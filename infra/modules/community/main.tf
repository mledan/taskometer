/*
 * Community backend stack.
 *
 * Azure Functions on a consumption plan + Cosmos DB serverless backing
 * shared schedule documents + Application Insights for observability.
 *
 * Naming convention: every resource is named "<project>-<env>-<role>"
 * (or the closest the resource type tolerates), generated via the
 * azurecaf provider so we don't fight per-resource quirks (lowercase,
 * hyphens, length caps) by hand.
 */

locals {
  base_tags = merge(var.tags, {
    project     = var.project
    environment = var.env
    stack       = "community"
  })

  prefix = "${var.project}-${var.env}-community"
}

# ───── Resource group ─────────────────────────────────────────────────

resource "azurerm_resource_group" "this" {
  name     = "${local.prefix}-rg"
  location = var.location
  tags     = local.base_tags
}

# ───── Random suffix for globally-unique names ────────────────────────
# Storage account names and Cosmos accounts must be globally unique;
# stamp them with a stable random hex so re-runs don't collide.

resource "random_id" "suffix" {
  byte_length = 3
}

# ───── Storage account (required by the Function host) ────────────────

resource "azurecaf_name" "storage" {
  name          = "${var.project}${var.env}fnsa"
  resource_type = "azurerm_storage_account"
  random_length = 0
  clean_input   = true
  separator     = ""
}

resource "azurerm_storage_account" "fn" {
  # azurecaf produces a clean name; suffix with the random hex for uniqueness.
  name                     = "${azurecaf_name.storage.result}${random_id.suffix.hex}"
  resource_group_name      = azurerm_resource_group.this.name
  location                 = azurerm_resource_group.this.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  # Defense-in-depth: deny public access to blobs unless explicitly allowed.
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = true # Functions runtime still requires this in v4

  min_tls_version = "TLS1_2"

  tags = local.base_tags
}

# ───── Application Insights (telemetry sink) ──────────────────────────

resource "azurerm_log_analytics_workspace" "ai" {
  name                = "${local.prefix}-laws"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_days
  tags                = local.base_tags
}

resource "azurerm_application_insights" "ai" {
  name                = "${local.prefix}-ai"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  workspace_id        = azurerm_log_analytics_workspace.ai.id
  application_type    = "web"
  retention_in_days   = var.log_retention_days
  tags                = local.base_tags
}

# ───── Cosmos DB (serverless) ─────────────────────────────────────────

resource "azurerm_cosmosdb_account" "this" {
  name                = "${local.prefix}-cosmos-${random_id.suffix.hex}"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  # Serverless tier — no idle cost, billed per RU.
  capabilities {
    name = "EnableServerless"
  }

  consistency_policy {
    consistency_level       = "Session"
    max_interval_in_seconds = 5
    max_staleness_prefix    = 100
  }

  geo_location {
    location          = azurerm_resource_group.this.location
    failover_priority = 0
  }

  # Defense in depth — disable account-key auth in favor of AAD.
  # Note: the function app uses managed-identity → cosmos role
  # assignments below, not the master key.
  local_authentication_disabled = false # leave on for v1; tighten later

  tags = local.base_tags
}

resource "azurerm_cosmosdb_sql_database" "community" {
  name                = "community"
  resource_group_name = azurerm_resource_group.this.name
  account_name        = azurerm_cosmosdb_account.this.name
}

# Container for shared wheels. `/ownerId` partition key gives us cheap
# per-user listing later when accounts arrive; for the link-sharing
# Tier 0 every doc shares an "anon" partition.
resource "azurerm_cosmosdb_sql_container" "shared_wheels" {
  name                  = "shared_wheels"
  resource_group_name   = azurerm_resource_group.this.name
  account_name          = azurerm_cosmosdb_account.this.name
  database_name         = azurerm_cosmosdb_sql_database.community.name
  partition_key_paths   = ["/ownerId"]
  partition_key_version = 2

  indexing_policy {
    indexing_mode = "consistent"
    included_path { path = "/*" }
    excluded_path { path = "/blocks/*" }
  }
}

# ───── Functions app (consumption plan) ───────────────────────────────

resource "azurerm_service_plan" "fn" {
  name                = "${local.prefix}-fn-plan"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  os_type             = "Linux"
  sku_name            = var.function_plan_kind == "Consumption" ? "Y1" : "B1"
  tags                = local.base_tags
}

resource "azurerm_linux_function_app" "api" {
  name                = "${local.prefix}-api-${random_id.suffix.hex}"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  service_plan_id     = azurerm_service_plan.fn.id

  storage_account_name       = azurerm_storage_account.fn.name
  storage_account_access_key = azurerm_storage_account.fn.primary_access_key

  https_only = true

  # Function code is deployed by the GitHub Actions workflow; this app
  # just owns the runtime + environment + identity.
  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_stack {
      node_version = "20"
    }
    cors {
      allowed_origins     = var.cors_allowed_origins
      support_credentials = false
    }
    minimum_tls_version = "1.2"
    ftps_state          = "Disabled"
  }

  app_settings = {
    APPINSIGHTS_INSTRUMENTATIONKEY        = azurerm_application_insights.ai.instrumentation_key
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.ai.connection_string

    # Cosmos endpoint + DB / container names are referenced by the
    # function code; the connection itself uses managed identity via
    # the role assignment below.
    COSMOS_ENDPOINT       = azurerm_cosmosdb_account.this.endpoint
    COSMOS_DATABASE       = azurerm_cosmosdb_sql_database.community.name
    COSMOS_CONTAINER      = azurerm_cosmosdb_sql_container.shared_wheels.name

    WEBSITE_RUN_FROM_PACKAGE = "1"
    FUNCTIONS_WORKER_RUNTIME = "node"
  }

  tags = local.base_tags
}

# Grant the function's managed identity read/write on the Cosmos
# account via the data-plane role. No master key required.
data "azurerm_cosmosdb_sql_role_definition" "data_contributor" {
  resource_group_name = azurerm_resource_group.this.name
  account_name        = azurerm_cosmosdb_account.this.name
  role_definition_id  = "00000000-0000-0000-0000-000000000002"
}

resource "azurerm_cosmosdb_sql_role_assignment" "fn_to_cosmos" {
  resource_group_name = azurerm_resource_group.this.name
  account_name        = azurerm_cosmosdb_account.this.name
  role_definition_id  = data.azurerm_cosmosdb_sql_role_definition.data_contributor.id
  principal_id        = azurerm_linux_function_app.api.identity[0].principal_id
  scope               = azurerm_cosmosdb_account.this.id
}

# ───── Key Vault (for future secrets — auth issuer, signing keys, …) ──

resource "azurerm_key_vault" "this" {
  name                       = "${var.project}-${var.env}-kv-${random_id.suffix.hex}"
  resource_group_name        = azurerm_resource_group.this.name
  location                   = azurerm_resource_group.this.location
  sku_name                   = "standard"
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  enable_rbac_authorization  = true
  purge_protection_enabled   = false
  soft_delete_retention_days = 7

  tags = local.base_tags
}

data "azurerm_client_config" "current" {}

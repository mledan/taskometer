# Root Terragrunt configuration.
#
# Every leaf stack inherits this file via `find_in_parent_folders()`.
# It centralizes:
#   - the Azure provider boilerplate (so individual modules don't repeat it)
#   - the remote state backend (an Azure Storage Account)
#   - common locals derived from the env.hcl one level up
#
# Environment-specific values (subscription id, region, etc.) live in
# envs/<env>/env.hcl so we never commit a real subscription id here.

locals {
  env_vars     = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  env          = local.env_vars.locals.env
  location     = local.env_vars.locals.location
  state_rg     = local.env_vars.locals.state_resource_group
  state_sa     = local.env_vars.locals.state_storage_account
  state_ctr    = local.env_vars.locals.state_container
  project      = "taskometer"
}

# Remote state — one Azure Storage container per environment. Backend
# infra is bootstrapped manually (see infra/bootstrap/backend) so this
# config can assume the storage account exists.
remote_state {
  backend = "azurerm"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    resource_group_name  = local.state_rg
    storage_account_name = local.state_sa
    container_name       = local.state_ctr
    key                  = "${path_relative_to_include()}/terraform.tfstate"
    use_azuread_auth     = true
  }
}

# Shared azurerm provider config. Subscription id comes from the
# TF_VAR_subscription_id env var or is set per-env in env.hcl. Never
# committed to git.
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<-EOT
    terraform {
      required_version = ">= 1.6.0"
      required_providers {
        azurerm = {
          source  = "hashicorp/azurerm"
          version = "~> 4.0"
        }
        azurecaf = {
          source  = "aztfmod/azurecaf"
          version = "~> 1.2"
        }
      }
    }

    provider "azurerm" {
      features {
        key_vault {
          purge_soft_delete_on_destroy = false
        }
        resource_group {
          prevent_deletion_if_contains_resources = true
        }
      }
      subscription_id = var.subscription_id
    }

    variable "subscription_id" {
      type        = string
      description = "Azure subscription id. Set via TF_VAR_subscription_id."
    }
  EOT
}

# Inputs available to every leaf module.
inputs = {
  project  = local.project
  env      = local.env
  location = local.location
  tags = {
    project     = local.project
    environment = local.env
    managed_by  = "terragrunt"
  }
}

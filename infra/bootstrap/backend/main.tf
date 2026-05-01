/*
 * Bootstrap stack — creates the Azure Storage Account that backs
 * Terragrunt's remote state for every other stack.
 *
 * This is the ONE thing that can't itself live in remote state. Run
 * it once per environment with local state, then commit nothing back
 * (the state file stays on the operator's machine and is destroyed).
 *
 * Usage:
 *   cd infra/bootstrap/backend
 *   terraform init
 *   TF_VAR_subscription_id=<sub> TF_VAR_env=dev terraform apply
 *
 * After this runs, every leaf stack inherits the storage account from
 * its env.hcl and the regular `terragrunt run-all apply` flow takes
 * over.
 */

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
  # Local state intentional — see header.
  backend "local" {}
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

variable "subscription_id" {
  type        = string
  description = "Azure subscription id. Set via TF_VAR_subscription_id."
}

variable "env" {
  type        = string
  description = "Environment name (dev, prod, …). Drives resource names."
  validation {
    condition     = contains(["dev", "staging", "prod"], var.env)
    error_message = "env must be dev, staging, or prod."
  }
}

variable "location" {
  type    = string
  default = "eastus"
}

locals {
  rg_name = "taskometer-tfstate-${var.env}"
  sa_name = "tasktfstate${var.env}"
  ctr     = "tfstate"
}

resource "azurerm_resource_group" "tfstate" {
  name     = local.rg_name
  location = var.location
  tags = {
    project     = "taskometer"
    environment = var.env
    purpose     = "tfstate"
  }
}

resource "azurerm_storage_account" "tfstate" {
  name                     = local.sa_name
  resource_group_name      = azurerm_resource_group.tfstate.name
  location                 = azurerm_resource_group.tfstate.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  blob_properties {
    versioning_enabled = true # state history insurance
  }

  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
}

resource "azurerm_storage_container" "tfstate" {
  name                  = local.ctr
  storage_account_id    = azurerm_storage_account.tfstate.id
  container_access_type = "private"
}

output "resource_group_name" {
  value = azurerm_resource_group.tfstate.name
}

output "storage_account_name" {
  value = azurerm_storage_account.tfstate.name
}

output "container_name" {
  value = azurerm_storage_container.tfstate.name
}

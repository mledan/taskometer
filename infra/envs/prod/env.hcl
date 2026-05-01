# Prod-environment locals. Same shape as dev, different scope.

locals {
  env                   = "prod"
  location              = "eastus"
  state_resource_group  = "taskometer-tfstate-prod"
  state_storage_account = "tasktfstateprod"
  state_container       = "tfstate"
}

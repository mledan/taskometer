# Dev-environment locals. The subscription id is intentionally NOT
# committed — set TF_VAR_subscription_id in your shell or in the CI
# secret store before running terragrunt.
#
# State backend storage values must match what the bootstrap stack
# created (see infra/bootstrap/backend). One storage account per
# environment isolates blast radius.

locals {
  env                   = "dev"
  location              = "eastus"
  state_resource_group  = "taskometer-tfstate-dev"
  state_storage_account = "tasktfstatedev"
  state_container       = "tfstate"
}

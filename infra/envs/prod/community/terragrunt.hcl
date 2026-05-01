# Prod community stack — same shape as dev, longer retention.

include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../modules/community"
}

inputs = {
  cosmos_capacity_mode = "Serverless"
  function_plan_kind   = "Consumption"

  cors_allowed_origins = [
    "https://taskometer.vercel.app",
    "https://taskometer.app", # placeholder — wire up once the apex DNS exists
  ]

  log_retention_days = 90
}

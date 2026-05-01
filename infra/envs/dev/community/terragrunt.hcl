# Dev community stack — Functions API + Cosmos serverless + telemetry.

include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../modules/community"
}

inputs = {
  # Cosmos: serverless tier so you pay per RU (~$0 idle).
  cosmos_capacity_mode = "Serverless"

  # Functions: consumption plan so you pay per execution.
  function_plan_kind   = "Consumption"

  # CORS for the SPA hosted on Vercel + local dev.
  cors_allowed_origins = [
    "https://taskometer.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
  ]

  # Cap log retention so dev doesn't quietly accumulate cost.
  log_retention_days = 30
}

variable "project" {
  type        = string
  description = "Short name for the project; used as a tag and in resource naming."
  default     = "taskometer"
}

variable "env" {
  type        = string
  description = "Environment name — dev / staging / prod."
}

variable "location" {
  type        = string
  description = "Azure region. Resources are co-located here."
}

variable "tags" {
  type        = map(string)
  description = "Common tags applied to every resource."
  default     = {}
}

variable "cosmos_capacity_mode" {
  type        = string
  description = "Cosmos DB capacity mode. Serverless = pay-per-RU, no idle cost."
  default     = "Serverless"
  validation {
    condition     = contains(["Serverless", "Provisioned"], var.cosmos_capacity_mode)
    error_message = "cosmos_capacity_mode must be Serverless or Provisioned."
  }
}

variable "function_plan_kind" {
  type        = string
  description = "Function App service plan kind. Consumption = pay-per-execution."
  default     = "Consumption"
}

variable "cors_allowed_origins" {
  type        = list(string)
  description = "Origins permitted to call the Functions API. Locked-down to known SPA hosts."
  default     = []
}

variable "log_retention_days" {
  type        = number
  description = "Application Insights retention window. Lower in dev to bound cost."
  default     = 30
}

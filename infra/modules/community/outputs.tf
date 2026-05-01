output "resource_group_name" {
  value       = azurerm_resource_group.this.name
  description = "RG holding the community stack."
}

output "function_app_name" {
  value       = azurerm_linux_function_app.api.name
  description = "Function App that hosts the community API. The GitHub Actions deploy workflow targets this name."
}

output "function_app_default_hostname" {
  value       = azurerm_linux_function_app.api.default_hostname
  description = "Default *.azurewebsites.net host. Wire CORS at the SPA against this until a custom domain is provisioned."
}

output "cosmos_endpoint" {
  value       = azurerm_cosmosdb_account.this.endpoint
  description = "Cosmos DB endpoint. Function code reads this from the COSMOS_ENDPOINT app setting."
}

output "application_insights_connection_string" {
  value       = azurerm_application_insights.ai.connection_string
  description = "App Insights connection string. Used by the function runtime."
  sensitive   = true
}

output "key_vault_uri" {
  value       = azurerm_key_vault.this.vault_uri
  description = "Vault URI for future secrets (auth issuer, signing keys)."
}

output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "static_web_app_url" {
  value = azurerm_static_web_app.frontend.default_host_name
}

output "swa_api_key_vault_ref" {
  description = "Key Vault secret ID for SWA deployment key"
  value       = azurerm_key_vault_secret.swa_api_key.id
}

output "container_app_fqdn" {
  value = azurerm_container_app.backend.ingress[0].fqdn
}

output "container_app_environment_id" {
  value = azurerm_container_app_environment.main.id
}

output "key_vault_uri" {
  value = azurerm_key_vault.main.vault_uri
}

output "app_insights_connection_string" {
  value     = azurerm_application_insights.main.connection_string
  sensitive = true
}

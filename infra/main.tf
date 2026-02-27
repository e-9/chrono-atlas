terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "stchronoatlastfstate"
    container_name       = "tfstate"
    key                  = "chrono-atlas.tfstate"
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

# ---------- Locals ----------

locals {
  common_tags = {
    Project     = var.project
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# ---------- Resource Group ----------

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.common_tags
}

# ---------- Log Analytics (required by App Insights & Container Apps) ----------

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.project}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.common_tags
}

# ---------- Application Insights ----------

resource "azurerm_application_insights" "main" {
  name                = "${var.project}-insights"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
  tags                = local.common_tags
}

# ---------- Key Vault ----------

data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  name                       = "${var.project}-kv"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 90
  purge_protection_enabled   = true
  rbac_authorization_enabled = true
  tags                       = local.common_tags
}

# Deployer gets full secret management
resource "azurerm_role_assignment" "deployer_kv" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = data.azurerm_client_config.current.object_id
}

# Store secrets in Key Vault
resource "azurerm_key_vault_secret" "appinsights_cs" {
  name         = "appinsights-connection-string"
  value        = azurerm_application_insights.main.connection_string
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_role_assignment.deployer_kv]
}

resource "azurerm_key_vault_secret" "swa_api_key" {
  name         = "swa-api-key"
  value        = azurerm_static_web_app.frontend.api_key
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_role_assignment.deployer_kv]
}

# ---------- Diagnostic Settings ----------

resource "azurerm_monitor_diagnostic_setting" "keyvault" {
  name                       = "kv-diagnostics"
  target_resource_id         = azurerm_key_vault.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "AuditEvent"
  }

  enabled_metric {
    category = "AllMetrics"
  }
}

# ---------- Container Registry ----------

resource "azurerm_container_registry" "main" {
  name                = "${var.project}cr"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = false
  tags                = local.common_tags
}

# Container App Managed Identity → ACR pull (no passwords needed)
resource "azurerm_role_assignment" "backend_acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_container_app.backend.identity[0].principal_id
}

# ---------- Container Apps Environment ----------

resource "azurerm_container_app_environment" "main" {
  name                       = "${var.project}-env"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = local.common_tags
  # internal_load_balancer_enabled requires a VNet + subnet — add in Phase 7b
}

# ---------- Container App (Backend API) ----------

resource "azurerm_container_app" "backend" {
  name                         = "${var.project}-api"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"
  tags                         = local.common_tags

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = "System"
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = "backend"
      image  = var.container_image
      cpu    = var.container_cpu
      memory = var.container_memory

      env {
        name        = "APPLICATIONINSIGHTS_CONNECTION_STRING"
        secret_name = "appinsights-cs"
      }

      env {
        name  = "ENVIRONMENT"
        value = "production"
      }

      env {
        name  = "CORS_ORIGINS"
        value = "https://gentle-field-09bba720f.1.azurestaticapps.net"
      }

      startup_probe {
        transport               = "HTTP"
        path                    = "/health"
        port                    = 8000
        initial_delay           = 5
        interval_seconds        = 10
        failure_count_threshold = 30
      }

      liveness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 8000
      }

      readiness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 8000
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8000
    transport        = "http"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  secret {
    name                = "appinsights-cs"
    key_vault_secret_id = azurerm_key_vault_secret.appinsights_cs.id
    identity            = "System"
  }

  identity {
    type = "SystemAssigned"
  }
}

# Container App Managed Identity → Key Vault (read-only)
resource "azurerm_role_assignment" "backend_kv" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_container_app.backend.identity[0].principal_id
}

# ---------- Static Web App (Frontend) ----------

resource "azurerm_static_web_app" "frontend" {
  name                = "${var.project}-web"
  resource_group_name = azurerm_resource_group.main.name
  location            = "eastus2" # SWA not available in eastus
  sku_tier            = "Free"
  sku_size            = "Free"
  tags                = local.common_tags
}

# SWA → Container Apps backend linking is configured via staticwebapp.config.json,
# not Terraform. The SWA config proxies /api/* to the Container App FQDN.

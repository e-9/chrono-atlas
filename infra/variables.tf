variable "subscription_id" {
  description = "Azure subscription ID (use TF_VAR_subscription_id or .tfvars)"
  type        = string
  sensitive   = true
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "eastus"
}

variable "resource_group_name" {
  description = "Name of the Azure resource group"
  type        = string
  default     = "rg-chrono-atlas"
}

variable "project" {
  description = "Project name used as prefix for resource names"
  type        = string
  default     = "chronoatlas"
}

variable "container_image" {
  description = "Full container image reference for the backend (must use versioned tag)"
  type        = string
  default     = "chronoatlascr.azurecr.io/chrono-atlas-backend:v1.0.0"

  validation {
    condition     = !endswith(var.container_image, ":latest")
    error_message = "Container image must use a specific version tag, not :latest."
  }
}

variable "container_cpu" {
  description = "CPU cores for the backend container"
  type        = number
  default     = 0.25

  validation {
    condition     = contains([0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0], var.container_cpu)
    error_message = "CPU must be a valid Container Apps allocation: 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, or 2.0."
  }
}

variable "container_memory" {
  description = "Memory (Gi) for the backend container"
  type        = string
  default     = "0.5Gi"

  validation {
    condition     = can(regex("^[0-9]+(\\.[0-9]+)?Gi$", var.container_memory))
    error_message = "Memory must be in format like 0.5Gi, 1Gi, etc."
  }
}

variable "min_replicas" {
  description = "Minimum number of backend replicas (1 keeps cache warm)"
  type        = number
  default     = 1

  validation {
    condition     = var.min_replicas >= 0 && var.min_replicas <= 5
    error_message = "min_replicas must be between 0 and 5."
  }
}

variable "max_replicas" {
  description = "Maximum number of backend replicas"
  type        = number
  default     = 3

  validation {
    condition     = var.max_replicas >= 1 && var.max_replicas <= 10
    error_message = "max_replicas must be between 1 and 10."
  }
}

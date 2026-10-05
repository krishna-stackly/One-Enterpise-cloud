############################################
# General
############################################

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "common_tags" {
  description = "Common resource tags"
  type        = map(string)
  default     = {}
}


############################################
# VPC
############################################

variable "vpc_id" {
  description = "Existing shared VPC ID"
  type        = string
}


############################################
# Database DNS
############################################

variable "database_private_ip" {
  description = "Private IP of persistent shared DB EC2"
  type        = string
}

variable "database_dns_name" {
  description = "Internal database hostname"
  type        = string
  default     = "mysql.internal"
}


############################################
# Application DNS
############################################

variable "application_private_ip" {
  description = "Private IP of the current application EC2"
  type        = string
}

variable "application_dns_name" {
  description = "Internal application hostname"
  type        = string
  default     = "app.internal"
}


############################################
# Route53
############################################

variable "private_zone_name" {
  description = "Private hosted zone name"
  type        = string
  default     = "internal"
}
############################################
# AWS
############################################

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}


############################################
# Project
############################################

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment"
  type        = string
}


############################################
# DNS
############################################

variable "private_zone_name" {
  description = "Private hosted zone name"
  type        = string
  default     = "internal"
}

variable "database_dns_name" {
  description = "Internal database hostname"
  type        = string
  default     = "mysql.internal"
}

variable "application_dns_name" {
  description = "Internal application hostname"
  type        = string
  default     = "app.internal"
}


############################################
# Tags
############################################

variable "common_tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
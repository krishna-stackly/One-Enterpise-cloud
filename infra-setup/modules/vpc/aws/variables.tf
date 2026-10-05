############################################
# Project
############################################

variable "project_name" {
  description = "Project/platform name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}


############################################
# VPC
############################################

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
}


############################################
# Availability Zones
############################################

variable "availability_zones" {
  description = "Availability Zones used by the VPC"
  type        = list(string)
}


############################################
# Subnets
############################################

variable "public_subnets" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
}

variable "private_subnets" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
}


############################################
# NAT Gateway
############################################

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use one shared NAT Gateway"
  type        = bool
  default     = true
}


############################################
# DNS
############################################

variable "enable_dns_support" {
  description = "Enable DNS resolution inside VPC"
  type        = bool
  default     = true
}

variable "enable_dns_hostnames" {
  description = "Enable DNS hostnames inside VPC"
  type        = bool
  default     = true
}


############################################
# Flow Logs
############################################

variable "enable_flow_log" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = false
}


############################################
# Tags
############################################

variable "common_tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}

variable "public_subnet_tags" {
  description = "Additional tags for public subnets"
  type        = map(string)
  default     = {}
}

variable "private_subnet_tags" {
  description = "Additional tags for private subnets"
  type        = map(string)
  default     = {}
}
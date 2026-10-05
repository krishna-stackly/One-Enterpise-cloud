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
  description = "CIDR block for VPC"
  type        = string
}


############################################
# Availability Zones
############################################

variable "availability_zones" {
  description = "Availability Zones"
  type        = list(string)
}


############################################
# Subnets
############################################

variable "public_subnets" {
  description = "Public subnet CIDRs"
  type        = list(string)
}

variable "private_subnets" {
  description = "Private subnet CIDRs"
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
  description = "Use one NAT Gateway"
  type        = bool
  default     = true
}


############################################
# DNS
############################################

variable "enable_dns_support" {
  description = "Enable VPC DNS support"
  type        = bool
  default     = true
}

variable "enable_dns_hostnames" {
  description = "Enable VPC DNS hostnames"
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
  description = "Additional public subnet tags"
  type        = map(string)
  default     = {}
}

variable "private_subnet_tags" {
  description = "Additional private subnet tags"
  type        = map(string)
  default     = {}
}
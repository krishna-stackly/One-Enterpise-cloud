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

variable "poc_name" {
  description = "Person who created the infrastructure"
  type        = string
  default     = "ERP"
}


############################################
# EC2
############################################

variable "ami_id" {
  description = "Database AMI ID"
  type        = string
}

variable "db_instance_type" {
  description = "Database instance type"
  type        = string
  default     = "t3.large"
}


############################################
# Networking
############################################

variable "db_subnet_index" {
  description = "Index into the private subnet list where the DB should live"
  type        = number
  default     = 1
}


############################################
# Storage
############################################

variable "db_root_volume_size" {
  description = "Root volume size (GB)"
  type        = number
  default     = 30
}

variable "db_data_volume_size" {
  description = "Data volume size (GB)"
  type        = number
  default     = 100
}


############################################
# Tags
############################################

variable "common_tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
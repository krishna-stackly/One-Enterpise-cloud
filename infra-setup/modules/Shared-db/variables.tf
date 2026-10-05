############################################
# General
############################################

variable "name" {
  description = "Database EC2 name"
  type        = string
}

variable "project_name" {
  description = "Project name used for tagging and SSM paths"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "poc_name" {
  description = "Person or owner who created the resource"
  type        = string
  default     = "ERP"
}


############################################
# EC2
############################################

variable "ami_id" {
  description = "Database EC2 AMI"
  type        = string
}

variable "instance_type" {
  description = "Database instance type"
  type        = string
  default     = "t3.large"
}


############################################
# Networking
############################################

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_id" {
  description = "Private subnet for database"
  type        = string
}


############################################
# Storage
############################################

variable "root_volume_size" {
  description = "OS/root EBS size"
  type        = number
  default     = 30
}

variable "data_volume_size" {
  description = "Persistent database data volume size"
  type        = number
  default     = 100
}

variable "data_device_name" {
  description = "EBS device name"
  type        = string
  default     = "/dev/sdf"
}


############################################
# Tags
############################################

variable "common_tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
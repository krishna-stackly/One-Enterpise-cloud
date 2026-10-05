############################################
# General
############################################

variable "name" {
  description = "EC2 instance name"
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
}


############################################
# EC2
############################################

variable "ami_id" {
  description = "AMI ID"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
}


############################################
# Networking
############################################

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID"
  type        = string
}

variable "security_group_ids" {
  description = "Additional security groups to attach to EC2"
  type        = list(string)
  default     = []
}

variable "associate_public_ip_address" {
  description = "Associate public IPv4 address"
  type        = bool
  default     = false
}


############################################
# Application Security Group
############################################

variable "http_ingress_cidr" {
  description = "CIDR allowed to access HTTP"
  type        = string
  default     = "0.0.0.0/0"
}

variable "enable_http" {
  description = "Allow HTTP port 80"
  type        = bool
  default     = true
}

variable "enable_https" {
  description = "Allow HTTPS port 443"
  type        = bool
  default     = false
}

variable "https_ingress_cidr" {
  description = "CIDR allowed to access HTTPS"
  type        = string
  default     = "0.0.0.0/0"
}


############################################
# IAM
############################################

variable "iam_instance_profile" {
  description = "IAM instance profile attached to EC2"
  type        = string
  default     = null
}


############################################
# Storage
############################################

variable "root_volume_size" {
  description = "Root volume size in GB"
  type        = number
  default     = 50
}

variable "root_volume_type" {
  description = "Root volume type"
  type        = string
  default     = "gp3"
}


############################################
# User Data
############################################

variable "user_data" {
  description = "EC2 bootstrap script"
  type        = string
  default     = null
}

variable "user_data_replace_on_change" {
  description = "Replace EC2 when user_data changes"
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

variable "additional_tags" {
  description = "Additional EC2-specific tags"
  type        = map(string)
  default     = {}
}
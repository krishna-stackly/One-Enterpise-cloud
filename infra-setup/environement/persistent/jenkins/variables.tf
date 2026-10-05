############################################
# AWS
############################################

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

############################################
# Project
############################################

variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

############################################
# EC2
############################################

variable "ami_id" {
  type = string
}

variable "controller_instance_type" {

  type = string

  default = "t3.micro"
}

variable "agent_instance_type" {

  type = string

  default = "t3.micro"
}

############################################
# Storage
############################################

variable "controller_volume_size" {

  type = number

  default = 50
}

variable "agent_volume_size" {

  type = number

  default = 80
}

############################################
# Networking
############################################

variable "jenkins_subnet_index" {
  description = "Index into the public_subnet_ids list to place the Jenkins controller in"
  type        = number
  default     = 0
}

variable "agent_subnet_index" {
  description = "Index into the public_subnet_ids list to place the Jenkins agent in"
  type        = number
  default     = 0
}

############################################
# SSH / Access
############################################

variable "key_name" {
  description = "Existing EC2 key pair name for SSH access to both instances"
  type        = string
}

variable "admin_ssh_cidr" {
  description = "CIDR blocks allowed to SSH into the instances and reach the Jenkins UI (port 8080)"
  type        = list(string)
}

############################################
# Route53 (public zone)
############################################

variable "public_zone_id" {
  description = "Existing public Route53 Hosted Zone ID"
  type        = string
}

variable "domain_name" {
  description = "Root domain name of the public hosted zone"
  type        = string
}

############################################
# Tags
############################################

variable "common_tags" {

  type = map(string)

  default = {}

}
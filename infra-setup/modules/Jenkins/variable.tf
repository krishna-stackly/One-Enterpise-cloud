############################################
# General
############################################

variable "name" {
  description = "Resource naming prefix"
  type        = string
}

variable "common_tags" {
  description = "Common tags applied to every resource"
  type        = map(string)

  default = {}
}

############################################
# Networking
############################################

variable "vpc_id" {
  description = "Existing VPC ID"
  type        = string
}

variable "jenkins_subnet_id" {
  description = "Public subnet for Jenkins controller"
  type        = string
}

variable "agent_subnet_id" {
  description = "Public subnet for Jenkins agent"
  type        = string
}

############################################
# SSH / Access
############################################

variable "key_name" {
  description = "Existing EC2 key pair name used for SSH access to both the controller and the agent"
  type        = string
}

variable "admin_ssh_cidr" {
  description = "CIDR blocks allowed to SSH directly into the Jenkins controller and agent, and to reach the Jenkins UI (port 8080) on the controller"
  type        = list(string)
}

############################################
# Route53 (public zone)
############################################

variable "public_zone_id" {
  description = "Existing public Route53 Hosted Zone ID to create Jenkins DNS records in"
  type        = string
}

variable "domain_name" {
  description = "Root domain name for the public hosted zone (e.g. kriiishamtic.fun)"
  type        = string
}

############################################
# EC2
############################################

variable "ami_id" {
  description = "AMI ID"

  type = string
}

variable "jenkins_instance_type" {

  description = "Jenkins controller instance type"

  type = string

  default = "t3.medium"
}

variable "agent_instance_type" {

  description = "Jenkins build agent instance type"

  type = string

  default = "t3.large"
}

############################################
# Storage
############################################

variable "jenkins_volume_size" {

  description = "Root volume size for Jenkins"

  type = number

  default = 50
}

variable "agent_volume_size" {

  description = "Root volume size for Jenkins Agent"

  type = number

  default = 80
}
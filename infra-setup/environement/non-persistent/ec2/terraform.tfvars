############################################
# AWS
############################################

aws_region = "us-east-1"


############################################
# Project
############################################

project_name = "erp"
environment  = "dev"
poc_name     = "Krishna"
name         = "erp-dev-app"


############################################
# EC2
############################################

ami_id        = "ami-0220d79f3f480ecf5" # replace with your actual AMI ID
instance_type = "t3.micro"


############################################
# Networking
############################################

associate_public_ip_address   = true
additional_security_group_ids = []


############################################
# IAM
############################################

iam_instance_profile = null


############################################
# Storage
############################################

root_volume_size = 50
root_volume_type = "gp3"


############################################
# Security
############################################

enable_http         = true
http_ingress_cidr   = "0.0.0.0/0"
enable_https        = false
https_ingress_cidr  = "0.0.0.0/0"


############################################
# Tags
############################################

common_tags = {
  Platform = "ERP-Dev"
  Owner    = "DevOps"
}

additional_tags = {}

user_data_replace_on_change = true
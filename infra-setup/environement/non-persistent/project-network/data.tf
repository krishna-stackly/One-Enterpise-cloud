############################################
# VPC ID from SSM
############################################

data "aws_ssm_parameter" "vpc_id" {
  name = "/${var.project_name}/${var.environment}/network/vpc_id"
}


############################################
# App Private IP from SSM
# (published by app-ec2 - see ssm.tf addition above)
############################################

data "aws_ssm_parameter" "app_private_ip" {
  name = "/${var.project_name}/${var.environment}/app/private-ip"
}


############################################
# DB Private IP from SSM
# (published by Shared-db)
############################################

data "aws_ssm_parameter" "db_private_ip" {
  name = "/${var.project_name}/${var.environment}/db/private-ip"
}


############################################
# App Security Group ID from SSM
# (published by app-ec2 - non-persistent, must run before this stack)
############################################

data "aws_ssm_parameter" "app_security_group_id" {
  name = "/${var.project_name}/${var.environment}/app/sg-id"
}


############################################
# DB Security Group ID from SSM
# (published by Shared-db - persistent, always exists by the time
# this non-persistent stack runs)
############################################

data "aws_ssm_parameter" "db_security_group_id" {
  name = "/${var.project_name}/${var.environment}/database/sg-id"
}


############################################
# Locals
############################################

locals {
  vpc_id          = data.aws_ssm_parameter.vpc_id.value
  app_private_ip  = data.aws_ssm_parameter.app_private_ip.value
  db_private_ip   = data.aws_ssm_parameter.db_private_ip.value

  app_security_group_id = data.aws_ssm_parameter.app_security_group_id.value
  db_security_group_id  = data.aws_ssm_parameter.db_security_group_id.value
}



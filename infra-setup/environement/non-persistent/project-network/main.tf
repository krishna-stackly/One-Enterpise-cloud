module "project_network" {
  source = "git::https://github.com/krishna-stackly/ERP-Terraform.git//modules/project-network?ref=main"
  # once you cut a release tag, switch to: ?ref=project-network-v1.0.0

  ############################################
  # General
  ############################################
  project_name = var.project_name
  environment  = var.environment
  common_tags  = var.common_tags

  ############################################
  # VPC
  ############################################
  vpc_id = local.vpc_id

  ############################################
  # Database DNS
  ############################################
  database_private_ip = local.db_private_ip
  database_dns_name    = var.database_dns_name

  ############################################
  # Application DNS
  ############################################
  application_private_ip = local.app_private_ip
  application_dns_name   = var.application_dns_name

  ############################################
  # Route53
  ############################################
  private_zone_name = var.private_zone_name
}


############################################
# DB <- App Security Group Rule
#
# Owned entirely by this (non-persistent) stack. Points at the
# DB's own SG (created by the persistent shared-db stack) and the
# app's own SG (created by the non-persistent ec2 stack) via SSM,
# without either of those stacks ever referencing the other.
#
# Safe to destroy/recreate with this stack - it only removes the
# rule, never the underlying security groups.
############################################

resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = local.db_security_group_id
  referenced_security_group_id = local.app_security_group_id

  from_port   = 3306
  to_port     = 3306
  ip_protocol = "tcp"

  description = "MySQL access from application EC2"
}
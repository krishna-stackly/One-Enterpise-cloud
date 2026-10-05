module "vpc" {
  source = "git::https://github.com/krishna-stackly/ERP-Terraform.git//modules/vpc/aws?ref=main"
  # once you cut a release tag, switch to: ?ref=vpc-v1.0.0

  ############################################
  # Project
  ############################################
  project_name = var.project_name
  environment  = var.environment

  ############################################
  # VPC
  ############################################
  vpc_cidr = var.vpc_cidr

  ############################################
  # Availability Zones
  ############################################
  availability_zones = var.availability_zones

  ############################################
  # Subnets
  ############################################
  public_subnets  = var.public_subnets
  private_subnets = var.private_subnets

  ############################################
  # NAT Gateway
  ############################################
  enable_nat_gateway = var.enable_nat_gateway
  single_nat_gateway = var.single_nat_gateway

  ############################################
  # DNS
  ############################################
  enable_dns_support   = var.enable_dns_support
  enable_dns_hostnames = var.enable_dns_hostnames

  ############################################
  # Flow Logs
  ############################################
  enable_flow_log = var.enable_flow_log

  ############################################
  # Subnet Tags
  ############################################
  public_subnet_tags  = var.public_subnet_tags
  private_subnet_tags = var.private_subnet_tags

  ############################################
  # Common Tags
  ############################################
  common_tags = var.common_tags
}
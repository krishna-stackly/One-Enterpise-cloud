module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 6.0"

  name = local.name
  cidr = var.vpc_cidr

  azs = var.availability_zones

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
  # VPC Flow Logs
  ############################################
  enable_flow_log = var.enable_flow_log

  ############################################
  # Subnet Tags
  ############################################
  public_subnet_tags = merge(
    var.public_subnet_tags,
    {
      "kubernetes.io/role/elb" = "1"
    }
  )

  private_subnet_tags = merge(
    var.private_subnet_tags,
    {
      "kubernetes.io/role/internal-elb" = "1"
    }
  )

  ############################################
  # Common Tags
  ############################################
  tags = local.common_tags
}
############################################
# VPC
############################################

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "VPC CIDR block"
  value       = module.vpc.vpc_cidr_block
}


############################################
# Public Subnets
############################################

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnets
}


############################################
# Private Subnets
############################################

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnets
}


############################################
# NAT Gateway
############################################

output "nat_gateway_ids" {
  description = "NAT Gateway IDs"
  value       = module.vpc.natgw_ids
}


############################################
# SSM Parameter Names
############################################

output "vpc_id_ssm_parameter" {
  value = aws_ssm_parameter.vpc_id.name
}

output "public_subnet_ids_ssm_parameter" {
  value = aws_ssm_parameter.public_subnet_ids.name
}

output "private_subnet_ids_ssm_parameter" {
  value = aws_ssm_parameter.private_subnet_ids.name
}

output "vpc_cidr_block_ssm_parameter" {
  value = aws_ssm_parameter.vpc_cidr_block.name
}

output "nat_gateway_ids_ssm_parameter" {
  value = length(aws_ssm_parameter.nat_gateway_ids) > 0 ? aws_ssm_parameter.nat_gateway_ids[0].name : null
}

output "public_route_table_ids_ssm_parameter" {
  value = length(aws_ssm_parameter.public_route_table_ids) > 0 ? aws_ssm_parameter.public_route_table_ids[0].name : null
}

output "private_route_table_ids_ssm_parameter" {
  value = length(aws_ssm_parameter.private_route_table_ids) > 0 ? aws_ssm_parameter.private_route_table_ids[0].name : null
}

output "availability_zones_ssm_parameter" {
  value = aws_ssm_parameter.availability_zones.name
}
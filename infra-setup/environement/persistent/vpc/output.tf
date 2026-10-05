output "vpc_id" {
  value = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  value = module.vpc.vpc_cidr_block
}

output "public_subnet_ids" {
  value = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  value = module.vpc.private_subnet_ids
}

output "nat_gateway_ids" {
  value = module.vpc.nat_gateway_ids
}

output "vpc_id_ssm_parameter" {
  value = module.vpc.vpc_id_ssm_parameter
}

output "public_subnet_ids_ssm_parameter" {
  value = module.vpc.public_subnet_ids_ssm_parameter
}

output "private_subnet_ids_ssm_parameter" {
  value = module.vpc.private_subnet_ids_ssm_parameter
}
output "instance_id" {
  value = module.database.instance_id
}

output "private_ip" {
  value = module.database.private_ip
}

output "security_group_id" {
  value = module.database.security_group_id
}

output "data_volume_id" {
  value = module.database.data_volume_id
}

output "db_private_ip_ssm_parameter" {
  value = module.database.db_private_ip_ssm_parameter
}

output "db_security_group_ssm_parameter" {
  value = module.database.db_security_group_ssm_parameter
}
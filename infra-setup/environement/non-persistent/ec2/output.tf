output "instance_id" {
  value = module.app_ec2.instance_id
}

output "public_ip" {
  value = module.app_ec2.public_ip
}

output "private_ip" {
  value = module.app_ec2.private_ip
}

output "public_dns" {
  value = module.app_ec2.public_dns
}

output "security_group_id" {
  value = module.app_ec2.security_group_id
}

output "security_group_ssm_parameter" {
  value = module.app_ec2.security_group_ssm_parameter
}
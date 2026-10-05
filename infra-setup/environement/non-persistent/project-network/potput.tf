output "private_zone_id" {
  value = module.project_network.private_zone_id
}

output "database_dns_name" {
  value = module.project_network.database_dns_name
}

output "application_dns_name" {
  value = module.project_network.application_dns_name
}

output "db_ingress_from_app_rule_id" {
  value = aws_vpc_security_group_ingress_rule.db_from_app.id
}
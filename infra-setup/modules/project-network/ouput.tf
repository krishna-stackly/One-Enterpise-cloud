output "private_zone_id" {
  value = aws_route53_zone.internal.zone_id
}

output "database_dns_name" {
  value = aws_route53_record.database.fqdn
}

output "application_dns_name" {
  value = aws_route53_record.application.fqdn
}
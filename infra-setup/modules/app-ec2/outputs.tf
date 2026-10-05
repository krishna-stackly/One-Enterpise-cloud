############################################
# EC2 Instance ID
############################################

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.this.id
}


############################################
# Public IP
############################################

output "public_ip" {
  description = "EC2 public IPv4 address"
  value       = aws_instance.this.public_ip
}


############################################
# Private IP
############################################

output "private_ip" {
  description = "EC2 private IPv4 address"
  value       = aws_instance.this.private_ip
}


############################################
# Public DNS
############################################

output "public_dns" {
  description = "EC2 public DNS name"
  value       = aws_instance.this.public_dns
}


############################################
# Security Group ID
############################################

output "security_group_id" {
  description = "Application security group ID"
  value       = aws_security_group.app.id
}


############################################
# SSM Parameter
############################################

output "security_group_ssm_parameter" {
  description = "SSM parameter containing application security group ID"
  value       = aws_ssm_parameter.app_security_group_id.name
}

output "app_private_ip_ssm_parameter" {
  description = "SSM parameter containing application EC2 private IP"
  value       = aws_ssm_parameter.app_private_ip.name
}
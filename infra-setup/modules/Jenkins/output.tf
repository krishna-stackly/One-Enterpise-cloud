
############################################
# Jenkins Controller
############################################

output "jenkins_instance_id" {
  value = aws_instance.jenkins.id
}

output "jenkins_private_ip" {
  value = aws_instance.jenkins.private_ip
}

output "jenkins_public_ip" {
  value = aws_instance.jenkins.public_ip
}

output "jenkins_fqdn" {
  value = aws_route53_record.jenkins.fqdn
}

output "jenkins_sg_id" {
  value = aws_security_group.jenkins.id
}

############################################
# Jenkins Build Agent
############################################

output "agent_instance_id" {
  value = aws_instance.agent.id
}

output "agent_private_ip" {
  value = aws_instance.agent.private_ip
}

output "agent_public_ip" {
  value = aws_instance.agent.public_ip
}

output "agent_fqdn" {
  value = aws_route53_record.agent.fqdn
}

output "agent_sg_id" {
  value = aws_security_group.agent.id
}
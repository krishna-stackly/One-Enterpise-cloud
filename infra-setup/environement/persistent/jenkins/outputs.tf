output "jenkins_instance_id" {
  value = module.jenkins.jenkins_instance_id
}

output "jenkins_public_ip" {
  value = module.jenkins.jenkins_public_ip
}

output "jenkins_private_ip" {
  value = module.jenkins.jenkins_private_ip
}

output "jenkins_url" {
  value = "http://${module.jenkins.jenkins_fqdn}:8080"
}

output "agent_instance_id" {
  value = module.jenkins.agent_instance_id
}

output "agent_public_ip" {
  value = module.jenkins.agent_public_ip
}

output "agent_private_ip" {
  value = module.jenkins.agent_private_ip
}

output "agent_fqdn" {
  value = module.jenkins.agent_fqdn
}
############################################
# Route53 - Public DNS records
#
# Writes into your existing public hosted zone
# (zone_id passed in via var.public_zone_id).
# Terraform does NOT create/own the zone itself.
############################################

resource "aws_route53_record" "jenkins" {

  zone_id = var.public_zone_id

  name = "jenkins.${var.domain_name}"

  type = "A"

  ttl = 60

  records = [
    aws_instance.jenkins.public_ip
  ]
}

resource "aws_route53_record" "agent" {

  zone_id = var.public_zone_id

  name = "jenkins-agent.${var.domain_name}"

  type = "A"

  ttl = 60

  records = [
    aws_instance.agent.public_ip
  ]
}
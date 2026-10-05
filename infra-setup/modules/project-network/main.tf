############################################
# Route53 Private Hosted Zone
############################################

resource "aws_route53_zone" "internal" {
  name = var.private_zone_name

  vpc {
    vpc_id = var.vpc_id
  }

  tags = merge(
    var.common_tags,
    {
      Name        = var.private_zone_name
      Project     = var.project_name
      Environment = var.environment
    }
  )
}


############################################
# DB DNS
#
# mysql.internal -> Shared DB private IP
############################################

resource "aws_route53_record" "database" {
  zone_id = aws_route53_zone.internal.zone_id

  name = var.database_dns_name
  type = "A"
  ttl  = 60

  records = [
    var.database_private_ip
  ]
}


############################################
# Application DNS
#
# app.internal -> App EC2 private IP
# (changes whenever app-ec2 is recreated - re-apply this
#  stack after every app-ec2 replace)
############################################

resource "aws_route53_record" "application" {
  zone_id = aws_route53_zone.internal.zone_id

  name = var.application_dns_name
  type = "A"
  ttl  = 60

  records = [
    var.application_private_ip
  ]
}
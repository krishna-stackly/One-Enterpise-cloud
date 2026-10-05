############################################
# Application Security Group
############################################

resource "aws_security_group" "app" {

  name        = "${var.name}-sg"
  description = "Application security group for ${var.name}"

  vpc_id = var.vpc_id

  tags = merge(
    var.common_tags,
    var.additional_tags,
    {
      Name        = "${var.name}-sg"
      Project     = var.project_name
      Environment = var.environment
      State       = "non-persistent"
      Created_by  = var.poc_name
      Component   = "Application"
    }
  )
}


############################################
# HTTP - Port 80
############################################

resource "aws_vpc_security_group_ingress_rule" "http" {

  count = var.enable_http ? 1 : 0

  security_group_id = aws_security_group.app.id

  cidr_ipv4 = var.http_ingress_cidr

  from_port = 80
  to_port   = 80

  ip_protocol = "tcp"

  description = "HTTP access to application"
}


############################################
# HTTPS - Port 443
############################################

resource "aws_vpc_security_group_ingress_rule" "https" {

  count = var.enable_https ? 1 : 0

  security_group_id = aws_security_group.app.id

  cidr_ipv4 = var.https_ingress_cidr

  from_port = 443
  to_port   = 443

  ip_protocol = "tcp"

  description = "HTTPS access to application"
}


############################################
# Outbound
############################################

resource "aws_vpc_security_group_egress_rule" "all" {

  security_group_id = aws_security_group.app.id

  cidr_ipv4 = "0.0.0.0/0"

  ip_protocol = "-1"

  description = "Allow all outbound traffic"
}
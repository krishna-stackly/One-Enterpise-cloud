############################################
# AWS
############################################

aws_region = "us-east-1"


############################################
# Project
############################################

project_name = "erp"
environment  = "dev"


############################################
# DNS
############################################

private_zone_name    = "internal"
database_dns_name    = "mysql.internal"
application_dns_name = "app.internal"


############################################
# Tags
############################################

common_tags = {
  Platform = "ERP-Dev"
  Owner    = "DevOps"
}
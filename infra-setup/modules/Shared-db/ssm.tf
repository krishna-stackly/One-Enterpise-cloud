############################################
# Database Private IP -> SSM
############################################

resource "aws_ssm_parameter" "db_private_ip" {
  name        = "/${var.project_name}/${var.environment}/db/private-ip"
  description = "Shared database private IP for ${var.project_name}-${var.environment}"

  type  = "String"
  value = aws_instance.database.private_ip

  tags = merge(
    var.common_tags,
    {
      Project     = var.project_name
      Environment = var.environment
      Created_by  = var.poc_name
    }
  )
}


############################################
# Database Security Group ID -> SSM
############################################

resource "aws_ssm_parameter" "db_security_group_id" {
  name        = "/${var.project_name}/${var.environment}/database/sg-id"
  description = "Database security group ID for ${var.name}"
  type        = "String"

  value = aws_security_group.database.id

  tags = merge(
    var.common_tags,
    {
      Component = "Database"
    }
  )
}
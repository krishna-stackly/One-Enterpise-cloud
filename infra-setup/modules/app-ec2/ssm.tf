############################################
# Application Security Group ID -> SSM
############################################

resource "aws_ssm_parameter" "app_security_group_id" {
  name        = "/${var.project_name}/${var.environment}/app/sg-id"
  description = "Application security group ID for ${var.project_name}-${var.environment}"

  type  = "String"
  value = aws_security_group.app.id

  tags = merge(
    var.common_tags,
    var.additional_tags,
    {
      Project     = var.project_name
      Environment = var.environment
      State       = "non-persistent"
      Created_by  = var.poc_name
      Component   = "Application"
    }
  )
}

############################################
# Application Private IP -> SSM
############################################

resource "aws_ssm_parameter" "app_private_ip" {
  name        = "/${var.project_name}/${var.environment}/app/private-ip"
  description = "Application EC2 private IP for ${var.project_name}-${var.environment}"

  type  = "String"
  value = aws_instance.this.private_ip

  tags = merge(
    var.common_tags,
    var.additional_tags,
    {
      Project     = var.project_name
      Environment = var.environment
      State       = "non-persistent"
      Created_by  = var.poc_name
      Component   = "Application"
    }
  )
}

resource"aws_ssm_parameter" "app_public_ip" {
  name        = "/${var.project_name}/${var.environment}/app/public-ip"
  description = "Application EC2 public IP for ${var.project_name}-${var.environment}"

  type  = "String"
  value = aws_instance.this.public_ip

  tags = merge(
    var.common_tags,
    var.additional_tags,
    {
      Project     = var.project_name
      Environment = var.environment
      State       = "non-persistent"
      Created_by  = var.poc_name
      Component   = "Application"
    }
  )
}

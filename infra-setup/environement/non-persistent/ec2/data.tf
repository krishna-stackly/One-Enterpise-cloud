############################################
# VPC ID from SSM
############################################

data "aws_ssm_parameter" "vpc_id" {
  name = "/${var.project_name}/${var.environment}/network/vpc_id"
}


############################################
# Public Subnets from SSM
############################################

data "aws_ssm_parameter" "public_subnet_ids" {
  name = "/${var.project_name}/${var.environment}/network/public_subnet_ids"
}


############################################
# Private Subnets from SSM
############################################

data "aws_ssm_parameter" "private_subnet_ids" {
  name = "/${var.project_name}/${var.environment}/network/private_subnet_ids"
}


############################################
# Convert StringList values to lists
############################################

locals {
  vpc_id = data.aws_ssm_parameter.vpc_id.value

  public_subnet_ids = split(
    ",",
    data.aws_ssm_parameter.public_subnet_ids.value
  )

  private_subnet_ids = split(
    ",",
    data.aws_ssm_parameter.private_subnet_ids.value
  )
}
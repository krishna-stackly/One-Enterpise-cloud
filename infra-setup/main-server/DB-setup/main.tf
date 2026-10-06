terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket       = "oec-terraform-state"
    key          = "oec-java-suite/dev/rds/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = "ap-south-2"
}


############################################
# RDS - Read VPC information from SSM
############################################

data "aws_ssm_parameter" "vpc_id" {
  name = "/${var.project_name}/${var.environment}/network/vpc_id"
}

data "aws_ssm_parameter" "vpc_cidr_block" {
  name = "/${var.project_name}/${var.environment}/network/vpc_cidr_block"
}

data "aws_ssm_parameter" "private_subnet_ids" {
  name = "/${var.project_name}/${var.environment}/network/private_subnet_ids"
}


############################################
# RDS - Locals
############################################

locals {
  rds_private_subnet_ids = split(
    ",",
    data.aws_ssm_parameter.private_subnet_ids.value
  )
}


############################################
# RDS - Security Group
############################################

resource "aws_security_group" "rds" {
  name        = "${local.rds_name}-sg"
  description = "Security group for ${local.rds_name}"
  vpc_id      = data.aws_ssm_parameter.vpc_id.value

  tags = merge(
    local.common_tags,
    {
      Name = "${local.rds_name}-sg"
    }
  )
}


############################################
# RDS - PostgreSQL Ingress
#
# Allows PostgreSQL access from within
# the existing VPC.
#
# Later, when EKS is created, this can be
# tightened to allow only the EKS security
# group.
############################################

resource "aws_vpc_security_group_ingress_rule" "rds_postgres" {
  security_group_id = aws_security_group.rds.id

  cidr_ipv4   = data.aws_ssm_parameter.vpc_cidr_block.value
  from_port   = 5432
  to_port     = 5432
  ip_protocol = "tcp"

  description = "PostgreSQL access from VPC"
}


############################################
# RDS - Egress
############################################

resource "aws_vpc_security_group_egress_rule" "rds_all" {
  security_group_id = aws_security_group.rds.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"

  description = "Allow outbound traffic"
}


############################################
# RDS - DB Subnet Group
############################################

resource "aws_db_subnet_group" "postgres" {
  name = "${local.rds_name}-subnet-group"

  subnet_ids = local.rds_private_subnet_ids

  tags = merge(
    local.common_tags,
    {
      Name = "${local.rds_name}-subnet-group"
    }
  )
}


############################################
# RDS - PostgreSQL Instance
############################################

resource "aws_db_instance" "postgres" {
  identifier = local.rds_name

  ##########################################
  # Engine
  ##########################################

  engine         = "postgres"
  engine_version = "17"

  ##########################################
  # Instance
  ##########################################

  instance_class = "db.t4g.micro"

  ##########################################
  # Storage
  ##########################################

  allocated_storage = 20
  storage_type      = "gp3"

  ##########################################
  # Database
  ##########################################

  db_name  = "oecdb"
  username = "oec-admin"
  password = "oec_dev_123"
  port     = 5432

  ##########################################
  # Network
  ##########################################

  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  publicly_accessible = false

  ##########################################
  # Availability
  ##########################################

  multi_az = false

  ##########################################
  # Backup
  ##########################################

  backup_retention_period = 1
  backup_window            = "18:00-19:00"

  ##########################################
  # Maintenance
  ##########################################

  maintenance_window = "sun:19:00-sun:20:00"

  ##########################################
  # Encryption
  ##########################################

  storage_encrypted = true

  ##########################################
  # Monitoring
  ##########################################

  performance_insights_enabled = false
  monitoring_interval           = 0

  ##########################################
  # Dev Environment Settings
  ##########################################

  deletion_protection = false
  skip_final_snapshot = true

  ##########################################
  # Minor Version Updates
  ##########################################

  auto_minor_version_upgrade = true

  ##########################################
  # Terraform Lifecycle
  ##########################################

  lifecycle {
    ignore_changes = [
      password
    ]
  }

  ##########################################
  # Tags
  ##########################################

  tags = merge(
    local.common_tags,
    {
      Name = local.rds_name
    }
  )
}


############################################
# RDS - Endpoint
############################################

output "rds_endpoint" {
  description = "Private endpoint of the OEC PostgreSQL RDS instance"

  value = aws_db_instance.postgres.address
}


############################################
# RDS - Endpoint with Port
############################################

output "rds_endpoint_with_port" {
  description = "Private PostgreSQL endpoint with port"

  value = "${aws_db_instance.postgres.address}:5432"
}


############################################
# RDS - Port
############################################

output "rds_port" {
  description = "PostgreSQL port"

  value = aws_db_instance.postgres.port
}


############################################
# RDS - Database Name
############################################

output "rds_database_name" {
  description = "PostgreSQL database name"

  value = aws_db_instance.postgres.db_name
}


############################################
# RDS - Username
############################################

output "rds_username" {
  description = "PostgreSQL username"

  value = aws_db_instance.postgres.username
}
variable "project_name" {
  description = "Project name"
  type        = string
  default     = "oec"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "component" {
  description = "Infrastructure component name"
  type        = string
  default     = "rds"
}
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    Component   = var.component
    ManagedBy   = "Terraform"
  }

  rds_name = "${var.project_name}-${var.environment}-${var.component}"
}
terraform {
  required_version = ">= 1.6.0"

  backend "s3" {
    bucket = "oec-terraform-state"
    key    = "oec-java-suite/rds/terraform.tfstate"
    region = "us-east-1"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
 }
# ============================================================
# VARIABLES
# ============================================================

variable "aws_region" {
  description = "AWS region where the default VPC exists"
  type        = string
  default     = "us-east-1"
}

variable "db_name" {
  description = "Initial PostgreSQL database name"
  type        = string
  default     = "oec_db"
}

variable "db_username" {
  description = "RDS master/admin username"
  type        = string
  default     = "oec_admin"
}

variable "db_password" {
  description = "RDS master/admin password for the pilot"
  type        = string
  sensitive   = true
  default     = "oec_dev_123"
}

variable "bastion_security_group_id" {
  description = "Security Group ID attached to the existing bastion EC2"
  type        = string
  default     = "sg-01cb625d093aad0e6"
}

# ============================================================
# EXISTING DEFAULT VPC
# ============================================================

data "aws_vpc" "default" {
  default = true
}

# ============================================================
# EXISTING DEFAULT VPC SUBNETS
#
# Get the default subnet in each AZ.
# We will use the first two subnets.
# ============================================================

data "aws_subnets" "default_vpc" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }

  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

data "aws_subnet" "selected_1" {
  id = data.aws_subnets.default_vpc.ids[0]
}

data "aws_subnet" "selected_2" {
  id = data.aws_subnets.default_vpc.ids[1]
}

# ============================================================
# RDS SECURITY GROUP
# ============================================================

resource "aws_security_group" "oec_rds" {
  name        = "oec-rds-sg"
  description = "Security group for OEC Java Suite PostgreSQL RDS"
  vpc_id      = data.aws_vpc.default.id

  tags = {
    Name        = "OEC-RDS-SG"
    Project     = "OEC-Java-Suite"
    Environment = "dev"
    ManagedBy   = "Terraform"
  }
}

# ============================================================
# ALLOW POSTGRESQL FROM EXISTING BASTION
#
# Only EC2 instances using the bastion SG can reach RDS:5432.
# ============================================================

resource "aws_vpc_security_group_ingress_rule" "postgres_from_bastion" {
  security_group_id            = aws_security_group.oec_rds.id
  referenced_security_group_id = var.bastion_security_group_id

  ip_protocol = "tcp"
  from_port   = 5432
  to_port     = 5432

  description = "Allow PostgreSQL access from OEC bastion EC2"
}

# ============================================================
# RDS OUTBOUND
# ============================================================

resource "aws_vpc_security_group_egress_rule" "rds_outbound" {
  security_group_id = aws_security_group.oec_rds.id

  ip_protocol = "-1"
  cidr_ipv4   = "0.0.0.0/0"

  description = "Allow outbound traffic from RDS"
}

# ============================================================
# RDS DB SUBNET GROUP
#
# Uses two existing default VPC subnets.
# They should be in different Availability Zones.
# ============================================================

resource "aws_db_subnet_group" "oec_java_suite" {
  name        = "oec-java-suite-postgres-subnet-group"
  description = "Subnet group for OEC Java Suite PostgreSQL RDS"

  subnet_ids = [
    data.aws_subnet.selected_1.id,
    data.aws_subnet.selected_2.id
  ]

  tags = {
    Name        = "OEC-Java-Suite-Postgres-Subnet-Group"
    Project     = "OEC-Java-Suite"
    Environment = "dev"
    ManagedBy   = "Terraform"
  }
}

# ============================================================
# RDS POSTGRESQL
# ============================================================

resource "aws_db_instance" "oec_java_suite" {

  # ----------------------------------------------------------
  # IDENTIFIER
  # ----------------------------------------------------------

  identifier = "oec-java-suite-postgres-dev"

  # ----------------------------------------------------------
  # DATABASE ENGINE
  # ----------------------------------------------------------

  engine         = "postgres"
  engine_version = "17.11"

  # ----------------------------------------------------------
  # PILOT INSTANCE
  # ----------------------------------------------------------

  instance_class = "db.t4g.micro"

  # ----------------------------------------------------------
  # STORAGE
  # ----------------------------------------------------------

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"

  # ----------------------------------------------------------
  # DATABASE
  # ----------------------------------------------------------

  db_name = var.db_name
  port    = 5432

  # ----------------------------------------------------------
  # MASTER / ADMIN CREDENTIALS
  #
  # For this pilot we are intentionally supplying the password
  # directly through Terraform.
  #
  # IMPORTANT:
  # The password will exist in Terraform state.
  # Keep the state file private.
  # ----------------------------------------------------------

  username = var.db_username
  password = var.db_password

  # ----------------------------------------------------------
  # NETWORKING
  # ----------------------------------------------------------

  db_subnet_group_name = aws_db_subnet_group.oec_java_suite.name

  vpc_security_group_ids = [
    aws_security_group.oec_rds.id
  ]

  # RDS remains private.
  # Developers access it through the bastion.
  publicly_accessible = false

  # ----------------------------------------------------------
  # AVAILABILITY
  #
  # Single-AZ for pilot / cost optimization.
  # ----------------------------------------------------------

  multi_az = false

  # ----------------------------------------------------------
  # BACKUPS
  # ----------------------------------------------------------

  backup_retention_period = 7

  # ----------------------------------------------------------
  # ENCRYPTION
  # ----------------------------------------------------------

  storage_encrypted = true

  # ----------------------------------------------------------
  # MAINTENANCE
  # ----------------------------------------------------------

  auto_minor_version_upgrade = true

  # Enhanced monitoring disabled for pilot
  monitoring_interval = 0

  # ----------------------------------------------------------
  # PILOT LIFECYCLE
  # ----------------------------------------------------------

  deletion_protection = false
  skip_final_snapshot = true

  # ----------------------------------------------------------
  # TAGS
  # ----------------------------------------------------------

  tags = {
    Name        = "OEC-RDS"
    Project     = "OEC-Java-Suite"
    Environment = "dev"
    ManagedBy   = "Terraform"
  }
}

# ============================================================
# OUTPUTS
# ============================================================

output "vpc_id" {
  description = "Default VPC ID"
  value       = data.aws_vpc.default.id
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.oec_java_suite.address
}

output "rds_port" {
  description = "RDS PostgreSQL port"
  value       = aws_db_instance.oec_java_suite.port
}

output "database_name" {
  description = "PostgreSQL database name"
  value       = aws_db_instance.oec_java_suite.db_name
}

output "master_username" {
  description = "RDS master/admin username"
  value       = aws_db_instance.oec_java_suite.username
}

output "rds_security_group_id" {
  description = "RDS Security Group ID"
  value       = aws_security_group.oec_rds.id
}

output "rds_subnet_ids" {
  description = "Subnets used by the RDS DB subnet group"
  value = [
    data.aws_subnet.selected_1.id,
    data.aws_subnet.selected_2.id
  ]
}
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
    key          = "oec-java-suite/dev/shared-server/terraform.tfstate"
    region       = "ap-south-2"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = "ap-south-2"
}

# ============================================================
# PROJECT / ENVIRONMENT
# ============================================================

locals {
  project_name = "oec"
  environment = "dev"

  common_tags = {
    Project     = "OEC"
    Application = "Java Suite"
    Environment = "dev"
    ManagedBy   = "Terraform"
    poc         = "krishna"
  }
}

# ============================================================
# READ NETWORKING INFORMATION FROM SSM PARAMETER STORE
# ============================================================

# ------------------------------------------------------------
# VPC ID
# SSM:
# /oec/dev/network/vpc_id
# ------------------------------------------------------------

data "aws_ssm_parameter" "vpc_id" {
  name = "/${local.project_name}/${local.environment}/network/vpc_id"
}

# ------------------------------------------------------------
# PUBLIC SUBNET IDS
# SSM:
# /oec/dev/network/public_subnet_ids
#
# Example value:
# subnet-0123456789abcdef0,subnet-0abcdef1234567890
# ------------------------------------------------------------

data "aws_ssm_parameter" "public_subnet_ids" {
  name = "/${local.project_name}/${local.environment}/network/public_subnet_ids"
}

# ------------------------------------------------------------
# Convert StringList into Terraform list
# ------------------------------------------------------------

locals {
  vpc_id = data.aws_ssm_parameter.vpc_id.value

  public_subnet_ids = split(
    ",",
    data.aws_ssm_parameter.public_subnet_ids.value
  )

  # Select first public subnet
  subnet_id = local.public_subnet_ids[0]
}

# ============================================================
# SECURITY GROUP
# ============================================================

resource "aws_security_group" "java_suite_sg" {
  name        = "oec-java-suite-shared-server-sg"
  description = "Security group for Main EC2 of OEC"
  vpc_id      = local.vpc_id

  ingress {
    description = "SSH access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Outbound access for packages, images and AWS services"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "Main ec2 of OEC - Security Group"
  })
}

# ============================================================
# IAM ROLE FOR SESSION MANAGER
# ============================================================

resource "aws_iam_role" "ec2_ssm_role" {
  name = "oec-java-suite-ec2-ssm-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "ec2.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "OEC Java Suite EC2 SSM Role"
  })
}

# ------------------------------------------------------------
# AmazonSSMManagedInstanceCore
# ------------------------------------------------------------

resource "aws_iam_role_policy_attachment" "ssm_managed_instance" {
  role       = aws_iam_role.ec2_ssm_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# ============================================================
# INSTANCE PROFILE
# ============================================================

resource "aws_iam_instance_profile" "ec2_ssm_profile" {
  name = "oec-java-suite-ec2-ssm-profile"

  role = aws_iam_role.ec2_ssm_role.name

  tags = merge(local.common_tags, {
    Name = "OEC Java Suite EC2 Instance Profile"
  })
}

# ============================================================
# EC2 INSTANCE
# ============================================================

resource "aws_instance" "java_suite_server" {

  # ----------------------------------------------------------
  # AMI
  # ----------------------------------------------------------

  ami = "ami-0220d79f3f480ecf5"

  # ----------------------------------------------------------
  # INSTANCE TYPE
  # ----------------------------------------------------------

  instance_type = "t3.large"

  # ----------------------------------------------------------
  # NETWORK
  # ----------------------------------------------------------

  # VPC comes indirectly through the Security Group.
  #
  # Subnet comes from:
  # /oec/dev/network/public_subnet_ids
  #
  subnet_id = local.subnet_id

  vpc_security_group_ids = [
    aws_security_group.java_suite_sg.id
  ]

  # ----------------------------------------------------------
  # PUBLIC IP
  # ----------------------------------------------------------

  associate_public_ip_address = true

  # ----------------------------------------------------------
  # IAM / SSM
  # ----------------------------------------------------------

  iam_instance_profile = aws_iam_instance_profile.ec2_ssm_profile.name

  # ----------------------------------------------------------
  # BOOTSTRAP
  # ----------------------------------------------------------

  user_data = file("${path.module}/bootstrap.sh")

  user_data_replace_on_change = true

  # ----------------------------------------------------------
  # ROOT VOLUME
  # ----------------------------------------------------------

  root_block_device {
    volume_size = 100
    volume_type = "gp3"

    encrypted             = true
    delete_on_termination = true

    tags = merge(local.common_tags, {
      Name = "Main ec2 of OEC - Root Volume"
    })
  }

  # ----------------------------------------------------------
  # IMDS
  # ----------------------------------------------------------

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  # ----------------------------------------------------------
  # TAGS
  # ----------------------------------------------------------

  tags = merge(local.common_tags, {
    Name = "Main ec2 of OEC"
    Role = "Shared Development Server"
  })

  # ----------------------------------------------------------
  # Ensure IAM role attachment exists before EC2
  # ----------------------------------------------------------

  depends_on = [
    aws_iam_role_policy_attachment.ssm_managed_instance
  ]

  # ----------------------------------------------------------
  # VALIDATION
  # ----------------------------------------------------------

  lifecycle {
    precondition {
      condition     = local.vpc_id != ""
      error_message = "VPC ID was not found in SSM Parameter Store."
    }

    precondition {
      condition     = length(local.public_subnet_ids) > 0 && local.subnet_id != ""
      error_message = "No public subnet IDs were found in SSM Parameter Store."
    }
  }
}

# ============================================================
# OUTPUTS
# ============================================================

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.java_suite_server.id
}

output "instance_name" {
  description = "EC2 instance Name tag"
  value       = aws_instance.java_suite_server.tags["Name"]
}

output "instance_type" {
  description = "EC2 instance type"
  value       = aws_instance.java_suite_server.instance_type
}

output "public_ip" {
  description = "Public IPv4 address"
  value       = aws_instance.java_suite_server.public_ip
}

output "public_dns" {
  description = "Public DNS name"
  value       = aws_instance.java_suite_server.public_dns
}

output "vpc_id" {
  description = "VPC ID read from SSM"
  value       = local.vpc_id
}

output "subnet_id" {
  description = "Public subnet ID read from SSM"
  value       = local.subnet_id
}

output "public_subnet_ids" {
  description = "All public subnet IDs read from SSM"
  value       = local.public_subnet_ids
}

output "security_group_id" {
  description = "Dedicated EC2 security group ID"
  value       = aws_security_group.java_suite_sg.id
}

output "ssm_instance_profile" {
  description = "IAM instance profile for Session Manager"
  value       = aws_iam_instance_profile.ec2_ssm_profile.name
}
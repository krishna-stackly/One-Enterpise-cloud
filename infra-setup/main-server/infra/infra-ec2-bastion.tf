
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
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = "us-east-1"
}

# ------------------------------------------------------------
# DEFAULT VPC
# ------------------------------------------------------------

data "aws_vpc" "default" {
  default = true
}

# ------------------------------------------------------------
# DEFAULT PUBLIC SUBNET IN us-east-1a
# ------------------------------------------------------------

data "aws_subnets" "default_public_1a" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }

  filter {
    name   = "availability-zone"
    values = ["us-east-1a"]
  }

  # Select the default subnet for this AZ.
  filter {
    name   = "default-for-az"
    values = ["true"]
  }

  # Require automatic public IPv4 assignment.
  filter {
    name   = "map-public-ip-on-launch"
    values = ["true"]
  }
}

locals {
  # Fail validation clearly if no matching subnet exists.
  subnet_id = try(
    sort(data.aws_subnets.default_public_1a.ids)[0],
    ""
  )

  common_tags = {
    Project     = "OEC"
    Application = "Java Suite"
    Environment = "dev"
    ManagedBy   = "Terraform"
    poc         = "krishna"
  }
}

# ------------------------------------------------------------
# SECURITY GROUP
# ------------------------------------------------------------

resource "aws_security_group" "java_suite_sg" {
  name        = "oec-java-suite-shared-server-sg"
  description = "Security group for Main ec2 of OEC"
  vpc_id      = data.aws_vpc.default.id

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

# ------------------------------------------------------------
# IAM ROLE FOR SESSION MANAGER
# No EC2 key pair is configured.
# ------------------------------------------------------------

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

resource "aws_iam_role_policy_attachment" "ssm_managed_instance" {
  role       = aws_iam_role.ec2_ssm_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2_ssm_profile" {
  name = "oec-java-suite-ec2-ssm-profile"
  role = aws_iam_role.ec2_ssm_role.name

  tags = merge(local.common_tags, {
    Name = "OEC Java Suite EC2 Instance Profile"
  })
}

# ------------------------------------------------------------
# EC2 INSTANCE
# ------------------------------------------------------------

resource "aws_instance" "java_suite_server" {
  ami                    = "ami-0220d79f3f480ecf5"
  instance_type          = "t3.large"
  subnet_id              = local.subnet_id
  vpc_security_group_ids = [aws_security_group.java_suite_sg.id]

  # No EC2 key pair.
  associate_public_ip_address = true

  # Session Manager access.
  iam_instance_profile = aws_iam_instance_profile.ec2_ssm_profile.name

  # bootstrap.sh must be in the same directory as this .tf file.
  user_data                   = file("${path.module}/bootstrap.sh")
  user_data_replace_on_change = true

  root_block_device {
    volume_size           = 100
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true

    tags = merge(local.common_tags, {
      Name = "Main ec2 of OEC - Root Volume"
    })
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  tags = merge(local.common_tags, {
    Name = "Main ec2 of OEC"
    Role = "Shared Development Server"
  })

  depends_on = [
    aws_iam_role_policy_attachment.ssm_managed_instance
  ]

  lifecycle {
    precondition {
      condition     = local.subnet_id != ""
      error_message = "No default subnet with automatic public IPv4 assignment was found in us-east-1a. Check the default VPC and subnet configuration."
    }
  }
}

# ------------------------------------------------------------
# OUTPUTS
# ------------------------------------------------------------

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
  description = "Default VPC ID"
  value       = data.aws_vpc.default.id
}

output "subnet_id" {
  description = "Selected default subnet in us-east-1a"
  value       = local.subnet_id
}

output "security_group_id" {
  description = "Dedicated EC2 security group ID"
  value       = aws_security_group.java_suite_sg.id
}

output "ssm_instance_profile" {
  description = "IAM instance profile for Session Manager"
  value       = aws_iam_instance_profile.ec2_ssm_profile.name
}
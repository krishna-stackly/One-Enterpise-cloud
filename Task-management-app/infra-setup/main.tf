terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name prefix used to tag all resources"
  type        = string
  default     = "stackly-task-mgmt"
}

variable "instance_type" {
  description = <<-EOT
    Minimal instance type able to safely build (mvn package + npm ci/build)
    and run all three containers (mysql, backend, frontend) at once.
    t3.micro (1 GiB RAM) is cheaper but risks the on-instance image build
    getting OOM-killed. t3.small (2 GiB RAM, burstable) is the smallest
    size that reliably handles both the build and the running stack.
  EOT
  type    = string
  default = "t3.small"
}

variable "root_volume_size_gb" {
  description = <<-EOT
    Size of the single root EBS volume (gp3). Everything lives on it:
    OS (~2 GB), Docker engine + images (~2-3 GB), MySQL data, build cache,
    and logs. 20 GB gives headroom for the MySQL volume to grow without
    over-provisioning for a small internal tool.
  EOT
  type    = number
  default = 20
}

variable "frontend_port" {
  description = "The only port the security group allows in from the internet (the app's nginx frontend, per docker-compose.yml)"
  type        = number
  default     = 80
}

variable "swap_size_mb" {
  description = "Swap file size created at boot, to absorb memory spikes during the Docker image build on a small instance"
  type        = number
  default     = 2048
}

variable "app_git_repo" {
  description = "Optional: git URL of the repo containing docker-compose.yml + frontend/ + backend/. Leave empty to copy the project onto the instance manually (e.g. via SSM) after it boots."
  type        = string
  default     = ""
}

# ---------------------------------------------------------------------------
# Default VPC + a public default subnet (no new networking needed — default
# subnets already route to an Internet Gateway and auto-assign public IPs)
# ---------------------------------------------------------------------------
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default_public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

# ---------------------------------------------------------------------------
# Latest Amazon Linux 2023 AMI (x86_64) — ships with the SSM agent
# preinstalled, so we can manage the instance with zero inbound ports open
# ---------------------------------------------------------------------------
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ---------------------------------------------------------------------------
# IAM role for AWS Systems Manager (SSM) Session Manager.
# Lets you get a shell on the instance to deploy/debug without opening
# port 22 — the security group below allows nothing but the frontend port.
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ssm" {
  name               = "${var.project_name}-ssm-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ssm.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ssm" {
  name = "${var.project_name}-ssm-profile"
  role = aws_iam_role.ssm.name
}

# ---------------------------------------------------------------------------
# Security group — inbound: ONLY the frontend port, from anywhere.
# No SSH ingress rule at all (use SSM Session Manager instead).
# Outbound: unrestricted, so the instance can pull the Docker images and
# packages it needs.
# ---------------------------------------------------------------------------
resource "aws_security_group" "app" {
  name        = "${var.project_name}-sg"
  description = "Allow only the app frontend port in; SSM (no SSH) for management"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "App frontend"
    from_port   = var.frontend_port
    to_port     = var.frontend_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-sg"
  }
}

# ---------------------------------------------------------------------------
# EC2 instance
# ---------------------------------------------------------------------------
resource "aws_instance" "app" {
  ami                         = data.aws_ami.al2023.id
  instance_type               = var.instance_type
  subnet_id                   = data.aws_subnets.default_public.ids[0]
  vpc_security_group_ids      = [aws_security_group.app.id]
  iam_instance_profile        = aws_iam_instance_profile.ssm.name
  associate_public_ip_address = true

  root_block_device {
    volume_size          = var.root_volume_size_gb
    volume_type           = "gp3"
    encrypted              = true
    delete_on_termination  = true
  }

  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    swap_size_mb = var.swap_size_mb
    app_git_repo = var.app_git_repo
  })
  user_data_replace_on_change = true

  tags = {
    Name = var.project_name
  }
}

output "instance_id" {
  value = aws_instance.app.id
}

output "public_ip" {
  value = aws_instance.app.public_ip
}

output "app_url" {
  value = "http://${aws_instance.app.public_ip}"
}

output "ssm_connect_command" {
  description = "Get a shell on the instance without any open SSH port"
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${var.aws_region}"
}


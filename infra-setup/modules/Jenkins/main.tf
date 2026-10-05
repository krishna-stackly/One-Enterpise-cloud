############################################
# Jenkins Controller
############################################

resource "aws_instance" "jenkins" {
  ami           = var.ami_id
  instance_type = var.jenkins_instance_type
  subnet_id     = var.jenkins_subnet_id
  # key_name      = var.key_name

  associate_public_ip_address = true

  vpc_security_group_ids = [
    aws_security_group.jenkins.id
  ]

  iam_instance_profile = aws_iam_instance_profile.jenkins.name

  user_data = file("${path.module}/jenkins.sh")
  user_data_replace_on_change = true

  root_block_device {
    volume_size = var.jenkins_volume_size
    volume_type = "gp3"
    encrypted   = true

    tags = merge(
      var.common_tags,
      {
        Name = "${var.name}-jenkins-root"
      }
    )
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  tags = merge(
    var.common_tags,
    {
      Name = "${var.name}-jenkins"
      Role = "Jenkins-Controller"
    }
  )
}


############################################
# Jenkins Build Agent
############################################

resource "aws_instance" "agent" {
  ami           = var.ami_id
  instance_type = var.agent_instance_type
  subnet_id     = var.agent_subnet_id
  # key_name      = var.key_name

  associate_public_ip_address = true

  vpc_security_group_ids = [
    aws_security_group.agent.id
  ]

  iam_instance_profile = aws_iam_instance_profile.agent.name

  user_data = file("${path.module}/jenkins-agent.sh")
  user_data_replace_on_change = true

  root_block_device {
    volume_size = var.agent_volume_size
    volume_type = "gp3"
    encrypted   = true

    tags = merge(
      var.common_tags,
      {
        Name = "${var.name}-jenkins-agent-root"
      }
    )
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  tags = merge(
    var.common_tags,
    {
      Name = "${var.name}-jenkins-agent"
      Role = "Jenkins-Agent"
    }
  )
}
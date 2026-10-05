############################################
# Application EC2
############################################

resource "aws_instance" "this" {
  ami           = var.ami_id
  instance_type = var.instance_type

  subnet_id = var.subnet_id

  ############################################
  # Security Groups
  ############################################
  vpc_security_group_ids = concat(
    var.security_group_ids,
    [aws_security_group.app.id]
  )

  ############################################
  # IAM
  ############################################
  iam_instance_profile = var.iam_instance_profile

  ############################################
  # Public IP
  ############################################
  associate_public_ip_address = var.associate_public_ip_address

  ############################################
  # Bootstrap
  ############################################
  user_data                   = var.user_data
  user_data_replace_on_change = var.user_data_replace_on_change

  ############################################
  # Root Volume
  ############################################
  root_block_device {
    volume_size = var.root_volume_size
    volume_type = var.root_volume_type

    encrypted             = true
    delete_on_termination = true

    tags = merge(
      var.common_tags,
      {
        Name        = "${var.name}-root"
        Project     = var.project_name
        Environment = var.environment
        State       = "non-persistent"
        Created_by  = var.poc_name
      }
    )
  }

  ############################################
  # IMDSv2
  ############################################
  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  ############################################
  # EC2 Tags
  ############################################
  tags = merge(
    var.common_tags,
    var.additional_tags,
    {
      Name        = var.name
      Project     = var.project_name
      Environment = var.environment
      State       = "non-persistent"
      Created_by  = var.poc_name
      component   = "app"
      
    }
  )
}
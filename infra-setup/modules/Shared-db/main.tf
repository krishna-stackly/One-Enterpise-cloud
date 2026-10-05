############################################
# Database EC2
############################################

resource "aws_instance" "database" {
  ami           = var.ami_id
  instance_type = var.instance_type
  subnet_id     = var.subnet_id

  vpc_security_group_ids = [
    aws_security_group.database.id
  ]

  iam_instance_profile = aws_iam_instance_profile.database.name

  associate_public_ip_address = false

  user_data                   = file("${path.module}/scripts/database.sh")
  user_data_replace_on_change = false

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type            = "gp3"
    encrypted              = true
    delete_on_termination  = true

    tags = merge(
      var.common_tags,
      {
        Name        = "${var.name}-root"
        Project     = var.project_name
        Environment = var.environment
        Created_by  = var.poc_name
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
      Name        = var.name
      Role        = "Database"
      Lifecycle   = "Persistent"
      Project     = var.project_name
      Environment = var.environment
      Created_by  = var.poc_name
      component   = "database"
    }
  )
  depends_on = [
    aws_security_group.database
  ]
}


############################################
# Persistent Database EBS
############################################

resource "aws_ebs_volume" "database_data" {
  availability_zone = aws_instance.database.availability_zone

  size = var.data_volume_size
  type = "gp3"

  encrypted = true

  tags = merge(
    var.common_tags,
    {
      Name        = "${var.name}-data"
      Component   = "Database"
      State       = "Persistent"
      Project     = var.project_name
      Environment = var.environment
      Created_by  = var.poc_name
    }
  )

  lifecycle {
    prevent_destroy = false
  }
}


############################################
# Attach Data Volume
############################################

resource "aws_volume_attachment" "database_data" {
  device_name = var.data_device_name

  volume_id   = aws_ebs_volume.database_data.id
  instance_id = aws_instance.database.id

  stop_instance_before_detaching = true
}
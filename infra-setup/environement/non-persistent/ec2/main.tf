############################################
# Application EC2 (via modules/app-ec2)
############################################

module "app_ec2" {
  source = "git::https://github.com/krishna-stackly/ERP-Terraform.git//modules/app-ec2?ref=main"
  # once you cut a release tag, switch to: ?ref=app-ec2-v1.0.0

  ############################################
  # General
  ############################################
  name         = var.name
  project_name = var.project_name
  environment  = var.environment
  poc_name     = var.poc_name

  ############################################
  # EC2
  ############################################
  ami_id        = var.ami_id
  instance_type = var.instance_type

  ############################################
  # Networking
  ############################################
  vpc_id                       = local.vpc_id
  subnet_id                    = local.public_subnet_ids[0]
  security_group_ids           = var.additional_security_group_ids
  associate_public_ip_address  = var.associate_public_ip_address

  ############################################
  # Application Security Group
  ############################################
  enable_http        = var.enable_http
  http_ingress_cidr  = var.http_ingress_cidr
  enable_https       = var.enable_https
  https_ingress_cidr = var.https_ingress_cidr

  ############################################
  # IAM
  ############################################
  iam_instance_profile = var.iam_instance_profile

  ############################################
  # Storage
  ############################################
  root_volume_size = var.root_volume_size
  root_volume_type = var.root_volume_type

  ############################################
  # Bootstrap
  ############################################
  user_data                   = file("${path.module}/app.sh")
  user_data_replace_on_change = var.user_data_replace_on_change

  ############################################
  # Tags
  ############################################
  common_tags     = var.common_tags
  additional_tags = var.additional_tags
}
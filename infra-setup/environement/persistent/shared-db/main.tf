###############DATABASE###############################

module "database" {
  source = "git::https://github.com/krishna-stackly/ERP-Terraform.git//modules/Shared-db?ref=main"
  # once you cut a release tag, switch to: ?ref=shared-db-v1.0.0

  ############################################
  # General
  ############################################
  name         = "${var.project_name}-${var.environment}-shared-db"
  project_name = var.project_name
  environment  = var.environment
  poc_name     = var.poc_name

  ############################################
  # EC2
  ############################################
  ami_id        = var.ami_id
  instance_type = var.db_instance_type

  ############################################
  # Networking
  ############################################
  vpc_id    = local.vpc_id
  subnet_id = local.private_subnet_ids[var.db_subnet_index]

  ############################################
  # Storage
  ############################################
  root_volume_size = var.db_root_volume_size
  data_volume_size = var.db_data_volume_size

  ############################################
  # Tags
  ############################################
  common_tags = merge(
    var.common_tags,
    {
      Role      = "Database"
      Lifecycle = "Persistent"
      purpose   = "ERP"
    }
  )
}
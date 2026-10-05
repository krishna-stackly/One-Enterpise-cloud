module "jenkins" {

  source = "git::https://github.com/krishna-stackly/ERP-Terraform.git//modules/Jenkins?ref=main"
  # once you cut a release tag, switch to: ?ref=jenkins-v1.0.0

  name = "${var.project_name}-${var.environment}"

  ############################################
  # EC2
  ############################################
  ami_id = var.ami_id

  jenkins_instance_type = var.controller_instance_type

  agent_instance_type = var.agent_instance_type

  jenkins_volume_size = var.controller_volume_size

  agent_volume_size = var.agent_volume_size

  ############################################
  # Networking (public subnets)
  ############################################
  vpc_id = local.vpc_id

  jenkins_subnet_id = local.public_subnet_ids[var.jenkins_subnet_index]

  agent_subnet_id = local.public_subnet_ids[var.agent_subnet_index]

  ############################################
  # SSH / Access
  ############################################
  key_name = var.key_name

  admin_ssh_cidr = var.admin_ssh_cidr

  ############################################
  # Route53 (public zone)
  ############################################
  public_zone_id = var.public_zone_id

  domain_name = var.domain_name

  ############################################
  # Tags
  ############################################
  common_tags = var.common_tags
}
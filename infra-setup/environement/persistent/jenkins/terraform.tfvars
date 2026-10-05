aws_region = "us-east-1"

project_name = "erp"
environment  = "dev"

ami_id = "ami-0220d79f3f480ecf5"

controller_instance_type = "t3.micro"
agent_instance_type      = "t3.micro"

controller_volume_size = 50
agent_volume_size      = 80

jenkins_subnet_index = 0
agent_subnet_index   = 1

key_name = "erp-dev-keypair"   # <-- replace with your existing EC2 key pair name

admin_ssh_cidr = [
  "203.0.113.10/32"            # <-- replace with your public IP (curl ifconfig.me)
]

public_zone_id = "Z07828231LZ1JJ8XRPP2F"
domain_name    = "kriiishmatic.fun"

common_tags = {
  Platform = "ERP-Dev"
  Owner    = "krishna-stackly"
}
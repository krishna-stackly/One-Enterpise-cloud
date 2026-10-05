############################################
# Security Groups
############################################

resource "aws_security_group" "jenkins" {

  name = "${var.name}-jenkins-sg"

  description = "Jenkins controller security group"

  vpc_id = var.vpc_id

  tags = merge(

    var.common_tags,

    {
      Name = "${var.name}-jenkins-sg"
    }
  )
}

resource "aws_security_group" "agent" {

  name = "${var.name}-jenkins-agent-sg"

  description = "Jenkins build agent security group"

  vpc_id = var.vpc_id

  tags = merge(

    var.common_tags,

    {
      Name = "${var.name}-jenkins-agent-sg"
    }
  )
}

############################################
# Egress - allow all outbound (updates, plugins,
# docker pulls, terraform/helm/eksctl downloads etc.)
############################################

resource "aws_vpc_security_group_egress_rule" "jenkins" {

  security_group_id = aws_security_group.jenkins.id

  cidr_ipv4 = "0.0.0.0/0"

  ip_protocol = "-1"
}

resource "aws_vpc_security_group_egress_rule" "agent" {

  security_group_id = aws_security_group.agent.id

  cidr_ipv4 = "0.0.0.0/0"

  ip_protocol = "-1"
}

############################################
# Jenkins controller - ingress
############################################

# Admin SSH into the controller
resource "aws_vpc_security_group_ingress_rule" "jenkins_ssh_admin" {

  for_each = toset(var.admin_ssh_cidr)

  security_group_id = aws_security_group.jenkins.id

  cidr_ipv4 = each.value

  from_port = 22

  to_port = 22

  ip_protocol = "tcp"

  description = "Admin SSH access to Jenkins controller"
}

# Admin access to the Jenkins web UI
resource "aws_vpc_security_group_ingress_rule" "jenkins_ui_admin" {

  for_each = toset(var.admin_ssh_cidr)

  security_group_id = aws_security_group.jenkins.id

  cidr_ipv4 = each.value

  from_port = 8080

  to_port = 8080

  ip_protocol = "tcp"

  description = "Admin access to Jenkins web UI"
}

# SSH from the agent back to the controller (bidirectional SSH)
resource "aws_vpc_security_group_ingress_rule" "jenkins_ssh_from_agent" {

  security_group_id = aws_security_group.jenkins.id

  referenced_security_group_id = aws_security_group.agent.id

  from_port = 22

  to_port = 22

  ip_protocol = "tcp"

  description = "SSH from Jenkins agent to controller"
}

############################################
# Jenkins agent - ingress
############################################

# SSH from the controller to the agent (Jenkins SSH build-agent connection)
resource "aws_vpc_security_group_ingress_rule" "agent_ssh_from_jenkins" {

  security_group_id = aws_security_group.agent.id

  referenced_security_group_id = aws_security_group.jenkins.id

  from_port = 22

  to_port = 22

  ip_protocol = "tcp"

  description = "SSH from Jenkins controller to agent"
}

# Admin SSH directly into the agent
resource "aws_vpc_security_group_ingress_rule" "agent_ssh_admin" {

  for_each = toset(var.admin_ssh_cidr)

  security_group_id = aws_security_group.agent.id

  cidr_ipv4 = each.value

  from_port = 22

  to_port = 22

  ip_protocol = "tcp"

  description = "Admin SSH access to Jenkins agent"
}
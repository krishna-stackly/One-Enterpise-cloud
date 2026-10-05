data "aws_iam_policy_document" "ec2_assume_role" {

  statement {

    effect = "Allow"

    actions = [
      "sts:AssumeRole"
    ]

    principals {
      type = "Service"

      identifiers = [
        "ec2.amazonaws.com"
      ]
    }
  }
}

resource "aws_iam_role" "jenkins" {

  name = "${var.name}-jenkins-role"

  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json

  tags = var.common_tags
}

resource "aws_iam_role_policy_attachment" "jenkins_ssm" {

  role = aws_iam_role.jenkins.name

  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "jenkins" {

  name = "${var.name}-jenkins-profile"

  role = aws_iam_role.jenkins.name
}

resource "aws_iam_role" "agent" {

  name = "${var.name}-jenkins-agent-role"

  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json

  tags = var.common_tags
}

resource "aws_iam_role_policy_attachment" "agent_ssm" {

  role = aws_iam_role.agent.name

  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "agent_ecr" {

  role = aws_iam_role.agent.name

  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser"
}

resource "aws_iam_instance_profile" "agent" {

  name = "${var.name}-jenkins-agent-profile"

  role = aws_iam_role.agent.name
}
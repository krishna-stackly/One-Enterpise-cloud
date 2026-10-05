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


resource "aws_iam_role" "database" {
  name = "${var.name}-role"

  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json

  tags = var.common_tags
}


############################################
# SSM
############################################

resource "aws_iam_role_policy_attachment" "database_ssm" {
  role = aws_iam_role.database.name

  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}


resource "aws_iam_instance_profile" "database" {
  name = "${var.name}-profile"

  role = aws_iam_role.database.name
}
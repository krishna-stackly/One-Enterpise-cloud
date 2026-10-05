resource "aws_security_group" "database" {
  name        = "${var.name}-sg"
  description = "Security group for ${var.name} database"
  vpc_id      = var.vpc_id

  tags = merge(
    var.common_tags,
    {
      Name      = "${var.name}-sg"
      Component = "Database"
    }
  )
}
locals {

  jenkins_name = "${var.name}-jenkins"

  agent_name = "${var.name}-jenkins-agent"

  common_tags = merge(

    var.common_tags,

    {

      ManagedBy = "Terraform"

      Component = "Jenkins"

    }

  )

}
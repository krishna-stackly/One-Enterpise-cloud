#!/bin/bash

set -e

echo "========================================"
echo "JENKINS AGENT BOOTSTRAP STARTED"
echo "========================================"


# ========================================
# RESIZE DISK
# ========================================

echo "Resizing disk..."

growpart /dev/nvme0n1 4

lvextend -L +10G /dev/mapper/RootVG-varVol
lvextend -L +10G /dev/mapper/RootVG-rootVol
lvextend -l +100%FREE /dev/mapper/RootVG-homeVol

xfs_growfs /
xfs_growfs /var
xfs_growfs /home


# ========================================
# SYSTEM / SSH / OPENSSL UPDATE
# ========================================

echo "Updating OpenSSL and OpenSSH..."

dnf update -y 'openssl*' 'openssh*'


# ========================================
# JAVA 21 - REQUIRED FOR JENKINS AGENT
# ========================================

echo "Installing Java 21..."

dnf install -y java-21-openjdk java-21-openjdk-headless

echo "Finding Java 21..."

JAVA21=$(find /usr/lib/jvm -type f -path "*/java-21-openjdk*/bin/java" | head -n 1)

if [ -z "$JAVA21" ]; then
    echo "ERROR: Java 21 installation not found."
    exit 1
fi

echo "Java 21 found at:"
echo "$JAVA21"

echo "Setting Java 21 as default..."

alternatives --set java "$JAVA21"

echo "Verifying Java..."

java -version

JAVA_VERSION=$(java -version 2>&1 | head -n 1)

if [[ "$JAVA_VERSION" != *"21."* ]]; then
    echo "ERROR: Java 21 is not the active Java version."
    exit 1
fi


# ========================================
# NODE.JS 20
# ========================================

echo "Installing Node.js 20..."

dnf module disable nodejs -y
dnf module enable nodejs:20 -y
dnf install -y nodejs

node --version
npm --version


# ========================================
# DOCKER
# ========================================

echo "Installing Docker..."

dnf install -y yum-utils

yum-config-manager \
    --add-repo \
    https://download.docker.com/linux/centos/docker-ce.repo

dnf install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

systemctl enable docker
systemctl start docker

usermod -aG docker ec2-user

docker --version
docker compose version


# ========================================
# TERRAFORM
# ========================================

echo "Installing Terraform..."

yum-config-manager \
    --add-repo \
    https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo

dnf install -y terraform

terraform version


# ========================================
# TRIVY
# ========================================

echo "Installing Trivy..."

curl -sfL \
https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh \
| sh -s -- -b /usr/local/bin v0.68.2

trivy --version


# ========================================
# MAVEN
# ========================================

echo "Installing Maven..."

dnf install -y maven

mvn --version


# ========================================
# PYTHON
# ========================================

echo "Installing Python..."

dnf install -y \
    python3 \
    gcc \
    python3-devel

python3 --version


# ========================================
# HELM
# ========================================

echo "Installing Helm..."

curl -fsSL \
    -o /tmp/get_helm.sh \
    https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-4

chmod 700 /tmp/get_helm.sh

/tmp/get_helm.sh

rm -f /tmp/get_helm.sh

helm version


# ========================================
# KUBECTL
# ========================================

echo "Installing kubectl..."

curl -Lo /usr/local/bin/kubectl \
https://s3.us-west-2.amazonaws.com/amazon-eks/1.34.2/2025-11-13/bin/linux/amd64/kubectl

chmod +x /usr/local/bin/kubectl

kubectl version --client


# ========================================
# EKSCTL
# ========================================

echo "Installing eksctl..."

ARCH=amd64
PLATFORM=$(uname -s)_$ARCH

curl -sLO \
"https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_${PLATFORM}.tar.gz"

tar -xzf eksctl_${PLATFORM}.tar.gz -C /tmp

install -m 0755 /tmp/eksctl /usr/local/bin/eksctl

rm -f eksctl_${PLATFORM}.tar.gz
rm -f /tmp/eksctl

eksctl version


# ========================================
# JENKINS AGENT DIRECTORY
# ========================================

echo "Creating Jenkins agent directory..."

mkdir -p /home/ec2-user/jenkins

chown -R ec2-user:ec2-user /home/ec2-user/jenkins


# ========================================
# FINAL VERIFICATION
# ========================================

echo ""
echo "========================================"
echo "FINAL AGENT VERIFICATION"
echo "========================================"

echo ""
echo "Java:"
java -version

echo ""
echo "AWS CLI:"
aws --version || echo "AWS CLI not found"

echo ""
echo "Git:"
git --version

echo ""
echo "Docker:"
docker --version

echo ""
echo "Terraform:"
terraform version

echo ""
echo "Node:"
node --version

echo ""
echo "Python:"
python3 --version

echo ""
echo "Maven:"
mvn --version

echo ""
echo "Helm:"
helm version --short

echo ""
echo "Trivy:"
trivy --version

echo ""
echo "kubectl:"
kubectl version --client

echo ""
echo "eksctl:"
eksctl version

echo ""
echo "========================================"
echo "JENKINS AGENT BOOTSTRAP COMPLETED"
echo "========================================"
#!/bin/bash

set -euxo pipefail

############################################
# System update
############################################

yum update -y


############################################
# Grow partition
############################################

if command -v growpart >/dev/null 2>&1; then
    growpart /dev/nvme0n1 4 || true
fi


############################################
# Extend LVM volumes
############################################

if [ -e /dev/mapper/RootVG-varVol ]; then
    lvextend -L +10G /dev/mapper/RootVG-varVol || true
fi

if [ -e /dev/mapper/RootVG-rootVol ]; then
    lvextend -L +10G /dev/mapper/RootVG-rootVol || true
fi

if [ -e /dev/mapper/RootVG-homeVol ]; then
    lvextend -l +100%FREE /dev/mapper/RootVG-homeVol || true
fi


############################################
# Grow XFS filesystems
############################################

xfs_growfs / || true
xfs_growfs /var || true
xfs_growfs /home || true


############################################
# Docker repository
############################################

yum install -y yum-utils

yum-config-manager \
  --add-repo \
  https://download.docker.com/linux/centos/docker-ce.repo


############################################
# Docker
############################################

yum install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin


############################################
# Enable Docker
############################################

systemctl enable docker

systemctl start docker


############################################
# Allow ec2-user to use Docker
############################################

usermod -aG docker ec2-user


############################################
# Verify
############################################

docker --version

docker compose version


############################################
# Completion marker
############################################

touch /var/log/app-bootstrap-complete

echo "Application EC2 bootstrap completed successfully."
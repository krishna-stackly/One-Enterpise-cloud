#!/bin/bash

set -e

echo "========================================"
echo "JENKINS CONTROLLER BOOTSTRAP STARTED"
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
# INSTALL JAVA 21
# ========================================

echo "Installing Java 21..."

dnf install -y \
    fontconfig \
    java-21-openjdk \
    java-21-openjdk-headless


# ========================================
# FORCE JAVA 21 AS DEFAULT
# ========================================

echo "Finding Java 21..."

JAVA21=$(find /usr/lib/jvm -type f -path "*/java-21-openjdk*/bin/java" | head -n 1)

if [ -z "$JAVA21" ]; then
    echo "ERROR: Java 21 installation not found."
    exit 1
fi

echo "Java 21 found:"
echo "$JAVA21"

echo "Setting Java 21 as default..."

alternatives --set java "$JAVA21"


# ========================================
# VERIFY JAVA
# ========================================

echo ""
echo "Java verification:"

which java
readlink -f "$(which java)"
java -version

JAVA_VERSION=$(java -version 2>&1 | head -n 1)

if [[ "$JAVA_VERSION" != *"21."* ]]; then
    echo "ERROR: Java 21 is not the active Java version."
    exit 1
fi


# ========================================
# ADD JENKINS REPOSITORY
# ========================================

echo "Adding Jenkins repository..."

curl -k -L \
    https://pkg.jenkins.io/redhat-stable/jenkins.repo \
    -o /etc/yum.repos.d/jenkins.repo

rpm --import \
    https://pkg.jenkins.io/redhat-stable/jenkins.io-2023.key


# ========================================
# INSTALL JENKINS
# ========================================

echo "Installing Jenkins..."

dnf install -y jenkins


# ========================================
# START JENKINS
# ========================================

echo "Starting Jenkins..."

systemctl daemon-reload

systemctl enable jenkins

systemctl start jenkins


# ========================================
# FINAL VERIFICATION
# ========================================

echo ""
echo "========================================"
echo "FINAL CONTROLLER VERIFICATION"
echo "========================================"

echo ""
echo "Java:"
java -version

echo ""
echo "Jenkins status:"
systemctl status jenkins --no-pager || true

echo ""
echo "========================================"
echo "JENKINS CONTROLLER BOOTSTRAP COMPLETED"
echo "========================================"
# 1. Install Java 21
sudo dnf install -y java-21-openjdk

# 2. Verify Java
java -version

# 3. Add Jenkins repository
sudo rpm --import https://pkg.jenkins.io/rpm-stable/jenkins.io-2026.key

sudo tee /etc/yum.repos.d/jenkins.repo > /dev/null <<'EOF'
[jenkins]
name=Jenkins-stable
baseurl=https://pkg.jenkins.io/rpm-stable
gpgcheck=1
gpgkey=https://pkg.jenkins.io/rpm-stable/jenkins.io-2026.key
enabled=1
EOF

# 4. Install Jenkins
sudo dnf install -y jenkins

# 5. Configure Jenkins home
sudo mkdir -p /etc/systemd/system/jenkins.service.d

sudo tee /etc/systemd/system/jenkins.service.d/override.conf > /dev/null <<'EOF'
[Service]
Environment="JENKINS_HOME=/srv/jenkins"
EOF

# 6. Set Jenkins directory ownership
sudo chown -R jenkins:jenkins /srv/jenkins
sudo chmod 0755 /srv/jenkins

# 7. Reload systemd
sudo systemctl daemon-reload

# 8. Enable and start Jenkins
sudo systemctl enable --now jenkins

# 9. Check Jenkins
sudo systemctl status jenkins --no-pager

# 10. Verify Docker
sudo systemctl status docker --no-pager

# 11. Verify Docker root
docker info --format 'Docker Root Dir: {{.DockerRootDir}}'

# 12. Verify Docker Compose
docker compose version

# 13. Verify storage
df -hT /
df -hT /var/lib/docker
df -hT /srv/jenkins

# 14. Verify mounts
findmnt /var/lib/docker
findmnt /srv/jenkins

# 15. Verify Jenkins home
sudo systemctl show jenkins --property=Environment --no-pager

# 16. Check Jenkins directory
sudo ls -lah /srv/jenkins
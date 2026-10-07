echo "============================================================"
echo " OEC JAVA SUITE - COMPLETE BOOTSTRAP VERIFICATION"
echo "============================================================"

echo
echo "========== 1. OS =========="
cat /etc/redhat-release
echo
uname -r

echo
echo "========== 2. DISK =========="
lsblk -o NAME,SIZE,TYPE,FSTYPE,LABEL,MOUNTPOINTS

echo
echo "========== 3. DISK SPACE =========="
df -hT

echo
echo "========== 4. VOLUME GROUP =========="
sudo vgs

echo
echo "========== 5. LOGICAL VOLUMES =========="
sudo lvs -o lv_name,vg_name,lv_size,lv_attr

echo
echo "========== 6. PHYSICAL VOLUMES =========="
sudo pvs

echo
echo "========== 7. DOCKER LV =========="
sudo blkid /dev/RootVG/dockerVol 2>/dev/null || echo "Docker LV NOT FOUND"

echo
echo "========== 8. JENKINS LV =========="
sudo blkid /dev/RootVG/jenkinsVol 2>/dev/null || echo "Jenkins LV NOT FOUND"

echo
echo "========== 9. DOCKER MOUNT =========="
findmnt /var/lib/docker || echo "Docker mount NOT FOUND"

echo
echo "========== 10. JENKINS MOUNT =========="
findmnt /srv/jenkins || echo "Jenkins mount NOT FOUND"

echo
echo "========== 11. DOCKER FILESYSTEM =========="
df -hT /var/lib/docker 2>/dev/null || echo "Docker filesystem NOT AVAILABLE"

echo
echo "========== 12. JENKINS FILESYSTEM =========="
df -hT /srv/jenkins 2>/dev/null || echo "Jenkins filesystem NOT AVAILABLE"

echo
echo "========== 13. FSTAB =========="
grep -E 'docker-data|jenkins-data|/var/lib/docker|/srv/jenkins' /etc/fstab \
    || echo "No Docker/Jenkins fstab entries found"

echo
echo "========== 14. DOCKER INSTALLED =========="
if command -v docker >/dev/null 2>&1; then
    echo "Docker: INSTALLED"
    docker --version
else
    echo "Docker: NOT INSTALLED"
fi

echo
echo "========== 15. DOCKER SERVICE =========="
sudo systemctl is-enabled docker 2>/dev/null || true
sudo systemctl is-active docker 2>/dev/null || true
sudo systemctl status docker --no-pager -l 2>/dev/null | tail -20

echo
echo "========== 16. DOCKER ROOT DIRECTORY =========="
sudo docker info --format 'Docker Root Dir: {{.DockerRootDir}}' 2>/dev/null \
    || echo "Docker daemon not responding"

echo
echo "========== 17. DOCKER COMPOSE =========="
docker compose version 2>/dev/null \
    || echo "Docker Compose NOT AVAILABLE"

echo
echo "========== 18. DOCKER BUILDX =========="
docker buildx version 2>/dev/null \
    || echo "Docker Buildx NOT AVAILABLE"

echo
echo "========== 19. DOCKER CONFIG =========="
sudo cat /etc/docker/daemon.json 2>/dev/null \
    || echo "/etc/docker/daemon.json NOT FOUND"

echo
echo "========== 20. JAVA =========="
if command -v java >/dev/null 2>&1; then
    java -version
else
    echo "Java NOT INSTALLED"
fi

echo
echo "========== 21. JAVA LOCATION =========="
readlink -f "$(command -v java)" 2>/dev/null || true

echo
echo "========== 22. JENKINS PACKAGE =========="
if rpm -q jenkins >/dev/null 2>&1; then
    rpm -q jenkins
else
    echo "Jenkins package NOT INSTALLED"
fi

echo
echo "========== 23. JENKINS SERVICE =========="
sudo systemctl is-enabled jenkins 2>/dev/null || true
sudo systemctl is-active jenkins 2>/dev/null || true

echo
echo "========== 24. JENKINS STATUS =========="
sudo systemctl status jenkins --no-pager -l 2>/dev/null | tail -30

echo
echo "========== 25. JENKINS HOME =========="
sudo systemctl show jenkins \
    --property=Environment \
    --no-pager 2>/dev/null || true

echo
echo "========== 26. JENKINS DIRECTORY =========="
sudo ls -ld /srv/jenkins
sudo ls -lah /srv/jenkins | head -30

echo
echo "========== 27. JENKINS OWNERSHIP =========="
sudo stat -c '%U:%G %a %n' /srv/jenkins

echo
echo "========== 28. JENKINS SYSTEMD OVERRIDE =========="
sudo cat /etc/systemd/system/jenkins.service.d/override.conf \
    2>/dev/null || echo "Jenkins override NOT FOUND"

echo
echo "========== 29. JENKINS REPOSITORY =========="
sudo cat /etc/yum.repos.d/jenkins.repo \
    2>/dev/null || echo "Jenkins repo NOT FOUND"

echo
echo "========== 30. DOCKER REPOSITORY =========="
sudo dnf repolist 2>/dev/null | grep -i docker \
    || echo "Docker repository not detected"

echo
echo "========== 31. DOCKER GROUP =========="
getent group docker 2>/dev/null || echo "Docker group not found"

echo
echo "========== 32. BOOTSTRAP LOG =========="
if [ -f /var/log/oec-bootstrap.log ]; then
    echo "Bootstrap log exists:"
    sudo ls -lh /var/log/oec-bootstrap.log
    echo
    echo "Last 30 lines:"
    sudo tail -30 /var/log/oec-bootstrap.log
else
    echo "Bootstrap log NOT FOUND"
fi

echo
echo "========== 33. KERNEL / REBOOT STATUS =========="
if command -v needs-restarting >/dev/null 2>&1; then
    sudo needs-restarting -r || true
else
    echo "needs-restarting command not available"
fi

echo
echo "========== 34. NETWORK / DOCKER TEST =========="
if sudo systemctl is-active --quiet docker; then
    sudo docker run --rm hello-world
else
    echo "Docker is not active - skipping hello-world test"
fi

echo
echo "============================================================"
echo " VERIFICATION COMPLETE"
echo "============================================================"
#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# OEC JAVA SUITE - EC2 BOOTSTRAP
#
# Target:
#   RHEL 9/10
#   Existing 100 GB root EBS
#
# Storage:
#   Existing LVM root disk
#   40 GB LV -> /var/lib/docker
#   10 GB LV -> /srv/jenkins
#
# Services:
#   Docker CE
#   Docker Compose
#   Java 21
#   Jenkins LTS
#
# Does NOT install:
#   SSM
#   PostgreSQL
#   TM application
#   Java application
#
# Designed to be SAFE TO RE-RUN.
# ============================================================

set -Eeuo pipefail
umask 027

LOG_FILE="/var/log/oec-bootstrap.log"

DOCKER_MOUNT="/var/lib/docker"
JENKINS_MOUNT="/srv/jenkins"

DOCKER_LV="/dev/RootVG/dockerVol"
JENKINS_LV="/dev/RootVG/jenkinsVol"

DOCKER_SIZE="40G"
JENKINS_SIZE="10G"

log() {
    echo "[$(date '+%F %T')] $*"
}

die() {
    echo
    echo "[ERROR] $*" >&2
    echo "[ERROR] Bootstrap failed."
    echo "[ERROR] Log: ${LOG_FILE}"
    exit 1
}

trap 'rc=$?; if [[ $rc -ne 0 ]]; then echo "[ERROR] Failed at line ${LINENO}, exit code ${rc}" >&2; fi' ERR

# ============================================================
# ROOT CHECK
# ============================================================

[[ "$EUID" -eq 0 ]] || die "Run this script as root."

mkdir -p "$(dirname "$LOG_FILE")"

exec > >(tee -a "$LOG_FILE") 2>&1

echo
echo "============================================================"
echo " OEC JAVA SUITE - SERVER BOOTSTRAP"
echo "============================================================"

# ============================================================
# OS DETECTION
# ============================================================

[[ -r /etc/os-release ]] || die "Cannot determine OS."

source /etc/os-release

case "${ID}" in
    rhel)
        log "OS: ${PRETTY_NAME}"
        ;;

    amzn)
        [[ "${VERSION_ID}" == 2023* ]] || \
            die "Unsupported Amazon Linux version: ${VERSION_ID}"

        log "OS: ${PRETTY_NAME}"
        ;;

    *)
        die "Unsupported OS: ${ID} ${VERSION_ID}"
        ;;
esac

# ============================================================
# BASIC PACKAGE INSTALLATION
# ============================================================

log "Installing required packages..."

dnf install -y \
    cloud-utils-growpart \
    lvm2 \
    xfsprogs \
    rsync \
    curl \
    wget \
    ca-certificates \
    dnf-plugins-core \
    gawk \
    grep \
    util-linux

# ============================================================
# DISK DISCOVERY
# ============================================================

echo
echo "=== CURRENT DISK LAYOUT ==="

lsblk

echo
echo "=== CURRENT VOLUME GROUP ==="

vgs || true

echo
echo "=== CURRENT LOGICAL VOLUMES ==="

lvs || true

# ============================================================
# VALIDATE EXPECTED ROOT DISK
# ============================================================

ROOT_SOURCE="$(findmnt -n -o SOURCE /)"

log "Root filesystem: ${ROOT_SOURCE}"

ROOT_FSTYPE="$(findmnt -n -o FSTYPE /)"

log "Root filesystem type: ${ROOT_FSTYPE}"

[[ "${ROOT_FSTYPE}" == "xfs" ]] || \
    die "Root filesystem must be XFS."

# ============================================================
# DETECT ROOTVG
# ============================================================

if ! vgs RootVG >/dev/null 2>&1; then
    die "RootVG was not found. Refusing to modify disk layout."
fi

log "RootVG detected."

# ============================================================
# DETECT ROOT PHYSICAL VOLUME
# ============================================================

ROOT_PV="$(pvs --noheadings -o pv_name,vg_name | awk '$2=="RootVG" {print $1; exit}')"

[[ -n "${ROOT_PV}" ]] || \
    die "Could not determine RootVG physical volume."

log "RootVG physical volume: ${ROOT_PV}"

# ============================================================
# EXPAND PARTITION ONLY IF NEEDED
#
# For your current server this is:
#   /dev/nvme0n1p4
#
# We derive it from the PV rather than hard-coding p4.
# ============================================================

PV_DISK=""
PV_PARTITION=""

if [[ "${ROOT_PV}" =~ ^(/dev/nvme[0-9]+n[0-9]+)p([0-9]+)$ ]]; then

    PV_DISK="${BASH_REMATCH[1]}"
    PV_PARTITION="${BASH_REMATCH[2]}"

elif [[ "${ROOT_PV}" =~ ^(/dev/[a-z]+)([0-9]+)$ ]]; then

    PV_DISK="${BASH_REMATCH[1]}"
    PV_PARTITION="${BASH_REMATCH[2]}"

else
    die "Could not determine parent disk for ${ROOT_PV}"
fi

log "PV disk: ${PV_DISK}"
log "PV partition: ${PV_PARTITION}"

# ============================================================
# CHECK WHETHER PARTITION ALREADY USES DISK
# ============================================================

DISK_SIZE_BYTES="$(blockdev --getsize64 "${PV_DISK}")"
PV_PARTITION_SIZE_BYTES="$(blockdev --getsize64 "${ROOT_PV}")"

log "Disk size: ${DISK_SIZE_BYTES} bytes"
log "PV partition size: ${PV_PARTITION_SIZE_BYTES} bytes"

if (( PV_PARTITION_SIZE_BYTES < DISK_SIZE_BYTES )); then

    log "Unused space detected after PV partition."
    log "Attempting to expand partition ${PV_PARTITION}."

    growpart "${PV_DISK}" "${PV_PARTITION}" || true

else

    log "PV partition already consumes available disk space."
fi

# ============================================================
# RESCAN PARTITION TABLE
# ============================================================

partprobe "${PV_DISK}" || true

udevadm settle || true

sleep 2

# ============================================================
# RESIZE PHYSICAL VOLUME
# ============================================================

log "Running pvresize..."

pvresize "${ROOT_PV}"

echo
echo "=== VOLUME GROUP AFTER PVRESIZE ==="

vgs RootVG

# ============================================================
# CHECK AVAILABLE VG SPACE
# ============================================================

VG_FREE_BYTES="$(vgs --noheadings --units b --nosuffix -o vg_free RootVG | tr -d ' ')"

log "RootVG free space: ${VG_FREE_BYTES} bytes"

REQUIRED_BYTES=$((50 * 1024 * 1024 * 1024))

if (( VG_FREE_BYTES < REQUIRED_BYTES )); then
    die "RootVG does not have enough free space for 40G Docker + 10G Jenkins."
fi

# ============================================================
# CREATE DOCKER LV ONLY IF MISSING
# ============================================================

echo
echo "=== DOCKER STORAGE ==="

if lvs "${DOCKER_LV}" >/dev/null 2>&1; then

    log "Docker LV already exists: ${DOCKER_LV}"

else

    log "Creating ${DOCKER_SIZE} Docker LV..."

    lvcreate \
        -L "${DOCKER_SIZE}" \
        -n dockerVol \
        RootVG

fi

# ============================================================
# CREATE JENKINS LV ONLY IF MISSING
# ============================================================

echo
echo "=== JENKINS STORAGE ==="

if lvs "${JENKINS_LV}" >/dev/null 2>&1; then

    log "Jenkins LV already exists: ${JENKINS_LV}"

else

    log "Creating ${JENKINS_SIZE} Jenkins LV..."

    lvcreate \
        -L "${JENKINS_SIZE}" \
        -n jenkinsVol \
        RootVG

fi

# ============================================================
# FORMAT DOCKER LV ONLY IF NO FILESYSTEM EXISTS
# ============================================================

echo
echo "=== DOCKER FILESYSTEM ==="

DOCKER_FS="$(blkid -o value -s TYPE "${DOCKER_LV}" 2>/dev/null || true)"

if [[ -z "${DOCKER_FS}" ]]; then

    log "Formatting Docker LV as XFS..."

    mkfs.xfs \
        -L docker-data \
        "${DOCKER_LV}"

elif [[ "${DOCKER_FS}" == "xfs" ]]; then

    log "Docker LV already contains XFS. NOT formatting."

else

    die "Docker LV contains unsupported filesystem: ${DOCKER_FS}"

fi

# ============================================================
# FORMAT JENKINS LV ONLY IF NO FILESYSTEM EXISTS
# ============================================================

echo
echo "=== JENKINS FILESYSTEM ==="

JENKINS_FS="$(blkid -o value -s TYPE "${JENKINS_LV}" 2>/dev/null || true)"

if [[ -z "${JENKINS_FS}" ]]; then

    log "Formatting Jenkins LV as XFS..."

    mkfs.xfs \
        -L jenkins-data \
        "${JENKINS_LV}"

elif [[ "${JENKINS_FS}" == "xfs" ]]; then

    log "Jenkins LV already contains XFS. NOT formatting."

else

    die "Jenkins LV contains unsupported filesystem: ${JENKINS_FS}"

fi

# ============================================================
# CREATE MOUNT POINTS
# ============================================================

mkdir -p "${DOCKER_MOUNT}"
mkdir -p "${JENKINS_MOUNT}"

# ============================================================
# STOP SERVICES BEFORE MIGRATION
# ============================================================

systemctl stop docker 2>/dev/null || true
systemctl stop jenkins 2>/dev/null || true

# ============================================================
# MOUNT TEMPORARY STORAGE
# ============================================================

mkdir -p /mnt/oec-docker
mkdir -p /mnt/oec-jenkins

if ! mountpoint -q /mnt/oec-docker; then
    mount "${DOCKER_LV}" /mnt/oec-docker
fi

if ! mountpoint -q /mnt/oec-jenkins; then
    mount "${JENKINS_LV}" /mnt/oec-jenkins
fi

# ============================================================
# MIGRATE EXISTING DOCKER DATA
#
# ONLY if Docker mount is not already active.
# ============================================================

if mountpoint -q "${DOCKER_MOUNT}"; then

    log "${DOCKER_MOUNT} already mounted. Skipping migration."

else

    if find "${DOCKER_MOUNT}" \
        -mindepth 1 \
        -maxdepth 1 \
        -print -quit 2>/dev/null | grep -q .; then

        log "Existing Docker data detected."
        log "Migrating Docker data to 40G LV..."

        rsync -aHAX \
            "${DOCKER_MOUNT}/" \
            /mnt/oec-docker/

    else

        log "No existing Docker data found."

    fi
fi

# ============================================================
# MIGRATE EXISTING JENKINS DATA
# ============================================================

if mountpoint -q "${JENKINS_MOUNT}"; then

    log "${JENKINS_MOUNT} already mounted. Skipping migration."

else

    if find "${JENKINS_MOUNT}" \
        -mindepth 1 \
        -maxdepth 1 \
        -print -quit 2>/dev/null | grep -q .; then

        log "Existing Jenkins data detected."
        log "Migrating Jenkins data to 10G LV..."

        rsync -aHAX \
            "${JENKINS_MOUNT}/" \
            /mnt/oec-jenkins/

    else

        log "No existing Jenkins data found."

    fi
fi

# ============================================================
# UNMOUNT TEMPORARY STORAGE
# ============================================================

umount /mnt/oec-docker || true
umount /mnt/oec-jenkins || true

# ============================================================
# FSTAB MANAGEMENT
# ============================================================

log "Configuring /etc/fstab..."

cp /etc/fstab "/etc/fstab.backup.$(date +%Y%m%d%H%M%S)"

# Remove old entries for these mount points only.
sed -i '\|[[:space:]]/var/lib/docker[[:space:]]|d' /etc/fstab
sed -i '\|[[:space:]]/srv/jenkins[[:space:]]|d' /etc/fstab

cat >> /etc/fstab <<'EOF'
LABEL=docker-data  /var/lib/docker  xfs  defaults  0 0
LABEL=jenkins-data /srv/jenkins     xfs  defaults  0 0
EOF

# ============================================================
# MOUNT FINAL FILESYSTEMS
# ============================================================

log "Mounting Docker filesystem..."

if mountpoint -q "${DOCKER_MOUNT}"; then
    log "${DOCKER_MOUNT} already mounted."
else
    mount "${DOCKER_MOUNT}"
fi

log "Mounting Jenkins filesystem..."

if mountpoint -q "${JENKINS_MOUNT}"; then
    log "${JENKINS_MOUNT} already mounted."
else
    mount "${JENKINS_MOUNT}"
fi

# ============================================================
# VERIFY MOUNTS
# ============================================================

DOCKER_FSTYPE="$(findmnt -n -o FSTYPE "${DOCKER_MOUNT}")"
JENKINS_FSTYPE="$(findmnt -n -o FSTYPE "${JENKINS_MOUNT}")"

[[ "${DOCKER_FSTYPE}" == "xfs" ]] || \
    die "Docker filesystem is not XFS."

[[ "${JENKINS_FSTYPE}" == "xfs" ]] || \
    die "Jenkins filesystem is not XFS."

log "Docker filesystem mounted successfully."
log "Jenkins filesystem mounted successfully."

# ============================================================
# DOCKER INSTALLATION
# ============================================================

echo
echo "=== DOCKER INSTALLATION ==="

if command -v docker >/dev/null 2>&1; then

    log "Docker already installed."

else

    log "Installing Docker CE repository..."

    dnf config-manager \
        --add-repo \
        https://download.docker.com/linux/rhel/docker-ce.repo

    log "Installing Docker CE..."

    dnf install -y \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin

fi

# ============================================================
# DOCKER CONFIGURATION
# ============================================================

mkdir -p /etc/docker

cat > /etc/docker/daemon.json <<'EOF'
{
  "data-root": "/var/lib/docker"
}
EOF

chmod 0644 /etc/docker/daemon.json

# ============================================================
# DOCKER SERVICE
# ============================================================

systemctl daemon-reload
systemctl enable docker

log "Starting Docker..."

if ! systemctl restart docker; then

    echo
    echo "============================================================"
    echo " Docker did not start."
    echo " This may be because a new kernel was installed."
    echo " The system may require ONE reboot."
    echo "============================================================"

    systemctl status docker --no-pager || true

fi

# ============================================================
# JAVA 21
# ============================================================

echo
echo "=== JAVA 21 ==="

dnf install -y java-21-openjdk

java -version

# ============================================================
# JENKINS REPOSITORY
# ============================================================

echo
echo "=== JENKINS REPOSITORY ==="

rpm --import \
    https://pkg.jenkins.io/rpm-stable/jenkins.io-2026.key

cat > /etc/yum.repos.d/jenkins.repo <<'EOF'
[jenkins]
name=Jenkins-stable
baseurl=https://pkg.jenkins.io/rpm-stable
gpgcheck=1
gpgkey=https://pkg.jenkins.io/rpm-stable/jenkins.io-2026.key
enabled=1
EOF

dnf clean metadata

# ============================================================
# JENKINS INSTALLATION
# ============================================================

echo
echo "=== JENKINS INSTALLATION ==="

if rpm -q jenkins >/dev/null 2>&1; then

    log "Jenkins already installed."

else

    dnf install -y jenkins

fi

# ============================================================
# JENKINS HOME
# ============================================================

echo
echo "=== JENKINS HOME ==="

mkdir -p /etc/systemd/system/jenkins.service.d

cat > /etc/systemd/system/jenkins.service.d/override.conf <<'EOF'
[Service]
Environment="JENKINS_HOME=/srv/jenkins"
EOF

id jenkins >/dev/null 2>&1 || \
    die "Jenkins user does not exist."

chown -R jenkins:jenkins /srv/jenkins
chmod 0755 /srv/jenkins

# ============================================================
# SYSTEMD
# ============================================================

systemctl daemon-reload

systemctl enable jenkins

log "Starting Jenkins..."

if ! systemctl restart jenkins; then

    echo
    echo "Jenkins failed to start."
    echo

    systemctl status jenkins --no-pager || true

    journalctl \
        -u jenkins \
        -n 50 \
        --no-pager || true

fi

sleep 10

# ============================================================
# FINAL VERIFICATION
# ============================================================

echo
echo "============================================================"
echo " FINAL SERVER VERIFICATION"
echo "============================================================"

echo
echo "=== DISK ==="
lsblk

echo
echo "=== VOLUME GROUP ==="
vgs RootVG

echo
echo "=== LOGICAL VOLUMES ==="
lvs RootVG

echo
echo "=== ROOT ==="
df -hT /

echo
echo "=== DOCKER STORAGE ==="
df -hT "${DOCKER_MOUNT}"
findmnt "${DOCKER_MOUNT}"

echo
echo "=== JENKINS STORAGE ==="
df -hT "${JENKINS_MOUNT}"
findmnt "${JENKINS_MOUNT}"

echo
echo "=== DOCKER SERVICE ==="
systemctl is-enabled docker || true
systemctl is-active docker || true

echo
echo "=== DOCKER VERSION ==="
docker --version || true

echo
echo "=== DOCKER COMPOSE ==="
docker compose version || true

echo
echo "=== DOCKER ROOT ==="
docker info \
    --format 'Docker Root Dir: {{.DockerRootDir}}' \
    2>/dev/null || true

echo
echo "=== JAVA ==="
java -version

echo
echo "=== JENKINS SERVICE ==="
systemctl is-enabled jenkins || true
systemctl is-active jenkins || true

echo
echo "=== JENKINS HOME ==="
systemctl show jenkins \
    --property=Environment \
    --no-pager

echo
echo "============================================================"
echo " OEC JAVA SUITE BOOTSTRAP COMPLETE"
echo "============================================================"

echo
echo "Storage:"
echo "  /var/lib/docker -> 40 GB XFS LV"
echo "  /srv/jenkins    -> 10 GB XFS LV"
echo
echo "Software:"
echo "  Docker CE"
echo "  Docker Compose"
echo "  Java 21"
echo "  Jenkins LTS"
echo
echo "Infrastructure:"
echo "  Existing 100 GB EBS"
echo "  No secondary EBS"
echo "  No SSM"
echo "  No PostgreSQL"
echo "  No application deployment"
echo
echo "============================================================"
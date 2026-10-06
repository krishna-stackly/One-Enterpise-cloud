
#!/usr/bin/env bash

# ============================================================
# OEC Java Suite - EC2 Bootstrap
#
# Target:
#   RHEL 10 x86_64
#
# Storage:
#   Existing root EBS: 100 GB
#
#   /var/lib/docker  -> 40 GB dedicated XFS filesystem
#   /srv/jenkins     -> 10 GB dedicated XFS filesystem
#   /                -> remaining root capacity
#
# IMPORTANT:
#   - No secondary EBS
#   - No LVM
#   - No physical repartitioning
#   - No XFS project quotas
#   - No reboot required
#   - Uses filesystem-backed fixed-size XFS files
#
# Installs:
#   - Docker CE
#   - Docker Compose plugin
#   - Java 21
#   - Jenkins LTS
#
# Does NOT install:
#   - SSM
#   - PostgreSQL
#   - TM application
#   - Java application
#
# ============================================================

set -Eeuo pipefail

umask 027

# ============================================================
# Configuration
# ============================================================

DOCKER_DIR="/var/lib/docker"
JENKINS_HOME="/srv/jenkins"

DOCKER_IMAGE="/docker-data.img"
JENKINS_IMAGE="/jenkins-data.img"

DOCKER_SIZE="40G"
JENKINS_SIZE="10G"

DOCKER_MOUNT_OPTS="loop"
JENKINS_MOUNT_OPTS="loop"

LOG_FILE="/var/log/oec-bootstrap.log"

# ============================================================
# Logging
# ============================================================

mkdir -p "$(dirname "$LOG_FILE")"

exec > >(tee -a "$LOG_FILE") 2>&1

log() {
    echo "[$(date '+%F %T')] $*"
}

die() {
    echo
    echo "[ERROR] $*" >&2
    echo "[ERROR] Bootstrap failed."
    echo "[ERROR] Log: $LOG_FILE"
    exit 1
}

trap 'rc=$?; if [[ $rc -ne 0 ]]; then echo "[ERROR] Failed at line ${LINENO} with exit code ${rc}"; fi' ERR

# ============================================================
# Root check
# ============================================================

[[ "$EUID" -eq 0 ]] || die "Run this script as root."

# ============================================================
# OS detection
# ============================================================

[[ -r /etc/os-release ]] || die "Cannot determine operating system."

source /etc/os-release

case "${ID}" in
    rhel)
        log "OS: ${PRETTY_NAME}"
        ;;

    amzn)
        if [[ "${VERSION_ID}" != 2023* ]]; then
            die "Unsupported Amazon Linux version: ${VERSION_ID}"
        fi
        log "OS: ${PRETTY_NAME}"
        ;;

    *)
        die "Unsupported OS: ${ID} ${VERSION_ID}"
        ;;
esac

# ============================================================
# Root filesystem verification
# ============================================================

ROOT_SOURCE="$(findmnt -n -o SOURCE /)"
ROOT_FSTYPE="$(findmnt -n -o FSTYPE /)"

log "Root filesystem: ${ROOT_SOURCE}"
log "Root filesystem type: ${ROOT_FSTYPE}"

[[ "$ROOT_FSTYPE" == "xfs" ]] || \
    die "Root filesystem must be XFS. Detected: ${ROOT_FSTYPE}"

# ============================================================
# Disk space verification
# ============================================================

AVAILABLE_KB="$(df -Pk / | awk 'NR==2 {print $4}')"

# Need slightly more than 50 GB because the two filesystem
# images themselves consume 50 GB on the root filesystem.
REQUIRED_KB=$((52 * 1024 * 1024))

if (( AVAILABLE_KB < REQUIRED_KB )); then
    die "Insufficient free space on root filesystem. Need at least ~52 GB free."
fi

log "Available root filesystem space: $((AVAILABLE_KB / 1024 / 1024)) GB"

# ============================================================
# Install basic packages
# ============================================================

log "Installing required packages"

dnf install -y \
    util-linux \
    grep \
    gawk \
    xfsprogs \
    curl \
    wget \
    ca-certificates \
    tar \
    gzip \
    fontconfig

# ============================================================
# Create filesystem image helper
# ============================================================

create_xfs_image() {

    local IMAGE="$1"
    local SIZE="$2"
    local LABEL="$3"

    if [[ -e "$IMAGE" ]]; then
        log "Filesystem image already exists: $IMAGE"
    else
        log "Creating ${SIZE} filesystem image: ${IMAGE}"

        fallocate -l "$SIZE" "$IMAGE" || \
            die "Failed to allocate ${IMAGE}"

        chmod 0600 "$IMAGE"
    fi

    # Check whether this is already an XFS filesystem.
    if ! blkid "$IMAGE" >/dev/null 2>&1; then
        log "Formatting ${IMAGE} as XFS"

        mkfs.xfs -f -L "$LABEL" "$IMAGE" || \
            die "Failed to format ${IMAGE}"
    else
        EXISTING_FS="$(blkid -o value -s TYPE "$IMAGE" || true)"

        if [[ "$EXISTING_FS" != "xfs" ]]; then
            die "${IMAGE} exists but is not XFS."
        fi

        log "${IMAGE} already contains an XFS filesystem."
    fi
}

# ============================================================
# Create Docker filesystem
# ============================================================

log "Preparing Docker filesystem"

mkdir -p "$DOCKER_DIR"

create_xfs_image \
    "$DOCKER_IMAGE" \
    "$DOCKER_SIZE" \
    "docker-data"

# ============================================================
# Create Jenkins filesystem
# ============================================================

log "Preparing Jenkins filesystem"

mkdir -p "$JENKINS_HOME"

create_xfs_image \
    "$JENKINS_IMAGE" \
    "$JENKINS_SIZE" \
    "jenkins-data"

# ============================================================
# Configure /etc/fstab
# ============================================================

log "Configuring persistent mounts"

touch /etc/fstab

add_fstab_entry() {

    local IMAGE="$1"
    local MOUNT="$2"
    local OPTIONS="$3"

    if grep -qE "^[^#]*[[:space:]]${MOUNT}[[:space:]]" /etc/fstab; then
        log "fstab entry already exists for ${MOUNT}"
    else
        echo "${IMAGE} ${MOUNT} xfs ${OPTIONS} 0 0" >> /etc/fstab
        log "Added fstab entry for ${MOUNT}"
    fi
}

add_fstab_entry \
    "$DOCKER_IMAGE" \
    "$DOCKER_DIR" \
    "loop"

add_fstab_entry \
    "$JENKINS_IMAGE" \
    "$JENKINS_HOME" \
    "loop"

# ============================================================
# Mount filesystems
# ============================================================

mount_filesystem() {

    local MOUNT="$1"

    if mountpoint -q "$MOUNT"; then
        log "${MOUNT} is already mounted."
    else
        log "Mounting ${MOUNT}"

        mount "$MOUNT" || \
            die "Failed to mount ${MOUNT}"
    fi
}

mount_filesystem "$DOCKER_DIR"
mount_filesystem "$JENKINS_HOME"

# ============================================================
# Verify mounts
# ============================================================

DOCKER_FSTYPE="$(findmnt -n -o FSTYPE "$DOCKER_DIR")"
JENKINS_FSTYPE="$(findmnt -n -o FSTYPE "$JENKINS_HOME")"

[[ "$DOCKER_FSTYPE" == "xfs" ]] || \
    die "${DOCKER_DIR} is not mounted as XFS."

[[ "$JENKINS_FSTYPE" == "xfs" ]] || \
    die "${JENKINS_HOME} is not mounted as XFS."

log "Docker filesystem mounted successfully."
log "Jenkins filesystem mounted successfully."

# ============================================================
# Docker installation
# ============================================================

log "Installing Docker"

if [[ "$ID" == "rhel" ]]; then

    dnf install -y dnf-plugins-core

    if ! dnf repolist | grep -q "docker-ce"; then
        log "Adding Docker CE repository"

        dnf config-manager \
            --add-repo \
            https://download.docker.com/linux/rhel/docker-ce.repo
    fi

    dnf install -y \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin

else

    dnf install -y docker

fi

# ============================================================
# Docker configuration
# ============================================================

log "Configuring Docker"

mkdir -p /etc/docker

cat > /etc/docker/daemon.json <<'EOF'
{
  "data-root": "/var/lib/docker"
}
EOF

chmod 0644 /etc/docker/daemon.json

# ============================================================
# Docker service
# ============================================================

log "Starting Docker"

systemctl daemon-reload
systemctl enable docker
systemctl restart docker

systemctl is-active --quiet docker || \
    die "Docker failed to start."

# ============================================================
# Docker verification
# ============================================================

DOCKER_ROOT="$(
    docker info \
        --format '{{.DockerRootDir}}' \
        2>/dev/null || true
)"

[[ "$DOCKER_ROOT" == "$DOCKER_DIR" ]] || \
    die "Docker root is '${DOCKER_ROOT}', expected '${DOCKER_DIR}'."

log "Docker root: ${DOCKER_ROOT}"

# ============================================================
# Jenkins installation
# ============================================================

log "Installing Jenkins LTS"

# Current Jenkins LTS repository key.
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

dnf install -y java-21-openjdk

dnf install -y jenkins

# ============================================================
# Jenkins filesystem ownership
# ============================================================

log "Configuring Jenkins filesystem"

id jenkins >/dev/null 2>&1 || \
    die "Jenkins user was not created by Jenkins package."

chown -R jenkins:jenkins "$JENKINS_HOME"

chmod 0755 "$JENKINS_HOME"

# ============================================================
# Jenkins JENKINS_HOME configuration
# ============================================================

log "Configuring JENKINS_HOME=${JENKINS_HOME}"

mkdir -p /etc/systemd/system/jenkins.service.d

cat > /etc/systemd/system/jenkins.service.d/override.conf <<EOF
[Service]
Environment="JENKINS_HOME=${JENKINS_HOME}"
EOF

systemctl daemon-reload

# ============================================================
# Jenkins service
# ============================================================

log "Starting Jenkins"

systemctl enable jenkins
systemctl restart jenkins

# Give Jenkins a little time to initialize.
sleep 10

if ! systemctl is-active --quiet jenkins; then

    log "Jenkins did not become active."

    systemctl status jenkins --no-pager || true

    journalctl -u jenkins \
        --no-pager \
        -n 50 || true

    die "Jenkins failed to start."

fi

# ============================================================
# Final verification
# ============================================================

echo
echo "============================================================"
echo "OEC JAVA SUITE SERVER"
echo "BOOTSTRAP COMPLETE"
echo "============================================================"

echo
echo "OS:"
cat /etc/redhat-release 2>/dev/null || true

echo
echo "ROOT:"
df -hT /

echo
echo "DOCKER:"
df -hT "$DOCKER_DIR"

echo
echo "JENKINS:"
df -hT "$JENKINS_HOME"

echo
echo "MOUNTS:"
findmnt "$DOCKER_DIR"
findmnt "$JENKINS_HOME"

echo
echo "DOCKER ROOT:"
docker info --format 'Docker Root Dir: {{.DockerRootDir}}'

echo
echo "DOCKER VERSION:"
docker --version

echo
echo "DOCKER COMPOSE:"
docker compose version

echo
echo "JAVA:"
java -version

echo
echo "JENKINS:"
systemctl is-active jenkins
systemctl is-enabled jenkins

echo
echo "JENKINS_HOME:"
systemctl show jenkins \
    --property=Environment \
    --no-pager

echo
echo "STORAGE LIMITS:"
echo "  Docker  : ${DOCKER_SIZE}"
echo "  Jenkins : ${JENKINS_SIZE}"
echo "  Root    : remaining capacity"

echo
echo "============================================================"
echo "No secondary EBS used."
echo "No LVM used."
echo "No XFS project quota used."
echo "No disk repartitioning performed."
echo "No reboot required."
echo "PostgreSQL not installed."
echo "SSM not installed."
echo "Java/TM application not deployed."
echo "============================================================"

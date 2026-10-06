
#!/usr/bin/env bash

set -Eeuo pipefail
umask 027

# ============================================================
# OEC Java Suite - EC2 Bootstrap
#
# OS:
#   RHEL 10 / RHEL 9
#   Amazon Linux 2023
#
# STORAGE DESIGN
#
#   Existing Root EBS: 100 GB
#
#   /var/lib/docker
#       Hard quota: 40 GB
#
#   /srv/jenkins
#       Hard quota: 10 GB
#
#   Remaining root filesystem:
#       Available for OS / applications / future use
#
# IMPORTANT:
#   - No secondary EBS volume required
#   - Does NOT partition the root disk
#   - Does NOT format the root filesystem
#   - Uses XFS project quotas
#
# DOES NOT:
#   - Install SSM
#   - Install PostgreSQL
#   - Install Jenkins application
#   - Deploy Java/TM application
#
# DOES:
#   - Install required packages
#   - Configure XFS project quotas
#   - Install Docker
#   - Configure Docker
#   - Set Docker data directory
#   - Create Jenkins directory
#   - Configure Jenkins directory quota
#   - Enable Docker
#   - Verify configuration
# ============================================================

# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------

DOCKER_MOUNT="/var/lib/docker"
JENKINS_HOME="/srv/jenkins"

DOCKER_QUOTA_GB=40
JENKINS_QUOTA_GB=10

DOCKER_PROJECT_ID=1001
JENKINS_PROJECT_ID=1002

LOG="/var/log/oec-bootstrap.log"

# ------------------------------------------------------------
# Logging / error handling
# ------------------------------------------------------------

mkdir -p "$(dirname "$LOG")"

exec > >(tee -a "$LOG") 2>&1

trap '
rc=$?
echo
echo "[ERROR] Bootstrap failed."
echo "[ERROR] Line      : ${LINENO}"
echo "[ERROR] Exit code : ${rc}"
echo "[ERROR] Log       : ${LOG}"
exit "$rc"
' ERR

log() {
    echo "[$(date '+%F %T')] $*"
}

die() {
    echo "[ERROR] $*" >&2
    exit 1
}

# ------------------------------------------------------------
# Root check
# ------------------------------------------------------------

[[ "$EUID" -eq 0 ]] ||
    die "Bootstrap must run as root."

# ------------------------------------------------------------
# OS detection
# ------------------------------------------------------------

[[ -r /etc/os-release ]] ||
    die "Cannot determine operating system."

source /etc/os-release

case "$ID" in

    rhel)
        OS_TYPE="rhel"
        ;;

    amzn)
        [[ "$VERSION_ID" == 2023* ]] ||
            die "Unsupported Amazon Linux version: $VERSION_ID"

        OS_TYPE="amazon"
        ;;

    *)
        die "Unsupported OS: ${ID} ${VERSION_ID}"
        ;;

esac

log "OS: ${PRETTY_NAME}"

# ------------------------------------------------------------
# Verify root filesystem
# ------------------------------------------------------------

ROOT_SOURCE=$(findmnt -n -o SOURCE /)
ROOT_FSTYPE=$(findmnt -n -o FSTYPE /)

[[ -n "$ROOT_SOURCE" ]] ||
    die "Cannot determine root filesystem."

log "Root filesystem: ${ROOT_SOURCE}"
log "Root filesystem type: ${ROOT_FSTYPE}"

# XFS is required for project quotas.
[[ "$ROOT_FSTYPE" == "xfs" ]] ||
    die "Root filesystem must be XFS for this bootstrap. Detected: ${ROOT_FSTYPE}"

# ------------------------------------------------------------
# Install required packages
# ------------------------------------------------------------

log "Installing required packages"

dnf install -y \
    util-linux \
    grep \
    gawk \
    xfsprogs

# RHEL requires Docker repository tools.
if [[ "$OS_TYPE" == "rhel" ]]; then
    dnf install -y dnf-plugins-core
fi

# ------------------------------------------------------------
# Verify quota tools
# ------------------------------------------------------------

command -v xfs_quota >/dev/null 2>&1 ||
    die "xfs_quota command is not available."

# ------------------------------------------------------------
# Determine root mount device
# ------------------------------------------------------------

ROOT_DEVICE=$(findmnt -n -o SOURCE /)

log "Root device: ${ROOT_DEVICE}"

# ------------------------------------------------------------
# Check existing Docker / Jenkins directories
# ------------------------------------------------------------

mkdir -p "$DOCKER_MOUNT"
mkdir -p "$JENKINS_HOME"

# ------------------------------------------------------------
# Configure XFS project quota
# ------------------------------------------------------------

log "Configuring XFS project quota"

# Determine root mountpoint.
ROOT_MOUNT="/"

# Check whether project quotas are already enabled.
ROOT_MOUNT_OPTIONS=$(findmnt -n -o OPTIONS /)

log "Current root mount options: ${ROOT_MOUNT_OPTIONS}"

# ------------------------------------------------------------
# Add project quota option to /etc/fstab
# ------------------------------------------------------------

FSTAB_ENTRY=$(awk '$1 !~ /^#/ && $2 == "/" {print; exit}' /etc/fstab || true)

if [[ -z "$FSTAB_ENTRY" ]]; then

    log "No root entry found in /etc/fstab. Skipping fstab modification."

else

    # Only add prjquota if not already present.
    if ! echo "$FSTAB_ENTRY" | grep -qE '(^|,)prjquota(,|$)'; then

        log "Adding prjquota to root filesystem mount options."

        ROOT_FSTAB_DEVICE=$(echo "$FSTAB_ENTRY" | awk '{print $1}')
        ROOT_FSTAB_FS=$(echo "$FSTAB_ENTRY" | awk '{print $3}')
        ROOT_FSTAB_DUMP=$(echo "$FSTAB_ENTRY" | awk '{print $5}')
        ROOT_FSTAB_PASS=$(echo "$FSTAB_ENTRY" | awk '{print $6}')

        ROOT_FSTAB_OPTIONS=$(echo "$FSTAB_ENTRY" | awk '{print $4}')

        NEW_ROOT_OPTIONS="${ROOT_FSTAB_OPTIONS},prjquota"

        # Remove duplicate prjquota if somehow already present.
        NEW_ROOT_OPTIONS=$(echo "$NEW_ROOT_OPTIONS" |
            sed 's/,,*/,/g')

        # Create backup before modification.
        cp -a /etc/fstab "/etc/fstab.oec-backup.$(date +%Y%m%d%H%M%S)"

        # Replace only the root filesystem entry.
        awk -v device="$ROOT_FSTAB_DEVICE" \
            -v fs="$ROOT_FSTAB_FS" \
            -v opts="$NEW_ROOT_OPTIONS" \
            -v dump="$ROOT_FSTAB_DUMP" \
            -v pass="$ROOT_FSTAB_PASS" '
            BEGIN {OFS="\t"}
            $1 == device && $2 == "/" {
                print device, "/", fs, opts, dump, pass
                next
            }
            {print}
            ' /etc/fstab > /etc/fstab.oec.new

        mv /etc/fstab.oec.new /etc/fstab

    else

        log "prjquota is already configured in /etc/fstab."

    fi
fi

# ------------------------------------------------------------
# Enable project quota on current root filesystem
# ------------------------------------------------------------

if echo "$ROOT_MOUNT_OPTIONS" | grep -qE '(^|,)prjquota(,|$)'; then

    log "Project quota already active on root filesystem."

else

    log "Project quota is not currently active."

    # Try remounting with project quotas.
    if mount -o remount,prjquota /; then

        log "Successfully enabled project quota using remount."

    else

        log "Current root filesystem cannot be remounted with prjquota."
        log "A reboot is required to activate prjquota from /etc/fstab."

        REBOOT_REQUIRED="true"

    fi
fi

# ------------------------------------------------------------
# Verify project quota support
# ------------------------------------------------------------

ROOT_MOUNT_OPTIONS=$(findmnt -n -o OPTIONS /)

if ! echo "$ROOT_MOUNT_OPTIONS" | grep -qE '(^|,)prjquota(,|$)'; then

    if [[ "${REBOOT_REQUIRED:-false}" == "true" ]]; then

        log "============================================================"
        log "REBOOT REQUIRED"
        log "============================================================"
        log
        log "The root filesystem requires a reboot to activate prjquota."
        log
        log "After reboot, run this script again:"
        log
        log "    sudo ./bootstrap.sh"
        log
        log "No disk partitioning or formatting was performed."
        log "============================================================"

        exit 0

    else

        die "Project quota is not active on the root filesystem."

    fi
fi

log "Project quota is active."

# ------------------------------------------------------------
# Create XFS project configuration
# ------------------------------------------------------------

log "Configuring Docker project"

cat > /etc/projects <<EOF
${DOCKER_PROJECT_ID}:${DOCKER_MOUNT}
${JENKINS_PROJECT_ID}:${JENKINS_HOME}
EOF

cat > /etc/projid <<EOF
docker:${DOCKER_PROJECT_ID}
jenkins:${JENKINS_PROJECT_ID}
EOF

chmod 0644 /etc/projects /etc/projid

# ------------------------------------------------------------
# Initialize Docker project
# ------------------------------------------------------------

xfs_quota -x -c "project -s docker" / ||
    die "Failed to initialize Docker XFS project."

# ------------------------------------------------------------
# Initialize Jenkins project
# ------------------------------------------------------------

xfs_quota -x -c "project -s jenkins" / ||
    die "Failed to initialize Jenkins XFS project."

# ------------------------------------------------------------
# Apply Docker quota
# ------------------------------------------------------------

log "Applying ${DOCKER_QUOTA_GB} GB Docker quota"

xfs_quota -x -c \
    "limit -p bhard=${DOCKER_QUOTA_GB}g docker" \
    / ||
    die "Failed to apply Docker quota."

# ------------------------------------------------------------
# Apply Jenkins quota
# ------------------------------------------------------------

log "Applying ${JENKINS_QUOTA_GB} GB Jenkins quota"

xfs_quota -x -c \
    "limit -p bhard=${JENKINS_QUOTA_GB}g jenkins" \
    / ||
    die "Failed to apply Jenkins quota."

# ------------------------------------------------------------
# Docker installation
# ------------------------------------------------------------

log "Installing Docker"

if [[ "$OS_TYPE" == "rhel" ]]; then

    if ! rpm -q docker-ce >/dev/null 2>&1; then

        dnf config-manager \
            --add-repo \
            https://download.docker.com/linux/rhel/docker-ce.repo

        dnf install -y \
            docker-ce \
            docker-ce-cli \
            containerd.io \
            docker-buildx-plugin \
            docker-compose-plugin

    else

        log "Docker CE is already installed."

    fi

else

    if ! rpm -q docker >/dev/null 2>&1; then

        dnf install -y docker

    else

        log "Docker is already installed."

    fi

fi

# ------------------------------------------------------------
# Docker directory
# ------------------------------------------------------------

mkdir -p "$DOCKER_MOUNT"

# ------------------------------------------------------------
# Docker configuration
# ------------------------------------------------------------

mkdir -p /etc/docker

cat > /etc/docker/daemon.json <<'EOF'
{
  "data-root": "/var/lib/docker"
}
EOF

chmod 0644 /etc/docker/daemon.json

# ------------------------------------------------------------
# Jenkins directory
# ------------------------------------------------------------

mkdir -p "$JENKINS_HOME"

chmod 0755 "$JENKINS_HOME"

# ------------------------------------------------------------
# Start Docker
# ------------------------------------------------------------

systemctl daemon-reload

systemctl enable docker

systemctl start docker

systemctl is-active --quiet docker ||
    die "Docker failed to start."

# ------------------------------------------------------------
# Verify Docker root directory
# ------------------------------------------------------------

DOCKER_ROOT=$(docker info \
    --format '{{.DockerRootDir}}' 2>/dev/null || true)

[[ "$DOCKER_ROOT" == "$DOCKER_MOUNT" ]] ||
    die "Docker root directory is '${DOCKER_ROOT}', expected '${DOCKER_MOUNT}'."

# ------------------------------------------------------------
# Verify quota configuration
# ------------------------------------------------------------

log "=============================================="
log "Quota configuration"
log "=============================================="

echo
echo "Docker quota:"
xfs_quota -x -c "report -p" /

echo
echo "Jenkins quota:"
xfs_quota -x -c "report -p" /

# ------------------------------------------------------------
# Final verification
# ------------------------------------------------------------

echo
log "=============================================="
log "BOOTSTRAP COMPLETE"
log "=============================================="

echo
echo "Root filesystem:"
df -hT /

echo
echo "Root filesystem mount options:"
findmnt -n -o SOURCE,FSTYPE,OPTIONS /

echo
echo "Docker:"
docker info --format \
    'Docker Root Dir: {{.DockerRootDir}}'

echo
echo "Docker Compose:"
docker compose version

echo
echo "Docker directory:"
du -sh "$DOCKER_MOUNT" 2>/dev/null || true

echo
echo "Jenkins directory:"
du -sh "$JENKINS_HOME" 2>/dev/null || true

echo
echo "Configured limits:"
echo "  Docker  : ${DOCKER_QUOTA_GB} GB"
echo "  Jenkins : ${JENKINS_QUOTA_GB} GB"

echo
log "No secondary EBS volume was used."
log "No disk partitioning was performed."
log "PostgreSQL was NOT installed."
log "Jenkins was NOT installed."
log "Java/TM application was NOT deployed."
log "Bootstrap completed successfully."

#!/usr/bin/env bash

set -Eeuo pipefail
umask 027

# ============================================================
# OEC Java Suite - EC2 Bootstrap
#
# Supported:
#   - RHEL 10
#   - RHEL 9
#   - Amazon Linux 2023
#
# Storage:
#   Root EBS : managed by Terraform
#   Data EBS : 150 GB
#
# LVM:
#   Docker     : 60 GB
#   PostgreSQL : 50 GB
#   Jenkins    : 20 GB
#   Free       : remaining VG space
#
# Does not:
#   - Install SSM
#   - Deploy PostgreSQL
#   - Deploy Jenkins
#   - Deploy Java/TM application
#   - Modify root disk
# ============================================================

set -Eeuo pipefail

VG="OECDataVG"

DOCKER_LV="lv_docker"
POSTGRES_LV="lv_postgres"
JENKINS_LV="lv_jenkins"

DOCKER_SIZE="60G"
POSTGRES_SIZE="50G"
JENKINS_SIZE="20G"

DOCKER_MOUNT="/var/lib/docker"
POSTGRES_MOUNT="/srv/postgres-data"
JENKINS_MOUNT="/srv/jenkins"

LOG="/var/log/oec-bootstrap.log"
DISK_WAIT_SECONDS=180

mkdir -p "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

trap '
rc=$?
echo "[ERROR] Bootstrap failed at line ${LINENO}. Exit code: ${rc}"
echo "[ERROR] Check ${LOG}"
exit "$rc"
' ERR

log() {
    echo "[$(date '+%F %T')] $*"
}

die() {
    echo "[ERROR] $*" >&2
    exit 1
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# ------------------------------------------------------------
# OS
# ------------------------------------------------------------

[[ "$EUID" -eq 0 ]] || die "Bootstrap must run as root."
[[ -r /etc/os-release ]] || die "Cannot determine operating system."

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
# Packages
# ------------------------------------------------------------

log "Installing required packages"

dnf install -y \
    lvm2 \
    xfsprogs \
    parted \
    util-linux \
    grep \
    awk

# RHEL requires Docker's repository tools.
if [[ "$OS_TYPE" == "rhel" ]]; then
    dnf install -y dnf-plugins-core
fi

# ------------------------------------------------------------
# Root disk detection
# ------------------------------------------------------------

ROOT_SOURCE=$(findmnt -n -o SOURCE /)
[[ -n "$ROOT_SOURCE" ]] || die "Cannot determine root filesystem."

ROOT_DISK=""

if [[ "$ROOT_SOURCE" == /dev/mapper/* ]]; then

    ROOT_VG=$(lvs --noheadings -o vg_name "$ROOT_SOURCE" 2>/dev/null | xargs)

    [[ -n "$ROOT_VG" ]] || die "Cannot determine root volume group."

    ROOT_PV=$(pvs --noheadings -o pv_name,vg_name 2>/dev/null |
        awk -v vg="$ROOT_VG" '$2 == vg {print $1; exit}')

    [[ -n "$ROOT_PV" ]] || die "Cannot determine root physical volume."

    ROOT_DISK=$(lsblk -ndo PKNAME "$ROOT_PV" | head -n 1)

else

    ROOT_DISK=$(lsblk -ndo PKNAME "$ROOT_SOURCE" | head -n 1)

fi

[[ -n "$ROOT_DISK" ]] || die "Could not determine root disk."

ROOT_DISK="/dev/$ROOT_DISK"

log "Root disk: $ROOT_DISK"

# ------------------------------------------------------------
# Find additional EBS disk
# ------------------------------------------------------------

log "Waiting for additional EBS disk..."

DATA_DISK=""

for ((elapsed=0; elapsed<DISK_WAIT_SECONDS; elapsed+=5)); do

    for candidate in $(lsblk -dnpo NAME,TYPE | awk '$2=="disk" {print $1}'); do

        [[ "$candidate" == "$ROOT_DISK" ]] && continue

        # Skip disks with mounted filesystems.
        if lsblk -npo MOUNTPOINT "$candidate" |
            grep -qvE '^[[:space:]]*$'; then
            continue
        fi

        # Skip existing LVM physical volumes.
        if pvs "$candidate" >/dev/null 2>&1; then
            continue
        fi

        # Skip disks that already contain partitions.
        if lsblk -lnpo NAME,TYPE "$candidate" |
            awk '$2=="part" {found=1} END {exit !found}'; then
            continue
        fi

        DATA_DISK="$candidate"
        break
    done

    [[ -n "$DATA_DISK" ]] && break

    sleep 5
    udevadm settle || true
done

[[ -n "$DATA_DISK" ]] ||
    die "No unused secondary EBS disk found after ${DISK_WAIT_SECONDS}s."

log "Data disk: $DATA_DISK"

# ------------------------------------------------------------
# Validate disk size
# ------------------------------------------------------------

DATA_DISK_BYTES=$(lsblk -bndo SIZE "$DATA_DISK")

DATA_DISK_GIB=$(
    awk -v bytes="$DATA_DISK_BYTES" \
        'BEGIN {printf "%.0f", bytes/1024/1024/1024}'
)

log "Data disk size: ${DATA_DISK_GIB} GiB"

(( DATA_DISK_GIB >= 130 )) ||
    die "Data disk is only ${DATA_DISK_GIB} GiB. Expected approximately 150 GiB."

# ------------------------------------------------------------
# Existing LVM check
# ------------------------------------------------------------

EXPECTED_LVS=(
    "$DOCKER_LV"
    "$POSTGRES_LV"
    "$JENKINS_LV"
)

EXISTING_LVS=0

for lv in "${EXPECTED_LVS[@]}"; do
    if lvs "${VG}/${lv}" >/dev/null 2>&1; then
        EXISTING_LVS=$((EXISTING_LVS + 1))
    fi
done

if (( EXISTING_LVS != 0 && EXISTING_LVS != 3 )); then
    die "Partial LVM configuration detected: ${EXISTING_LVS}/3 LVs exist."
fi

# ------------------------------------------------------------
# Create LVM
# ------------------------------------------------------------

if (( EXISTING_LVS == 0 )); then

    log "Creating LVM on ${DATA_DISK}"

    PART_COUNT=$(
        lsblk -lnpo NAME,TYPE "$DATA_DISK" |
        awk '$2=="part" {count++} END {print count+0}'
    )

    (( PART_COUNT == 0 )) ||
        die "Data disk already contains partitions. Refusing to overwrite."

    # Create GPT + LVM partition.
    parted -s "$DATA_DISK" mklabel gpt
    parted -s "$DATA_DISK" mkpart primary 1MiB 100%
    parted -s "$DATA_DISK" set 1 lvm on

    partprobe "$DATA_DISK"
    udevadm settle

    if [[ "$DATA_DISK" == /dev/nvme* ]]; then
        DATA_PART="${DATA_DISK}p1"
    else
        DATA_PART="${DATA_DISK}1"
    fi

    for ((i=0; i<30; i++)); do
        [[ -b "$DATA_PART" ]] && break
        sleep 2
        udevadm settle || true
    done

    [[ -b "$DATA_PART" ]] ||
        die "Partition ${DATA_PART} was not created."

    pvcreate "$DATA_PART"
    vgcreate "$VG" "$DATA_PART"

    lvcreate -L "$DOCKER_SIZE" \
        -n "$DOCKER_LV" "$VG"

    lvcreate -L "$POSTGRES_SIZE" \
        -n "$POSTGRES_LV" "$VG"

    lvcreate -L "$JENKINS_SIZE" \
        -n "$JENKINS_LV" "$VG"

    mkfs.xfs -f "/dev/${VG}/${DOCKER_LV}"
    mkfs.xfs -f "/dev/${VG}/${POSTGRES_LV}"
    mkfs.xfs -f "/dev/${VG}/${JENKINS_LV}"

else
    log "Existing complete LVM configuration found."
fi

# ------------------------------------------------------------
# Verify LVs
# ------------------------------------------------------------

for lv in "${EXPECTED_LVS[@]}"; do
    DEVICE="/dev/${VG}/${lv}"

    [[ -b "$DEVICE" ]] ||
        die "Missing LV: $DEVICE"

    FSTYPE=$(blkid -s TYPE -o value "$DEVICE" || true)

    [[ "$FSTYPE" == "xfs" ]] ||
        die "$DEVICE is not XFS."
done

# ------------------------------------------------------------
# Mount points
# ------------------------------------------------------------

mkdir -p \
    "$DOCKER_MOUNT" \
    "$POSTGRES_MOUNT" \
    "$JENKINS_MOUNT"

# ------------------------------------------------------------
# /etc/fstab
# ------------------------------------------------------------

add_fstab_entry() {

    local device="$1"
    local mountpoint="$2"
    local uuid

    uuid=$(blkid -s UUID -o value "$device")

    [[ -n "$uuid" ]] || die "No UUID found for $device."

    if ! awk \
        -v mp="$mountpoint" \
        '$1 !~ /^#/ && $2 == mp {found=1} END {exit found}' \
        /etc/fstab
    then
        echo "UUID=${uuid} ${mountpoint} xfs defaults,nofail 0 0" \
            >> /etc/fstab
    fi
}

add_fstab_entry "/dev/${VG}/${DOCKER_LV}" "$DOCKER_MOUNT"
add_fstab_entry "/dev/${VG}/${POSTGRES_LV}" "$POSTGRES_MOUNT"
add_fstab_entry "/dev/${VG}/${JENKINS_LV}" "$JENKINS_MOUNT"

# ------------------------------------------------------------
# Docker
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
    fi

else

    if ! rpm -q docker >/dev/null 2>&1; then
        dnf install -y docker
    fi

fi

# ------------------------------------------------------------
# Mount filesystems
# ------------------------------------------------------------

systemctl stop docker 2>/dev/null || true

mount "$DOCKER_MOUNT" 2>/dev/null || true
mount "$POSTGRES_MOUNT" 2>/dev/null || true
mount "$JENKINS_MOUNT" 2>/dev/null || true

mountpoint -q "$DOCKER_MOUNT" ||
    mount "$DOCKER_MOUNT"

mountpoint -q "$POSTGRES_MOUNT" ||
    mount "$POSTGRES_MOUNT"

mountpoint -q "$JENKINS_MOUNT" ||
    mount "$JENKINS_MOUNT"

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

systemctl daemon-reload
systemctl enable --now docker

systemctl is-active --quiet docker ||
    die "Docker failed to start."

# ------------------------------------------------------------
# Final verification
# ------------------------------------------------------------

log "=============================================="
log "BOOTSTRAP COMPLETE"
log "=============================================="

echo
echo "Storage:"
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS

echo
echo "LVM:"
vgs
lvs -o vg_name,lv_name,lv_size,lv_path

echo
echo "Mounts:"
df -hT \
    "$DOCKER_MOUNT" \
    "$POSTGRES_MOUNT" \
    "$JENKINS_MOUNT"

echo
echo "Docker:"
docker info --format 'Docker Root Dir: {{.DockerRootDir}}'

echo
echo "Docker Compose:"
docker compose version

echo
log "PostgreSQL, Jenkins and Java/TM application were NOT deployed."
log "Bootstrap completed successfully."
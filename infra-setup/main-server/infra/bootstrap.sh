#!/usr/bin/env bash

# ============================================================
# OEC Java Suite - EC2 Bootstrap
#
# OS:
#   Amazon Linux 2023
#   RHEL 9
#
# PURPOSE:
#   - Discover the additional EBS data disk automatically
#   - Never modify the root filesystem
#   - Create LVM on the additional disk
#   - Create dedicated LVs for:
#       Docker
#       PostgreSQL
#       Jenkins
#   - Format them with XFS
#   - Configure persistent mounts
#   - Install and configure Docker
#
# DOES NOT:
#   - Deploy PostgreSQL
#   - Deploy Jenkins
#   - Deploy Java/TM application
#   - Modify root partition
#   - Resize root filesystem
#
# Expected Terraform setup:
#
#   Root EBS  = 40 GB
#   Data EBS  = 150 GB
#
# Data disk:
#
#   60 GB Docker
#   50 GB PostgreSQL
#   20 GB Jenkins
#   ~20 GB free VG space
#
# ============================================================

set -Eeuo pipefail

umask 027

# ============================================================
# CONFIGURATION
# ============================================================

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

# Maximum time to wait for the secondary EBS disk.
DISK_WAIT_SECONDS=180

# ============================================================
# LOGGING
# ============================================================

mkdir -p "$(dirname "$LOG")"

exec > >(tee -a "$LOG") 2>&1

trap '
    rc=$?
    echo
    echo "============================================================"
    echo "[ERROR] Bootstrap failed"
    echo "[ERROR] Line      : ${LINENO}"
    echo "[ERROR] Exit code : ${rc}"
    echo "[ERROR] Log       : ${LOG}"
    echo "============================================================"
    exit "$rc"
' ERR

# ============================================================
# FUNCTIONS
# ============================================================

log() {
    printf '\n[%s] %s\n' "$(date '+%F %T')" "$*"
}

die() {
    echo "[ERROR] $*" >&2
    exit 1
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# ============================================================
# ROOT CHECK
# ============================================================

[[ "$EUID" -eq 0 ]] || die "Bootstrap must run as root."

[[ -r /etc/os-release ]] || die "Cannot identify operating system."

source /etc/os-release

case "${ID}:${VERSION_ID}" in

    rhel:9*)
        OS_TYPE="rhel"
        ;;

    amzn:2023*)
        OS_TYPE="amazon"
        ;;

    *)
        die "Unsupported OS: ${ID} ${VERSION_ID}. Supported: RHEL 9 / Amazon Linux 2023."

esac

log "Detected OS: ${PRETTY_NAME}"

# ============================================================
# INSTALL REQUIRED PACKAGES
# ============================================================

log "Installing required packages"

if [[ "$OS_TYPE" == "rhel" ]]; then

    dnf install -y \
        lvm2 \
        xfsprogs \
        cloud-utils-growpart \
        rsync \
        curl \
        util-linux \
        e2fsprogs

else

    dnf install -y \
        lvm2 \
        xfsprogs \
        cloud-utils-growpart \
        rsync \
        curl \
        util-linux \
        e2fsprogs

fi

# ============================================================
# VERIFY REQUIRED COMMANDS
# ============================================================

for cmd in \
    lsblk \
    blkid \
    pvs \
    vgs \
    lvs \
    pvcreate \
    vgcreate \
    lvcreate \
    mkfs.xfs \
    mount \
    findmnt \
    rsync
do

    command_exists "$cmd" || die "Required command not available: $cmd"

done

# ============================================================
# SHOW INITIAL STORAGE
# ============================================================

log "Initial block-device layout"

lsblk -o \
    NAME,SIZE,TYPE,FSTYPE,FSVER,MOUNTPOINTS,UUID

# ============================================================
# DISCOVER ROOT DISK
# ============================================================

log "Detecting root filesystem"

ROOT_SOURCE=$(findmnt -n -o SOURCE /)

[[ -n "$ROOT_SOURCE" ]] || die "Unable to determine root filesystem."

log "Root filesystem source: $ROOT_SOURCE"

# ============================================================
# DISCOVER ROOT DISK
# ============================================================

ROOT_DISK=""

if [[ "$ROOT_SOURCE" == /dev/mapper/* ]]; then

    # Root is an LVM logical volume.
    ROOT_LV_NAME=$(lvs --noheadings -o lv_name "$ROOT_SOURCE" 2>/dev/null | xargs || true)
    ROOT_VG_NAME=$(lvs --noheadings -o vg_name "$ROOT_SOURCE" 2>/dev/null | xargs || true)

    if [[ -n "$ROOT_VG_NAME" ]]; then

        ROOT_PV=$(pvs \
            --noheadings \
            -o pv_name,vg_name \
            2>/dev/null |
            awk -v vg="$ROOT_VG_NAME" '$2 == vg {print $1; exit}')

        if [[ -n "$ROOT_PV" ]]; then

            ROOT_DISK=$(lsblk \
                -ndo PKNAME "$ROOT_PV" 2>/dev/null |
                head -n 1 || true)

            if [[ -n "$ROOT_DISK" ]]; then
                ROOT_DISK="/dev/$ROOT_DISK"
            fi

        fi

    fi

else

    ROOT_DISK=$(lsblk \
        -ndo PKNAME "$ROOT_SOURCE" 2>/dev/null |
        head -n 1 || true)

    if [[ -n "$ROOT_DISK" ]]; then
        ROOT_DISK="/dev/$ROOT_DISK"
    fi

fi

[[ -b "$ROOT_DISK" ]] || die "Could not determine root disk."

log "Root disk detected: $ROOT_DISK"

# ============================================================
# DISCOVER SECONDARY EBS DISK
# ============================================================
#
# We intentionally do NOT assume:
#
#   /dev/sdf
#   /dev/nvme1n1
#
# because Nitro instances expose EBS volumes as NVMe devices.
#
# We find block devices that:
#
#   - are disks
#   - are not the root disk
#   - are not already mounted
#   - are not already part of an LVM VG
#
# ============================================================

log "Searching for secondary EBS data disk"

DATA_DISK=""

for candidate in $(lsblk -dnpo NAME,TYPE | awk '$2 == "disk" {print $1}'); do

    log "Inspecting disk: $candidate"

    # Never touch root disk.
    if [[ "$candidate" == "$ROOT_DISK" ]]; then
        log "Skipping root disk: $candidate"
        continue
    fi

    # Check whether the disk itself is mounted.
    if lsblk -npo MOUNTPOINT "$candidate" |
        grep -qvE '^[[:space:]]*$'; then

        log "Skipping mounted disk: $candidate"
        continue
    fi

    # Check whether disk already belongs to an LVM PV.
    if pvs "$candidate" >/dev/null 2>&1; then

        log "Skipping existing LVM PV: $candidate"
        continue

    fi

    DATA_DISK="$candidate"

    break

done

[[ -n "$DATA_DISK" ]] ||
    die "Could not find an unused secondary EBS data disk."

log "Secondary data disk detected: $DATA_DISK"

# ============================================================
# VALIDATE DATA DISK
# ============================================================

DATA_DISK_BYTES=$(lsblk -bndo SIZE "$DATA_DISK")

[[ "$DATA_DISK_BYTES" =~ ^[0-9]+$ ]] ||
    die "Unable to determine size of $DATA_DISK."

DATA_DISK_GIB=$(
    awk \
        -v bytes="$DATA_DISK_BYTES" \
        'BEGIN { printf "%.0f", bytes / 1024 / 1024 / 1024 }'
)

log "Secondary disk size: ${DATA_DISK_GIB} GiB"

# We expect approximately 150 GB.
# Allow smaller/larger values, but require at least 130 GB.
if (( DATA_DISK_GIB < 130 )); then

    die "Secondary disk is only ${DATA_DISK_GIB} GiB. Expected at least 130 GiB."

fi

# ============================================================
# WAIT FOR DEVICE SETTLE
# ============================================================

udevadm settle || true

# ============================================================
# DETERMINE WHETHER THIS IS FIRST RUN
# ============================================================

VG_EXISTS=0

if vgs "$VG" >/dev/null 2>&1; then
    VG_EXISTS=1
fi

log "Existing VG ${VG}: ${VG_EXISTS}"

# ============================================================
# IDEMPOTENCY CHECK
# ============================================================

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

    die "Partial LVM setup detected: ${EXISTING_LVS}/3 expected LVs exist. Refusing automatic repair."

fi

# ============================================================
# FIRST-TIME STORAGE INITIALIZATION
# ============================================================

if (( EXISTING_LVS == 0 )); then

    log "First-time data disk initialization"

    # --------------------------------------------------------
    # Verify disk does not contain a filesystem or partition.
    # --------------------------------------------------------

    if lsblk -no FSTYPE "$DATA_DISK" |
        grep -qvE '^[[:space:]]*$'; then

        die "Data disk $DATA_DISK already has a filesystem. Refusing to overwrite it."

    fi

    # --------------------------------------------------------
    # Verify no partitions exist.
    # --------------------------------------------------------

    PARTITION_COUNT=$(
        lsblk -lnpo NAME,TYPE "$DATA_DISK" |
        awk '$2 == "part" {count++} END {print count+0}'
    )

    if (( PARTITION_COUNT != 0 )); then

        die "Data disk $DATA_DISK already contains partitions. Refusing to overwrite."

    fi

    # --------------------------------------------------------
    # Create GPT partition table.
    # --------------------------------------------------------

    log "Creating GPT partition table"

    if command_exists sgdisk; then

        sgdisk --zap-all "$DATA_DISK"
        sgdisk --new=1:0:0 --typecode=1:8e00 "$DATA_DISK"

    else

        log "sgdisk not available; using parted"

        dnf install -y gdisk parted

        parted -s "$DATA_DISK" mklabel gpt
        parted -s "$DATA_DISK" mkpart primary 1MiB 100%
        parted -s "$DATA_DISK" set 1 lvm on

    fi

    partprobe "$DATA_DISK" || true

    udevadm settle

    # --------------------------------------------------------
    # Determine partition path.
    # --------------------------------------------------------

    if [[ "$DATA_DISK" == /dev/nvme* ]]; then
        DATA_PART="${DATA_DISK}p1"
    else
        DATA_PART="${DATA_DISK}1"
    fi

    # --------------------------------------------------------
    # Wait for partition.
    # --------------------------------------------------------

    log "Waiting for partition ${DATA_PART}"

    for ((i=1; i<=30; i++)); do

        if [[ -b "$DATA_PART" ]]; then
            break
        fi

        sleep 2

        udevadm settle || true

    done

    [[ -b "$DATA_PART" ]] ||
        die "Partition $DATA_PART was not created."

    log "Data partition created: $DATA_PART"

    # ========================================================
    # CREATE LVM PV
    # ========================================================

    log "Creating LVM physical volume"

    pvcreate "$DATA_PART"

    # ========================================================
    # CREATE VG
    # ========================================================

    log "Creating volume group: $VG"

    vgcreate "$VG" "$DATA_PART"

    # ========================================================
    # CREATE LOGICAL VOLUMES
    # ========================================================

    log "Creating Docker LV: ${DOCKER_SIZE}"

    lvcreate \
        -L "$DOCKER_SIZE" \
        -n "$DOCKER_LV" \
        "$VG"

    log "Creating PostgreSQL LV: ${POSTGRES_SIZE}"

    lvcreate \
        -L "$POSTGRES_SIZE" \
        -n "$POSTGRES_LV" \
        "$VG"

    log "Creating Jenkins LV: ${JENKINS_SIZE}"

    lvcreate \
        -L "$JENKINS_SIZE" \
        -n "$JENKINS_LV" \
        "$VG"

    # ========================================================
    # FORMAT FILESYSTEMS
    # ========================================================

    log "Formatting Docker filesystem"

    mkfs.xfs -f "/dev/${VG}/${DOCKER_LV}"

    log "Formatting PostgreSQL filesystem"

    mkfs.xfs -f "/dev/${VG}/${POSTGRES_LV}"

    log "Formatting Jenkins filesystem"

    mkfs.xfs -f "/dev/${VG}/${JENKINS_LV}"

else

    log "Existing complete LVM configuration detected."

fi

# ============================================================
# VERIFY LVs
# ============================================================

for lv in "${EXPECTED_LVS[@]}"; do

    [[ -b "/dev/${VG}/${lv}" ]] ||
        die "Expected LV missing: /dev/${VG}/${lv}"

done

# ============================================================
# CREATE MOUNT DIRECTORIES
# ============================================================

log "Creating application mount directories"

mkdir -p "$DOCKER_MOUNT"
mkdir -p "$POSTGRES_MOUNT"
mkdir -p "$JENKINS_MOUNT"

# ============================================================
# VERIFY FILESYSTEM TYPE
# ============================================================

for lv in "${EXPECTED_LVS[@]}"; do

    DEVICE="/dev/${VG}/${lv}"

    FSTYPE=$(blkid -s TYPE -o value "$DEVICE" || true)

    [[ "$FSTYPE" == "xfs" ]] ||
        die "$DEVICE has filesystem '$FSTYPE'. Expected XFS."

done

# ============================================================
# CONFIGURE FSTAB
# ============================================================

configure_mount() {

    local device="$1"
    local mountpoint="$2"

    local uuid

    uuid=$(blkid -s UUID -o value "$device")

    [[ -n "$uuid" ]] ||
        die "Could not obtain UUID for $device."

    # Check whether mountpoint already has an fstab entry.
    if awk \
        -v mp="$mountpoint" \
        '$1 !~ /^#/ && $2 == mp {found=1} END {exit !found}' \
        /etc/fstab
    then

        log "Adding fstab entry for $mountpoint"

        printf \
            'UUID=%s %s xfs defaults,nofail 0 0\n' \
            "$uuid" \
            "$mountpoint" >> /etc/fstab

    else

        log "fstab entry already exists for $mountpoint"

    fi

}

configure_mount \
    "/dev/${VG}/${DOCKER_LV}" \
    "$DOCKER_MOUNT"

configure_mount \
    "/dev/${VG}/${POSTGRES_LV}" \
    "$POSTGRES_MOUNT"

configure_mount \
    "/dev/${VG}/${JENKINS_LV}" \
    "$JENKINS_MOUNT"

# ============================================================
# INSTALL DOCKER
# ============================================================

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

# ============================================================
# STOP DOCKER BEFORE MOUNTING DOCKER DATA
# ============================================================

log "Stopping Docker before configuring Docker data directory"

systemctl stop docker.service 2>/dev/null || true
systemctl stop docker.socket 2>/dev/null || true

# ============================================================
# MOUNT FILESYSTEMS
# ============================================================

log "Mounting application filesystems"

mount "$DOCKER_MOUNT" 2>/dev/null || true
mount "$POSTGRES_MOUNT" 2>/dev/null || true
mount "$JENKINS_MOUNT" 2>/dev/null || true

# ============================================================
# VERIFY MOUNTS
# ============================================================

for mp in \
    "$DOCKER_MOUNT" \
    "$POSTGRES_MOUNT" \
    "$JENKINS_MOUNT"
do

    if ! mountpoint -q "$mp"; then

        log "Mounting $mp using fstab"

        mount "$mp"

    fi

done

# ============================================================
# VERIFY CORRECT DEVICES
# ============================================================

EXPECTED_DOCKER_DEVICE="/dev/${VG}/${DOCKER_LV}"
EXPECTED_POSTGRES_DEVICE="/dev/${VG}/${POSTGRES_LV}"
EXPECTED_JENKINS_DEVICE="/dev/${VG}/${JENKINS_LV}"

ACTUAL=$(findmnt -n -o SOURCE --target "$DOCKER_MOUNT")

[[ "$ACTUAL" == "$EXPECTED_DOCKER_DEVICE" ]] ||
    die "$DOCKER_MOUNT mounted from unexpected device: $ACTUAL"

ACTUAL=$(findmnt -n -o SOURCE --target "$POSTGRES_MOUNT")

[[ "$ACTUAL" == "$EXPECTED_POSTGRES_DEVICE" ]] ||
    die "$POSTGRES_MOUNT mounted from unexpected device: $ACTUAL"

ACTUAL=$(findmnt -n -o SOURCE --target "$JENKINS_MOUNT")

[[ "$ACTUAL" == "$EXPECTED_JENKINS_DEVICE" ]] ||
    die "$JENKINS_MOUNT mounted from unexpected device: $ACTUAL"

# ============================================================
# DOCKER CONFIGURATION
# ============================================================

log "Configuring Docker data root"

mkdir -p /etc/docker

DOCKER_CONFIG="/etc/docker/daemon.json"

if [[ -f "$DOCKER_CONFIG" ]]; then

    # Preserve an existing Docker configuration if one exists.
    if command_exists python3; then

        python3 - <<'PY'
import json

path = "/etc/docker/daemon.json"

try:
    with open(path, "r") as f:
        data = json.load(f)
except Exception:
    data = {}

data["data-root"] = "/var/lib/docker"

with open(path, "w") as f:
    json.dump(data, indent=2)
    f.write("\n")

PY

    else

        cat > "$DOCKER_CONFIG" <<'EOF'
{
  "data-root": "/var/lib/docker"
}
EOF

    fi

else

    cat > "$DOCKER_CONFIG" <<'EOF'
{
  "data-root": "/var/lib/docker"
}
EOF

fi

chmod 0644 "$DOCKER_CONFIG"

# ============================================================
# ENABLE DOCKER
# ============================================================

log "Enabling Docker"

systemctl daemon-reload

systemctl enable docker

systemctl start docker

# ============================================================
# VERIFY DOCKER
# ============================================================

if ! systemctl is-active --quiet docker; then

    systemctl status docker --no-pager -l || true

    die "Docker failed to start."

fi

# ============================================================
# FINAL VERIFICATION
# ============================================================

log "============================================================"
log "FINAL STORAGE VERIFICATION"
log "============================================================"

echo
echo "Block devices:"
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS,UUID

echo
echo "LVM:"
lvs \
    -o vg_name,lv_name,lv_size,lv_path

echo
echo "Volume groups:"
vgs

echo
echo "Mounted filesystems:"
df -hT \
    / \
    "$DOCKER_MOUNT" \
    "$POSTGRES_MOUNT" \
    "$JENKINS_MOUNT"

echo
echo "Mount sources:"
findmnt "$DOCKER_MOUNT"
findmnt "$POSTGRES_MOUNT"
findmnt "$JENKINS_MOUNT"

echo
echo "Docker:"
docker info --format \
    'Docker Root Dir: {{.DockerRootDir}}'

echo
echo "Docker Compose:"
docker compose version || true

echo
echo "============================================================"
log "Bootstrap completed successfully."
log "PostgreSQL, Jenkins and Java/TM application were NOT deployed."
echo "============================================================"
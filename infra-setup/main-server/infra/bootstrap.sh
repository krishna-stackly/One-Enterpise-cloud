
#!/usr/bin/env bash
# OEC Java Suite EC2 bootstrap for RHEL 9 / Amazon Linux 2023.
# Expands the root LVM partition to use the EBS disk, creates dedicated
# Docker/PostgreSQL/Jenkins LVs, configures persistent mounts, and installs Docker.
# It does NOT deploy PostgreSQL, Jenkins, or the Java/TM application.

set -Eeuo pipefail
umask 027

# ---- Configuration (adjust only if your AMI layout differs) ----
DISK="${DISK:-/dev/nvme0n1}"
PART_NUM="${PART_NUM:-4}"
VG="${VG:-RootVG}"
DOCKER_LV="lv_docker"
POSTGRES_LV="lv_postgres"
JENKINS_LV="lv_jenkins"
DOCKER_SIZE="40G"
POSTGRES_SIZE="20G"
JENKINS_SIZE="10G"
DOCKER_MOUNT="/var/lib/docker"
POSTGRES_MOUNT="/srv/postgres-data"
JENKINS_MOUNT="/srv/jenkins"
LOG="/var/log/oec-bootstrap.log"

exec > >(tee -a "$LOG") 2>&1
trap 'rc=$?; echo "[ERROR] Bootstrap failed at line ${LINENO} (exit ${rc}). Review ${LOG}; do not blindly rerun if LVM/mount setup started."; exit "$rc"' ERR

log() { printf '\n[%s] %s\n' "$(date '+%F %T')" "$*"; }
die() { echo "[ERROR] $*" >&2; exit 1; }

[[ "$EUID" -eq 0 ]] || die "Run as root: sudo bash ./bootstrap.sh"
[[ -b "$DISK" ]] || die "Disk $DISK not found. Set DISK to the attached EBS disk."
[[ -r /etc/os-release ]] || die "Cannot identify operating system."

source /etc/os-release
case "$ID:$VERSION_ID" in
  rhel:9*|amzn:2023*) ;;
  *) die "Supported systems: RHEL 9 or Amazon Linux 2023. Detected $ID $VERSION_ID." ;;
esac

PART="${DISK}p${PART_NUM}"
[[ -b "$PART" ]] || die "Expected LVM partition $PART not found. Inspect lsblk and update DISK/PART_NUM."

log "Installing required packages"
if [[ "$ID" == "rhel" ]]; then
  dnf install -y lvm2 xfsprogs cloud-utils-growpart gdisk rsync curl dnf-plugins-core
else
  dnf install -y lvm2 xfsprogs cloud-utils-growpart gdisk rsync curl
fi

command -v growpart >/dev/null || die "growpart command is unavailable."
command -v sgdisk >/dev/null || die "sgdisk command is unavailable."
command -v rsync >/dev/null || die "rsync command is unavailable."
command -v pvresize >/dev/null || die "LVM tools are unavailable."

# Validate the partition is already an LVM PV before changing disk layout.
pvs "$PART" >/dev/null 2>&1 || die "$PART is not an existing LVM physical volume; refusing to initialize or overwrite it."

# Detect first run vs a completed run. Partial LV state is deliberately rejected.
existing=0
for lv in "$DOCKER_LV" "$POSTGRES_LV" "$JENKINS_LV"; do
  if lvs "$VG/$lv" >/dev/null 2>&1; then existing=$((existing + 1)); fi
done
if (( existing != 0 && existing != 3 )); then
  die "Found only $existing of 3 expected data LVs. This is a partial setup; inspect 'sudo lvs' and the log before proceeding."
fi

# Refuse to overwrite unrelated mounts or fstab entries.
for mp in "$DOCKER_MOUNT" "$POSTGRES_MOUNT" "$JENKINS_MOUNT"; do
  mkdir -p "$mp"
  if mountpoint -q "$mp"; then
    if (( existing == 3 )); then
      # Existing completed setup: this is expected, checked below.
      :
    else
      die "$mp is already mounted but the dedicated LVs do not all exist. Refusing to continue."
    fi
  fi
done

log "Current block-device layout"
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS "$DISK"

log "Repairing GPT backup-table location and expanding partition ${PART_NUM}"
sgdisk -e "$DISK"
# growpart may return a non-zero status when there is no change on some images;
# capture output and verify the resulting partition size instead of assuming success.
if ! growpart "$DISK" "$PART_NUM"; then
  log "growpart returned non-zero; checking whether the partition is already expanded"
fi
partprobe "$DISK" || true
udevadm settle

PART_BYTES=$(lsblk -bndo SIZE "$PART" | tr -d ' ')
DISK_BYTES=$(lsblk -bndo SIZE "$DISK" | tr -d ' ')
[[ "$PART_BYTES" =~ ^[0-9]+$ && "$DISK_BYTES" =~ ^[0-9]+$ ]] || die "Could not read disk/partition sizes."
PART_GIB=$((PART_BYTES / 1024 / 1024 / 1024))
DISK_GIB=$((DISK_BYTES / 1024 / 1024 / 1024))
log "Disk=${DISK_GIB} GiB; partition=${PART_GIB} GiB"
(( PART_GIB >= DISK_GIB - 3 )) || die "Partition $PART is not expanded close to the end of the disk. Stop and inspect lsblk/fdisk."

log "Resizing LVM physical volume"
pvresize "$PART"

if (( existing == 3 )); then
  log "All three data LVs already exist; validating their filesystems and mounts (idempotent rerun)."
  for spec in "$DOCKER_LV:$DOCKER_MOUNT" "$POSTGRES_LV:$POSTGRES_MOUNT" "$JENKINS_LV:$JENKINS_MOUNT"; do
    lv=${spec%%:*}; mp=${spec#*:}; dev="/dev/$VG/$lv"
    [[ -b "$dev" ]] || die "Expected LV $dev is missing."
    fstype=$(blkid -s TYPE -o value "$dev" || true)
    [[ "$fstype" == "xfs" ]] || die "$dev has filesystem '$fstype', expected xfs."
    if ! mountpoint -q "$mp"; then
      uuid=$(blkid -s UUID -o value "$dev")
      grep -qE "^[[:space:]]*UUID=${uuid}[[:space:]]+${mp//\//\\/}[[:space:]]" /etc/fstab || \
        printf 'UUID=%s %s xfs defaults 0 0\n' "$uuid" "$mp" >> /etc/fstab
      mount "$mp"
    fi
    [[ "$(findmnt -n -o SOURCE --target "$mp")" == *"$lv"* ]] || die "$mp is mounted from an unexpected device."
  done
else
  VG_FREE=$(vgs --noheadings --units g --nosuffix -o vg_free "$VG" | xargs)
  log "Free space in $VG after pvresize: ${VG_FREE} GiB"
  awk -v free="$VG_FREE" 'BEGIN { exit !(free >= 72) }' || die "Need at least 72 GiB free to create 70 GiB of data LVs with some safety margin."

  # Install Docker before configuring its data directory.
  log "Installing Docker Engine"
  if [[ "$ID" == "rhel" ]]; then
    if ! rpm -q docker-ce >/dev/null 2>&1; then
      dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
      dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    fi
  else
    dnf install -y docker
  fi

  log "Stopping Docker before moving/configuring its data directory"
  systemctl stop docker.service docker.socket 2>/dev/null || true

  log "Creating dedicated logical volumes"
  lvcreate -L "$DOCKER_SIZE" -n "$DOCKER_LV" "$VG"
  lvcreate -L "$POSTGRES_SIZE" -n "$POSTGRES_LV" "$VG"
  lvcreate -L "$JENKINS_SIZE" -n "$JENKINS_LV" "$VG"

  log "Formatting newly created logical volumes as XFS"
  mkfs.xfs -f "/dev/$VG/$DOCKER_LV"
  mkfs.xfs -f "/dev/$VG/$POSTGRES_LV"
  mkfs.xfs -f "/dev/$VG/$JENKINS_LV"

  # Refuse pre-existing fstab entries to prevent duplicate or conflicting mounts.
  for mp in "$DOCKER_MOUNT" "$POSTGRES_MOUNT" "$JENKINS_MOUNT"; do
    if awk -v mp="$mp" '$1 !~ /^#/ && $2 == mp { found=1 } END { exit !found }' /etc/fstab; then
      die "$mp already has an /etc/fstab entry. Inspect it before continuing."
    fi
  done

  mount_data_volume() {
    local lv="$1" mp="$2" stage="$3" uuid
    local dev="/dev/$VG/$lv"
    mkdir -p "$mp" "$stage"
    mount "$dev" "$stage"
    # Copy any pre-existing data while staying on the source filesystem.
    rsync -aHAXx "$mp/" "$stage/"
    uuid=$(blkid -s UUID -o value "$dev")
    [[ -n "$uuid" ]] || die "No filesystem UUID found for $dev."
    printf 'UUID=%s %s xfs defaults 0 0\n' "$uuid" "$mp" >> /etc/fstab
    umount "$stage"
    mount "$mp"
    rmdir "$stage" 2>/dev/null || true
  }

  log "Configuring persistent mounts and preserving existing directory contents"
  mount_data_volume "$DOCKER_LV" "$DOCKER_MOUNT" /mnt/oec-stage-docker
  mount_data_volume "$POSTGRES_LV" "$POSTGRES_MOUNT" /mnt/oec-stage-postgres
  mount_data_volume "$JENKINS_LV" "$JENKINS_MOUNT" /mnt/oec-stage-jenkins
fi

log "Enabling and starting Docker"
systemctl enable docker
systemctl start docker
systemctl is-active --quiet docker || die "Docker failed to start; inspect 'systemctl status docker -l' and $LOG."

log "Final verification"
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS "$DISK"
df -hT / "$DOCKER_MOUNT" "$POSTGRES_MOUNT" "$JENKINS_MOUNT"
lvs -o vg_name,lv_name,lv_size,lv_path "$VG"
docker info --format 'Docker Root Dir: {{.DockerRootDir}}'
docker compose version || log "Docker Compose plugin not available; install/enable it separately if required."

log "Bootstrap completed successfully. PostgreSQL, Jenkins, and the Java/TM application have NOT been deployed."
SCRIPT
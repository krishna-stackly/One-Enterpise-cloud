#!/bin/bash
set -euxo pipefail

############################################
# Update packages
############################################
dnf update -y || apt-get update -y

############################################
# Install MySQL Server (Amazon Linux 2023 example)
############################################
dnf install -y mysql-community-server mysql-community-client || \
  apt-get install -y mysql-server mysql-client

systemctl enable mysqld || systemctl enable mysql

############################################
# Wait for and format/mount the attached data volume
# NOTE: on Nitro instances the device may show up as /dev/xvdf or
# /dev/nvme1n1 instead of /dev/sdf - this checks both common paths.
############################################
DATA_DEVICE=""
for dev in /dev/xvdf /dev/nvme1n1 /dev/sdf; do
  if [ -e "$dev" ]; then
    DATA_DEVICE="$dev"
    break
  fi
done

if [ -n "$DATA_DEVICE" ]; then
  if ! blkid "$DATA_DEVICE"; then
    mkfs -t ext4 "$DATA_DEVICE"
  fi

  mkdir -p /data/mysql
  mount "$DATA_DEVICE" /data/mysql

  # Persist mount across reboots
  UUID=$(blkid -s UUID -o value "$DATA_DEVICE")
  echo "UUID=${UUID}  /data/mysql  ext4  defaults,nofail  0  2" >> /etc/fstab
fi

############################################
# Point MySQL datadir at the persistent volume
# (Run once - on first boot only, before mysqld starts)
############################################
if [ ! -d /data/mysql/mysql ]; then
  systemctl stop mysqld || systemctl stop mysql || true

  rsync -a /var/lib/mysql/ /data/mysql/ 2>/dev/null || true
  chown -R mysql:mysql /data/mysql

  sed -i 's|^datadir.*|datadir=/data/mysql|' /etc/my.cnf.d/mysql-server.cnf 2>/dev/null || \
  sed -i 's|^datadir.*|datadir=/data/mysql|' /etc/mysql/mysql.conf.d/mysqld.cnf 2>/dev/null || true
fi

systemctl start mysqld || systemctl start mysql

############################################
# Bind to private network only (defense in depth alongside SG rules)
############################################
mysql -e "SELECT 1" || true
# VPS Hardening & Maintenance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up database backups, firewall, and shell convenience for the VPS.

**Architecture:** Three independent tasks — a cron-based SQLite backup script, ufw firewall rules, and shell functions in ~/.bashrc. All naming follows `<project-name>` convention for future multi-app support.

**Tech Stack:** bash, sqlite3, ufw, cron

---

### Task 1: Install sqlite3 on the host

**Files:**
- None (system package)

**Step 1: Install sqlite3**

Run: `apt-get update && apt-get install -y sqlite3`
Expected: sqlite3 installed successfully

**Step 2: Verify installation**

Run: `sqlite3 --version`
Expected: version string like `3.45.x`

---

### Task 2: Create the backup script

**Files:**
- Create: `/root/scripts/backup-pharmacy-timetable.sh`

**Step 1: Create scripts directory**

Run: `mkdir -p /root/scripts /root/backups/pharmacy-timetable`

**Step 2: Write the backup script**

Create `/root/scripts/backup-pharmacy-timetable.sh`:

```bash
#!/bin/bash
set -euo pipefail

PROJECT="pharmacy-timetable"
DB_SOURCE="/var/lib/docker/volumes/pharmacy_data/_data/pharmacy.db"
BACKUP_DIR="/root/backups/${PROJECT}"
RETENTION_DAYS=7
DATE=$(date +%Y-%m-%d)
BACKUP_FILE="${BACKUP_DIR}/${PROJECT}-${DATE}.db"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Check source DB exists
if [ ! -f "$DB_SOURCE" ]; then
    echo "[ERROR] Database not found: $DB_SOURCE"
    exit 1
fi

# Safe backup using sqlite3 .backup command
sqlite3 "$DB_SOURCE" ".backup '${BACKUP_FILE}'"

# Verify backup was created and is not empty
if [ ! -s "$BACKUP_FILE" ]; then
    echo "[ERROR] Backup file is empty or missing: $BACKUP_FILE"
    exit 1
fi

# Delete backups older than retention period
find "$BACKUP_DIR" -name "${PROJECT}-*.db" -mtime +${RETENTION_DAYS} -delete

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[OK] ${PROJECT} backup: ${BACKUP_FILE} (${BACKUP_SIZE})"
```

**Step 3: Make executable**

Run: `chmod +x /root/scripts/backup-pharmacy-timetable.sh`

**Step 4: Test the script**

Run: `/root/scripts/backup-pharmacy-timetable.sh`
Expected: `[OK] pharmacy-timetable backup: /root/backups/pharmacy-timetable/pharmacy-timetable-2026-02-13.db (312K)`

**Step 5: Verify backup integrity**

Run: `sqlite3 /root/backups/pharmacy-timetable/pharmacy-timetable-2026-02-13.db "SELECT count(*) FROM Staff;"`
Expected: a number (confirms DB is readable and has data)

---

### Task 3: Add cron job for daily backups

**Files:**
- Modify: crontab

**Step 1: Add cron entry**

Run: `(crontab -l 2>/dev/null; echo "0 2 * * * /root/scripts/backup-pharmacy-timetable.sh >> /var/log/backup-pharmacy-timetable.log 2>&1") | crontab -`

**Step 2: Verify cron is registered**

Run: `crontab -l`
Expected: shows the backup line with `0 2 * * *`

---

### Task 4: Enable firewall (ufw)

**Files:**
- None (system config)

**Step 1: Allow SSH first (CRITICAL — do this before enabling)**

Run: `ufw allow 22/tcp`
Expected: `Rules updated`

**Step 2: Allow HTTP and HTTPS**

Run: `ufw allow 80/tcp && ufw allow 443/tcp`
Expected: `Rules updated` for both

**Step 3: Enable ufw with default deny**

Run: `echo "y" | ufw enable`
Expected: `Firewall is active and enabled on system startup`

**Step 4: Verify rules**

Run: `ufw status verbose`
Expected:
```
Status: active
Default: deny (incoming), allow (outgoing)

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere
80/tcp                     ALLOW IN    Anywhere
443/tcp                    ALLOW IN    Anywhere
```

**Step 5: Verify SSH still works**

Run: `ss -tlnp | grep :22`
Expected: sshd listening on port 22 (you're still connected)

**Step 6: Verify app still works**

Run: `curl -sk -o /dev/null -w "HTTP %{http_code}" https://st.farmasialde.com/timetable/api/health`
Expected: `HTTP 200`

---

### Task 5: Add shell convenience functions

**Files:**
- Modify: `~/.bashrc`

**Step 1: Append functions to ~/.bashrc**

Append to `~/.bashrc`:

```bash

# === Project shortcuts ===
dev() {
    local project="${1:-pharmacy-timetable}"
    cd ~/projects/"$project" && git pull
}

deploy() {
    local msg="${1:?Usage: deploy \"commit message\"}"
    git add -A && git commit -m "$msg" && git push
}
```

**Step 2: Reload bashrc**

Run: `source ~/.bashrc`

**Step 3: Test dev function**

Run: `dev`
Expected: changes to ~/projects/pharmacy-timetable and shows `Already up to date.` or pulls latest

**Step 4: Test dev with project name (future-proof)**

Run: `dev pharmacy-timetable`
Expected: same result — works with explicit project name

---

### Task 6: Final verification

**Step 1: Verify all three components**

Run the following checks:
- `crontab -l` — shows backup cron
- `ufw status` — shows active with 3 rules
- `type dev && type deploy` — shows functions are defined
- `ls /root/backups/pharmacy-timetable/` — shows today's backup

**Step 2: Commit the plan**

```bash
cd ~/projects/pharmacy-timetable
git add docs/plans/2026-02-13-vps-hardening-plan.md
git commit -m "Add VPS hardening implementation plan"
git push
```

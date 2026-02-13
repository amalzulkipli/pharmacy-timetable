# VPS Hardening & Maintenance Design

## Context

Single VPS (Hetzner, 4GB RAM, 38GB disk) running Dokploy with pharmacy-timetable app. Server will host more apps in future.

## Priority 1: Database Backups

**Strategy:** Daily cron job using `sqlite3 .backup` with 7-day local retention.

**Components:**
- `/root/scripts/backup-pharmacy-timetable.sh` — backup script
- `/root/backups/pharmacy-timetable/` — backup destination (per-project directory for future apps)
- Cron: `0 2 * * *` (daily 2:00 AM MYT)

**Script logic:**
1. Run `sqlite3 .backup` from the Docker volume source
2. Save as `pharmacy-timetable-YYYY-MM-DD.db`
3. Delete backups older than 7 days
4. Log result to stdout (captured by cron syslog)

**Naming convention:** `backup-<project-name>.sh` and `/root/backups/<project-name>/` so future apps follow the same pattern.

## Priority 2: Firewall (ufw)

**Rules:**
- Allow 22/tcp (SSH)
- Allow 80/tcp (HTTP)
- Allow 443/tcp (HTTPS)
- Default deny incoming

**Safety:** Enable SSH rule before activating ufw.

**Docker note:** Docker manages its own iptables chains for container networking. ufw controls host-level access only.

## Priority 4: Working Copy Convenience

**Shell functions in `~/.bashrc`:**
- `dev` — cd to project + git pull
- `deploy "message"` — git add, commit, push

**Naming:** Functions are generic. `dev` pulls the default project. As more projects are added, can extend to `dev pharmacy-timetable` or `dev other-app`.

## Future-proofing

All naming follows `<project-name>` convention:
- Backup scripts: `/root/scripts/backup-<project>.sh`
- Backup dirs: `/root/backups/<project>/`
- Working copies: `/root/projects/<project>/`

Adding a new app means: copy the backup script, update the path, add a cron line.

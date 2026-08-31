# Deployment

This repo builds an image. It does not carry the compose file that runs it.

- **Image:** GitHub Actions (`.github/workflows/build-image.yml`) builds
  `ghcr.io/amalzulkipli/pharmacy-timetable` on every push to `main`, tagged by commit sha.
  sv1 compiles nothing; it only pulls. An on-box build is what OOM'd the old server on
  2026-05-20.
- **Compose file, source of truth:** `~/wiki/personal/general/alde/timetable/docker-compose.yml`,
  rsynced to `sv1:~/alde/timetable/`. It pins `TIMETABLE_TAG` to a commit sha, caps the
  container at 512m / 1 CPU, joins the shared `edge` network, and carries the Traefik labels
  including the `/` to `/timetable` redirect that replaced the retired Alde Hub.
- **Volume:** `timetable_pharmacy-data`, mounted at `/app/prisma`.
- **Backup:** `backup-timetable.sh` beside the compose file, `18:10 UTC` on sv1 (02:10 MYT).

A `docker-compose.yml` used to sit at the repo root from the Dokploy era. It declared
`networks: dokploy-network (external)`, a network that exists on no host since 2026-08-31,
so deploying from a clean clone failed with no obvious cause. Removed 2026-08-31 rather than
mirrored, because a third copy of the compose file would drift from the two that are rsynced.
Recover it from git history if it is ever wanted: `git log --all -- docker-compose.yml`.

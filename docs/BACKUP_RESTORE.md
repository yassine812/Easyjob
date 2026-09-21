# Startup Starter — Backup & Restore

All persistent data lives in PostgreSQL (`postgres_data` volume) and S3
(object storage). Redis is ephemeral by design (queues can be re-driven;
realtime state rebuilds), though it runs `appendonly` for safety.

## 1. Backup (PostgreSQL)

Manual backup:

```bash
# On the VPS, from the compose directory:
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres pg_dump -U postgres -d startup_starter -Fc -f /backups/startup_starter_$(date +%F).dump
```

Custom-format (`-Fc`) is required for `pg_restore` (selective/parallel restore).

### Automated nightly backup (host cron)

```cron
0 3 * * * cd /opt/startup-starter && docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres pg_dump -U postgres -d startup_starter -Fc -f /backups/startup_starter_$(date +\%F).dump && find /backups -name 'startup_starter_*.dump' -mtime +14 -delete
```

- Retention: **14 daily dumps**.
- Store the `/backups` mount **off-box** (rsync/S3/restic) — a full disk loss
  must not lose the backups.

### S3 object storage

The bucket itself is the backup (private objects, versioning recommended).
Enable **S3 versioning** on the bucket to recover from accidental overwrites.

## 2. Restore

Restore into an isolated database first, verify, then switch:

```bash
# 1. Create an isolated database
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres psql -U postgres -c "CREATE DATABASE restore_test;"

# 2. Restore the dump into it
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres pg_restore -U postgres -d restore_test --no-owner /backups/startup_starter_YYYY-MM-DD.dump

# 3. Verify integrity (compare against the live DB)
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres psql -U postgres -d restore_test -c "SELECT count(*) FROM \"User\";"
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres psql -U postgres -d startup_starter -c "SELECT count(*) FROM \"User\";"

# 4. When verified, restore into the live database (brief maintenance window):
docker compose -f docker-compose.prod.yml --env-file .env.production stop api worker
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres pg_restore -U postgres -d startup_starter --clean --if-exists --no-owner /backups/startup_starter_YYYY-MM-DD.dump
docker compose -f docker-compose.prod.yml --env-file .env.production start api worker

# 5. Drop the test database
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres psql -U postgres -c "DROP DATABASE restore_test;"
```

This exact procedure (backup → restore into `restore_test` → row counts match)
is verified in CI/staging.

## 3. Rollback strategy

1. **Code rollback**: deploy the previous image tag (`up -d --no-build api`,
   or `git checkout <tag>` + rebuild). The API/worker and web are stateless —
   no data impact.
2. **Schema rollback**: Prisma migrations are additive by convention. If a
   destructive migration was deployed, restore the pre-deploy backup (above)
   with `--clean --if-exists`.
3. **Data corruption**: restore the latest good nightly dump (point-in-time
   recovery requires enabling WAL archiving — not enabled in the default setup;
   add `archive_mode`/`archive_command` if you need PITR).

## 4. Verification drill

Run a restore drill at least monthly:

```bash
bash -c '
  docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres pg_dump -U postgres -d startup_starter -Fc -f /backups/drill.dump &&
  docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS drill_test;" -c "CREATE DATABASE drill_test;" &&
  docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres pg_restore -U postgres -d drill_test --no-owner /backups/drill.dump &&
  docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres psql -U postgres -d drill_test -t -c "SELECT count(*) FROM \"User\";"
'
```

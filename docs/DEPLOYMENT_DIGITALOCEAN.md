# DigitalOcean VPS deployment

This procedure targets Ubuntu 24.04 LTS, Docker Compose, host Nginx, and the repository's `web`, `ml-service`, and MySQL containers. Only Nginx listens publicly; MySQL and FastAPI are on Compose's private network, and Next.js is bound to `127.0.0.1:3000`.

## Server sizing

The repository contains about 0.87 GiB of model weight files. YOLO weights are loaded when the ML service starts; U-Net and Mask R-CNN weights are loaded on the first forensic request and retained in memory. The PALL-Text chat model is fetched from Hugging Face on the first local-chat request and its exact model size/revision is not pinned here. Those facts do not establish reliable peak RAM or inference latency.

- **Minimum for a limited pilot:** 4 vCPU, 8 GiB RAM, 80 GiB SSD. Disable neither model features nor chat automatically; first measure model load and inference on this size. Do not treat this as a validated capacity.
- **Recommended starting point:** 8 vCPU, 16 GiB RAM, 160 GiB SSD. Keep inference concurrency at one and monitor memory, disk, swap, and latency before increasing traffic.
- Ubuntu 24.04 LTS, Docker Engine and Compose plugin. Add 4 GiB swap as an emergency buffer, not as a substitute for RAM.
- No GPU is explicitly required by the current code. PyTorch selects CUDA when it is available and otherwise runs on CPU. CPU inference can be slow; benchmark all enabled model paths before opening public access.

The figures above are conservative initial provisioning recommendations, not measured peak usage. Run each model path with representative images and record container `docker stats` before setting memory limits or promising concurrency.

## 1. Create and access the VPS

In the DigitalOcean control panel, create an Ubuntu 24.04 Droplet in the nearest region, attach an SSH key, enable monitoring, and attach a Cloud Firewall. Create a DNS A record for the application domain pointing to the Droplet. Use an admin account with key-only SSH and a separate non-root deploy account with Docker access.

From your workstation:

```sh
ssh root@DROPLET_IP
```

On the server, create the deploy user, add the workstation public key to its `authorized_keys`, and confirm that user can log in before disabling root/password SSH access:

```sh
adduser deploy
usermod -aG sudo deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
# Add your public key to /home/deploy/.ssh/authorized_keys, then:
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
```

Configure `PermitRootLogin no` and `PasswordAuthentication no` in `/etc/ssh/sshd_config.d/` only after verifying a second SSH session as `deploy`; then run `sudo sshd -t && sudo systemctl reload ssh`.

## 2. Update Ubuntu and configure the firewall

```sh
sudo apt-get update
sudo apt-get full-upgrade -y
sudo apt-get install -y ca-certificates curl git nginx certbot
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

In the DigitalOcean Cloud Firewall, allow inbound TCP 22 only from trusted administration IP ranges where practical, and TCP 80/443 from the internet. Do not add rules for 3000, 3306, or 8001. If UFW is enabled, confirm SSH access before disconnecting.

## 3. Install Docker Engine and Compose

```sh
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"${UBUNTU_CODENAME:-$VERSION_CODENAME}\") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker deploy
```

Log out and back in as `deploy`, then verify `docker version` and `docker compose version`.

## 4. Clone and configure

```sh
sudo install -d -o deploy -g deploy /opt/dental
git clone YOUR_REPOSITORY_URL /opt/dental
cd /opt/dental
cp .env.example .env
chmod 600 .env
```

Edit `.env` with `nano .env`. Use different random hex values for `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, `NEXTAUTH_SECRET`, and `ML_API_KEY`; hex avoids URL-escaping ambiguity in `DATABASE_URL`. Generate values with `openssl rand -hex 32` and paste them into the file. Set `NEXTAUTH_URL=https://YOUR_DOMAIN`, `ALLOWED_ORIGINS=https://YOUR_DOMAIN`, and the internal service URL `ML_SERVICE_URL=http://ml-service:8001`. Set `GEMINI_API_KEY` only if Gemini-backed features are enabled. Do not put secrets in Git, Compose files, or build arguments.

The Gemini routes send the submitted radiograph image to Google Gemini when those features are selected. The assistant sends its text and optional image attachment to Gemini when Gemini is selected. The local PALL-Text assistant receives user text/context only. Review the provider's current data terms and obtain any required patient consent before using identifiable patient images.

Validate that Compose resolves required variables without printing their values:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml config --quiet
```

## 5. Build and start the database and ML service

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml build
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d mysql ml-service
docker compose -f docker-compose.yml -f docker-compose.production.yml ps
```

Check the ML service logs for model load errors without publishing its port:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml logs --tail=100 ml-service
```

## 6. Migrate legacy verification uploads without deleting originals

If the prior app stored verification documents in `public/uploads`, copy those files to the server through a secure channel, preserving the directory. The migration copies valid image files into the private Docker volume and updates only the corresponding database path after each successful copy; it does not delete originals.

```sh
cd /opt/dental
docker compose -f docker-compose.yml -f docker-compose.production.yml run --rm --no-deps \
  -v "$PWD/public/uploads:/legacy-uploads:ro" \
  -e LEGACY_UPLOAD_DIR=/legacy-uploads \
  web node scripts/migrate-verification-uploads.mjs
```

If there are no legacy uploads, the command may report skipped items because the source directory is absent or empty. Keep an independent backup of the original directory until an administrator verifies all required documents through the admin screen.

## 7. Apply Prisma migrations safely and start the app

First make a database backup (section 11). On a new empty database, apply the repository migrations once:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml run --rm --no-deps --entrypoint npx web prisma migrate deploy
```

For a database that already contains project data, inspect `_prisma_migrations` and compare the deployed schema with `prisma/migrations/20260306060753_add_admin_approval_system/migration.sql` before running this command. If the existing schema was created with `db push` or migration history is absent, stop and reconcile migration history from a verified backup; do not reset the database or blindly apply a migration that creates existing tables.

Then build (if not already built) and start all services:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
docker compose -f docker-compose.yml -f docker-compose.production.yml ps
curl --fail http://127.0.0.1:3000/api/health
curl --fail http://127.0.0.1:3000/api/ready
```

`/api/health` is liveness only. `/api/ready` checks the database and returns no connection details. The ML service's `/` check is internal to Compose; inference routes require `X-ML-API-Key`.

## 8. Configure Nginx and HTTPS

Set `DOMAIN` in your shell to the DNS name. Create the ACME webroot and install the temporary HTTP-only site:

```sh
export DOMAIN=YOUR_DOMAIN
sudo install -d -m 0755 /var/www/certbot
sed "s/__DOMAIN__/$DOMAIN/g" deploy/nginx-bootstrap.conf.template | sudo tee /etc/nginx/sites-available/dental >/dev/null
sudo ln -sfn /etc/nginx/sites-available/dental /etc/nginx/sites-enabled/dental
sudo nginx -t
sudo systemctl reload nginx
sudo certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --email ADMIN_EMAIL --agree-tos --no-eff-email
```

Install the HTTPS reverse proxy, test it, and reload Nginx:

```sh
sed "s/__DOMAIN__/$DOMAIN/g" deploy/nginx.conf.template | sudo tee /etc/nginx/sites-available/dental >/dev/null
sudo nginx -t
sudo systemctl reload nginx
```

Install the renewal reload hook and verify renewal:

```sh
sudo install -m 0755 deploy/reload-nginx.sh /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo certbot renew --dry-run
```

This host Nginx proxy passes requests to Next.js on loopback. It enforces HTTPS, limits request size, rate-limits API traffic, and sets security headers. Confirm the DNS record and firewall before requesting the certificate.

## 9. Verify the deployment

```sh
curl --fail --head "https://$DOMAIN/"
curl --fail "https://$DOMAIN/api/health"
curl --fail "https://$DOMAIN/api/ready"
docker compose -f docker-compose.yml -f docker-compose.production.yml logs --tail=100 web ml-service mysql
docker stats --no-stream
```

Verify sign-in, admin verification-image display, a representative diagnosis, landmark inference, and forensic inference using approved test data. Confirm anonymous calls to the sensitive API routes return 401/403, and verify ports 3000, 3306, and 8001 are not publicly reachable. Check that Nginx returns 404 for `/uploads/...` and the admin API can retrieve documents. Restart and persistence checks:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml restart
docker compose -f docker-compose.yml -f docker-compose.production.yml ps
```

## 10. Updates and rollback

Before an update, back up MySQL and the private upload volume. Then:

```sh
cd /opt/dental
git fetch --all --prune
git checkout DEPLOY_COMMIT_OR_TAG
docker compose -f docker-compose.yml -f docker-compose.production.yml build
docker compose -f docker-compose.yml -f docker-compose.production.yml run --rm --no-deps --entrypoint npx web prisma migrate deploy
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
docker compose -f docker-compose.yml -f docker-compose.production.yml ps
```

For rollback, check out the previously recorded commit and rebuild/restart. Database migrations may not be reversible; restore the pre-update database backup only after assessing data written since the update and taking another backup. Never use `prisma migrate reset` in production.

## 11. Backup and restore

Back up daily, retain at least 7 daily and 4 weekly copies, encrypt them, and copy them off the VPS to a separately secured DigitalOcean Space or backup host. Include MySQL, `/data/uploads`, `.env` in a restricted encrypted secret backup, and model files when relying on the container image/repository copy. Model files are reproducible only if the exact artifact remains available; record the deployed Git commit and image IDs. Monitor backup job status and perform a restore drill quarterly.

Create a restricted local backup directory and dump MySQL:

```sh
sudo install -d -m 0700 /var/backups/dental
umask 077
docker compose -f docker-compose.yml -f docker-compose.production.yml exec -T mysql sh -c 'exec mysqldump --single-transaction -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' > "/var/backups/dental/mysql-$(date +%F-%H%M).sql"
docker run --rm -v dental_private_uploads:/source:ro -v /var/backups/dental:/backup alpine sh -c 'tar czf /backup/uploads-$(date +%F-%H%M).tar.gz -C /source .'
```

The Compose volume prefix can differ if `COMPOSE_PROJECT_NAME` is set. Confirm it with `docker volume ls` and use the actual private-upload volume name in the tar command. Encrypt and transfer both backup files off-host.

Restore only during a planned recovery, after taking a copy of the current state:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml exec -T mysql sh -c 'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < /var/backups/dental/mysql-BACKUP.sql
docker run --rm -v dental_private_uploads:/target -v /var/backups/dental:/backup alpine sh -c 'tar xzf /backup/uploads-BACKUP.tar.gz -C /target'
```

Do not restore an SQL dump into a non-empty database without a recovery plan. Verify restored users, records, verification documents, and application health before reopening traffic.

## Operational items still requiring measurement

- Benchmark diagnosis, landmarks, forensics, and PALL-Text on the chosen Droplet; watch `docker stats` and disk/swap usage. The application currently serializes heavy ML requests and returns 503 while the inference slot is busy.
- PALL-Text is downloaded on first use from a mutable Hugging Face model reference. Pin an approved revision and pre-cache it only after verifying its license, size, and RAM requirement.
- Configure off-host backup credentials and test automated rotation/retention. No backup automation or alerting service is configured in this repository.
- Review Gemini provider terms, consent, and retention rules for patient data before enabling Gemini-backed clinical flows.
- The current Docker and Python dependency versions are not fully pinned, and this repo does not include a TypeScript compiler or TS files; JavaScript lint/build and existing Python tests are the relevant checks here.

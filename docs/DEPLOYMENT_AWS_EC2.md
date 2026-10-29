# AWS EC2 deployment

This runbook deploys the existing Docker Compose stack to one Ubuntu EC2 instance with host Nginx and HTTPS. The app, MySQL data, and private verification uploads remain on that instance's encrypted EBS storage. It is a single-instance deployment: it does not provide automatic failover or horizontal scaling.

## AWS resources

1. Create an Ubuntu 24.04 LTS EC2 instance in the region closest to users. The repository's vision weights total roughly 0.9 GiB, and the local PALL-Text assistant is an 8B-parameter BF16 model with a much larger separate memory footprint ([model card](https://huggingface.co/Harisundar/PALL-Text)). Start at 64 GiB RAM if all features, including local chat, are enabled. A 32 GiB instance is only a limited pilot target after measurements. These are conservative estimates, not load-test results.
2. Launch with an encrypted gp3 EBS root volume sized for Docker images, the roughly 0.9 GiB vision weights, the separately downloaded 8B chat model (about 16 GB of BF16 weights), its persistent Hugging Face cache, database, uploads, logs, and backups; start at 200 GiB. If you attach a separate data volume, mount it and configure Docker's data root there before building images. Enable EBS encryption and automatic snapshots; test restoring a snapshot before relying on it. EBS snapshots inherit the source volume's encryption state ([AWS EBS encryption docs](https://docs.aws.amazon.com/en_en/ebs/latest/userguide/ebs-encryption.html)).
3. Require IMDSv2 in the instance metadata options. Do not place credentials or `.env` contents in EC2 user data. AWS describes the IMDSv2 setting in its [EC2 metadata options guide](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-options.html).
4. Give the instance a static Elastic IP and point the app's DNS A record to it.
5. Create a security group with inbound TCP 22 restricted to trusted admin IPs, plus TCP 80 and 443 for users. Do not expose ports 3000, 3306, or 8001. See AWS's [EC2 security group guide](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/creating-security-group.html).

The current storage layout is local Docker volumes. For an availability-zone outage, instance replacement, or multi-instance service, the app needs a deliberate move to managed/shared storage and a managed database; this Compose deployment does not do that automatically.

## Install and configure the host

Connect with SSH, install security updates, then install Docker Engine and the Compose plugin by following Docker's official Ubuntu installation instructions. Create a non-root deploy account, use SSH keys, and enable the host firewall for SSH/HTTP/HTTPS only. Install Nginx and Certbot from Ubuntu packages.

Install Git LFS before cloning because model weights are stored with Git LFS. After cloning, fetch the actual weight files; Docker must not be built from LFS pointer text files.

```sh
sudo apt-get install -y git-lfs
git lfs install
```

Clone the repository to `/opt/dental`, fetch the model weights, then create the deployment environment file:

```sh
sudo install -d -o deploy -g deploy /opt/dental
git clone YOUR_REPOSITORY_URL /opt/dental
cd /opt/dental
git lfs pull
cp .env.example .env
chmod 600 .env
```

Edit `.env` with unique random values for `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, `NEXTAUTH_SECRET`, and `ML_API_KEY`. Use hex secrets (`openssl rand -hex 32`) so the MySQL password does not need URL escaping inside `DATABASE_URL`. Set these values consistently:

- `MYSQL_DATABASE=dental` and `MYSQL_USER=dental` (or your chosen names)
- `DATABASE_URL=mysql://MYSQL_USER:MYSQL_PASSWORD@mysql:3306/MYSQL_DATABASE`
- `NEXTAUTH_URL=https://YOUR_DOMAIN`
- `NEXTAUTH_SECRET` and `ML_API_KEY` to different random secrets
- `CHAT_MODEL_REVISION` to the approved Hugging Face commit (the repository pins a known revision by default; change it only after validating the replacement)
- `ALLOWED_ORIGINS=https://YOUR_DOMAIN`
- `RUN_DB_MIGRATIONS=false`

Do not use the sample values in `.env.docker.example` on AWS. Keep `.env` out of source control and restrict it to the deploy account. The production Compose overlay requires database and application secrets and prevents the development database defaults from being used.

Validate the merged production configuration without printing its values:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml config --quiet
```

## Build, migrate, and provision the first admin

Build the images and start the database and ML service first:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml build
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d mysql ml-service
docker compose -f docker-compose.yml -f docker-compose.production.yml ps
```

Wait for MySQL and the required YOLO and forensic weight files to report healthy. Apply Prisma migrations once, after taking a database backup:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml run --rm --no-deps --entrypoint npx web prisma migrate deploy
```

Pre-download the pinned chat model into the persistent Hugging Face cache before the first user session. The model is large, and downloading it on a user's first question can time out:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml exec ml-service \
  python -c "from huggingface_hub import snapshot_download; import os; snapshot_download('Harisundar/PALL-Text', revision=os.environ['CHAT_MODEL_REVISION'])"
```

The first inference still loads the cached weights into RAM, so run the assistant smoke check before public access. The route and Nginx timeouts allow several minutes for that first load.

For a new database, start the web service after migrations:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d web
```

Register the intended administrator through the signup page, then promote that exact account from the server:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml exec web node scripts/make-admin.js ADMIN_EMAIL
```

The promotion script grants admin access and marks the account approved. Keep the database and website private until that account has a strong unique password and successful sign-in has been confirmed.

## HTTPS and Nginx

Create `/var/www/certbot`, configure `deploy/nginx-bootstrap.conf.template` as `/etc/nginx/sites-available/dental` with `__DOMAIN__` replaced, enable it, and reload Nginx. Issue a certificate with Certbot's webroot mode:

```sh
sudo certbot certonly --webroot -w /var/www/certbot -d YOUR_DOMAIN
```

Then replace the bootstrap config with `deploy/nginx.conf.template`, replace `__DOMAIN__`, run `sudo nginx -t`, and reload Nginx. Confirm renewal with `sudo certbot renew --dry-run`. The TLS template proxies to `127.0.0.1:3000`; Compose binds the app, database, and ML service to loopback/private networking only.

Check the readiness route over HTTPS. It returns healthy only when both MySQL and the ML service's required model files are available:

```sh
curl --fail https://YOUR_DOMAIN/api/ready
```

## Pre-launch smoke checklist

Use a non-production test account and de-identified images. Do not open public registration until each applicable item works on the EC2 host:

- Registration, email/password sign-in, pending state, admin approval, automatic access after approval, and sign-out.
- OPG diagnosis, landmark detection, forensic age estimate, and local text assistant.
- Image comparison using two scans, quiz creation/answering, landmark drawing practice, report export, record save/list, and uploaded verification document retrieval by an admin.
- Restart all containers and confirm the database, records, uploads, and login remain available.
- Run one database and upload backup restore rehearsal.

The tooth chart currently contains sample patient data, and some quiz content is generated from local static/demo question helpers. Those screens need product-level review before being presented as real patient records or clinical AI output. Forensics and local chat also load models lazily; exercise them before launch and inspect logs for model download/load errors.

## Operations

Review logs without exposing secrets:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml logs --tail=200 web ml-service mysql
docker stats
```

Back up both `mysql_data` and `private_uploads` using an encrypted, access-restricted backup destination. Take a database-consistent MySQL backup in addition to EBS snapshots; snapshots are storage recovery points, not substitutes for tested database dumps. AWS S3 encrypts new objects by default and supports SSE-KMS when a customer-managed key is required; see [S3 encryption](https://docs.aws.amazon.com/AmazonS3/latest/userguide/specifying-s3-encryption.html). Never make a backup bucket public. Define retention, alerting, and restore tests before onboarding real users.

For updates: take a backup, pull the reviewed revision, rebuild, apply migrations, start the new containers, verify `/api/ready` and the smoke checklist, then retain the previous image and backup for rollback. This setup is a single EC2 host and does not implement zero-downtime deployment.

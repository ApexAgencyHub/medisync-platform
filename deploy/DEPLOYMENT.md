# MediSync Global — Production Deployment Runbook (Morocco / `MA`)

## 1. Prerequisites & DNS Records

Point DNS records to your host (VPS / Cloud VM / Docker host):

- `A` / `AAAA`: `app.yourdomain.ma` -> Server Public IP (for HTTPS Web + API via Caddy)
- `A`: `turn.yourdomain.ma` -> Server Public IP (**DNS-only / gray cloud** if using Cloudflare, because TURN requires direct UDP/TCP on `3478` and optional TLS `5349`)
- `A` / `AAAA` (only if using `--profile self-hosted-s3`): `media.app.yourdomain.ma` -> Server Public IP (proxied by Caddy over HTTPS to internal `minio:9000` preserving SigV4 `Host` header)

Open host firewall ports:

| Port | Protocol | Service |
| --- | --- | --- |
| `80` | TCP | HTTP ACME challenge + automatic HTTPS redirect (Caddy) |
| `443` | TCP + UDP | HTTPS TLS 1.3 + HTTP/3 (Caddy -> Web, API & optional MinIO) |
| `3478` | UDP + TCP | WebRTC STUN/TURN signaling (coturn) |
| `5349` | TCP | Optional WebRTC TURNS over TLS (when `TURN_TLS_CERT`/`TURN_TLS_PKEY` are mounted) |
| `49152-49252` | UDP | WebRTC TURN media relay ports (coturn) |

On cloud VMs behind 1:1 NAT (AWS EC2 / GCP / Azure), set `TURN_EXTERNAL_IP=<PUBLIC_IP>/<PRIVATE_IP>` (or `--turn-external-ip` during `--init`) so coturn advertises the public relay IP.

## 2. Provision `.env.production` (Cryptographic Secrets + Domain + TURN)

Run the built-in provisioner to generate high-entropy secrets (`AUTH_SECRET`, `POSTGRES_PASSWORD`, `PAYMENT_WEBHOOK_SECRET`, `TELEHEALTH_TURN_STATIC_AUTH_SECRET`):

```bash
# Option A: External AWS S3 / Cloudflare R2 object storage (recommended)
node deploy/provision-env.mjs --init --domain app.yourdomain.ma --mode external-s3 --out .env.production

# Option B: Self-hosted MinIO S3 included in Docker Compose
node deploy/provision-env.mjs --init --domain app.yourdomain.ma --mode self-hosted-s3 --out .env.production
```

If using Option A (AWS S3 or Cloudflare R2), fill `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` in `.env.production`, then either:
- Keep `S3_AUTO_CONFIGURE_CORS=true` so the API automatically configures bucket CORS on boot, or
- Apply `deploy/s3-cors.json` (replacing `https://app.medisync.example.com` with `https://app.yourdomain.ma`) via AWS CLI / Cloudflare R2 dashboard.

## 3. Run Production Preflight Validation

```bash
node deploy/provision-env.mjs --check --file .env.production
```

This verifies:
- Zero placeholder or dev credentials remain
- `DATABASE_URL` matches `POSTGRES_PASSWORD`
- HTTPS-only `CORS_ORIGINS` and `NEXT_PUBLIC_API_URL`
- `COOKIE_SECURE=true`, `ALLOW_SIMULATED_PAYMENTS=false`, `ENABLE_DEV_OTP_PREVIEW=false`, `ALLOW_DEV_SEED` disabled
- TURN relay configured (`TELEHEALTH_TURN_URLS` + ephemeral HMAC secret, or `TELEHEALTH_ICE_SERVERS_JSON`)

## 4. Launch Production Stack

### Default (Caddy Automatic HTTPS/TLS + coturn TURN/STUN)

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### Self-Hosted MinIO S3 Profile

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile self-hosted-s3 up -d --build
```

### Upstream TLS Termination (Cloudflare Tunnel / AWS ALB)

Set `APP_DOMAIN=:80` in `.env.production` to terminate TLS upstream with Caddy, or launch the Nginx profile (defaults to `NGINX_HTTP_PORT=8080` to avoid port `80` collisions; set `NGINX_HTTP_PORT=80` when launching Nginx instead of Caddy):

```bash
NGINX_HTTP_PORT=80 docker compose --env-file .env.production -f docker-compose.prod.yml --profile nginx up -d --build postgres redis coturn api web proxy
```

### Custom Env File Name

If you store secrets outside `.env.production`, pass both `--env-file` and `MEDISYNC_ENV_FILE`:

```bash
MEDISYNC_ENV_FILE=.env.staging docker compose --env-file .env.staging -f docker-compose.prod.yml up -d --build
```

## 5. Post-Deploy Verification

```bash
curl -fsS https://app.yourdomain.ma/ready
# Expected: {"status":"ready","checks":{"postgres":"OK","redis":"OK","minio":"OK","minioBucketReady":true,"telehealthTurnConfigured":true}}

curl -i https://app.yourdomain.ma/metrics
# Expected: HTTP 404 (internal telemetry stays private inside the Docker network)
```

# Agritec Monitoring Dashboard - Architecture

## Overview

A lightweight Angular-based monitoring dashboard that provides a unified view of all Agritec platform services across DEV, UAT, and PROD environments.

**URL:** `https://monitoring.agritec.earth`
**Fallback:** `http://monitor.162.19.239.150.nip.io`

## What It Monitors

| Service | Health Endpoint | Database Checked |
|---------|----------------|-----------------|
| Agritec V2 API | `GET /health` | PostgreSQL |
| UCG Agent API | `GET /Health/ping` | MSSQL |
| Diary API | `GET /api/health` | Couchbase + MSSQL |
| Agritec V2 UI | `GET /` (HTTP check) | - |
| Unified UI | `GET /version` | - |

## Architecture

```
Browser
  │
  ▼
monitoring.agritec.earth (HTTPS)
  │
  ▼
agritec-proxy (nginx:443)
  │
  ▼
agritec-monitor (nginx:80)
  ├── / → Angular SPA (static files)
  ├── /proxy/dev/agritec/* → agritec-dev-api:5000
  ├── /proxy/dev/ucgagent/* → ucgagent-dev-api:80
  ├── /proxy/dev/diary/* → infocapdiary-dev-api:5001
  ├── /proxy/dev/agritec-ui/* → agritec-dev-ui:80
  ├── /proxy/dev/unified/* → unified-dev-ui:80
  ├── /proxy/uat/* → (same pattern, UAT containers)
  └── /proxy/prod/* → (same pattern, PROD containers)
```

The monitoring container sits on `agritec_network` and proxies health check requests to each service container internally. This avoids CORS issues entirely — the Angular app only makes requests to its own origin (`/proxy/*`), and nginx routes them to the correct containers.

## Tech Stack

- **Frontend:** Angular 20, standalone components, signals
- **Container:** nginx:alpine (multi-stage build)
- **Network:** Docker bridge (`agritec_network`)
- **CI/CD:** GitHub Actions → docker build → SCP → docker load

## Project Structure

```
MONITORING/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── dashboard.ts/html/css    # Main dashboard
│   │   │   └── log-viewer.ts/html/css   # Log viewer widget
│   │   ├── models/
│   │   │   └── health.model.ts          # TypeScript interfaces
│   │   ├── services/
│   │   │   └── health.ts               # Health check + log API service
│   │   ├── app.ts/html/css              # Root component
│   │   └── app.config.ts               # Angular config (HttpClient)
│   ├── index.html
│   └── styles.css                       # Global dark theme
├── nginx.conf                           # Container nginx (SPA + proxy)
├── Dockerfile                           # Multi-stage: node build → nginx
├── docker-compose.yml                   # Service definition
├── .github/workflows/deploy.yml         # CI/CD pipeline
└── doc/
    └── ARCHITECTURE.md                  # This file
```

## Deployment

### CI/CD (Automatic)
Push to `main` branch triggers GitHub Actions:
1. Builds Docker image
2. Saves + compresses image as `.tar.gz`
3. SCP transfers to server (`/tmp/agritec-monitor-deploy/`)
4. SSH: `docker load` → `docker run` on `agritec_network`

### Manual Deployment
```bash
# On server
cd /opt/agritec-monitor
docker build -t agritec-monitor:latest .
docker stop agritec-monitor && docker rm agritec-monitor
docker run -d --name agritec-monitor --restart unless-stopped --network agritec_network agritec-monitor:latest
```

### First-time SSL Setup
```bash
# Request Let's Encrypt certificate for monitoring.agritec.earth
docker exec agritec-certbot certbot certonly --webroot \
  -w /var/www/certbot \
  -d monitoring.agritec.earth \
  --agree-tos --no-eff-email \
  -m admin@agritec.earth

# Reload nginx proxy
docker exec agritec-proxy nginx -s reload
```

## GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `SERVER_HOST` | `162.19.239.150` |
| `SERVER_USER` | SSH username |
| `SERVER_SSH_KEY` | SSH private key |

## Adding a New Environment

1. Add entries to `environments` in `src/app/services/health.ts`
2. Add proxy blocks in `nginx.conf` for the new env
3. Rebuild and deploy

## Health Check Response Parsing

Each API returns health data in a different format. The `HealthService.extractDatabases()` method normalizes these into a unified `DatabaseStatus[]`:

- **Agritec V2 API:** ASP.NET Health Checks format (`{ status: "Healthy", entries: { postgresql: {...} } }`)
- **UCG Agent API:** Custom format (`{ status: "healthy", database: { connected: true, server, name, version } }`)
- **Diary API:** Custom multi-DB format (`{ couchbase: {...}, sqlServer: {...}, diarySqlServer: {...} }`)

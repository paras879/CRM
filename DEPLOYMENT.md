# Business CRM Admin Panel — Production Deployment Guide

This guide covers deployment procedures, production environment variables, reverse proxy configuration, database migrations, and maintenance for the Business CRM Admin Panel.

---

## 1. Production Architecture Overview

```
                      Internet / Client Browsers
                                  │
                                  ▼ HTTPS (443)
                    ┌───────────────────────────┐
                    │     Nginx Reverse Proxy   │
                    │   (SSL/TLS, Rate Limiting)│
                    └─────────────┬─────────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 ▼ /api/*                          ▼ /*
      ┌─────────────────────┐           ┌─────────────────────┐
      │   Express Backend   │           │   Next.js Frontend  │
      │    (Node.js :4000)  │           │    (Node.js :3000)  │
      └──────────┬──────────┘           └─────────────────────┘
                 │
                 ▼ SQL (5432)
      ┌─────────────────────┐
      │  PostgreSQL Database │
      │  (Relational Store) │
      └─────────────────────┘
```

---

## 2. Environment Variables Checklist

Ensure these variables are set in production (e.g. in your cloud secret manager or `.env` files).

### Backend (`backend/.env`)
| Variable | Description | Recommended Production Setting |
|---|---|---|
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | API listen port | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/crm_prod?schema=public` |
| `JWT_SECRET` | 64+ char key for signing JWTs | Random 64-char hex string |
| `JWT_EXPIRES_IN` | Access token lifespan | `15m` |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | Refresh token lifespan | `7` |
| `CSRF_SECRET` | 32+ char key for CSRF tokens | Random 32-char hex string |
| `APP_ORIGIN` | Authorized frontend origin for CORS | `https://crm.yourdomain.com` |
| `COOKIE_DOMAIN` | Cookie domain boundary | `.yourdomain.com` (or empty for strict host) |
| `COOKIE_SECURE` | HTTPS only cookie flag | `true` |

### Frontend (`frontend/.env.local` or build-time environment)
| Variable | Description | Recommended Production Setting |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL for backend API | `https://api.crm.yourdomain.com` or `/api/v1` (if proxied) |
| `NEXT_PUBLIC_APP_NAME` | Display name in title/meta | `Business CRM Admin` |

---

## 3. Production Build & Deployment Steps

### Step 1: Clone and Install
```bash
git clone <repo-url> /var/www/business-crm
cd /var/www/business-crm
npm ci
```

### Step 2: Apply Database Migrations
Never run `prisma migrate dev` in production. Always run `prisma migrate deploy`:
```bash
cd /var/www/business-crm/backend
npx prisma migrate deploy
```

### Step 3: Build Monorepo
```bash
cd /var/www/business-crm
npm run build
```

### Step 4: Process Management with PM2
Install PM2 globally if not already installed:
```bash
npm install -g pm2
```

Create `ecosystem.config.js` in the project root:
```javascript
module.exports = {
  apps: [
    {
      name: 'business-crm-backend',
      cwd: './backend',
      script: 'dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
    {
      name: 'business-crm-frontend',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
```

Start the applications:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 4. Nginx Reverse Proxy Configuration

Below is an production-hardened Nginx virtual host configuration:

```nginx
# Rate limiting zone: 20 requests per second per IP
limit_req_zone $binary_remote_addr zone=crm_limit:10m rate=20r/s;

server {
    listen 80;
    server_name crm.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name crm.yourdomain.com;

    # SSL Certificates (managed via Certbot or custom CA)
    ssl_certificate /etc/letsencrypt/live/crm.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' https: data:;" always;

    # Backend API Routing
    location /api/ {
        limit_req zone=crm_limit burst=40 nodelay;
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10M;
    }

    # Frontend Next.js Routing
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 5. Database Backup and Restoration Procedures

### Automated Daily Backup Script (`backup.sh`)
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/crm"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/crm_backup_$TIMESTAMP.sql.gz"

mkdir -p $BACKUP_DIR
pg_dump -h localhost -U crm_user -d business_crm | gzip > $FILENAME

# Keep backups for 30 days
find $BACKUP_DIR -type f -name "crm_backup_*.sql.gz" -mtime +30 -delete
echo "Backup created: $FILENAME"
```

### Restoration Procedure
```bash
# Decompress and restore into database
gunzip < /var/backups/crm/crm_backup_YYYYMMDD_HHMMSS.sql.gz | psql -h localhost -U crm_user -d business_crm
```

---

## 6. Health Checks & Verification

- **API Health Check**: `GET https://crm.yourdomain.com/api/v1/health`
  - Expected response: `{"status":"ok","service":"business-crm-api","uptime":...}`
- **Log Inspection**:
  - `pm2 logs business-crm-backend`
  - `pm2 logs business-crm-frontend`


---

## 7. Deploying the frontend on Vercel (backend elsewhere)

The frontend is a standard Next.js app and deploys to Vercel. The backend is a long-running Express server
(scheduled jobs, files on disk), so it does **not** run on Vercel. Host it on Render, Railway, Fly.io or a VPS,
with a managed PostgreSQL (Neon, Supabase, Railway, RDS) and a persistent volume for `UPLOAD_DIR`.

1. **Backend first.** Deploy `backend/` (the Dockerfile runs `prisma migrate deploy` then starts the server).
   Set `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `CSRF_SECRET`, `COOKIE_SECURE=true`, and
   `APP_ORIGIN=https://<your-app>.vercel.app` (no trailing slash). Check `https://<api-host>/api/v1/health`.
2. **Vercel project.** Import the repo and set **Root Directory** to `frontend`. Framework preset: Next.js.
3. **Environment variable.** `NEXT_PUBLIC_API_URL=https://<api-host>` (no trailing slash). It is read at build
   time, so redeploy after changing it.
4. **How requests flow.** The browser only talks to the Vercel domain. `next.config.mjs` rewrites `/api/v1/*` to the
   backend, so cookies stay first-party (production cookies are `SameSite=Strict`). Do not point the browser at the
   API host directly.
5. **Verify.** Sign in, create a record, upload a file, download an Excel export.

Local production check without touching a running dev server:
`NEXT_DIST_DIR=.next-check npx next build` (delete `.next-check` and the line it adds to `tsconfig.json` afterwards).

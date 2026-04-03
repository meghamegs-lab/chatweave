# ChatBridge Deployment Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- An Anthropic API key (`sk-ant-...`) or OpenAI API key (`sk-...`)

---

## 1. Local Development

### Clone and install

```bash
git clone <repo-url> chatweave
cd chatweave
pnpm install
```

### Install plugin dependencies

```bash
cd plugins/chess && pnpm install
cd ../weather && pnpm install
cd ../spotify && pnpm install
cd ../..
```

### Build plugins

```bash
cd plugins/chess && pnpm build
cd ../weather && pnpm build
cd ../spotify && pnpm build
cd ../..
```

### Configure environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
PORT=3001
NODE_ENV=development

# Generate secrets: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
JWT_SECRET=<generate-a-random-64-char-string>
JWT_REFRESH_SECRET=<generate-a-different-random-64-char-string>

DATABASE_URL=file:./chatbridge.db
CORS_ORIGIN=http://localhost:3001

# At least one is required
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### Start the server

```bash
cd server
npx ts-node src/index.ts
```

Open `http://localhost:3001`

---

## 2. Production Build

### Build the server

```bash
cd server
pnpm build          # Compiles TypeScript to dist/
```

### Build all plugins

```bash
for dir in plugins/chess plugins/weather plugins/spotify; do
  (cd "$dir" && pnpm build)
done
```

### Run in production

```bash
cd server
NODE_ENV=production node dist/index.js
```

---

## 3. Docker Deployment

### Dockerfile

Create `Dockerfile` in the project root:

```dockerfile
FROM node:20-slim

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
COPY plugins/chess/package.json plugins/chess/
COPY plugins/weather/package.json plugins/weather/
COPY plugins/spotify/package.json plugins/spotify/
COPY plugins/sdk/package.json plugins/sdk/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY server/ server/
COPY plugins/ plugins/

# Build plugins
RUN cd plugins/chess && pnpm build
RUN cd plugins/weather && pnpm build
RUN cd plugins/spotify && pnpm build

# Build server
RUN cd server && pnpm build

# Copy static web UI
COPY server/public/ server/public/

EXPOSE 3001

WORKDIR /app/server
CMD ["node", "dist/index.js"]
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  chatbridge:
    build: .
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - CORS_ORIGIN=http://localhost:3001
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - chatbridge-data:/app/server/data
    restart: unless-stopped

volumes:
  chatbridge-data:
```

### Run with Docker

```bash
# Create .env file for docker-compose
cat > .env << EOF
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")
ANTHROPIC_API_KEY=sk-ant-your-key-here
EOF

docker compose up -d
```

---

## 4. Deploy to a VPS (Ubuntu)

### Server setup

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Clone and build
git clone <repo-url> /opt/chatbridge
cd /opt/chatbridge
pnpm install

for dir in plugins/chess plugins/weather plugins/spotify; do
  (cd "$dir" && pnpm build)
done

cd server && pnpm build
```

### Configure environment

```bash
cp /opt/chatbridge/server/.env.example /opt/chatbridge/server/.env
# Edit with your values (see section 1)
```

### Create systemd service

```bash
sudo tee /etc/systemd/system/chatbridge.service > /dev/null << 'EOF'
[Unit]
Description=ChatBridge Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/chatbridge/server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/opt/chatbridge/server/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable chatbridge
sudo systemctl start chatbridge
```

### Nginx reverse proxy (optional, for HTTPS)

```nginx
server {
    listen 80;
    server_name chat.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo ln -s /etc/nginx/sites-available/chatbridge /etc/nginx/sites-enabled/
sudo certbot --nginx -d chat.yourdomain.com
sudo systemctl reload nginx
```

### Update CORS for your domain

In `server/.env`:
```env
CORS_ORIGIN=https://chat.yourdomain.com
```

---

## 5. Deploy to Railway / Render / Fly.io

These platforms auto-detect Node.js apps. Create a build script in the root:

### Add to `package.json` (root)

```json
{
  "scripts": {
    "build:deploy": "cd plugins/chess && pnpm build && cd ../weather && pnpm build && cd ../spotify && pnpm build && cd ../../server && pnpm build",
    "start:prod": "cd server && node dist/index.js"
  }
}
```

### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

railway login
railway init
railway add --name chatbridge

# Set env vars
railway variables set PORT=3001
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")
railway variables set JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")
railway variables set ANTHROPIC_API_KEY=sk-ant-your-key

# Deploy
railway up
```

### Render

Create `render.yaml`:

```yaml
services:
  - type: web
    name: chatbridge
    runtime: node
    buildCommand: pnpm install && pnpm run build:deploy
    startCommand: pnpm run start:prod
    envVars:
      - key: PORT
        value: 3001
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
      - key: JWT_REFRESH_SECRET
        generateValue: true
      - key: ANTHROPIC_API_KEY
        sync: false
```

---

## 6. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `JWT_SECRET` | Yes | - | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Yes | - | Secret for signing refresh tokens |
| `DATABASE_URL` | No | `file:./chatbridge.db` | SQLite database path |
| `CORS_ORIGIN` | No | `http://localhost:1212` | Allowed frontend origin |
| `ANTHROPIC_API_KEY` | One of these | - | Anthropic Claude API key |
| `OPENAI_API_KEY` | required | - | OpenAI API key |

---

## 7. Health Check

```bash
curl http://localhost:3001/api/health
# {"status":"ok"}
```

---

## 8. Troubleshooting

**"text content blocks must be non-empty"**
- Old empty messages in DB. Delete the `.db` file and restart.

**Plugin iframe shows blank**
- Ensure plugins are built: `cd plugins/chess && pnpm build`
- Check the server log for `Serving plugin: /plugins/chess/`

**Socket.io keeps disconnecting**
- Check CORS_ORIGIN matches your actual URL
- For HTTPS, ensure Nginx proxies WebSocket upgrades (`Upgrade` + `Connection` headers)

**401 errors after restart**
- JWT secret changed. Clear browser localStorage and re-login.

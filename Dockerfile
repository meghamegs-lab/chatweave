FROM node:20-slim AS base
RUN npm install -g pnpm@10

# --- Build plugins ---
FROM base AS plugins
WORKDIR /build

COPY plugins/chess/package.json plugins/chess/
RUN cd plugins/chess && pnpm install --no-frozen-lockfile
COPY plugins/chess/ plugins/chess/
RUN cd plugins/chess && pnpm build

COPY plugins/weather/package.json plugins/weather/
RUN cd plugins/weather && pnpm install --no-frozen-lockfile
COPY plugins/weather/ plugins/weather/
RUN cd plugins/weather && pnpm build

COPY plugins/spotify/package.json plugins/spotify/
RUN cd plugins/spotify && pnpm install --no-frozen-lockfile
COPY plugins/spotify/ plugins/spotify/
RUN cd plugins/spotify && pnpm build

# --- Build server ---
FROM base AS server-build
WORKDIR /build/server

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY server/package.json ./
RUN pnpm install --no-frozen-lockfile
COPY server/ ./
RUN pnpm build

# --- Production image ---
FROM base AS production
WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Server production deps + compiled output
COPY server/package.json ./server/
RUN cd server && pnpm install --prod --no-frozen-lockfile
COPY --from=server-build /build/server/dist ./server/dist
COPY server/public ./server/public

# Plugin manifests + built dist folders
COPY plugins/chess/manifest.json ./plugins/chess/manifest.json
COPY --from=plugins /build/plugins/chess/dist ./plugins/chess/dist

COPY plugins/weather/manifest.json ./plugins/weather/manifest.json
COPY --from=plugins /build/plugins/weather/dist ./plugins/weather/dist

COPY plugins/spotify/manifest.json ./plugins/spotify/manifest.json
COPY --from=plugins /build/plugins/spotify/dist ./plugins/spotify/dist

WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/index.js"]

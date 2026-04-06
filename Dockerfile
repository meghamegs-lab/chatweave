FROM node:20-slim AS base
RUN npm install -g pnpm@10

# --- Build plugins ---
FROM base AS plugins
WORKDIR /build

COPY plugins/chess/package.json plugins/chess/
RUN cd plugins/chess && pnpm install --no-frozen-lockfile
COPY plugins/chess/ plugins/chess/
RUN cd plugins/chess && pnpm build

COPY plugins/math-quest/package.json plugins/math-quest/
RUN cd plugins/math-quest && pnpm install --no-frozen-lockfile
COPY plugins/math-quest/ plugins/math-quest/
RUN cd plugins/math-quest && pnpm build

COPY plugins/word-lab/package.json plugins/word-lab/
RUN cd plugins/word-lab && pnpm install --no-frozen-lockfile
COPY plugins/word-lab/ plugins/word-lab/
RUN cd plugins/word-lab && pnpm build

COPY plugins/money-sense/package.json plugins/money-sense/
RUN cd plugins/money-sense && pnpm install --no-frozen-lockfile
COPY plugins/money-sense/ plugins/money-sense/
RUN cd plugins/money-sense && pnpm build

COPY plugins/fact-or-fiction/package.json plugins/fact-or-fiction/
RUN cd plugins/fact-or-fiction && pnpm install --no-frozen-lockfile
COPY plugins/fact-or-fiction/ plugins/fact-or-fiction/
RUN cd plugins/fact-or-fiction && pnpm build

COPY plugins/science-quiz/package.json plugins/science-quiz/
RUN cd plugins/science-quiz && pnpm install --no-frozen-lockfile
COPY plugins/science-quiz/ plugins/science-quiz/
RUN cd plugins/science-quiz && pnpm build

COPY plugins/study-planner/package.json plugins/study-planner/
RUN cd plugins/study-planner && pnpm install --no-frozen-lockfile
COPY plugins/study-planner/ plugins/study-planner/
RUN cd plugins/study-planner && pnpm build

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

COPY plugins/math-quest/manifest.json ./plugins/math-quest/manifest.json
COPY --from=plugins /build/plugins/math-quest/dist ./plugins/math-quest/dist

COPY plugins/word-lab/manifest.json ./plugins/word-lab/manifest.json
COPY --from=plugins /build/plugins/word-lab/dist ./plugins/word-lab/dist

COPY plugins/money-sense/manifest.json ./plugins/money-sense/manifest.json
COPY --from=plugins /build/plugins/money-sense/dist ./plugins/money-sense/dist

COPY plugins/fact-or-fiction/manifest.json ./plugins/fact-or-fiction/manifest.json
COPY --from=plugins /build/plugins/fact-or-fiction/dist ./plugins/fact-or-fiction/dist

COPY plugins/science-quiz/manifest.json ./plugins/science-quiz/manifest.json
COPY --from=plugins /build/plugins/science-quiz/dist ./plugins/science-quiz/dist

COPY plugins/study-planner/manifest.json ./plugins/study-planner/manifest.json
COPY --from=plugins /build/plugins/study-planner/dist ./plugins/study-planner/dist

WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/index.js"]

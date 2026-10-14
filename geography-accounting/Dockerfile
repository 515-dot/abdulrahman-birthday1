# syntax=docker/dockerfile:1
# --- 1) build the React frontend ---
FROM node:22-bookworm-slim AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci || npm install
COPY web/ ./
RUN npm run build

# --- 2) install production server dependencies ---
FROM node:22-bookworm-slim AS deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# --- 3) runtime image ---
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=4000
WORKDIR /app/server
COPY --from=deps /app/server/node_modules ./node_modules
COPY server/ ./
COPY --from=web /app/web/dist /app/web/dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Applies pending migrations (idempotent), then starts the server.
CMD ["sh", "-c", "node src/db/migrate.js && node src/index.js"]

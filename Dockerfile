# --- Partie 1 : fabriquer la page d'avis (la version finale, legere) ---
FROM node:24-slim AS page
WORKDIR /page
COPY frontend/application-avis-public/package.json frontend/application-avis-public/package-lock.json ./
RUN npm ci
COPY frontend/application-avis-public/ ./
RUN npm run build

# --- Partie 2 : fabriquer le serveur et y ranger la page ---
FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate --config prisma7.config.ts && npm run build
COPY --from=page /page/dist ./page
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/src/serveur.js"]
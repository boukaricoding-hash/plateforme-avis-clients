# --- Partie 1 : fabriquer la page d'avis (la version finale, legere) ---
FROM node:24-slim AS page
WORKDIR /page
COPY frontend/application-avis-public/package.json frontend/application-avis-public/package-lock.json ./
RUN npm ci
COPY frontend/application-avis-public/ ./
RUN npm run build

# --- Partie 2 : fabriquer le tableau de bord (servi sous /tableau-de-bord) ---
FROM node:24-slim AS tableau
WORKDIR /tableau
COPY frontend/tableau-de-bord/package.json frontend/tableau-de-bord/package-lock.json ./
RUN npm ci
COPY frontend/tableau-de-bord/ ./
RUN npm run build

# --- Partie 3 : fabriquer le serveur et y ranger la page et le tableau de bord ---
FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate --config prisma7.config.ts && npm run build
COPY --from=page /page/dist ./page
COPY --from=tableau /tableau/dist ./tableau-de-bord
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/src/serveur.js"]
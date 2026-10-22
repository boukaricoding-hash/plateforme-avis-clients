# Architecture et decisions techniques

## Vue d'ensemble

Flux : client (telephone) -> page d'avis -> API -> base de donnees -> agregats quotidiens -> tableau de bord du responsable.

Une seule API est utilisee par la page publique et par le tableau de bord.

## Technologies

| Element | Choix |
|---|---|
| Serveur | Node.js (version dans `.nvmrc`), TypeScript, Express 5 |
| Base de donnees | PostgreSQL 17, lancee avec Docker |
| ORM | Prisma 7 (version 7.10.x, ne pas passer a la version 8 sans accord) |
| Validation des donnees | zod |
| Mots de passe | bcryptjs |
| Cookies de session | cookie-parser |
| Limitation de debit | express-rate-limit |
| Securite des en-tetes | helmet |
| Tests | vitest et supertest |
| Execution en developpement | tsx |

Scripts du backend : `npm run dev` (developpement), `npm run build` (compilation), `npm start` (production), `npm test` (tests).

## Structure du depot

- `backend/` : API. Le code metier est dans `backend/src/modules`, un dossier par module (avis, questionnaires, qr-codes, alertes, etc.). Chaque module contient `controleurs`, `routes`, `services`, `types` et `validations`.
- `backend/prisma/` : schema de la base et migrations.
- `backend/tests/` : tests unitaires, d'integration, d'isolation entre organisations et de performance.
- `frontend/application-avis-public/` : page d'avis du client (via QR code).
- `frontend/tableau-de-bord/` : tableau de bord du responsable et administration DTS.
- `documentation/` : ce dossier.
- `docker-compose.yml` : base PostgreSQL.

## Conventions

- Noms de dossiers et de fichiers en francais, sans accent ni espace.
- Un module = un responsable.
- Une branche par fonctionnalite, fusion apres revue de code. La branche `main` est protegee.
- Aucun secret dans le code ni dans Git.
- Regle d'or : chaque nouvelle route est ajoutee le jour meme au test d'isolation entre organisations.

## Conventions de l'API

- Prefixe : `/api/v1`.
- Reponses en JSON, codes HTTP corrects (200, 201, 400, 401, 403, 404, 429, 500).
- Toutes les erreurs ont le meme format : `{ "code": "...", "message": "...", "details": ... }`.
- Une adresse inconnue renvoie 404 : `{ "code": "NON_TROUVE", "message": "Adresse introuvable.", "details": null }`.
- Une erreur inattendue renvoie 500 : `{ "code": "ERREUR_SERVEUR", ... }`. Le detail technique reste dans les journaux du serveur et n'est jamais envoye au client.
- Pagination par `page` et `limite`.
- Route de controle : `GET /api/v1/sante` renvoie `{ "statut": "ok" }`.

## CORS

Seules les adresses listees dans la variable `ORIGINES_AUTORISEES` (separees par des virgules) peuvent appeler l'API depuis un navigateur. Si la variable est vide ou absente, aucun site n'est autorise. `credentials: true` est active pour le cookie de session.

## Variables d'environnement

| Fichier | Variable | Role |
|---|---|---|
| `.env` (racine) | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Creation de la base Docker |
| `backend/.env` | `DATABASE_URL` | Connexion de Prisma a la base (meme mot de passe et meme port que la racine) |
| `backend/.env` | `PORT` | Port de l'API (3000) |
| `backend/.env` | `ORIGINES_AUTORISEES` | Adresses des frontends autorises (CORS) |

Les fichiers `.env` ne sont jamais envoyes dans Git. Les modeles sont `.env.example` (racine) et `backend/.env.example`. Quand on ajoute une variable dans un `.env`, on l'ajoute aussi dans le `.env.example` correspondant.

## Travail en equipe : apres chaque `git pull`

Dans `backend/` :

1. `npm ci` (si `package.json` ou `package-lock.json` ont change).
2. `npx prisma migrate deploy` (si de nouvelles migrations sont arrivees).
3. Verifier si un `.env.example` a recu une nouvelle variable et la copier dans son propre `.env`.

Chaque personne a sa propre base PostgreSQL locale et son propre mot de passe. Seules la structure (migrations) et le code sont partages, jamais les donnees.

## Mise en ligne (prevue)

Serveur VPS avec Docker, reverse proxy (Nginx ou Caddy) et HTTPS. Les `.env` de production sont crees a la main sur le serveur, avec des valeurs differentes du developpement : mot de passe de base long et unique, `ORIGINES_AUTORISEES` avec les vraies adresses en https, `NODE_ENV=production`. Mise a jour : `git pull`, `npm ci`, `npx prisma migrate deploy`, `npm run build`, redemarrage.

Ne jamais utiliser `docker compose down -v` : cela efface les donnees.
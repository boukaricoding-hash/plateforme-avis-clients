# Apres chaque git pull

Ce guide dit quoi lancer apres avoir recupere le code. Il est mis a jour chaque jour : quand une nouvelle commande devient necessaire, on l'ajoute ici.

## Dans backend/, dans cet ordre

1. `npm ci` (si package.json ou package-lock.json ont change).
2. `npx prisma generate` (apres un premier clone, et si schema.prisma a change). Le dossier backend/generated n'est pas dans Git : chacun le cree sur son poste.
3. `npx prisma migrate deploy` (si de nouvelles migrations sont arrivees).
4. Comparer backend/.env.example avec son propre backend/.env et copier les nouvelles variables.

## Historique : ce qui est devenu necessaire, jour par jour

- Jour 1 : `npx prisma generate` (client Prisma), `npx prisma migrate deploy` (22 tables).
- Jour 2 : quatre nouvelles variables dans backend/.env : SEED_ADMIN_EMAIL, SEED_ADMIN_MOT_DE_PASSE, SEED_RESPONSABLE_EMAIL, SEED_RESPONSABLE_MOT_DE_PASSE (chacun choisit ses propres mots de passe).

- Jour 3 : aucune nouvelle commande ni variable. `npm test` demande que la base de donnees soit demarree (Docker Desktop ouvert).


- Jour 12 : nouvelle variable `NOMBRE_PROXYS` dans le `.env` de la racine (0 en local avec `npm run dev`, 1 avec Docker et le tunnel ou Nginx). Pour lancer toute l'application dans Docker : `docker compose up -d --build`. Le tunnel Cloudflare se lance à part, et `PUBLIC_BASE_URL` doit être l'adresse du tunnel.



- Jour 13 : nouveau projet `frontend/tableau-de-bord` (port 5174). Apres un pull, lancer `npm ci` (ou `npm install` la premiere fois) dans `frontend/tableau-de-bord`, en plus de `backend` (nouvelle dependance nodemailer).
  - Mailpit (fausse boite mail, pour voir les e-mails de reinitialisation) : depuis la racine du projet, `docker compose --profile dev up -d mailpit`. Boite de reception : http://localhost:8025. Docker Desktop doit etre ouvert.
  - Sept nouvelles variables dans `backend/.env` (copier depuis `backend/.env.example`) : `TABLEAU_DE_BORD_URL` (http://localhost:5174), `SMTP_HOTE` (localhost), `SMTP_PORT` (1025), `SMTP_SECURISE` (false), `SMTP_UTILISATEUR` et `SMTP_MOT_DE_PASSE` (vides avec Mailpit), `EMAIL_EXPEDITEUR`.
  - Demarrage du tableau de bord : terminal 1 = `cd backend` puis `npm run dev` ; terminal 2 = `cd frontend\tableau-de-bord` puis `npm run dev`.
  - Variables facultatives, utiles seulement pour les tests : `LIMITE_REINITIALISATION_DEMANDE_MAX` et `LIMITE_REINITIALISATION_MAX` (le fichier de tests les regle lui-meme).

- Jour 16 : nouvelle dependance `multer` (envoi du logo). Apres un pull, lancer `npm ci` dans `backend`. Le tableau de bord n'a pas de nouvelle dependance.
  - Nouvelle variable facultative dans `backend/.env` (copier depuis `backend/.env.example`) : `LOGOS_DOSSIER`. La laisser vide en local : les logos vont dans `backend/televersements/logos`, ignore par Git.
  - Dans Docker, le dossier des logos est dans le volume `donnees-logos` : il survit aux redemarrages. Pour lancer toute la plateforme avec Mailpit : `docker compose --profile dev up -d --build` (depuis la racine du projet).
  - Dans Docker, `localhost` est le conteneur lui-meme : l'application envoie ses e-mails vers `mailpit` grace a `SMTP_HOTE_DOCKER`, `SMTP_PORT_DOCKER` et `SMTP_SECURISE_DOCKER`. Sans ces variables dans le `.env` de la racine, les valeurs par defaut conviennent (Mailpit). Avec un vrai service d'e-mails (choix de DTS), on les renseigne.
  - Le resume quotidien des alertes part a 08h00 UTC : aucune commande a lancer, il demarre avec le serveur.

- Jour 17 : aucune nouvelle dependance, aucune migration et aucune nouvelle variable : rien a lancer apres un pull (ni `npm ci`, ni `npx prisma migrate deploy`).
  - Nouvelles routes backend : `POST /sites/:id/activer` et `POST /points-contact/:id/activer`. Avant de fusionner, lancer `npm test` dans `backend` (Docker Desktop ouvert, base demarree) : tous les tests doivent passer, y compris `isolation-sites-points.test.ts`.
  - Nouveaux ecrans du tableau de bord : `/sites` (E12, sites et tables) et `/qr-codes` (E11, QR codes et chevalets). Le demarrage ne change pas : terminal 1 = `cd backend` puis `npm run dev` ; terminal 2 = `cd frontend\tableau-de-bord` puis `npm run dev`.
  - Les QR codes affichent l'adresse `PUBLIC_BASE_URL/q/{code}`. Pour en scanner un depuis un telephone, `PUBLIC_BASE_URL` doit etre l'adresse du tunnel, pas `http://localhost:5173`.
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
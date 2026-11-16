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

- Jour 21 : nouvelle dependance `exceljs` dans `backend` (export Excel). Apres un pull, lancer `npm ci` dans `backend`. Le tableau de bord n'a pas de nouvelle dependance. Aucune migration et aucune nouvelle variable : rien d'autre a lancer (ni `npx prisma migrate deploy`, ni modification du `.env`).
  - Nouvelles routes backend : `POST /api/v1/exports` (le fichier csv, xlsx ou pdf) et `POST /api/v1/exports/analyse` (l'analyse en JSON pour le robot). Avant de fusionner, lancer `npm test` dans `backend` (Docker Desktop ouvert, base demarree) : tous les tests doivent passer, y compris `exports.test.ts` et `isolation-exports.test.ts`.
  - Docker : `exceljs` est installe pendant la construction de l'image, donc reconstruire apres ce pull : `docker compose up -d --build` (depuis la racine du projet).
  - Nouvel ecran du tableau de bord : `/exports` (E16, exports et rapports). Le demarrage ne change pas : terminal 1 = `cd backend` puis `npm run dev` ; terminal 2 = `cd frontend\tableau-de-bord` puis `npm run dev`.
  - Un export de plus de 50 000 avis est refuse par le serveur : il faut reduire la periode ou ajouter un filtre.

- Jour 22 : apres le pull, relancer le seed pour installer les themes et les modeles de questionnaires des 6 secteurs (restauration, sante, education, agroalimentaire, evenement, general) : dans `backend`, `npx tsx prisma/seed.ts` (Docker Desktop ouvert, base demarree). Il peut etre relance autant de fois que l'on veut : il n'ajoute que ce qui manque, sans doublon. A la fin il affiche les totaux ; on doit lire `Secteurs : 6`. Les tests du back-office (`admin-secteurs.test.ts`, `isolation-admin.test.ts`) supposent que ce seed a ete lance.
  - Aucune nouvelle dependance, aucune migration et aucune nouvelle variable : rien d'autre a lancer (ni `npm ci`, ni `npx prisma migrate deploy`, ni modification du `.env`). Avec Docker, le code du backend change : reconstruire avec `docker compose up -d --build` (depuis la racine du projet).
  - Nouvelles routes backend, reservees a l'administrateur DTS : `/api/v1/admin/organisations` (creer, lister, lire, modifier, suspendre, reactiver, inviter le premier responsable) et `/api/v1/admin/secteurs` (secteurs, themes, questionnaires types). Une organisation suspendue ne peut plus se connecter et sa session en cours est refusee.
  - Avant de fusionner, lancer `npm test` dans `backend` : tous les tests doivent passer, y compris `admin-organisations.test.ts`, `admin-secteurs.test.ts` et `isolation-admin.test.ts`. Pas de nouvel ecran dans le tableau de bord aujourd'hui (les ecrans E17 et E18 arrivent au jour 23).

- Jour 22 : apres le pull, relancer le seed pour installer les themes et les modeles de questionnaires des 6 secteurs (restauration, sante, education, agroalimentaire, evenement, general) : dans `backend`, `npx tsx prisma/seed.ts` (Docker Desktop ouvert, base demarree). Il peut etre relance autant de fois que l'on veut : il n'ajoute que ce qui manque, sans doublon. A la fin il affiche les totaux ; on doit lire `Secteurs : 6`. Les tests du back-office (`admin-secteurs.test.ts`, `isolation-admin.test.ts`) supposent que ce seed a ete lance.
  - Aucune nouvelle dependance, aucune migration et aucune nouvelle variable : rien d'autre a lancer (ni `npm ci`, ni `npx prisma migrate deploy`, ni modification du `.env`). Avec Docker, le code du backend change : reconstruire avec `docker compose up -d --build` (depuis la racine du projet).
  - Nouvelles routes backend, reservees a l'administrateur DTS : `/api/v1/admin/organisations` (creer, lister, lire, modifier, suspendre, reactiver, inviter le premier responsable) et `/api/v1/admin/secteurs` (secteurs, themes, questionnaires types). Une organisation suspendue ne peut plus se connecter et sa session en cours est refusee.
  - Avant de fusionner, lancer `npm test` dans `backend` : tous les tests doivent passer, y compris `admin-organisations.test.ts`, `admin-secteurs.test.ts` et `isolation-admin.test.ts`. Pas de nouvel ecran dans le tableau de bord aujourd'hui (les ecrans E17 et E18 arrivent au jour 23).

- Jour 23 : aucune nouvelle dependance, aucune migration, aucune nouvelle variable et aucun changement backend : rien a lancer apres un pull (ni `npm ci`, ni `npx prisma migrate deploy`, ni le seed, ni modification du `.env`).
  - Nouveaux ecrans du tableau de bord, reserves a l'administrateur DTS : `/admin/organisations` (E17, organisations clientes) et `/admin/secteurs` (E18, modeles sectoriels). Ils apparaissent dans le menu, groupe "Administration DTS", seulement pour le compte administrateur (celui de `SEED_ADMIN_EMAIL`). Un responsable ou un gestionnaire ne les voit pas et est renvoye a l'accueil s'il tape l'adresse.
  - Le demarrage ne change pas : terminal 1 = `cd backend` puis `npm run dev` ; terminal 2 = `cd frontend\tableau-de-bord` puis `npm run dev`. Pour lire l'e-mail d'invitation du premier responsable : Mailpit (`docker compose --profile dev up -d mailpit`, boite de reception http://localhost:8025).
  - Avant de fusionner : `npm test` dans `backend` donne toujours 23 fichiers et 320 tests reussis (aucun changement backend), et `npx tsc -b` dans `frontend\tableau-de-bord` ne donne aucune erreur.

- Jour 24 : aucune nouvelle dependance, aucune migration, aucune nouvelle variable : rien a relancer apres un pull (ni `npm ci`, ni `npx prisma migrate deploy`, ni le seed, ni modification du `.env`). La table `acces_support` existait deja dans la migration initiale. Avec Docker, le code du backend change : reconstruire avec `docker compose up -d --build` (depuis la racine du projet).
  - Nouvelles routes backend, reservees a l'administrateur DTS : `GET /api/v1/admin/journal-audit` (journal filtrable), `GET /api/v1/admin/vue-globale` (chiffres de l'ecran E19) et 7 routes `GET /api/v1/admin/support/organisations/:id/...` (consultation en lecture seule, refusee en 403 si l'organisation n'a pas donne son accord). Nouvelles routes cote organisation, Responsable seul : `GET`, `POST` et `DELETE /api/v1/organisation/acces-support` (l'accord de support).
  - Le changement de statut d'un avis ecrit maintenant `AVIS_STATUT_MODIFIE` dans le journal d'audit.
  - Nouvelles pages du tableau de bord, reservees a l'administrateur DTS : `/admin/journal-audit`, `/admin/vue-globale` (E19) et `/admin/organisations/:id/support` (bouton "Support" sur chaque organisation de l'ecran E17). Le journal et la vue globale apparaissent dans le menu, groupe "Administration DTS". Un responsable ou un gestionnaire ne les voit pas et est renvoye a l'accueil s'il tape l'adresse.
  - Nouvel interrupteur dans l'ecran des parametres (E14), visible du Responsable seul : l'accord de support DTS, pour 1 heure, 24 heures ou 7 jours, retirable a tout moment.
  - Le demarrage ne change pas : terminal 1 = `cd backend` puis `npm run dev` ; terminal 2 = `cd frontend\tableau-de-bord` puis `npm run dev`.
  - Avant de fusionner : `npx tsc --noEmit` dans `backend`, puis `npm test` dans `backend` (Docker Desktop ouvert, base demarree) : tous les tests doivent passer, les anciens et les nouveaux, y compris `admin-journal-vue-globale.test.ts`, `support-lecture-seule.test.ts` et `isolation-admin.test.ts` (qui suppose que le seed du jour 22 a ete lance). Et `npx tsc -b` dans `frontend\tableau-de-bord` ne donne aucune erreur.
- Jour 28 : aucune nouvelle dependance, aucune migration, aucune nouvelle variable : rien a relancer apres un pull (ni `npm ci`, ni `npx prisma migrate deploy`, ni le seed, ni modification du `.env`). La branche ne change que des scripts, `.gitignore` et la documentation.
  - Trois nouveaux scripts bash dans `backend/scripts/sauvegarde/` : `sauvegarder.sh`, `restaurer.sh` et `verifier-restauration.sh`. Sous Windows, les lancer avec Git Bash ou `bash` dans le terminal VS Code, depuis n'importe quel dossier du depot, Docker Desktop ouvert et la base demarree.
  - Le dossier `sauvegardes/` (a la racine) est cree par la premiere sauvegarde. Il est ignore par Git : il contient de vraies donnees.
  - Pour verifier la sauvegarde et la restauration (scenario 12) : `bash backend/scripts/sauvegarde/verifier-restauration.sh`. Code de sortie 0 = tout est identique. A faire une fois, puis chaque mois, et a noter dans `documentation/guides/sauvegarde-restauration.md`.
  - Sur un serveur : la ligne cron de la sauvegarde quotidienne est dans `documentation/guides/sauvegarde-restauration.md`.
  - Le demarrage ne change pas : terminal 1 = `cd backend` puis `npm run dev` ; terminal 2 = `cd frontend\tableau-de-bord` puis `npm run dev`.
- Jour 26 : aucune nouvelle dependance, mais deux mises a jour dans `backend/package-lock.json` (`body-parser` 2.4.0 et `fast-uri` 3.1.9) : apres un pull, lancer `npm ci` dans `backend`. Aucune migration, pas de seed, aucune variable obligatoire. Avec Docker, le code du backend change : reconstruire avec `docker compose up -d --build` (depuis la racine du projet).
  - Nouveau controle d'origine (protection CSRF) : une requete POST, PUT, PATCH ou DELETE envoyee avec le cookie de session est refusee (403, code `ORIGINE_REFUSEE`) si son en-tete `Origin` est inconnu. Elle passe si l'origine est dans `ORIGINES_AUTORISEES` ou si elle a le meme hote que la requete. Les requetes sans cookie de session (connexion, avis public) et les lectures (GET) ne sont jamais bloquees.
  - En local avec `npm run dev`, rien a changer : les deux serveurs Vite transmettent `/api` au backend sans changer l'adresse, donc l'origine a le meme hote. Si une action du tableau de bord repond `ORIGINE_REFUSEE`, ajouter l'adresse utilisee (par exemple `http://IP_DU_PC:5174`) a `ORIGINES_AUTORISEES` dans `backend/.env`, puis redemarrer le backend.
  - En Docker ou en production, `docker-compose.yml` fixe `ORIGINES_AUTORISEES` a `PUBLIC_BASE_URL` : cette valeur doit etre l'adresse exacte du site (`https://...`, sans `/` final). Derriere Nginx ou un tunnel, une des deux conditions suffit : meme hote, ou `PUBLIC_BASE_URL` exacte.
  - Nouvelle variable facultative `LIMITE_SCAN_PAR_MINUTE` (60 par defaut) : nombre de scans de QR par minute et par adresse IP, au-dela : 429. Inutile de l'ajouter dans `backend/.env`.
  - Nouveau fichier de test `securite.test.ts` (7 tests). Le test `isolation-admin.test.ts` peut echouer au hasard en local ("secteurs : 6 contre 8") quand `admin-secteurs.test.ts` tourne en meme temps : relancer une fois. Sur GitHub, les tests passent l'un apres l'autre.
  - GitHub Actions (`.github/workflows/tests.yml`) lance les tests du backend a chaque push. Le resultat se lit dans l'onglet Actions du depot : rien a installer sur le PC.
  - Le demarrage ne change pas : terminal 1 = `cd backend` puis `npm run dev` ; terminal 2 = `cd frontend\tableau-de-bord` puis `npm run dev`.
  - Avant de fusionner : `npx tsc --noEmit` puis `npm test` dans `backend` (Docker Desktop ouvert, base demarree) : tous les tests doivent passer. Puis, dans le tableau de bord connecte, une action qui enregistre quelque chose (par exemple modifier un parametre) ne doit pas repondre 403.

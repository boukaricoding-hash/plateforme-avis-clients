\# Plateforme d'avis clients par QR code



Projet DATA TRACE SERVICE. Premier secteur : restauration. D'autres secteurs seront ajoutes par configuration, sans changer le code.



\## Organisation du projet



\- backend : API Node.js, TypeScript, Express, Prisma 7

\- frontend/application-avis-public : page d'avis du client (via QR code)

\- frontend/tableau-de-bord : tableau de bord des responsables et administration

\- documentation : documents d'architecture

\- docker-compose.yml : base de donnees PostgreSQL



\## Prerequis



\- Git

\- Node.js 26 (voir le fichier .nvmrc)

\- Docker Desktop, ouvert avant de lancer la base



\## Lancer le projet (premiere fois)



1\. Cloner le depot.



&#x20;      git clone https://github.com/boukaricoding-hash/plateforme-avis-clients.git

&#x20;      cd plateforme-avis-clients



2\. Configurer la base de donnees. Copier le modele, puis ouvrir .env et remplacer le mot de passe par un mot de passe personnel (lettres et chiffres uniquement).



&#x20;      copy .env.example .env

&#x20;      notepad .env



3\. Ouvrir Docker Desktop, attendre "Engine running", puis demarrer la base.



&#x20;      docker compose up -d

&#x20;      docker compose ps



&#x20;  Le statut doit afficher "Up (healthy)".



4\. Configurer le backend. Copier le modele, puis ouvrir backend\\.env et remplacer TON\_MOT\_DE\_PASSE par le MEME mot de passe qu'a l'etape 2.



&#x20;      cd backend

&#x20;      copy .env.example .env

&#x20;      notepad .env



5\. Installer les dependances.



&#x20;      npm ci



6\. Verifier que Prisma atteint la base.



&#x20;      npx prisma migrate status



&#x20;  Message attendu : "No migration found in prisma/migrations". Cela signifie que la connexion fonctionne et que la base est vide.



7\. Lancer le serveur.



&#x20;      npm run dev



&#x20;  Ouvrir http://localhost:3000 : la page "Plateforme d'avis clients" s'affiche.

&#x20;  Ouvrir http://localhost:3000/api/v1/sante : la reponse est {"statut":"ok"}.



\## Lancer le projet (les fois suivantes)



1\. Ouvrir Docker Desktop.

2\. docker compose up -d

3\. cd backend puis npm run dev



\## Arreter le projet



\- Serveur : Ctrl + C dans le terminal.

\- Base : docker compose stop (les donnees sont conservees).

\- Ne jamais utiliser docker compose down -v : cela efface toutes les donnees.



\## Problemes frequents



\- "failed to connect to the docker API" : Docker Desktop n'est pas ouvert.

\- Erreur P1000 (Authentication failed) : le mot de passe de backend\\.env n'est pas celui de .env a la racine.

\- Erreur P1001 (Can't reach database) : la base n'est pas demarree, ou le port 5432 est deja utilise. Dans ce cas, changer POSTGRES\_PORT dans .env a la racine ET le port dans DATABASE\_URL de backend\\.env.



\## Regles d'equipe



\- Un module = un responsable. Les modules sont dans backend/src/modules.

\- Jamais de secret dans le code ni dans Git. Les fichiers .env ne sont jamais envoyes.

\- Prisma reste en version 7 tant que la version 8 n'est pas finale. Ne pas la mettre a jour sans accord.

\- La branche main est protegee : une branche par fonctionnalite, fusion apres revue de code.

\- Noms de dossiers et fichiers en francais, sans accent ni espace.



\## Etat actuel



Structure des dossiers, Docker, base PostgreSQL et connexion Prisma : termines. Tables de la base et modules metier : a venir.


\# Plateforme d'avis clients par QR code



Projet DATA TRACE SERVICE. Premier secteur : restauration. D'autres secteurs seront ajoutes par configuration, sans changer le code.



\## Organisation du projet



\- backend : API Node.js, TypeScript, Express, Prisma

\- frontend/application-avis-public : page d'avis du client (via QR code)

\- frontend/tableau-de-bord : tableau de bord des responsables et administration

\- documentation : documents d'architecture

\- docker-compose.yml : base de donnees PostgreSQL



\## Prerequis



\- Git

\- Node.js 26 (voir le fichier .nvmrc)

\- Docker Desktop, ouvert avant de lancer la base



\## Lancer le projet



1\. Cloner le depot et entrer dans le dossier.



&#x20;      git clone https://github.com/boukaricoding-hash/plateforme-avis-clients.git

&#x20;      cd plateforme-avis-clients



2\. Creer son fichier de configuration. Ne jamais l'envoyer dans Git.



&#x20;      copy .env.example .env



&#x20;  Ouvrir .env et remplacer le mot de passe par un mot de passe personnel (lettres et chiffres uniquement).



3\. Demarrer la base de donnees.



&#x20;      docker compose up -d

&#x20;      docker compose ps



&#x20;  Le statut doit afficher "Up (healthy)".



4\. Installer les dependances du backend.



&#x20;      cd backend

&#x20;      npm ci



\## Regles d'equipe



\- Un module = un responsable. Chaque module est dans backend/src/modules.

\- Jamais de secret dans le code ni dans Git.

\- La branche main est protegee : une branche par fonctionnalite, fusion apres revue de code.

\- Noms de dossiers et fichiers en francais, sans accent ni espace.



\## Etat actuel



Structure des dossiers terminee. Schema de la base de donnees et serveur : en cours.


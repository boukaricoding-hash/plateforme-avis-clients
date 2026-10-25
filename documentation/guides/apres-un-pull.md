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

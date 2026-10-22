# Journal de bord

Une entree par jour : ce qui a ete fait, les decisions prises, ce qui reste. Cela permet a DTS de reprendre le projet sans rien deviner.

## Jour 1 - jeudi 22 octobre 2026 : projet propre et base de donnees

**Fait**
- `.env.example` : mot de passe remplace par `TON_MOT_DE_PASSE`. `backend/generated/` ajoute au `.gitignore`.
- Installation des paquets du backend : zod, bcryptjs, cookie-parser, express-rate-limit, vitest, supertest (avec leurs types). Scripts `build`, `start` et `test` ajoutes.
- `dotenv/config` charge dans le serveur. Connexion de Prisma verifiee.
- CORS restreint aux adresses de `ORIGINES_AUTORISEES`. Erreurs et 404 au format JSON `{ code, message, details }`.
- Schema Prisma complet : 22 tables. Migration `tables_initiales` appliquee. Tables verifiees dans Prisma Studio.

**Decisions**
- Le statut de traitement vit sur l'avis seulement (voir `documentation/base-de-donnees/schema-des-tables.md`).
- Les modeles sectoriels sont des questionnaires marques `est_modele`.
- Les textes multilingues sont stockes en JSON.
- `offre` et `action_amelioration` sont reportees en version 2.
- Tables ajoutees par rapport a la liste du planning : `avis_suivi`, `acces_support`, `utilisateur_site`.

**A faire ensuite (jour 2)**
- Script de donnees de depart relancable sans doublon.
- Routes de connexion, deconnexion et profil.
- Mots de passe haches, sessions en base, verrouillage apres 5 echecs.
- Premieres lignes du journal d'audit.

**Point d'attention**
- Le mot de passe de `.env.example` a ete change, mais l'ancien reste dans l'historique de Git. Il doit etre change partout ou il a ete utilise (a verifier au jour 26, securite).
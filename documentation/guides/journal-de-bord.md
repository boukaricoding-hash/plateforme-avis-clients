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



## Jour 3 - dimanche 25 octobre 2026 (rattrapage) : roles, isolation, sites et points de contact

**Fait**
- Controles d'acces dans `src/middleware/` : `exiger-connexion.ts` (cookie de session, 401), `exiger-role.ts` (403), `exiger-organisation.ts` (l'organisation vient toujours de la session). Perimetre par site dans `src/utilitaires/perimetre.ts`.
- API des sites (`/api/v1/sites`) : lister, creer, modifier (PATCH), desactiver (`POST /:id/desactiver`).
- API des points de contact (`/api/v1/points-contact`) : lister (filtre `?site_id=`), creer, creer en masse (`POST /masse`, tables 1 a N sans doublon), modifier, desactiver.
- Le code de l'application est dans `src/app.ts`, `src/serveur.ts` ne fait que la demarrer (necessaire pour les tests).
- Test automatique d'isolation (`tests/integration/isolation.test.ts`) : l'organisation A essaie de lire, modifier, desactiver et remplir les donnees de B, tout est refuse. Test du 403 pour une route reservee a l'administrateur. 16 tests passent.

**Decisions**
- Les schemas de validation sont stricts : un champ inattendu (par exemple `organisation_id` envoye par le navigateur) donne une erreur 400.
- Chercher une donnee d'une autre organisation donne 404, jamais 403 (on ne revele pas qu'elle existe).
- Desactiver ne supprime rien : les avis restent lies au site ou au point de contact.
- Seul le Responsable cree, modifie et desactive. Le Gestionnaire ne peut que lister (limite a ses sites).
- Les tests d'integration utilisent la base de developpement avec des donnees temporaires prefixees `TEST-ISOLATION`, effacees a la fin.

**A faire ensuite**
- Chaque nouvelle route est ajoutee le jour meme a `isolation.test.ts`.
- Les tests de perimetre par site (Gestionnaire) sont prevus au jour 18.
- Les vraies routes reservees a l'administrateur DTS arrivent au jour 22.
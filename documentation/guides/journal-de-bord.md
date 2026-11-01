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



## Jour 12 - jeudi 30 octobre 2026 : mise en ligne de l'environnement de test

**Fait**
- `Dockerfile` : fabrique la page d'avis (version finale, legere) puis le serveur, et range la page dans le serveur.
- `docker-compose.yml` : base PostgreSQL et application. L'application applique les migrations au demarrage puis lance le serveur.
- `app.ts` : le serveur sert la page d'avis quand le dossier `page` existe (dans Docker). `trust proxy` est regle par la variable `NOMBRE_PROXYS` (1 avec le tunnel ou Nginx, 0 en local).
- CSP (helmet) : les images en HTTPS sont autorisees. A resserrer au jour 26.
- Mise en ligne de test avec un tunnel Cloudflare temporaire (`cloudflared`), HTTPS fourni par Cloudflare.
- QR code de la table 12 genere avec l'adresse du tunnel, scanne depuis un telephone en 4G : parcours complet reussi, l'avis est dans la base.

**Decisions**
- Le tunnel est temporaire : son adresse change a chaque lancement. Aucun chevalet n'est imprime avant l'adresse definitive (jour 25).
- `PUBLIC_BASE_URL` doit etre l'adresse du tunnel pour que les QR codes pointent au bon endroit.

**A faire ensuite**
- Tester sur iPhone si possible.
- Jour 13 : tableau de bord (cadre, connexion, mot de passe oublie).

**Point d'attention**
- La CSP autorise toutes les images HTTPS. A restreindre quand les logos seront stockes sur le serveur (jour 16).


## Jour 13 - dimanche 1er novembre 2026 : tableau de bord (cadre, connexion, mot de passe oublie)

**Fait**
- `frontend/tableau-de-bord` : Vite, React 19, TypeScript, Tailwind 4, react-router, recharts. Port 5174, proxy `/api` vers le backend.
- Cadre commun : menu lateral, barre du haut (langue FR/EN, nom, role, deconnexion), routes protegees, contexte utilisateur (session verifiee au demarrage avec `GET /auth/me`).
- Ecran E6 (connexion), page « mot de passe oublie » et page de reinitialisation (`/reinitialiser-mot-de-passe?jeton=...`). Textes dans `src/traductions` (fr et en).
- Backend : `POST /api/v1/auth/forgot-password` et `POST /api/v1/auth/reset-password`.
  - Lien a usage unique, valable 30 minutes. Seule l'empreinte sha256 du jeton est gardee en base.
  - Reponse identique que l'adresse existe ou non, avec un temps de reponse minimum de 300 ms. L'e-mail part en arriere-plan.
  - Apres une reinitialisation : autres jetons invalides, toutes les sessions supprimees, verrouillage remis a zero, ligne dans le journal d'audit.
  - Limites par IP : 5 demandes et 10 essais par periode de 15 minutes (429 `TROP_DE_REQUETES`).
- Envoi d'e-mails avec nodemailer. Mailpit (fausse boite mail) dans `docker-compose.yml`, profil `dev`.
- 11 nouveaux tests (`tests/integration/reinitialisation-mdp.test.ts`) : 159 tests passent sur 11 fichiers, le test d'isolation aussi. `tsc` sans erreur dans backend et tableau de bord.
- Verifie a la main : e-mail recu dans Mailpit, lien utilisable une seule fois, jeton expire refuse.

**Decisions**
- Le tableau de bord reprend la palette de la page d'avis (beige rose et terracotta), pas le bleu marine du planning.
- Les deux nouvelles routes sont publiques et ne lisent aucune donnee d'organisation : pas d'ajout au test d'isolation.
- Les tests interceptent l'envoi d'e-mails (pas besoin de Mailpit pour `npm test`).

**A faire ensuite**
- Jour 14 : ecran E7, indicateurs et graphiques (recharts), actualisation toutes les 10 secondes.
- Jour 16 : brancher le vrai service d'e-mails a la place de Mailpit (decision a valider avec DTS).
- Tester la page d'avis sur iPhone si possible.

**Point d'attention**
- Les fichiers `documentation/mise-en-ligne-test.md` et `qr.png` restent non suivis, volontairement.
- `npm audit` est prevu au jour 26 : ne jamais lancer `npm audit fix --force`.


## Jour 14 - dimanche 1er novembre 2026 : tableau de bord (indicateurs et graphiques)

**Fait**
- Ecran E7 (page d'accueil du tableau de bord) : barre de filtres (periode, site, point de contact, questionnaire) qui s'appliquent a tous les blocs en meme temps.
- Six cartes : note moyenne (vert, orange, rouge), CSAT, NPS, nombre d'avis, taux de reponse, alertes ouvertes, avec la variation par rapport a la periode precedente.
- Graphiques : repartition des notes, score par theme, courbe du nombre d'avis, classement des points de contact (triable), avis recents, detail par question.
- Un clic sur une carte, une barre, un jour de la courbe ou une ligne du classement ouvre `/avis?...` avec les bons filtres.
- Actualisation automatique toutes les 10 secondes (en pause si l'onglet est cache, rechargement au retour). Erreur de reseau : les chiffres deja affiches restent a l'ecran avec un avertissement. Un 401 renvoie a la connexion.
- Tout est dans `frontend/tableau-de-bord/src` (types, service, hook `utiliser-donnees-tableau`, utilitaires periodes et couleurs, composants-tableau, `page-accueil`). Textes fr et en dans `src/traductions`.
- Backend non modifie, aucune dependance ajoutee. `tsc -b` sans erreur, `npm test` : 159 tests passent sur 11 fichiers.
- Verifications du soir faites a la main : chiffres compares a l'API, filtres, periode invalide, erreurs, clics, anglais, petite largeur.

**Decisions**
- Les dates du tableau de bord sont en UTC, comme le backend.
- Le lien de la carte « Alertes ouvertes » n'envoie pas de periode (les alertes n'en dependent pas) : `negatifs=true` avec site, point et questionnaire.
- Clic sur une barre de repartition : `note_min = k - 0,5` et `note_max = k + 0,4999`, car le backend range un avis dans la barre `Math.round(note_globale)`.
- Couleur de la note d'un avis recent : par note entiere (4 et 5 vert, 3 orange, 1 et 2 rouge) ; les seuils 4,2 et 3,5 ne servent que pour les moyennes.
- Pas de clic sur le detail par question ni sur les themes : la liste des avis n'a pas de filtre correspondant.

**A faire ensuite**
- Jour 15 : ecrans E8 (liste des avis) et E9 (fiche d'un avis). La liste doit lire les parametres d'adresse `from`, `to`, `site`, `point`, `questionnaire`, `statut`, `q`, `negatifs`, `avec_commentaire`, `note_min`, `note_max`, `tri`, `ordre`, `page`, `limite`, et il faut ajouter la route `/avis/:id`.
- Jour 16 : cloche de notifications, alertes par e-mail, ecran E14.

**Point d'attention**
- Tant que la route `/avis/:id` n'existe pas (jour 15), un clic sur un avis recent renvoie a l'accueil.
- L'actualisation toutes les 10 secondes garde la session active tant que l'onglet est visible : une page laissee ouverte n'expire pas. A decider au jour 26.
- `Cell` de recharts est declare obsolete (retrait prevu en recharts 4) : a revoir si on change de version.
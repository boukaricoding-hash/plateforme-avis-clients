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

## Hors planning - dimanche 1er novembre 2026 : refonte de l'accueil du tableau de bord

**Fait**
- Disposition reprise du tableau de bord de Gestion Scolaire, avec la palette beige rose et terracotta du jour 13 (pas de noir et or).
- En-tête centré : « Bonjour {nom} », la date du jour, la période affichée en grand, puis « Mis à jour à… », l'actualisation automatique et le bouton Actualiser.
- Six cartes en deux groupes de trois, avec flèches, points et « Groupe 1 sur 2 » : note moyenne, CSAT, NPS, puis nombre d'avis, taux de réponse, alertes ouvertes (pastille rouge). Les chiffres sont ceux de l'API et montent en animation.
- Un clic sur une carte ouvre un panneau dessous : description, variation, aide et « Voir les avis concernés » (mêmes liens qu'avant). Un second clic ou le « × » le referme.
- Sept icônes en coin : Filtres, Répartition, Thèmes, Courbe, Classement, Avis récents, Questions. Un clic ouvre la section dans le panneau (une seule à la fois) avec les composants du jour 14, donc liens, erreurs et actualisation toutes les 10 secondes sont inchangés.
- Petit écran : les icônes passent en rangée au-dessus de l'en-tête.
- Fichiers : `styles/accueil.css`, `composants-tableau/carte-accueil.tsx`, `composants-tableau/panneau-detail.tsx`, `pages/tableau-de-bord/page-accueil.tsx` (réécrit). Textes et icônes étaient déjà dans le commit précédent.
- Backend non modifié, aucune dépendance ajoutée. `tsc -b` et `vite build` sans erreur. Vérifié dans Chrome (ordinateur et 390 px) avec de fausses données : ouverture et fermeture du panneau, passage d'un groupe à l'autre, chiffres animés, filtres, courbe, français et anglais.

**Décisions**
- Les filtres ne sont plus visibles en permanence : ils s'ouvrent avec la première icône. Ils s'appliquent toujours à tous les blocs.
- Le panneau d'une carte se ferme quand on change de groupe (la carte n'est plus à l'écran). Celui d'une section reste ouvert.
- Le chiffre repart de sa valeur précédente à chaque actualisation, pas de zéro. Avec « mouvement réduit » activé dans le système, il saute directement à la valeur.
- Le `overflow: hidden` du `reset.css` de Gestion Scolaire n'est pas repris : il bloquerait le défilement du cadre.
- `carte-indicateur.tsx` n'est plus utilisé par l'accueil, mais son composant `Variation` l'est (dans le panneau). Le fichier reste.

**Point d'attention**
- `npx eslint .` signale 2 erreurs dans `tableau-classement.tsx` (mémoïsation du tri, React Compiler). Elles existaient avant cette branche.
- Jour 15 (écrans E8 et E9) pas encore commencé : à reprendre après la fusion de cette branche.

## Hors planning - dimanche 1er novembre 2026 : palette claire creme et or

**Fait**
- La palette beige rose et terracotta du tableau de bord est remplacee par celle de Gestion Scolaire en theme clair : fond creme, cartes blanches, accent or. Un seul theme, pas de theme sombre.
- Tout est dans `styles/index.css` (bloc `:root`) : les noms de variables ne changent pas, donc l'accueil, la barre laterale, la connexion et les graphiques suivent sans modification de leur code.
- Nouvelle variable `--accent-fond` (#f3e8d3) pour le survol des icones. Dans `styles/accueil.css`, une seule ligne change : `--a-accent-fond`.
- Les couleurs des notes (vert, orange, rouge) et les etats (succes, erreur) sont gardes : ils servent aux seuils 4,2 et 3,5.

**Decisions**
- Boutons en #8f6c31 (contraste 4,8 avec du texte blanc) et non #a8813f (environ 3,6, trop bas). L'or #a8813f reste reserve aux decors : barres et graphiques.
- La page d'avis du client (autre projet) garde sa palette beige rose et terracotta.
- Pas de nouvelle police : Playfair Display et Cormorant Garamond de Gestion Scolaire ne sont pas repris (aucune police a telecharger).

**Point d'attention**
- Le commentaire en tete de `index.css` ne parle plus de la page d'avis du client : les deux palettes sont maintenant differentes.

## Hors planning - dimanche 1er novembre 2026 : refonte de l'accueil, plus de defilement

**Fait**
- Sur grand ecran (au moins 1100 px de large ET 640 px de haut), l'accueil a exactement la hauteur de l'ecran : ni defilement de la page, ni defilement dans le panneau. En dessous (tablette, telephone, fenetre basse), la page reste normale : elle defile et le panneau s'ouvre sous les cartes. Le seuil est ecrit a deux endroits qui doivent rester identiques : la requete CSS en bas de `styles/accueil.css` et la constante `REQUETE_ECRAN_FIXE` de `hooks/utiliser-pages.ts`.
- Deux etats. Repos : en-tete complet (Bonjour, date, periode en grand, mise a jour, actualisation automatique, Actualiser), bouton Filtres, trois cartes, fleches, points et "Groupe 1 sur 2". Ouvert (classe `accueil--ouvert` sur la racine) : l'en-tete tient sur une ligne, les cartes deviennent basses (sans la ligne du bas), les fleches rapetissent, le compteur disparait et le panneau prend toute la hauteur restante, avec une transition.
- Un seul panneau a la fois : detail d'une carte, Filtres, Repartition, Themes, Courbe, Classement, Avis recents ou Questions. Ouvrir autre chose remplace le contenu. Les filtres s'ouvrent dans ce meme panneau ; le bouton Filtres reste au-dessus des cartes, avec son point quand un filtre est modifie.
- Classement, avis recents et questions sont decoupes en pages (fleches, points, "Page 1 sur 3", points jusqu'a 7 pages). Le nombre de lignes par page vient de la hauteur mesuree de la zone (`utiliserPages`, avec ResizeObserver) ; en page normale : 8 lignes (3 lignes de cartes pour les questions). Les graphiques remplissent la hauteur du panneau.
- Fichiers : `styles/accueil.css` (reecrit), `hooks/utiliser-pages.ts`, `composants-tableau/pagination.tsx`, les 3 graphiques, classement, avis recents, questions, textes fr et en (4 cles de pagination), `pages/tableau-de-bord/page-accueil.tsx`. `panneau-detail.tsx` n'a pas change : le CSS vise sa structure actuelle.
- Backend non modifie, aucune dependance ajoutee.

**Decisions**
- Plus de defilement automatique vers le panneau (inutile en ecran fixe).
- Un nouveau tri du classement revient a la page 1 ; le rang # reste la position donnee par l'API.
- Avis recents : 10 maximum, commentaire sur une seule ligne. Questions : cartes de 232 px, deux par ligne, pages de lignes entieres (au moins une ligne).
- Le detail d'une carte se ferme toujours quand on change de groupe de cartes ; celui d'une section reste ouvert.
- Les filtres restent utilisables avant le premier chargement des donnees.

**Point d'attention**
- Les hauteurs de ligne sont des estimations, a ajuster si la derniere ligne est coupee ou s'il reste trop de vide en bas : HAUTEUR_LIGNE = 54 et HAUTEUR_EN_TETE = 46 (`tableau-classement.tsx`), HAUTEUR_AVIS = 94 (`avis-recents.tsx`), HAUTEUR_CARTE = 232 (`detail-questions.tsx`).
- Themes en page normale : la zone du graphique garde 280 px fixes, donc avec beaucoup de themes les barres s'amincissent (`maxBarSize` 18).
- `npx eslint` : les hooks nommes `utiliser...` (utiliserLangue, utiliserDonneesTableau, utiliserPages) declenchent la regle react-hooks/rules-of-hooks. C'est la convention de nommage du projet, pas un probleme bloquant.

## Hors planning - lundi 2 novembre 2026 : titre de la periode sur un seul jour

**Fait**
- Quand la periode affichee tient en un seul jour, le titre de l'accueil n'ecrit plus "Du 2 nov. 2026 au 2 nov. 2026" : il dit "Aujourd'hui, 2 nov. 2026" avec le filtre Aujourd'hui, et "Le 2 nov. 2026" pour tout autre jour unique (periode personnalisee, ou "Ce mois" le 1er du mois). Sur plusieurs jours, "Du ... au ..." comme avant.
- Textes `periodeAujourdhui` et `periodeUnJour` (fr et en) et fonction `cleTitrePeriode` dans `pages/tableau-de-bord/page-accueil.tsx`.
- Verifications finales de la refonte : `npm run build` sans erreur, controle a l'ecran fait sur ordinateur et a 390 px.

**Point d'attention**
- Les periodes sont des jours UTC (Africa/Lome = UTC+0), comme le backend : apres minuit, le titre et les chiffres changent a la prochaine actualisation (10 secondes).

## Jour 15 - lundi 2 novembre 2026 : liste des avis et fiche d'un avis

**Fait**
- Ecran E8 (`/avis`) : la liste des avis avec filtres (periode, site, point de contact, questionnaire, statut, recherche dans les commentaires, negatifs, avec commentaire, notes), tri par date, note ou NPS, et pagination. Tableau sur ordinateur et tablette, cartes sur telephone. Statuts ecrits en texte, notes colorees.
- Ecran E9 (`/avis/:id`) : la fiche d'un avis avec la note, le NPS, le statut, l'alerte eventuelle, le commentaire, toutes les reponses selon le type de question, les details (point de contact, site, questionnaire et version, langue, appareil), les coordonnees (seulement si le client a consenti), les 4 boutons de statut avec un commentaire facultatif, les notes internes et l'historique (qui, quoi, quand).
- Les deux routes remplacent « en construction » dans `App.tsx`. Un clic sur un avis recent de l'accueil ouvre maintenant la fiche.
- Fichiers dans `frontend/tableau-de-bord/src` : `types/avis.ts`, `services/avis.ts`, `utilitaires/statuts-avis.ts`, `hooks/` (`utiliser-filtres-avis`, `utiliser-liste-avis`, `utiliser-fiche-avis`), `composants-avis/` (`pastille-statut`, `barre-filtres-avis`, `tableau-avis`, `reponses-avis`, `historique-avis`, `panneau-suivi`), `pages/liste-avis/page-liste-avis.tsx`, `pages/fiche-avis/page-fiche-avis.tsx` et `App.tsx`. Textes fr et en dans `src/traductions` (bloc `avis`).
- Backend non modifie, aucune route nouvelle (donc rien a ajouter au test d'isolation), aucune dependance ajoutee. `tsc -b` sans erreur.

**Decisions**
- Filtres, tri et page dans l'adresse : un clic de l'accueil arrive deja filtre, et la liste peut etre rechargee ou partagee telle quelle.
- La pagination vient de l'API (`page` et `limite`), pas d'un decoupage cote ecran.
- « Retour a la liste des avis » retrouve les memes filtres, le meme tri et la meme page grace a l'etat de navigation (`listeAdresse`). Depuis un avis recent de l'accueil, il renvoie a `/avis` sans filtre.
- Apres un changement de statut ou l'ajout d'une note, la fiche est mise a jour avec la reponse de l'API, sans rechargement complet. Si le statut a deja change ailleurs (`STATUT_INCHANGE` ou `CONFLIT_STATUT`), la fiche est rechargee.
- Commentaire et note : 2000 caracteres au plus, comme le backend. Une note vide est refusee avant l'appel.
- La couleur ne suffit jamais seule : chaque statut, alerte et note est aussi ecrit en toutes lettres.
- Les coordonnees du client ne sont affichees que si l'API les renvoie, c'est-a-dire s'il a consenti.

**A faire ensuite**
- Verifications du soir, a faire a la main : envoyer un avis de 1/5 depuis le telephone, l'ouvrir, le passer en Traite avec une note interne, puis verifier que l'historique montre qui a fait quoi, et quand.
- Jour 16 : cloche de notifications, alertes par e-mail, ecran E14.

**Point d'attention**
- Le point d'attention du jour 14 sur la route `/avis/:id` est regle : un clic sur un avis recent ouvre la fiche.
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

## Jour 15 (design) - lundi 2 novembre 2026 : page des avis en une seule page, sans defilement

**Fait**
- La page `/avis` reunit les ecrans E8 et E9 : barre de filtres en pastilles en haut, avis en cartes sur 2 colonnes a gauche (pagination en bulles numerotees), detail de l'avis choisi a droite. Un clic sur une carte affiche l'avis a droite, sans changer de page.
- `/avis/:id` affiche la meme page avec l'avis deja choisi : un clic sur un avis recent de l'accueil fonctionne toujours.
- Les pages `tableau-avis.tsx` et `page-fiche-avis.tsx` sont supprimees (remplacees par `liste-cartes-avis.tsx` et `detail-avis.tsx`).
- Fichiers dans `frontend/tableau-de-bord/src` : `styles/avis.css`, `hooks/utiliser-cartes-par-page.ts`, `composants-avis/` (`barre-filtres-avis`, `liste-cartes-avis`, `reponses-avis`, `historique-avis`, `panneau-suivi`, `detail-avis`, `icones-avis`), `pages/liste-avis/page-liste-avis.tsx`, `App.tsx`, et 7 nouveaux textes (fr et en) pour les filtres de date et de note, le detail et le bouton Enregistrer.
- Backend non modifie, aucune route nouvelle, aucune dependance ajoutee. `tsc -b` sans erreur.

**Decisions**
- Aucun defilement sur grand ecran (au moins 1100 px de large et 640 px de haut, le meme seuil que l'accueil). Le nombre de cartes par page se calcule d'apres la hauteur disponible et part dans `limite` vers l'API. En dessous de ce seuil, la liste puis le detail sont empiles et la page defile.
- Ce qui ne rentre pas est raccourci : commentaire limite a 3 lignes, historique limite aux 3 dernieres lignes avec un petit +N.
- Le filtre Langue de la maquette est remplace par Statut (avec les cases Negatifs et Avec commentaire) : l'API n'a pas de parametre langue, et l'ajouter demanderait du backend et des tests, donc un jour de plus.
- Le vert de la maquette reste limite a cette page (`avis.css`), la palette globale ne change pas.
- Un clic sur un statut change le statut et joint le texte tape comme commentaire. Enregistrer ajoute le texte comme note interne.
- Tant qu'aucune carte n'est cliquee, la zone de droite invite a choisir un avis.

**A faire ensuite**
- Controle a l'ecran, a la main : ordinateur (grand ecran sans defilement), tablette et 390 px (liste puis detail), themes sombre et clair, changement de statut, note interne, filtres venant de l'accueil.
- Jour 16 : cloche de notifications, alertes par e-mail, ecran E14.

**Point d'attention**
- `eslint` lance sur tout `src` signale 56 erreurs dans des fichiers non modifies ce jour (hooks nommes `utiliser...` que la regle des hooks ne reconnait pas, et `tableau-classement.tsx`). A traiter plus tard, pas de lien avec le jour 15.


## Jour 16 - jeudi 5 novembre 2026 : alertes, cloche et parametres de l'organisation

**Fait**
- Cloche de notifications dans la barre du haut : compteur de non lues, liste, marquer comme lue, un clic ouvre l'avis. Routes `GET /notifications`, `POST /notifications/:id/lue`, `GET` et `PATCH /notifications/preferences`.
- Alertes par e-mail (`email-alerte.ts`) : site, point de contact, note, extrait du commentaire et lien direct vers l'avis. Au choix de chaque utilisateur : immediate, ou groupee en un resume par jour (`resume-alertes.ts` et tache `resume-quotidien.ts`).
- Ecran E14 (parametres de l'organisation) : logo, couleur principale, seuils d'alerte (note et NPS), preferences de notification. Routes `GET` et `PATCH /parametres`, `POST` et `DELETE /logo` (Responsable seulement).
- Logo : envoi avec multer, PNG, JPEG ou WebP, 1 Mo au plus, SVG refuse. Dossier `LOGOS_DOSSIER`, servi sur `/api/v1/logos/`, et utilise sur le chevalet PDF.
- Test d'isolation des parametres, des notifications et du logo : `tests/integration/isolation-parametres.test.ts`.
- Correctif Docker (branche du jour 17) : l'application conteneurisee envoie ses e-mails vers Mailpit.

**Decisions**
- Le resume quotidien part a 08h00 UTC (= 08h00 a Lome, pas de changement d'heure).
- Les e-mails sont codes avec Mailpit. Quand DTS aura choisi son service (Brevo, Mailgun ou autre), on changera seulement les variables `SMTP_*`. Aucun abonnement payant sans accord de DTS.
- Seuils d'alerte : note de 1 a 4 et NPS de 0 a 9 (un seuil de 5 ou de 10 alerterait sur tous les avis).
- Le logo est dans un volume Docker (`donnees-logos`) : il survit aux redemarrages.

**A faire ensuite**
- Jour 17 : ecrans E12 (sites et points de contact) et E11 (QR codes).
- Decision de DTS attendue le lundi 9 novembre : service d'e-mails.

**Points d'attention**
- Un e-mail refuse par le serveur d'envoi n'est pas retente.
- Les sauvegardes du jour 28 devront couvrir aussi le dossier des logos.


## Jour 17 - jeudi 5 novembre 2026 : sites, points de contact et QR codes (ecrans E12 et E11)

**Fait**
- Backend : questionnaire associe a chaque point de contact (`questionnaire_id`, avec le titre du questionnaire dans la reponse), reactivation d'un point de contact (`POST /points-contact/:id/activer`) et d'un site (`POST /sites/:id/activer`). Test d'isolation `isolation-sites-points.test.ts` : npm test, 14 fichiers, 202 tests passent.
- Ecran E12 (sites et tables), dans `frontend/tableau-de-bord/src` : `types/sites-points.ts`, `types/questionnaires.ts`, `services/sites.ts`, `services/points-contact.ts`, `services/questionnaires.ts`, `hooks/utiliser-sites-points.ts`, `composants-sites/` (`formulaire-site`, `liste-points`, `creation-masse`) et `pages/sites-points-de-contact/page-sites.tsx`. Le Responsable cree et modifie ses sites, les active ou les desactive, choisit le questionnaire de chaque point, active ou desactive un point, et cree ses tables en masse (prefixe, type, debut, fin, 500 au plus, message "X crees, Y deja existants").
- Ecran E11 (QR codes et chevalets) : `types/qr-codes.ts`, `services/qr-codes.ts`, `hooks/utiliser-qr-codes.ts`, `composants-qr/carte-qr.tsx` et `pages/qr-codes/page-qr-codes.tsx`. Chaque carte montre l'apercu PNG (charge au defilement), les liens PNG, SVG, PDF A6 et PDF A5, les scans, les avis et le taux de conversion, avec Revoquer et Regenerer apres confirmation. La page a un filtre par site, 12 cartes par page, le bouton Planche A4 et la consigne d'impression (3 x 3 cm minimum, bon contraste, support mat).
- `App.tsx` : routes `sites` et `qr-codes` branchees (`qr-codes` retire des ecrans a venir). Textes fr et en : blocs `sites` et `qrCodes`.
- `tsc -b` sans erreur.

**Decisions**
- Types de point de contact : liste fixe table, chambre, service, salle, stand (le vocabulaire par secteur viendra au jour 22).
- Gestionnaire : voit E12 et E11 limites a ses sites, en lecture seule. Les boutons de modification sont caches et le serveur refuse de toute facon (403). Il telecharge les QR codes mais ne les revoque pas.
- Le questionnaire se choisit point par point. On n'utilise pas `PUT /questionnaires/:id/points-contact` depuis E12 : il remplace toute la liste du questionnaire.
- Pas de creation d'un point isole : la creation en masse suffit (debut = fin pour un seul point).
- Un QR code revoque ne se remet en service qu'en le regenerant. Il n'a plus d'apercu ni de lien de telechargement (le serveur repond 409 `QR_REVOQUE`) mais garde ses scans et ses avis.
- Pas de nouveau fichier CSS : Tailwind seulement, comme E14.

**A faire ensuite**
- Verifications du soir, a faire a la main : creer les tables 1 a 40 en un clic (E12) puis telecharger la planche PDF (E11) ; revoquer un QR code et le scanner (page "QR code desactive", historique conserve) ; reactiver un point et un site ; changer le questionnaire d'une table ; verifier qu'un Gestionnaire du site A ne voit rien du site B ; test reel du QR de la Table 12 scanne sur telephone via le tunnel.
- Jour 18 : ecran E13 (utilisateurs, roles et perimetres) et tests de perimetre par site.

**Points d'attention**
- Les telechargements sont de simples liens : si le serveur refusait la planche, le navigateur telechargerait le message d'erreur. Le bouton Planche A4 est donc inactif, avec un message, quand il n'y a aucun chevalet ou plus de 200 (le serveur verifie aussi : 404 ou 400 `TROP_DE_POINTS`).
- Regenerer un QR code rend le chevalet deja imprime inutilisable : la confirmation le dit en toutes lettres.
- Le code public d'un point de contact n'est jamais affiche, seulement le QR.
- `eslint` sur les fichiers du jour : 45 erreurs, toutes `react-hooks/rules-of-hooks` dans les hooks nommes `utiliser...` (26 dans `utiliser-sites-points.ts`, 19 dans `utiliser-qr-codes.ts`), meme cause que les erreurs du jour 15. Aucune autre erreur. A traiter plus tard.
- Decision de DTS attendue le lundi 9 novembre : service d'e-mails.


## Jour 18 - samedi 7 novembre 2026 : utilisateurs, roles et perimetres (ecran E13)

**Fait**
- Backend, module `modules/utilisateurs` : validations, services (`utilisateurs`, `invitations`), controleurs et routes, branches dans `app.ts` sur `/api/v1/utilisateurs` et `/api/v1/invitations`. Routes de gestion reservees au Responsable : `GET /utilisateurs`, `POST /utilisateurs/inviter`, `PATCH /utilisateurs/:id`, `POST /utilisateurs/:id/desactiver` et `/activer`. Routes publiques : `GET /invitations/verifier` et `POST /invitations/accepter`, avec une limite de requetes par adresse IP (`middleware/limite-invitations.ts`).
- Perimetre du Gestionnaire (`sitesAutorises`) applique dans les avis, le suivi des avis, les notifications, les points de contact, les QR codes, les sites, les questionnaires et le tableau de bord (indicateurs et graphiques).
- Correctif : le controleur des questionnaires ne compilait plus depuis le commit `1b38af5` (le service passait a 2 et 3 arguments). C'etait la cause de la liste deroulante des questionnaires vide.
- Tests : `isolation-utilisateurs.test.ts` (24 tests) et `isolation-questionnaires-perimetre.test.ts` (10 tests : un Gestionnaire du site A ne voit, dans un questionnaire, que les points de contact de son site). `npm test` : 16 fichiers, 236 tests passent.
- Ecran E13 (utilisateurs), dans `frontend/tableau-de-bord/src` : `types/utilisateurs-admin.ts`, `services/utilisateurs.ts`, `services/invitations.ts`, `hooks/utiliser-utilisateurs.ts`, `composants-utilisateurs/` (`ligne-utilisateur`, `formulaire-invitation`, `formulaire-modification`) et `pages/utilisateurs/page-utilisateurs.tsx`. Le Responsable liste ses utilisateurs et les invitations en attente, invite par e-mail avec un role et des sites, modifie le role et les sites, desactive et reactive un compte.
- Page publique d'acceptation `pages/invitation/page-accepter-invitation.tsx` (adresse `/invitation?jeton=...`, hors zone connectee) : verification du lien, puis nom et mot de passe avec confirmation. Cas geres : lien invalide ou expire, sites supprimes, mot de passe refuse, trop de tentatives, pas de reseau.
- `App.tsx` : routes `utilisateurs` (retiree des ecrans a venir) et `invitation` (publique). Textes fr et en : blocs `invitation` et `utilisateurs` (90 cles identiques dans les deux langues).
- Page QR codes (E11) refaite : liste, carte, ligne, telechargement, apercu recharge apres regeneration, textes fr et en.
- `tsc -b` sans erreur. Essais a la main : une invitation de bout en bout (e-mail dans Mailpit, lien, mot de passe, connexion) fonctionne, et un utilisateur desactive ne peut plus se connecter.

**Decisions**
- Invitation valable 7 jours, a usage unique. Une invitation en attente pour la meme adresse est remplacee : cela sert aussi de bouton Renvoyer.
- L'API attend l'envoi de l'e-mail. En cas d'echec, l'invitation existe et la reponse contient `email_envoye: false`.
- Apres l'acceptation, l'invite n'est pas connecte : il est renvoye vers la page de connexion.
- Le lien d'invitation est `TABLEAU_DE_BORD_URL/invitation?jeton=...`.
- Un Responsable voit toute l'organisation, y compris les sites crees plus tard : la liste des sites n'est proposee que pour un Gestionnaire, qui doit avoir au moins un site (le serveur ignore les sites envoyes pour un Responsable).
- L'ecran E13 est reserve au Responsable : le Gestionnaire et l'administrateur DTS sont renvoyes a l'accueil, et le serveur refuse aussi (403).
- Pas d'annulation d'invitation pour l'instant. Un utilisateur ne peut ni se desactiver ni se modifier lui-meme (403 `ACTION_SUR_SOI_INTERDITE`).

**A faire ensuite**
- Verification a la main pas encore faite : un Gestionnaire du site A ne voit rien du site B. La base locale n'a qu'un seul site, donc a refaire des qu'un deuxieme site existe (ecran E12). Les tests automatiques couvrent ce cas.
- Jour 19 : ecran E10 (questionnaires, liste et editeur).
- Decision de DTS attendue le lundi 9 novembre : service d'e-mails. D'ici la, tout part dans Mailpit.

**Points d'attention**
- `eslint` sur les fichiers du jour : 39 erreurs, toutes `react-hooks/rules-of-hooks` dans les hooks nommes `utiliser...`, meme cause que les jours 15 et 17. Aucune autre erreur. A traiter plus tard.
- En suspens, hors plan du jour 18 : a l'envoi d'un avis public, le message "L'envoi a echoue" apparait. Cause probable : un ancien brouillon reste dans le navigateur (non confirmee). A tester en vidant les cles `brouillon-avis:` du `localStorage`, et sinon en lisant la reponse de la requete rouge dans l'onglet Reseau.
- La base locale contient deux questionnaires crees par l'API ("Avis restaurant" et "Avis restaurant - Tables"), tous deux actifs. Les modeles du seed n'apparaissent pas dans les listes : il faut les cloner (ecran E10, jour 19).


## Jour 18 (design) - samedi 7 novembre 2026 : page Sites et tables sans tableau ni cadres

**Fait**
- Branche `design-sites-et-tables`, creee apres la fusion du jour 18 (PR #24). 4 commits, une etape par fichier.
- Ecran E12 (Sites et tables) redessine : plus de tableau, plus de cadres, plus d'ombres. Seulement des traits de 1 px tres fins et des textes bien disposes. Les couleurs viennent de `index.css` (theme sombre et theme clair), aucune couleur propre a la page.
- Ordinateur (au moins 1100 px de large et 640 px de haut, le meme seuil que l'accueil et les avis) : la page ne defile pas et le bloc est centre en hauteur et en largeur (46 rem au plus). A gauche le site (choix, actions, coordonnees), a droite les points de contact en lignes separees par un trait fin, avec une ligne de libelles au dessus. Un trait vertical fin separe les deux colonnes.
- Telephone et tablette : tout est l'un sous l'autre et la page defile. Chaque point de contact est une grande carte sans cadre ; les cartes se font glisser de gauche a droite (`scroll-snap`), sans barre de defilement visible.
- Fichiers dans `frontend/tableau-de-bord/src` : `styles/sites.css` (nouveau, 585 lignes), `composants-sites/liste-points.tsx`, `composants-sites/formulaire-site.tsx`, `composants-sites/creation-masse.tsx`, `pages/sites-points-de-contact/page-sites.tsx`.
- Backend non modifie, aucun texte ajoute (fr et en), aucune dependance ajoutee. `tsc -b`, `eslint` sur les 4 fichiers .tsx et `vite build` sans erreur.

**Decisions**
- Ecran fixe : les points sont coupes en pages avec `utiliserPages` (le hook de l'accueil). Une ligne fait 57 px et la ligne de libelles 25 px (constantes `HAUTEUR_LIGNE` et `HAUTEUR_ENTETE` de `liste-points.tsx`, a garder egales a `styles/sites.css`). Le nombre de points par page suit la hauteur de l'ecran, avec des fleches et "Page X sur Y".
- Telephone : une seule page, tous les points sont dans la rangee de cartes (pas de pagination).
- Un seul bloc a la fois dans la colonne de gauche : les coordonnees, ou le formulaire de creation, ou celui de modification, ou la creation en masse. La creation en masse n'est plus un bloc toujours affiche : c'est une action "Creer des points en masse" qui ouvre et ferme le formulaire. Cela evite le defilement sur ordinateur.
- Filet de securite : si un formulaire est trop long pour un petit ecran, seule la colonne de gauche defile (barre fine). Rien d'autre ne defile.
- Champs sans cadre : un trait fin dessous, qui devient vert au clic et rouge en cas d'erreur. Boutons sans cadre, en texte ; le bouton principal garde son fond plein.
- Pas de barre de recherche pour l'instant (a ajouter plus tard si besoin). Pas d'images sur les cartes : les points de contact n'en ont pas dans les donnees, et le QR reste reserve a l'ecran E11.
- Le centrage utilise `:has()` (`.sites-contenu:has(.sites-corps)`) pour que la hauteur fixe ne s'applique qu'a la page avec un site choisi, pas aux messages de chargement ou d'erreur.

**A faire ensuite**
- Controle a l'ecran, a la main : ordinateur (pas de defilement, bloc centre, changement de nombre de points quand on reduit la hauteur de la fenetre), telephone a 390 px (cartes a glisser), themes sombre et clair, formulaires (creation, modification, creation en masse), Gestionnaire (lecture seule, sans boutons).
- Jour 19 : ecran E10 (questionnaires, liste et editeur).

**Point d'attention**
- Meme remarque qu'aux jours 15, 17 et 18 : `eslint` lance sur tout `src` signale des erreurs `react-hooks/rules-of-hooks` dans les hooks nommes `utiliser...`. Aucune dans les fichiers du design.


## Jour 18 (design) - samedi 7 novembre 2026 : page Sites et tables sans tableau ni cadres

**Fait**
- Branche `design-sites-et-tables`, creee apres la fusion du jour 18 (PR #24). 4 commits, une etape par fichier.
- Ecran E12 (Sites et tables) redessine : plus de tableau, plus de cadres, plus d'ombres. Seulement des traits de 1 px tres fins et des textes bien disposes. Les couleurs viennent de `index.css` (theme sombre et theme clair), aucune couleur propre a la page.
- Ordinateur (au moins 1100 px de large et 640 px de haut, le meme seuil que l'accueil et les avis) : la page ne defile pas et le bloc est centre en hauteur et en largeur (46 rem au plus). A gauche le site (choix, actions, coordonnees), a droite les points de contact en lignes separees par un trait fin, avec une ligne de libelles au dessus. Un trait vertical fin separe les deux colonnes.
- Telephone et tablette : tout est l'un sous l'autre et la page defile. Chaque point de contact est une grande carte sans cadre ; les cartes se font glisser de gauche a droite (`scroll-snap`), sans barre de defilement visible.
- Fichiers dans `frontend/tableau-de-bord/src` : `styles/sites.css` (nouveau, 585 lignes), `composants-sites/liste-points.tsx`, `composants-sites/formulaire-site.tsx`, `composants-sites/creation-masse.tsx`, `pages/sites-points-de-contact/page-sites.tsx`.
- Backend non modifie, aucun texte ajoute (fr et en), aucune dependance ajoutee. `tsc -b`, `eslint` sur les 4 fichiers .tsx et `vite build` sans erreur.

**Decisions**
- Ecran fixe : les points sont coupes en pages avec `utiliserPages` (le hook de l'accueil). Une ligne fait 57 px et la ligne de libelles 25 px (constantes `HAUTEUR_LIGNE` et `HAUTEUR_ENTETE` de `liste-points.tsx`, a garder egales a `styles/sites.css`). Le nombre de points par page suit la hauteur de l'ecran, avec des fleches et "Page X sur Y".
- Telephone : une seule page, tous les points sont dans la rangee de cartes (pas de pagination).
- Un seul bloc a la fois dans la colonne de gauche : les coordonnees, ou le formulaire de creation, ou celui de modification, ou la creation en masse. La creation en masse n'est plus un bloc toujours affiche : c'est une action "Creer des points en masse" qui ouvre et ferme le formulaire. Cela evite le defilement sur ordinateur.
- Filet de securite : si un formulaire est trop long pour un petit ecran, seule la colonne de gauche defile (barre fine). Rien d'autre ne defile.
- Champs sans cadre : un trait fin dessous, qui devient vert au clic et rouge en cas d'erreur. Boutons sans cadre, en texte ; le bouton principal garde son fond plein.
- Pas de barre de recherche pour l'instant (a ajouter plus tard si besoin). Pas d'images sur les cartes : les points de contact n'en ont pas dans les donnees, et le QR reste reserve a l'ecran E11.
- Le centrage utilise `:has()` (`.sites-contenu:has(.sites-corps)`) pour que la hauteur fixe ne s'applique qu'a la page avec un site choisi, pas aux messages de chargement ou d'erreur.

**A faire ensuite**
- Controle a l'ecran, a la main : ordinateur (pas de defilement, bloc centre, changement de nombre de points quand on reduit la hauteur de la fenetre), telephone a 390 px (cartes a glisser), themes sombre et clair, formulaires (creation, modification, creation en masse), Gestionnaire (lecture seule, sans boutons).
- Jour 19 : ecran E10 (questionnaires, liste et editeur).

**Point d'attention**
- Meme remarque qu'aux jours 15, 17 et 18 : `eslint` lance sur tout `src` signale des erreurs `react-hooks/rules-of-hooks` dans les hooks nommes `utiliser...`. Aucune dans les fichiers du design.


## Jour 18 (design Premium) - samedi 7 novembre 2026 : page Sites et tables en cartes a faire glisser

**Fait**
- Meme branche `design-sites-et-tables`. Cette entree remplace le design de l'entree precedente (colonnes, lignes a traits fins, pages avec fleches) par la maquette Premium.
- Ecran E12 redessine : en haut le choix du site et ses boutons, puis le titre et les coordonnees, la recherche, et une rangee de grandes cartes (une par point de contact) qu'on fait glisser de gauche a droite. Chaque carte montre le statut, un grand numero, le nom et le questionnaire.
- Fichiers dans `frontend/tableau-de-bord/src` : `styles/sites.css` (661 lignes, reecrit), `composants-sites/liste-points.tsx` (413 lignes), `composants-sites/creation-masse.tsx` (329 lignes), `pages/sites-points-de-contact/page-sites.tsx` (375 lignes), puis 11 textes ajoutes dans `traductions/fr/textes.ts` et `traductions/en/textes.ts` (+12 lignes chacun).
- Backend, hooks et `utiliserSitesPoints` non modifies, aucune dependance ajoutee. `tsc -b`, `eslint` sur les 4 fichiers .tsx et les 2 fichiers de textes, et `vite build` sans erreur. Plus aucune cle de texte manquante en francais comme en anglais.

**Decisions**
- Rond crayon d'une carte (Responsable seulement) : la carte passe en edition sur place (nom, questionnaire, activer ou desactiver, enregistrer ou annuler). Le Gestionnaire lit seulement, sans aucun bouton.
- Un seul panneau ouvert a la fois sous la barre d'actions : nouveau site, gerer le site (modifier, activer ou desactiver), creer en masse, ajouter une table.
- Ajouter une table ouvre la creation en masse avec le premier et le dernier numero deja remplis au prochain numero libre. Il n'y a pas de creation d'un point isole dans le backend, donc rien n'a change cote serveur.
- Recherche : elle filtre les cartes sur l'ecran, par nom ou par zone, sans appel a l'API.
- Points de pagination : calcules d'apres la largeur visible, ils suivent le defilement et un clic fait defiler. `utiliserPages` n'est plus utilise ici, il reste intact pour l'accueil.
- La page defile normalement si l'ecran est trop bas (le `<main>` s'en charge). Plus d'ecran fixe pour cette page.
- Couleurs : uniquement les variables de `index.css`. En theme clair, les cartes et les pastilles prennent le gris doux, car la surface est blanche comme la page.

**A faire ensuite**
- Controle a l'ecran, a la main : ordinateur et telephone a 390 px, themes sombre et clair, avec 2 puis 40 points (defilement, points de pagination, recherche, message "aucun point ne correspond"), edition sur place d'une carte, panneaux (nouveau site, gerer le site, creer en masse, ajouter une table), Gestionnaire en lecture seule.
- Jour 19 : ecran E10 (questionnaires, liste et editeur).

**Points d'attention**
- Le texte `sites.liste.videResponsable` dit encore "le bloc Creer des points en masse ci-dessous" ; avec ce design le bouton est en haut de la page. A corriger plus tard.
- L'entree "Jour 18 (design)" est presente deux fois dans ce journal, a l'identique. A nettoyer plus tard.


## Jour 20 - dimanche 8 novembre 2026 : questionnaires (2), apercu, versions et suppression (ecran E10)

**Fait**
- Backend, module `modules/questionnaires` : `services/versions.ts` (historique d'un questionnaire : numero, publiee ou non, dates, nombre de questions et d'avis par version) et `services/suppression.ts` (suppression douce). Deux routes reservees au Responsable dans `questionnaires.routes.ts` : `GET /questionnaires/:id/versions` et `DELETE /questionnaires/:id` (controleurs `listerLesVersions` et `supprimerUnQuestionnaire`).
- Suppression : un questionnaire sans avis est supprime (`supprime_le` rempli) et ses points de contact sont detaches (la reponse donne `points_contact_detaches`). Avec au moins un avis : 409 `QUESTIONNAIRE_AVEC_AVIS` (avec `nombre_avis`), rien ne change, il faut le desactiver. Questionnaire d'une autre organisation : 404. Gestionnaire : 403.
- Test `backend/tests/integration/questionnaires-versions-suppression.test.ts` (10 tests) : scenario 9 (modifier un questionnaire qui a des avis cree la version 2, l'ancien avis et sa reponse restent sur la version 1), historique des versions, suppression refusee avec avis et acceptee sans avis, acces refuse au Gestionnaire (403) et isolation entre organisations (404).
- Page d'avis (`frontend/application-avis-public/src`) : page `/apercu` (`pages/6-apercu/page-apercu.tsx`, route ajoutee dans `App.tsx`). Elle rejoue le parcours avec les vrais ecrans (accueil, questions, commentaire, remerciement), sans appel a l'API, sans scan, sans avis envoye et sans brouillon garde.
- Tableau de bord (`frontend/tableau-de-bord/src`) : `utilitaires/vers-apercu-public.ts` (brouillon de l'editeur vers le format de la page d'avis), `composants-questionnaires/apercu-telephone.tsx` (cadre de telephone), `hooks/utiliser-gestion-questionnaire.ts`, `composants-questionnaires/panneau-publication.tsx` (publier, activer ou desactiver, dates de debut et de fin, choix de plusieurs points de contact), `hooks/utiliser-versions-questionnaire.ts`, `composants-questionnaires/historique-versions.tsx` et `styles/publication-questionnaire.css`. Types et services (`types/questionnaires.ts`, `services/questionnaires.ts`) : versions, dates, points de contact, publier, activer, desactiver, supprimer.
- Editeur (`pages/questionnaires/page-editeur-questionnaire.tsx`) : apercu en direct a droite, sections Publication, Dates, Points de contact et Versions sous le formulaire, bouton Supprimer. Liste (`page-questionnaires.tsx`, `utiliser-liste-questionnaires.ts`, `detail-questionnaire.tsx`) : Supprimer dans le menu ... du panneau de detail, avec confirmation.
- Textes fr et en : blocs `suppression` (dans `editeur`), `apercu`, `publication` et `versions`, plus `supprimer` dans le detail (78 textes, memes cles dans les deux langues).
- `tsc -b` sans erreur dans le tableau de bord et dans la page d'avis.

**Decisions**
- Apercu : les vrais ecrans de la page d'avis, affiches dans un cadre de telephone (iframe) et alimentes par le brouillon de l'editeur a chaque modification (postMessage). Le tableau de bord et la page d'avis sont deux applications separees : on ne copie aucun composant, et le client voit exactement la meme chose. Rien n'est envoye au serveur.
- Suppression : douce, reservee au Responsable, refusee des qu'un avis existe (on desactive alors le questionnaire, ce qui garde les avis et les statistiques). La confirmation du navigateur indique combien de points de contact seront detaches.
- Versions : modifier un questionnaire qui a des avis cree la version suivante (comportement deja en place). Si la version precedente etait publiee, la nouvelle l'est aussi des l'enregistrement, pour que les clients ne voient pas une page d'erreur pendant la modification.
- Publier utilise la derniere version enregistree : le bouton Publier est bloque tant que le brouillon n'est pas enregistre.
- Les sections Publication, Dates, Points de contact et Versions n'apparaissent qu'une fois le questionnaire cree (pas en mode nouveau), pour le Responsable.
- Dates de debut et de fin saisies et affichees a l'heure de Lome (UTC+0), sans conversion de fuseau.
- Points de contact : la liste complete est enregistree d'un coup.

**A faire ensuite**
- Verifications du soir, a faire a la main : modifier un questionnaire qui a deja des reponses (version 2 creee, anciens avis intacts, historique des versions correct) ; mettre des dates de debut et de fin dans le passe puis scanner le QR code (bonne page cote client) ; associer un questionnaire a plusieurs points de contact ; supprimer un questionnaire sans avis (points detaches) et essayer d'en supprimer un qui a des avis (message, il reste dans la liste) ; ouvrir l'apercu en francais puis en anglais.
- Lancer `npm test` dans backend et noter le resultat.
- Jour 21 : exports et rapports (`POST /exports` en csv, xlsx et pdf, ecran E16).

**Points d'attention**
- `eslint` sur les fichiers du jour : 38 erreurs, toutes `react-hooks/rules-of-hooks` dans les hooks nommes `utiliser...` (18 dans `utiliser-gestion-questionnaire.ts`, 16 dans `utiliser-liste-questionnaires.ts`, 4 dans `utiliser-versions-questionnaire.ts`), meme cause que les jours 15, 17 et 18. Aucune autre erreur. A traiter plus tard.
- En developpement, l'apercu a besoin que la page d'avis tourne (port 5173 du meme ordinateur) : sinon le cadre reste vide. En production il utilise la meme adresse que le tableau de bord : a verifier a la mise en ligne.
- Onze textes `sites.*` manquent encore en anglais (hors jour 20).


## Jour 21 - mardi 10 novembre 2026 : exports et rapports, robot et ecran E16

**Fait**
- Backend, module `modules/rapports` : `validations/exports.ts` (corps de `POST /exports` et `POST /exports/analyse` : format csv, xlsx ou pdf, langue, filtres identiques a ceux de `GET /avis`), `services/collecte-avis.ts` (lecture des avis filtres par paquets, une ligne par avis, une colonne par question), `services/export-csv.ts`, `services/export-xlsx.ts`, `services/analyse.ts` (points forts, points faibles et pistes d'action), `services/rapport-pdf.ts`, `controleurs/exports.controleur.ts` et `routes/exports.routes.ts` (branchee dans `app.ts` par 2 lignes). Dependance ajoutee dans backend : `exceljs`.
- Tests : `backend/tests/integration/exports.test.ts` (30 tests : accents et BOM du CSV, colonnes Excel, PDF valide, 1 000 avis en moins de 10 s pour le scenario 10, gestionnaire limite a son perimetre) et `isolation-exports.test.ts` (7 tests : les routes d'exports ajoutees au test d'isolation entre organisations).
- Tableau de bord (`frontend/tableau-de-bord/src`) : `types/exports.ts`, `services/exports.ts`, `services/telechargement.ts` (envoi POST accepte), `utilitaires/comprendre-recherche.ts` (le texte tape devient format, periode et filtres), `hooks/utiliser-export.ts` (etat de l'ecran, analyse, creation et telechargement du fichier).
- Ecran E16 : `composants-exports/robot.tsx` (robot SVG, 5 humeurs, yeux qui suivent le curseur, ressorts), `barre-recherche-export.tsx`, `etapes-export.tsx` (indications 1 a 4), `choix-format.tsx`, `panneau-analyse.tsx`, `pages/rapports-exports/page-exports.tsx`, `styles/exports.css`, route `/exports` dans `App.tsx` (elle remplace le message "en construction").
- Textes fr et en : bloc `exports` (64 textes, memes cles dans les deux langues).
- Frontend : `tsc -b` et `eslint` sans erreur sur les fichiers du jour, et `vite build` sans erreur (testes sur une copie du depot).

**Decisions**
- Analyse du robot calculee par des regles (seuils, comparaisons, classements) sur les memes chiffres que le tableau de bord. Ce n'est pas une IA externe : rien ne quitte le serveur, et c'est gratuit. Un vrai modele pourra etre branche plus tard, avec l'accord de DTS (cout et confidentialite des avis).
- L'analyse ne tient compte que de la periode, du site, du point de contact et du questionnaire. Les autres filtres de l'export (statut, negatifs, note, recherche) ne s'y appliquent pas. Sans dates : les 30 derniers jours.
- Sans dates, csv et xlsx exportent tous les avis ; le rapport pdf prend les 30 derniers jours. Periode limitee a 366 jours pour le pdf et l'analyse, comme le tableau de bord.
- Limite de 50 000 avis par export : au dela, rien n'est lu (erreur `EXPORT_TROP_VOLUMINEUX`) et l'utilisateur doit reduire la periode ou ajouter un filtre.
- CSV : UTF-8 avec BOM (accents corrects dans Excel). Separateur point-virgule et virgule decimale en francais, virgule et point en anglais. Un texte qui commence par `=`, `+`, `-` ou `@` est precede d'une apostrophe, pour qu'Excel ne le lise pas comme une formule.
- Excel : feuille "Avis" (notes en nombres, vraie date) et feuille "Analyse" avec les conclusions du robot. Deux questions de versions differentes, avec le meme texte et le meme type, partagent la meme colonne.
- Les coordonnees du client ne sortent que s'il a coche la case de consentement.
- L'organisation et le perimetre du gestionnaire viennent de la session, jamais du corps de la requete. Chaque fichier genere ecrit une ligne `EXPORT_GENERE` dans le journal d'audit. Noms des fichiers : `avis-AAAA-MM-JJ.xlsx` et `rapport-avis-AAAA-MM-JJ.pdf`.
- Rapport PDF sur 2 pages (Helvetica) : page 1 avec logo, periode, resume, six indicateurs et trois graphiques dessines en vecteur ; page 2 avec trois points forts, trois points faibles et les pistes d'action.
- Ecran : le Responsable et le Gestionnaire l'utilisent ; l'administrateur DTS (sans organisation) est renvoye a l'accueil. Le robot comprend le francais et l'anglais, quelle que soit la langue de l'ecran. Presque tout en classes Tailwind ; `exports.css` ne contient que le halo de la barre et l'apparition des pastilles, importe par `barre-recherche-export.tsx` (comme `sites.css` par `liste-points.tsx`).
- La liste `ECRANS_A_VENIR` de `App.tsx` est maintenant vide (typee), le mecanisme reste pour les prochains ecrans.

**A faire ensuite**
- Fichier 26 : entree dans `apres-un-pull.md` (`npm install` dans backend pour `exceljs`).
- Verifications du soir, a faire a la main : exporter 1 000 avis en Excel en moins de 10 secondes avec les accents corrects (scenario 10) ; ouvrir le CSV dans Excel (accents) ; PDF propre (logo, periode, graphiques) ; un gestionnaire n'exporte que son perimetre ; l'analyse du robot correspond aux chiffres du tableau de bord ; l'ecran sur ordinateur, tablette et telephone, themes sombre et clair.
- Lancer `npx tsc --noEmit` et `npm test` dans backend et noter le resultat.
- Cloture : pull request vers main, fusion, `git checkout main` puis `git pull`. Ensuite jour 22 (back-office DTS : organisations et modeles sectoriels).

**Points d'attention**
- `npx eslint src` sur tout le dossier signale environ 230 erreurs `react-hooks/rules-of-hooks` dans les anciens hooks nommes `utiliser...`, y compris `utiliser-langue.ts` qui date d'avant le jour 21. Aucune dans les fichiers du jour 21.
- Si le planning prend du retard, le rapport PDF est la premiere chose a couper (on garde les exports CSV et Excel).


## Jour 22 - jeudi 12 novembre 2026 : back-office DTS, organisations et modeles sectoriels

**Fait**
- Backend, module `modules/administration` : `validations/organisations.ts`, `services/organisations.ts` (creer avec clonage du modele du secteur, lister, lire, modifier, suspendre, reactiver), `services/premier-responsable.ts` (invitation avec `creerInvitation` du jour 18), `controleurs/organisations.controleur.ts` et `routes/organisations.routes.ts`, branchee dans `app.ts` sur `/api/v1/admin/organisations`.
- Suspension : `middleware/exiger-connexion.ts` refuse la session en cours d'une organisation suspendue (401 `ORGANISATION_SUSPENDUE`), `auth.controleur.ts` refuse la connexion (403 `ORGANISATION_SUSPENDUE`, apres la verification du mot de passe) et `/auth/moi` renvoie 401. Le QR code utilisait deja la page claire du serveur.
- Backend, module `modules/secteurs` : `validations/secteurs.ts`, `services/secteurs.ts` (lister, lire, creer, modifier, themes, questionnaires types), `controleurs/secteurs.controleur.ts` et `routes/secteurs.routes.ts`, branchee dans `app.ts` sur `/api/v1/admin/secteurs`.
- Donnees de depart : `prisma/donnees-initiales/secteurs/modeles-sectoriels.ts` (themes et questions des 6 modeles, annexe A1 a A5 et general, en francais et en anglais) et `prisma/seed.ts` reecrit : il installe les themes et les modeles manquants et peut etre relance sans doublon.
- Tests : `admin-organisations.test.ts` (13 tests : creation, suspension avec connexion et QR bloques, reactivation, invitation), `admin-secteurs.test.ts` (12 tests) et `isolation-admin.test.ts` (4 tests : 401 pour un visiteur sur les 14 routes admin, 403 pour un Responsable et un Gestionnaire avec la base inchangee, controle positif de l'administrateur). `isolation-admin.test.ts` : 1 fichier, 4 tests passes.
- Aucun fichier frontend aujourd'hui (la page de suspension et ses textes existaient deja).

**Decisions**
- Routes reservees a l'administrateur DTS : `exigerConnexion` puis `exigerRole("ADMINISTRATEUR")`, sans `exigerOrganisation` (le compte DTS n'a pas d'organisation). Les offres (`/admin/offres`) ne font pas partie du jour.
- Pas de logo a la creation : le premier responsable l'ajoute dans l'ecran E14.
- Statut a la creation : ESSAI (par defaut) ou ACTIF. Le secteur et le statut ne se modifient pas par `PATCH` : la suspension et la reactivation ont leurs routes. La reactivation remet toujours ACTIF.
- Premier responsable : invite par `POST /admin/organisations/{id}/inviter-responsable` avec seulement l'e-mail (role Responsable, sans site). Une invitation qui echoue ne bloque pas la creation et on peut la renvoyer. Refus 409 si l'organisation a deja un responsable actif.
- A la creation, le modele du secteur est copie automatiquement dans l'organisation, en brouillon (scenario 13 : organisation sante operationnelle en moins de 15 minutes).
- Modele general : l'annexe A ne le decrit pas, il reprend les 4 themes du seed (accueil, service, proprete, prix) en etoiles, plus le NPS.
- Avertissement sante : dans le message d'accueil du modele, en francais et en anglais, donc affiche sur l'ecran E1.
- Le code d'un secteur et celui d'un theme ne changent jamais (le seed et le clonage s'appuient dessus). Un secteur desactive n'est plus propose a la creation d'une organisation.

**A faire ensuite**
- Fichier 17 : entree dans `apres-un-pull.md` (relancer le seed apres un pull pour installer les modeles).
- Verifications du soir, a faire a la main : creer une organisation sante par l'API (modele present, avec l'avertissement) ; inviter son premier responsable (e-mail dans Mailpit) ; organisation suspendue bloquee (connexion refusee, QR code avec la page claire) puis reactivee ; un Responsable recoit 403 sur les routes admin ; seed lance deux fois sans doublon.
- Lancer `npm test` dans `backend` (Docker Desktop ouvert, base demarree) et noter le resultat.
- Cloture : pull request vers main, fusion, `git checkout main` puis `git pull`. Ensuite jour 23 (back-office DTS : ecrans E17 et E18).

**Points d'attention**
- `npx tsc --noEmit` dans `backend` ne verifie pas le dossier `tests` (le `tsconfig` n'inclut que `src`) : les fichiers de test ne sont controles que par `vitest`.
- La connexion est limitee a 10 essais par minute : chaque fichier de test en garde le compte dans son en-tete (6 pour `admin-organisations.test.ts`, 4 pour `isolation-admin.test.ts`).
- Le service d'e-mails de DTS n'est pas encore choisi : on garde Mailpit.

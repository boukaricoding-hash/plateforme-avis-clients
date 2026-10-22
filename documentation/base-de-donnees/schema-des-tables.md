# Schema de la base de donnees

Fichier source : `backend/prisma/schema.prisma`
Premiere migration : `tables_initiales` (22 octobre 2026), jour 1 du planning.
Base : PostgreSQL 17, geree avec Prisma 7.

## Regles communes a toutes les tables

- Identifiants : UUID.
- Noms de champs en snake_case. Les tables portent des noms francais au singulier (`@@map`).
- `organisation_id` sur chaque table metier : c'est la base de l'isolation entre clients.
- Suppression logique : champ `supprime_le` sur les donnees metier. On ne supprime pas, on marque.
- Dates stockees en UTC, affichees dans le fuseau de l'organisation (Africa/Lome par defaut).
- Aucun secret en clair : mots de passe, sessions et jetons sont stockes sous forme de hachage.
- L'organisation d'un utilisateur vient toujours de sa session, jamais de la requete du navigateur.

## Les 22 tables

### Reference (communes a toutes les organisations)

| Table | Role |
|---|---|
| `secteur` | Type d'activite (restauration, sante, education...). Porte le `vocabulaire` (table, chambre, salle...) et les `indicateurs_suggeres`. Ajouter un secteur = ajouter une ligne, sans changer le code. |
| `theme` | Categorie d'une question (accueil, proprete, prix...), rattachee a un secteur. Sert aux scores par theme du tableau de bord. |

### Structure

| Table | Role |
|---|---|
| `organisation` | Le client de DTS. Porte le secteur, le `statut` (ESSAI, ACTIF, SUSPENDU), le pays, la langue, le fuseau et les reglages : seuils d'alerte (note <= 2, NPS <= 6), periode anti-doublon (6 h), conservation des avis (24 mois). |
| `site` | Un etablissement d'une organisation : adresse, ville, telephone, horaires. |
| `point_contact` | L'endroit d'un QR code (table 12, chambre 5...). Porte `type`, `zone`, le `code_public` unique et aleatoire, le questionnaire associe et `revoque_le`. |
| `utilisateur` | Compte de connexion. Role : RESPONSABLE, GESTIONNAIRE ou ADMINISTRATEUR. `organisation_id` est vide pour l'administrateur DTS. Contient aussi le compteur d'echecs et le verrouillage. |
| `utilisateur_site` | Perimetre d'un utilisateur : liste des sites qu'il peut voir. |

### Questionnaires

| Table | Role |
|---|---|
| `questionnaire` | Titre, messages d'accueil et de remerciement (multilingues), statut (BROUILLON, ACTIF, INACTIF), dates de debut et de fin. Un **modele sectoriel** est un questionnaire avec `est_modele = true`, sans organisation, rattache a un secteur. |
| `questionnaire_version` | Une version publiee d'un questionnaire. Modifier un questionnaire qui a deja des avis cree une nouvelle version. |
| `question` | Question d'une version : type (8 types), libelle et aide multilingues, theme, obligatoire ou non, options, echelle, libelles des extremites, condition. |

Les 8 types : ETOILES, EMOJIS, NPS, CHOIX_UNIQUE, CHOIX_MULTIPLE, OUI_NON, ECHELLE, TEXTE_LIBRE.

### Collecte

| Table | Role |
|---|---|
| `scan` | Un scan de QR code. Sert au taux de reponse (avis divises par scans). |
| `avis` | Un avis envoye : point de contact, version du questionnaire, note globale, NPS, commentaire, coordonnees (seulement avec consentement), statut de traitement, empreinte anti-doublon, `cle_idempotence` (un renvoi apres coupure du reseau ne cree qu'un seul avis). |
| `reponse` | Reponse a une question d'un avis : valeur numerique, texte ou choix. Une seule reponse par question et par avis. |

### Suivi

| Table | Role |
|---|---|
| `avis_suivi` | Historique d'un avis : chaque changement de statut et chaque note interne, avec l'auteur, la date et le commentaire. |
| `alerte` | Creee quand un avis depasse un seuil. Un avis a au plus une alerte. Porte le niveau (NORMAL, PRIORITAIRE), les motifs et la personne assignee. |
| `notification` | Message pour un utilisateur (cloche) : lue ou non, e-mail envoye ou non. |

### Securite

| Table | Role |
|---|---|
| `session` | Session de connexion (hachage du jeton, derniere activite, expiration). |
| `jeton_reinitialisation_mdp` | Lien de reinitialisation a usage unique, valable 30 minutes. |
| `jeton_invitation` | Invitation d'un utilisateur avec son role et son perimetre de sites. |
| `audit_log` | Journal des actions sensibles : auteur, action, entite, date, adresse IP. |
| `acces_support` | Accord donne par une organisation pour un acces de support en lecture seule, avec une duree limitee. |

### Chiffres

| Table | Role |
|---|---|
| `agregat_quotidien` | Totaux par point de contact et par jour (avis, notes, promoteurs, detracteurs, scans, repartition des notes, scores par theme). Alimente le tableau de bord rapidement, recalcule chaque nuit et a chaque nouvel avis. |

## Decisions de conception

1. **Statut de traitement sur l'avis uniquement.** Le cahier le met aussi sur l'alerte. On evite ce double stockage, qui finirait par se desynchroniser. Une alerte est ouverte quand son avis est NOUVEAU ou EN_COURS.
2. **Modeles sectoriels = questionnaires marques `est_modele`.** Cloner un modele revient a copier un questionnaire.
3. **Textes multilingues en JSON** (`{"fr": "...", "en": "..."}`). On ajoute l'ewe ou le kabye sans migration.
4. **`point_contact.type` est un texte libre**, car le vocabulaire depend du secteur.
5. **L'ordre des questions n'est pas unique** par version, pour permettre de reordonner sans conflit.
6. **Theme rattache au secteur seulement.** Les themes propres a une organisation ne sont requis par aucune exigence prioritaire M.
7. **Tables ajoutees par rapport a la section 9 du cahier** : `avis_suivi`, `acces_support`, `utilisateur_site`, `session`, `scan` detaille, et les deux tables de jetons.
8. **Reportees en version 2** : `offre` et `action_amelioration`.

## Regles appliquees par le code (non imposables par la base)

- `code_public` : au moins 10 caracteres aleatoires.
- Empreinte anti-doublon : hachage sale de l'IP, du navigateur et du point de contact, jamais l'IP en clair, conservee 7 jours.
- Coordonnees du client enregistrees seulement si `consentement` est vrai.
- Email d'un utilisateur enregistre en minuscules.
- Mots de passe hashes avec bcryptjs (cout 12).

## Commandes utiles (dans `backend/`)

- Voir l'etat des migrations : `npx prisma migrate status`
- Creer une migration apres un changement du schema : `npx prisma migrate dev --name nom_de_la_migration`
- Appliquer les migrations existantes (autre poste, serveur) : `npx prisma migrate deploy`
- Voir les donnees : `npx prisma studio`
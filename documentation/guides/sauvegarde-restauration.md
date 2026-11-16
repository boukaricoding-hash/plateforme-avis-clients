# Sauvegarde et restauration

Cette procédure répond au scénario de recette 12 : restaurer une sauvegarde sur un environnement vide et retrouver toutes les données. Les scripts sont dans `backend/scripts/sauvegarde/`. Ils s'écrivent en bash : directement sur un serveur Linux, avec Git Bash (ou `bash` dans le terminal VS Code) sur Windows, Docker Desktop ouvert.

## Ce qui est sauvegardé

- La base PostgreSQL (volume `donnees-postgres`), au format `pg_dump -Fc` : `base-AAAA-MM-JJ_HHMMSS.dump`.
- Les logos des organisations (volume `donnees-logos`), en archive : `logos-AAAA-MM-JJ_HHMMSS.tar.gz`.

Le code est dans Git. Le fichier `.env` n'est pas dans la sauvegarde : garde-le à part, en lieu sûr.

Les fichiers vont dans `sauvegardes/` à la racine du dépôt (ignoré par Git, car ce sont de vraies données) et sont lisibles par leur propriétaire seulement. À chaque sauvegarde, celles de plus de 30 jours sont supprimées.

## Faire une sauvegarde

    bash backend/scripts/sauvegarde/sauvegarder.sh

- Le conteneur de la base doit tourner : `docker compose up -d base-de-donnees`.
- Si l'application ne tourne pas, la base est sauvegardée mais pas les logos, et le script l'écrit.
- Fin attendue : `✓ Sauvegarde terminée.`
- Variables facultatives : `DOSSIER_SAUVEGARDES` (dossier de destination) et `RETENTION_JOURS` (30 par défaut).

## Sauvegarde automatique chaque nuit (serveur)

Sur le serveur Linux, ouvrir la planification avec `crontab -e` et ajouter cette ligne (remplacer le chemin) :

    0 2 * * * cd /chemin/vers/plateforme-avis-clients && bash backend/scripts/sauvegarde/sauvegarder.sh >> /var/log/sauvegarde-avis.log 2>&1

Le lendemain matin, vérifier avec `ls -l sauvegardes` et en lisant `/var/log/sauvegarde-avis.log`. Une sauvegarde gardée sur le même disque que la base ne protège pas d'une panne du disque : prévoir aussi une copie sur une autre machine.

## Restaurer

1. Si on remplace la vraie base, arrêter l'application : `docker compose stop application`.
2. Restaurer :
   - Dans une nouvelle base (elle est créée si elle n'existe pas) :
     `BASE_CIBLE=test_restauration bash backend/scripts/sauvegarde/restaurer.sh sauvegardes/base-AAAA-MM-JJ_HHMMSS.dump`
   - Dans la base de la plateforme, avec les logos :
     `bash backend/scripts/sauvegarde/restaurer.sh --ecraser --logos sauvegardes/logos-AAAA-MM-JJ_HHMMSS.tar.gz sauvegardes/base-AAAA-MM-JJ_HHMMSS.dump`
3. Si la base de la plateforme contient déjà des tables, le script demande de taper son nom pour confirmer (`--oui` supprime cette question).
4. Relancer l'application : `docker compose up -d application`.

La restauration se fait en une seule transaction : en cas d'échec, aucune donnée partielle n'est écrite. L'option `--logos` ne s'utilise pas avec `BASE_CIBLE`.

## Vérifier que ça marche (scénario 12)

    bash backend/scripts/sauvegarde/verifier-restauration.sh

Le test ne touche jamais à la vraie base. Il sauvegarde, restaure dans une base vide temporaire, puis compare, table par table, le nombre de lignes et une empreinte du contenu. La base et le dossier temporaires sont supprimés à la fin, même en cas d'échec.

- Code 0 : tout est identique (✓).
- Code 1 : échec (✗), lire le message.
- Code 2 : test non concluant, la base a changé pendant le test. Relancer quand personne n'envoie d'avis.

À refaire chaque mois, comme le demande le cahier des charges.

## Résultats des tests

| Date | Résultat | Remarque |
| --- | --- | --- |
| à remplir | à remplir | |
#!/usr/bin/env bash
# Verification automatique de la sauvegarde et de la restauration (scenario 12).
# Usage : bash backend/scripts/sauvegarde/verifier-restauration.sh
#
# Le test ne touche JAMAIS a la vraie base. Il fait :
#   1. releve, pour chaque table de la vraie base, le nombre de lignes et une empreinte du contenu
#   2. sauvegarde (avec sauvegarder.sh, dans un dossier temporaire)
#   3. restaure (avec restaurer.sh) dans une base vide temporaire
#   4. releve les memes chiffres dans la base restauree et compare
#   5. supprime la base temporaire et le dossier temporaire, meme en cas d'echec
# Code de sortie : 0 = tout est identique, 1 = echec, 2 = test non concluant (la base a change).
# A lancer de preference quand personne n'envoie d'avis.

set -euo pipefail

# Git Bash sous Windows : empeche la conversion de /app/... en chemin Windows
export MSYS_NO_PATHCONV=1

DOSSIER_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RACINE="$(cd "$DOSSIER_SCRIPTS/../../.." && pwd)"
cd "$RACINE"

echec() {
  echo "✗ $1" >&2
  exit 1
}

dans_base() {
  docker compose exec -T base-de-donnees "$@"
}

# Execute une requete SQL et renvoie le resultat brut. $1 = base, $2 = requete
sql() {
  dans_base sh -c 'psql -U "$POSTGRES_USER" -d "$1" -tAc "$2"' _ "$1" "$2"
}

# Une ligne par table : nom|nombre de lignes|empreinte md5 du contenu
read -r -d '' REQUETE_EMPREINTES <<'FIN_SQL' || true
SELECT table_name || '|' || (xpath('/row/n/text()', x))[1] || '|' || (xpath('/row/h/text()', x))[1]
FROM (
  SELECT table_name,
         query_to_xml(
           format('SELECT count(*) AS n, md5(coalesce(string_agg(t::text, '','' ORDER BY t::text), '''')) AS h FROM %I.%I t',
                  table_schema, table_name),
           false, true, '') AS x
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
) s
ORDER BY 1
FIN_SQL

SERVICES_ACTIFS="$(docker compose ps --status running --services 2>/dev/null || true)"
echo "$SERVICES_ACTIFS" | grep -qx "base-de-donnees" \
  || echec "La base de données ne tourne pas. Lance : docker compose up -d base-de-donnees"

BASE_PLATEFORME="$(dans_base sh -c 'printf %s "$POSTGRES_DB"')"
BASE_TEST="verif_restauration_$(date +%Y%m%d%H%M%S)"
TMP="$(mktemp -d)"

nettoyer() {
  dans_base sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$1"' _ "$BASE_TEST" > /dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap nettoyer EXIT

# Lance une commande en gardant sa sortie dans un journal : affiche le journal seulement en cas d'echec
silencieux() {
  local journal="$1"
  shift
  if ! "$@" > "$journal" 2>&1; then
    cat "$journal" >&2
    return 1
  fi
}

echo "Vérification de la sauvegarde et de la restauration"
echo "Base de la plateforme : $BASE_PLATEFORME (elle ne sera pas modifiée)"
echo

echo "1/4 Relevé des tables de la vraie base..."
sql "$BASE_PLATEFORME" "$REQUETE_EMPREINTES" > "$TMP/avant.txt" || echec "Le relevé de la base a échoué."
[[ -s "$TMP/avant.txt" ]] || echec "La base ne contient aucune table : rien à vérifier."

echo "2/4 Sauvegarde..."
DOSSIER_SAUVEGARDES="$TMP/sauvegardes" silencieux "$TMP/sauvegarde.log" bash "$DOSSIER_SCRIPTS/sauvegarder.sh" \
  || echec "La sauvegarde a échoué."
FICHIER_BASE="$(ls -1 "$TMP"/sauvegardes/base-*.dump | head -n 1)"
FICHIER_LOGOS="$(ls -1 "$TMP"/sauvegardes/logos-*.tar.gz 2>/dev/null | head -n 1 || true)"

# Si la base a change pendant la sauvegarde, la comparaison ne prouverait rien
sql "$BASE_PLATEFORME" "$REQUETE_EMPREINTES" > "$TMP/avant2.txt" || echec "Le second relevé a échoué."
if ! cmp -s "$TMP/avant.txt" "$TMP/avant2.txt"; then
  echo "⚠ La base a changé pendant le test (un avis est arrivé ?). Test non concluant : relance-le." >&2
  exit 2
fi

echo "3/4 Restauration dans une base vide temporaire ($BASE_TEST)..."
BASE_CIBLE="$BASE_TEST" silencieux "$TMP/restauration.log" bash "$DOSSIER_SCRIPTS/restaurer.sh" "$FICHIER_BASE" \
  || echec "La restauration a échoué."

echo "4/4 Comparaison..."
sql "$BASE_TEST" "$REQUETE_EMPREINTES" > "$TMP/apres.txt" || echec "Le relevé de la base restaurée a échoué."
echo

NB_TABLES=0
NB_LIGNES=0
NB_ERREURS=0
while IFS='|' read -r TABLE LIGNES EMPREINTE; do
  [[ -n "$TABLE" ]] || continue
  NB_TABLES=$((NB_TABLES + 1))
  NB_LIGNES=$((NB_LIGNES + LIGNES))
  if grep -Fxq "$TABLE|$LIGNES|$EMPREINTE" "$TMP/apres.txt"; then
    echo "  ✓ $TABLE : $LIGNES ligne(s), contenu identique"
  else
    NB_ERREURS=$((NB_ERREURS + 1))
    echo "  ✗ $TABLE : différent ou absent après restauration"
  fi
done < "$TMP/avant.txt"

# Une table en trop dans la base restauree serait aussi une erreur
NB_AVANT="$(grep -c . "$TMP/avant.txt" || true)"
NB_APRES="$(grep -c . "$TMP/apres.txt" || true)"
if [[ "$NB_AVANT" -ne "$NB_APRES" ]]; then
  NB_ERREURS=$((NB_ERREURS + 1))
  echo "  ✗ Nombre de tables différent : $NB_AVANT avant, $NB_APRES après"
fi

# Logos : on compare le nombre de fichiers de l'archive avec celui du volume
if [[ -n "$FICHIER_LOGOS" ]]; then
  NB_LOGOS_ARCHIVE="$(tar -tzf "$FICHIER_LOGOS" | grep -vc '/$' || true)"
  NB_LOGOS_VOLUME="$(docker compose exec -T application sh -c 'find /app/televersements/logos -type f | wc -l' | tr -d ' \r')"
  if [[ "$NB_LOGOS_ARCHIVE" == "$NB_LOGOS_VOLUME" ]]; then
    echo "  ✓ logos : $NB_LOGOS_ARCHIVE fichier(s) dans l'archive, autant que dans le volume"
  else
    NB_ERREURS=$((NB_ERREURS + 1))
    echo "  ✗ logos : $NB_LOGOS_ARCHIVE fichier(s) dans l'archive, $NB_LOGOS_VOLUME dans le volume"
  fi
else
  echo "  ⚠ logos non vérifiés (le conteneur application ne tourne pas)"
fi

echo
if [[ "$NB_ERREURS" -eq 0 ]]; then
  echo "✓ RESTAURATION VÉRIFIÉE : $NB_TABLES tables et $NB_LIGNES lignes retrouvées à l'identique."
else
  echo "✗ ÉCHEC : $NB_ERREURS différence(s) entre la base d'origine et la base restaurée." >&2
  exit 1
fi
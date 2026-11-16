#!/usr/bin/env bash
# Restauration d'une sauvegarde : base PostgreSQL (+ logos si fournis).
# Usage :
#   bash backend/scripts/sauvegarde/restaurer.sh [options] FICHIER_BASE.dump
# Options :
#   --logos FICHIER.tar.gz : restaure aussi les logos des organisations
#   --ecraser              : autorise la restauration dans une base qui contient deja des tables
#                            (les objets existants sont supprimes puis recrees)
#   --oui                  : ne demande pas de confirmation (a utiliser avec --ecraser)
# Variable facultative :
#   BASE_CIBLE : nom de la base de destination (defaut : la base de la plateforme).
#                Si cette base n'existe pas, elle est creee.

set -euo pipefail

# Git Bash sous Windows : empeche la conversion de /app/... en chemin Windows
export MSYS_NO_PATHCONV=1

echec() {
  echo "✗ $1" >&2
  exit 1
}

FICHIER_BASE=""
FICHIER_LOGOS=""
ECRASER=0
CONFIRME=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --logos)
      [[ $# -ge 2 ]] || echec "--logos attend un nom de fichier."
      FICHIER_LOGOS="$2"
      shift 2
      ;;
    --ecraser)
      ECRASER=1
      shift
      ;;
    --oui)
      CONFIRME=1
      shift
      ;;
    -*)
      echec "Option inconnue : $1"
      ;;
    *)
      [[ -z "$FICHIER_BASE" ]] || echec "Un seul fichier de sauvegarde de la base est attendu."
      FICHIER_BASE="$1"
      shift
      ;;
  esac
done

[[ -n "$FICHIER_BASE" ]] \
  || echec "Il manque le fichier de sauvegarde. Usage : bash backend/scripts/sauvegarde/restaurer.sh [--ecraser] [--oui] [--logos FICHIER.tar.gz] FICHIER_BASE.dump"
[[ -f "$FICHIER_BASE" ]] || echec "Fichier introuvable : $FICHIER_BASE"
if [[ -n "$FICHIER_LOGOS" ]]; then
  [[ -f "$FICHIER_LOGOS" ]] || echec "Fichier introuvable : $FICHIER_LOGOS"
fi

# Chemins absolus : le script se place ensuite a la racine du depot
chemin_absolu() {
  echo "$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
}
FICHIER_BASE="$(chemin_absolu "$FICHIER_BASE")"
if [[ -n "$FICHIER_LOGOS" ]]; then
  FICHIER_LOGOS="$(chemin_absolu "$FICHIER_LOGOS")"
fi

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$RACINE"

dans_base() {
  docker compose exec -T base-de-donnees "$@"
}

# Execute une requete SQL et renvoie le resultat brut. $1 = base, $2 = requete
sql() {
  dans_base sh -c 'psql -U "$POSTGRES_USER" -d "$1" -tAc "$2"' _ "$1" "$2"
}

SERVICES_ACTIFS="$(docker compose ps --status running --services 2>/dev/null || true)"

echo "$SERVICES_ACTIFS" | grep -qx "base-de-donnees" \
  || echec "La base de données ne tourne pas. Lance : docker compose up -d base-de-donnees"

# Controle de lecture avant de toucher a quoi que ce soit
dans_base pg_restore --list < "$FICHIER_BASE" > /dev/null \
  || echec "Ce fichier est illisible ou n'est pas une sauvegarde de la base."

BASE_PLATEFORME="$(dans_base sh -c 'printf %s "$POSTGRES_DB"')"
CIBLE="${BASE_CIBLE:-$BASE_PLATEFORME}"
[[ "$CIBLE" =~ ^[A-Za-z0-9_]+$ ]] \
  || echec "Nom de base invalide : $CIBLE (lettres, chiffres et _ seulement)."

if [[ "$CIBLE" == "$BASE_PLATEFORME" ]]; then
  if echo "$SERVICES_ACTIFS" | grep -qx "application"; then
    echec "L'application tourne : arrête-la avant de restaurer la base de la plateforme (docker compose stop application)."
  fi
elif [[ -n "$FICHIER_LOGOS" ]]; then
  echec "--logos ne s'utilise que pour la restauration de la base de la plateforme (pas avec BASE_CIBLE)."
fi

# Options de pg_restore : tout ou rien (une seule transaction)
OPTIONS=(--no-owner --no-privileges --single-transaction --exit-on-error)

EXISTE="$(sql postgres "SELECT 1 FROM pg_database WHERE datname = '$CIBLE'")"
if [[ "$EXISTE" == "1" ]]; then
  NB_TABLES="$(sql "$CIBLE" "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
  if [[ "$NB_TABLES" -gt 0 ]]; then
    [[ "$ECRASER" -eq 1 ]] \
      || echec "La base « $CIBLE » contient déjà $NB_TABLES table(s). Pour la remplacer, relance avec --ecraser (ou choisis une base vide avec BASE_CIBLE)."
    if [[ "$CONFIRME" -ne 1 ]]; then
      echo "⚠ Les $NB_TABLES tables de « $CIBLE » vont être supprimées puis remplacées par la sauvegarde."
      read -r -p "Tape le nom de la base pour confirmer : " REPONSE || REPONSE=""
      [[ "$REPONSE" == "$CIBLE" ]] || echec "Confirmation incorrecte, rien n'a été modifié."
    fi
    OPTIONS+=(--clean --if-exists)
  fi
else
  echo "Création de la base « $CIBLE »..."
  dans_base sh -c 'createdb -U "$POSTGRES_USER" "$1"' _ "$CIBLE" \
    || echec "Création de la base impossible."
fi

echo "Restauration dans « $CIBLE »..."
dans_base sh -c 'base="$1"; shift; pg_restore -U "$POSTGRES_USER" -d "$base" "$@"' _ "$CIBLE" "${OPTIONS[@]}" \
  < "$FICHIER_BASE" \
  || echec "La restauration a échoué : aucune donnée partielle n'a été écrite (transaction unique)."

NB_APRES="$(sql "$CIBLE" "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
echo "✓ Base « $CIBLE » restaurée ($NB_APRES tables)."

# Logos : docker compose run fonctionne meme si l'application est arretee
if [[ -n "$FICHIER_LOGOS" ]]; then
  tar -tzf "$FICHIER_LOGOS" > /dev/null || echec "L'archive des logos est illisible."
  echo "Restauration des logos..."
  docker compose run --rm --no-deps -T application tar -xzf - -C /app/televersements/logos \
    < "$FICHIER_LOGOS" || echec "La restauration des logos a échoué."
  echo "✓ Logos restaurés."
fi

if [[ "$CIBLE" == "$BASE_PLATEFORME" ]]; then
  echo "Il reste à relancer l'application : docker compose up -d application"
fi
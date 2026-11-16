#!/usr/bin/env bash
# Sauvegarde de la plateforme : base PostgreSQL + logos des organisations.
# Usage (depuis n'importe quel dossier) : bash backend/scripts/sauvegarde/sauvegarder.sh
# Variables facultatives :
#   DOSSIER_SAUVEGARDES : dossier de destination (defaut : sauvegardes/ a la racine du depot)
#   RETENTION_JOURS     : nombre de jours de conservation (defaut : 30)

set -euo pipefail

# Git Bash sous Windows : empeche la conversion de /app/... en chemin Windows
export MSYS_NO_PATHCONV=1

# Les sauvegardes contiennent de vraies donnees : lisibles par le proprietaire seulement
umask 077

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$RACINE"

DOSSIER="${DOSSIER_SAUVEGARDES:-$RACINE/sauvegardes}"
RETENTION="${RETENTION_JOURS:-30}"
HORODATAGE="$(date +%Y-%m-%d_%H%M%S)"
FICHIER_BASE="$DOSSIER/base-$HORODATAGE.dump"
FICHIER_LOGOS="$DOSSIER/logos-$HORODATAGE.tar.gz"

echec() {
  echo "✗ $1" >&2
  exit 1
}

# Un fichier a moitie ecrit ne doit jamais ressembler a une sauvegarde valide
trap 'rm -f "$FICHIER_BASE.tmp" "$FICHIER_LOGOS.tmp"' EXIT

[[ "$RETENTION" =~ ^[0-9]+$ ]] || echec "RETENTION_JOURS doit être un nombre de jours (reçu : $RETENTION)."

mkdir -p "$DOSSIER"

SERVICES_ACTIFS="$(docker compose ps --status running --services 2>/dev/null || true)"

# 1. Base de donnees (format custom : compresse, restaurable avec pg_restore)
echo "$SERVICES_ACTIFS" | grep -qx "base-de-donnees" \
  || echec "La base de données ne tourne pas. Lance : docker compose up -d base-de-donnees"

echo "Sauvegarde de la base de données..."
docker compose exec -T base-de-donnees sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$FICHIER_BASE.tmp" || echec "pg_dump a échoué."

[[ -s "$FICHIER_BASE.tmp" ]] || echec "La sauvegarde de la base est vide."

# Controle de lecture : pg_restore doit pouvoir lister le contenu du fichier
docker compose exec -T base-de-donnees pg_restore --list < "$FICHIER_BASE.tmp" > /dev/null \
  || echec "La sauvegarde de la base est illisible."

mv "$FICHIER_BASE.tmp" "$FICHIER_BASE"
echo "✓ Base de données : $FICHIER_BASE ($(du -h "$FICHIER_BASE" | cut -f1))"

# 2. Logos des organisations (volume donnees-logos, visible dans le conteneur application)
LOGOS_SAUVEGARDES=0
if echo "$SERVICES_ACTIFS" | grep -qx "application"; then
  echo "Sauvegarde des logos..."
  docker compose exec -T application tar -czf - -C /app/televersements/logos . \
    > "$FICHIER_LOGOS.tmp" || echec "L'archive des logos a échoué."
  tar -tzf "$FICHIER_LOGOS.tmp" > /dev/null || echec "L'archive des logos est illisible."
  mv "$FICHIER_LOGOS.tmp" "$FICHIER_LOGOS"
  LOGOS_SAUVEGARDES=1
  echo "✓ Logos : $FICHIER_LOGOS ($(du -h "$FICHIER_LOGOS" | cut -f1))"
else
  echo "⚠ Le conteneur application ne tourne pas : les logos n'ont PAS été sauvegardés."
fi

# 3. Menage : suppression des sauvegardes de plus de RETENTION jours
SUPPRIMEES="$(find "$DOSSIER" -maxdepth 1 -type f \( -name 'base-*.dump' -o -name 'logos-*.tar.gz' \) \
  -mtime +"$RETENTION" -print -delete | wc -l | tr -d ' ')"
echo "Ménage : $SUPPRIMEES ancienne(s) sauvegarde(s) de plus de $RETENTION jours supprimée(s)."

if [[ "$LOGOS_SAUVEGARDES" -eq 1 ]]; then
  echo "✓ Sauvegarde terminée."
else
  echo "✓ Sauvegarde de la base terminée (logos non sauvegardés, voir l'avertissement ci-dessus)."
fi
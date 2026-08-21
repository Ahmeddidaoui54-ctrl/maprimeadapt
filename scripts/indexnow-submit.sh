#!/bin/bash
# IndexNow — indexation instantanée Bing, Yandex, Naver, Seznam.
# Lancer APRES chaque deploy pour indexer rapidement les nouvelles/modifiees
# pages sur Bing et Yandex (Google n'utilise pas IndexNow, mais l'effet SEO
# indirect via Bing est reel).
#
# Usage : ./scripts/indexnow-submit.sh                  -> soumet tout le sitemap
#         ./scripts/indexnow-submit.sh /paris /versailles ... -> soumet des URL precises
#
# Compatible macOS (sed BSD-safe : aucune expression sed utilisee).
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="www.maprimeadapt-idf.fr"

# Recupere la cle IndexNow depuis le nom du fichier {cle}.txt a la racine du repo.
KEY_FILE=$(find "$REPO_ROOT" -maxdepth 1 -type f -name '????????????????????????????????.txt' | head -n 1)
if [ -z "$KEY_FILE" ]; then
  echo "Erreur : fichier de cle IndexNow introuvable a la racine du repo." >&2
  exit 1
fi
KEY=$(basename "$KEY_FILE" .txt)

TMP=$(mktemp)
trap 'rm -f "$TMP" "$TMP".part.*' EXIT

if [ $# -gt 0 ]; then
  for p in "$@"; do echo "https://$HOST$p"; done > "$TMP"
else
  curl -s "https://$HOST/sitemap.xml" \
    | tr '<' '\n' \
    | grep '^loc>' \
    | cut -d'>' -f2 > "$TMP"
fi

TOTAL=$(wc -l < "$TMP" | tr -d ' ')
echo "Soumission de $TOTAL URL a IndexNow (par lots de 5000)..."
echo "Cle : $KEY"

# IndexNow accepte au maximum 10 000 URL par requete ; on reste sous 5 000.
split -l 5000 "$TMP" "${TMP}.part."
for f in "${TMP}".part.*; do
  URLS=$(awk 'BEGIN{ORS=""} {if(NR>1)printf ","; printf "\"%s\"", $0}' "$f")
  curl -sS -X POST "https://api.indexnow.org/indexnow" \
    -H "Content-Type: application/json; charset=utf-8" \
    -d "{\"host\":\"$HOST\",\"key\":\"$KEY\",\"keyLocation\":\"https://$HOST/$KEY.txt\",\"urlList\":[$URLS]}" \
    -w " -> HTTP %{http_code}\n"
done

echo "Done."

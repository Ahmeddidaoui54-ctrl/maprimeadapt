#!/bin/bash
# ═══════════════════════════════════════
#  SUIVI HORAIRE — Adjoint DG
#  Lancé chaque heure par cron
# ═══════════════════════════════════════

TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
DATE_TODAY=$(date '+%Y-%m-%d')
LOG_DIR="/Users/yourmacbookair/Desktop/maprimeadapt/logs"
JSON_OUT="$LOG_DIR/rapport-horaire.json"
LOG_FILE="$LOG_DIR/hourly.log"

mkdir -p "$LOG_DIR"

# ── 1. ARBIBOT ──────────────────────────
ARBI_STATUS="offline"
ARBI_OPPS=0
ARBI_LAST_SCAN="—"
ARBI_SCAN_TOKEN="cc51f5e7f5a78a488d0b7e3e657c2b4c5d274275b4863bef"

if curl -sf "http://localhost:3001/health" --max-time 3 > /dev/null 2>&1; then
  ARBI_STATUS="online"
  RAW=$(curl -sf "http://localhost:3001/api/opportunities?token=$ARBI_SCAN_TOKEN" --max-time 5 2>/dev/null)
  if [ -n "$RAW" ]; then
    ARBI_OPPS=$(echo "$RAW" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('opportunities', d if isinstance(d,list) else [])))" 2>/dev/null || echo 0)
  fi
  ARBI_LAST_SCAN=$(date '+%H:%M')
fi

# ── 2. SITE MAPRIMEADAPT ────────────────
SITE_STATUS="unknown"
if curl -sf "https://maprimeadapt-idf.pages.dev" --max-time 5 > /dev/null 2>&1; then
  SITE_STATUS="online"
elif curl -sf "https://maprimeadapt-idf.fr" --max-time 5 > /dev/null 2>&1; then
  SITE_STATUS="online"
else
  SITE_STATUS="local_only"
fi

# ── 3. LEADS DU JOUR (fichier compteur) ─
LEADS_FILE="$LOG_DIR/leads-$DATE_TODAY.count"
LEADS_TODAY=0
if [ -f "$LEADS_FILE" ]; then
  LEADS_TODAY=$(cat "$LEADS_FILE" 2>/dev/null || echo 0)
fi

# ── 4. JOURNAL ──────────────────────────
echo "$TIMESTAMP | ArbiBot=$ARBI_STATUS opps=$ARBI_OPPS | Site=$SITE_STATUS | Leads=$LEADS_TODAY" >> "$LOG_FILE"

# Garder seulement les 200 dernières lignes
tail -200 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"

# ── 5. JSON pour plan-action.html ───────
cat > "$JSON_OUT" << JSONEOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$DATE_TODAY",
  "arbibot": {
    "status": "$ARBI_STATUS",
    "opportunities": $ARBI_OPPS,
    "last_scan": "$ARBI_LAST_SCAN"
  },
  "maprimeadapt": {
    "site_status": "$SITE_STATUS",
    "leads_today": $LEADS_TODAY
  },
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSONEOF

# ── 6. ALERTES macOS ────────────────────
if [ "$ARBI_STATUS" = "offline" ]; then
  osascript -e 'display notification "ArbiBot hors ligne — démarrer avec: cd ~/Desktop/maprimeadapt/arbi-placer && node server.js" with title "⚠️ ArbiBot Offline" sound name "Ping"' 2>/dev/null
fi

if [ "$ARBI_OPPS" -gt "3" ] 2>/dev/null; then
  osascript -e "display notification \"$ARBI_OPPS opportunités détectées — vérifier le dashboard\" with title \"🎯 ArbiBot: Arbs détectées\" sound name \"Glass\"" 2>/dev/null
fi

echo "✓ Suivi horaire $TIMESTAMP — ArbiBot=$ARBI_STATUS | Opps=$ARBI_OPPS | Leads=$LEADS_TODAY"

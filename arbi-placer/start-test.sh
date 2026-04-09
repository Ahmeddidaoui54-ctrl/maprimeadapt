#!/bin/bash
# ══════════════════════════════════════════
#  ArbiBot — Démarrage PHASE TEST
#  Aucun vrai pari · Aucune clé API requise
# ══════════════════════════════════════════

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ArbiBot  ·  PHASE TEST  ·  DRY RUN      ║"
echo "║  Aucun vrai pari ne sera placé           ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Vérifie Node
if ! command -v node &> /dev/null; then
  echo "✗ Node.js non trouvé. Installe depuis https://nodejs.org"
  exit 1
fi

# Crée .env test si absent
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ .env créé depuis .env.example"
fi

# Force DRY_RUN en test
sed -i '' 's/^DRY_RUN=.*/DRY_RUN=true/' .env
echo "✓ DRY_RUN=true confirmé"

# Vérifie node_modules
if [ ! -d node_modules ]; then
  echo "→ Installation des dépendances..."
  npm install --cache /tmp/npm-cache --silent
fi

echo ""
echo "Démarrage des 3 processus..."
echo "─────────────────────────────"
echo ""

# Lance server.js en arrière-plan
node server.js &
SERVER_PID=$!
echo "✓ Serveur scan    PID $SERVER_PID  (port 3001 / ws:3002)"
sleep 2

# Lance auto-robot en arrière-plan
node auto-robot.js &
ROBOT_PID=$!
echo "✓ Auto-robot      PID $ROBOT_PID   (DRY RUN — simulation)"
echo ""
echo "─────────────────────────────"
echo "📋 Logs en direct (Ctrl+C pour tout arrêter)"
echo ""

# Ouvre ArbiBot dans le navigateur
sleep 1
open ../arbitrage-sport.html 2>/dev/null || true

# Trap pour tuer proprement
cleanup() {
  echo ""
  echo "→ Arrêt de tous les processus..."
  kill $SERVER_PID $ROBOT_PID 2>/dev/null
  echo "✓ ArbiBot arrêté proprement"
  exit 0
}
trap cleanup SIGINT SIGTERM

# Affiche les logs du serveur
wait

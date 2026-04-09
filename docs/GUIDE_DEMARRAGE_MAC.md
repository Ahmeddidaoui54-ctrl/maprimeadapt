# GUIDE DE DÉMARRAGE · Mac
# À donner au second · Version 1.0

---

## ÉTAPE 1 · Vérifier Node.js

Ouvrir le Terminal (CMD+espace → "Terminal") et taper :
```bash
node --version
```

Si rien ne s'affiche → installer Node.js :
```bash
# Installer Homebrew d'abord si pas présent
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Puis Node.js
brew install node
```

---

## ÉTAPE 2 · Installer Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

Vérifier l'installation :
```bash
claude --version
```

---

## ÉTAPE 3 · Créer le dossier projet

```bash
mkdir ~/bots-projet
cd ~/bots-projet
```

---

## ÉTAPE 4 · Copier le CLAUDE.md

Glisser le fichier PROMPT_MAITRE_CLAUDE_CODE.md dans le dossier,
puis le renommer :
```bash
mv PROMPT_MAITRE_CLAUDE_CODE.md CLAUDE.md
```

---

## ÉTAPE 5 · Créer le fichier .env

```bash
nano .env
```

Coller ceci et remplir les valeurs :
```env
OWNER_AUTH_TOKEN=motdepasse_proprietaire
SECOND_AUTH_TOKEN=motdepasse_second
MONTHLY_BUDGET_EUR=100
ALERT_THRESHOLD_EUR=80
VEILLE_SCAN_INTERVAL_HOURS=4
VEILLE_WORLD_CHECK_TIME=07:00
TRADER_MAX_OPEN_OPS=3
TRADER_MAX_SINGLE_OP_EUR=20
TRADER_MAX_TOTAL_EUR=60
TRADER_STOP_LOSS_EUR=15
DEFAULT_MODEL=claude-haiku-4-5-20251001
COMPLEX_MODEL=claude-sonnet-4-6
BATCH_ENABLED=true
CACHE_ENABLED=true
```

Sauvegarder : CTRL+X → Y → Entrée

---

## ÉTAPE 6 · Lancer le système

```bash
cd ~/bots-projet
claude
```

Claude Code lira automatiquement le CLAUDE.md.
Le système est prêt.

---

## COMMANDES COURANTES POUR LE SECOND

```
"Active le bot Client"
"Montre le rapport du Bot Veille"
"Montre les opérations ouvertes du Trader"
"Montre la consommation tokens du mois"
"Mets le bot Contenu en veille"
```

## EN CAS DE PROBLÈME

1. Taper : "Montre le journal d'audit"
2. Logger l'incident
3. Taper : "Mets tous les bots en veille"
4. Contacter le propriétaire

---

*Ce guide est destiné au second · Ne pas partager publiquement*

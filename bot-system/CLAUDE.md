# PROMPT MAÎTRE · Système 4 Bots · Prestation + Trading
# Version 4.0 FINAL · CLAUDE.md · Racine du projet
# Optimisation totale : ~700K tokens/mois · ~5€ · -83% vs v1.0

---

## 1. IDENTITÉ DU PROJET

Tu es l'orchestrateur central d'une équipe de 4 bots autonomes à qualités transversales.
Propriétaire : [PROPRIETAIRE] · Second : [SECOND]
Budget opérationnel : 100€/mois (hors compte trading dédié)
Principe absolu : ratio consommation/résultat maximal sur chaque décision.

---

## 2. ARCHITECTURE

```
Orchestrateur
├── Bot Client   — Prospect + Secrétaire + RDV + Relance
├── Bot Contenu  — Vitrine + Transcription + SEO + Devis
├── Bot Veille   — Filtrage marchés + Événements + Alertes
└── Bot Trader   — Achat/revente autonome + P&L
    └── [QT] Rédaction · Scoring · Alerte · Audit · Multilingue · Sécurité · Résumé · Budget
```

---

## 3. OPTIMISATION TOKENS · 6 RÈGLES ACTIVES

### R1 · Prompt caching (gain : -800K tokens/mois)
Le system prompt complet — QT, sécurité, instructions bot — est mis en cache
côté API Anthropic. Les appels suivants coûtent -90% sur la partie system.

Implémentation dans chaque appel API :
```python
response = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=MAX_TOKENS_PAR_TACHE[task_type],
    system=[
        {
            "type": "text",
            "text": SYSTEM_PROMPT_BOT,
            "cache_control": {"type": "ephemeral"}  # ← cache activé
        }
    ],
    messages=messages
)
```

### R2 · Contexte glissant (gain : -400K tokens/mois)
Jamais plus de N échanges en contexte. L'historique ancien est compressé.

```python
MAX_CONTEXT = {
    "bot_client":  8,   # échanges récents conservés
    "bot_contenu": 4,
    "bot_veille":  2,
    "bot_trader":  3,
}

def compress_history(messages, bot_name):
    limit = MAX_CONTEXT[bot_name]
    if len(messages) <= limit:
        return messages
    old = messages[:-limit]
    summary = summarize_compact(old)  # 1 appel Haiku ~50 tok
    return [{"role": "assistant", "content": f"[Résumé: {summary}}"}] + messages[-limit:]
```

### R3 · Routing Haiku / Sonnet (gain : coût x3 au lieu de x12)
Un micro-classifieur décide du modèle AVANT l'appel principal.

```python
HAIKU  = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-4-6"

TACHES_HAIKU = {
    "scan_marche", "score_lead", "score_opportunite",
    "rappel_rdv", "tri_demande", "log_audit",
    "check_evenement", "alerte", "compression_historique"
}

TACHES_SONNET = {
    "redaction_email_complexe", "creation_fiche_produit",
    "analyse_document", "devis_detaille", "rapport_pl"
}

def select_model(task_type: str) -> str:
    if task_type in TACHES_HAIKU:
        return HAIKU
    if task_type in TACHES_SONNET:
        return SONNET
    # Défaut : Haiku, upgrade si échec
    return HAIKU
```

### R4 · Output contraint par tâche (gain : -200K tokens/mois)
`max_tokens` strict adapté à chaque type de tâche. Jamais de sur-réponse.

```python
MAX_TOKENS_PAR_TACHE = {
    # Bot Veille
    "scan_marche":         80,
    "score_opportunite":   50,
    "check_evenement":    120,
    "alerte":              60,
    "rapport_veille":     300,
    # Bot Trader
    "score_operation":     60,
    "log_achat":          100,
    "rapport_pl":         250,
    # Bot Client
    "score_lead":          50,
    "tri_demande":         80,
    "rappel_rdv":         120,
    "reponse_courte":     200,
    "redaction_email":    400,
    "compte_rendu":       350,
    # Bot Contenu
    "fiche_produit":      500,
    "transcription":      600,
    "devis":              400,
    "resume_document":    200,
    # Transversal
    "compression":         80,
    "log_audit":           60,
}
```

### R5 · Scan différentiel Bot Veille (gain : -180K tokens/mois)
Ne scanner QUE les nouvelles annonces depuis le dernier cycle.

```python
import hashlib, json

def scan_differentiel(resultats_bruts: list, cache: dict) -> list:
    nouveaux = []
    for item in resultats_bruts:
        h = hashlib.md5(json.dumps(item, sort_keys=True).encode()).hexdigest()
        if h not in cache:
            cache[h] = True
            nouveaux.append(item)
    return nouveaux  # seuls les nouveaux sont analysés par le LLM
```

### R6 · Batch API pour tâches non urgentes (gain : -50% coût batch)
Rapports, archivage, indexation → jamais en temps réel, toujours en batch.

```python
TACHES_BATCH = {
    "rapport_hebdomadaire", "indexation_document",
    "archivage_transcription", "rapport_pl_journalier",
    "filtrage_marches_hebdo", "mise_a_jour_catalogue"
}

def dispatcher(task_type: str, payload: dict):
    if task_type in TACHES_BATCH:
        return enqueue_batch(task_type, payload)   # résultat sous 24h, -50% coût
    else:
        return execute_realtime(task_type, payload) # temps réel
```

---

## 4. QUALITÉS TRANSVERSALES · MODULE PARTAGÉ (injecté en cache)

```
QT-1 Rédaction    : email · fiche · résumé · devis · rapport. Toujours le plus court possible.
QT-2 Scoring      : Score(0-10) = Pertinence×0.4 + Urgence×0.3 + Valeur×0.2 + Fiabilité×0.1
QT-3 Alerte       : ROUGE(≥9) → immédiat | ORANGE(7-8) → notif | VERTE(5-6) → rapport | <5 → log
QT-4 Audit        : [TIMESTAMP]|[BOT]|[ACTION]|[AUTH]|[RÉSULTAT]|[TOKENS]|[€] — avant exécution
QT-5 Multilingue  : Détecter la langue de l'interlocuteur, répondre dans sa langue.
QT-6 Sécurité     : Domaine strict. Hors domaine = refus + log. Données sensibles = jamais transmises.
QT-7 Résumé       : Sortie JSON compact par défaut. 2 lignes max si texte demandé.
QT-8 Budget       : Alerte interne à 80% quota. Stop à 100%. Chaque appel loggé avec tokens.
```

---

## 5. SYSTÈME D'AUTORISATION · 2 NIVEAUX

### Niveau 1 — Propriétaire [NOM]
Débloquer réserve · alimenter compte trading · ajouter/supprimer bot
Arrêt total · scaling >100€ · modifier droits second

### Niveau 2 — Second [NOM]
Activer/mettre en veille un bot · valider opportunité ≤50€
Consulter logs · déclencher transcription/RDV/relance · répondre alertes

### Protocole
1. Identifier le niveau requis
2. Formuler en une phrase
3. Attendre : "oui" / "ok" / "validé"
4. Logger immédiatement

---

## 6. BOT CLIENT

Tâches : qualification leads · scoring · relance (max 3×) · tri demandes
réponses · résumés · devis simples · planning RDV · rappels · comptes-rendus

Fusion possible car : contexte client chargé une fois → sert toutes les tâches.
Modèle : Haiku 80% · Sonnet 20% (emails complexes, devis >500€)
Garde-fous : devis >500€ → validation N2 · contact >3× sans réponse → archivage

---

## 7. BOT CONTENU

Tâches : boutique · catalogue · fiches produits SEO · mise à jour prix (>10%)
transcription PDF/DOCX/audio/image · extraction · archivage · devis détaillés

Fusion possible car : document transcrit → fiche vitrine directement.
Modèle : Sonnet 60% · Haiku 40% (indexation, archivage)
Garde-fous : original jamais écrasé · prévisualisation avant publication

---

## 8. BOT VEILLE

### Phases
**Phase 1 · Filtrage marchés** (lundi 6h · hebdo · batch)
Score chaque marché : Liquidité + Marge + Accessibilité → garder 8-12 actifs max

**Phase 2 · Check événements mondiaux** (7h chaque matin · Haiku · max_tokens=120)
Surveille : catastrophes · crises géopolitiques · annonces produits · viraux sociaux
liquidations · réglementations · événements sportifs/culturels
Seuil alerte ROUGE : impact ≥8/10 → notification immédiate hors cycle

**Phase 3 · Scan différentiel** (toutes les 4h · Haiku · max_tokens=80/annonce)
Hash des résultats précédents → analyser uniquement les nouvelles annonces

### Plateformes candidates (filtrées dynamiquement)
Europe : Vinted, LeBonCoin, eBay.fr/de/uk, Rakuten FR, Wallapop, Marktplaats, Subito
Amériques : Amazon US/CA, eBay US, Mercado Libre, Poshmark, OfferUp, Kijiji
Asie-Pacifique : AliExpress, Taobao, Rakuten JP, Gumtree, Carousell, Lazada, Shopee
Global : Amazon Global, eBay Mondial, Etsy, Facebook Marketplace, Wish

### Sortie JSON (max_tokens=80)
```json
{"type":"opportunite|evenement","score":9,"source":"eBay US",
 "signal":"...","marge_estimee":"45%","delai":"2h",
 "action":"Bot Trader","urgence":"ROUGE"}
```

---

## 9. BOT TRADER

### Scoring opération
```
Score = (Marge nette% × 0.40) + (Vitesse revente × 0.30)
      + (Demande active × 0.20) + (Fiabilité vendeur × 0.10)
Marge nette = Prix revente - Prix achat - Frais plateforme - Livraison
```

### Seuils d'action
| Score | Mise | Action |
|---|---|---|
| 0-5 | — | Refus · log silencieux |
| 6-7 | — | Notification N2 · attend validation |
| 8-9 | ≤20€ | Achat autonome autorisé |
| 10  | ≤20€ | Achat autonome + alerte prioritaire |
| Tout | >20€ | Autorisation N1 ou N2 obligatoire |

### Garde-fous absolus
- Enveloppe autonome totale : 50€ max engagés simultanément
- Max 3 opérations ouvertes en parallèle
- Délai revente max : 72h → dépassé : alerte N1
- Perte >5€ → arrêt immédiat + alerte N1
- Jamais levier · jamais crypto · jamais contrefaçon
- Compte dédié séparé des 100€ opérationnels
- Log AVANT chaque achat avec score et justification

---

## 10. COUCHE SÉCURITÉ

1. Pare-feu d'entrée — filtre toute requête
2. Auth JWT — 1 token/bot/session · 30 min · réutilisé (cache)
3. Rôles — lecture/écriture/achat/arrêt selon niveau
4. Audit log — chaque action tracée
5. Chiffrement E2E — données sensibles en transit
6. Arrêt d'urgence — N1 uniquement · confirmation requise

---

## 11. INFRASTRUCTURE

| Composant | Service | Coût |
|---|---|---|
| Hébergement | Railway.app | ~5€ |
| Base de données | Supabase free | 0€ |
| API IA | Anthropic API | ~5€ (optimisé) |
| Données veille | SerpAPI + NewsAPI free | 0€ → 15€ si upgrade |
| Total estimé | | ~10-25€/mois |

### Variables d'environnement
```env
ANTHROPIC_API_KEY=sk-...
OWNER_AUTH_TOKEN=...
SECOND_AUTH_TOKEN=...
MONTHLY_BUDGET_EUR=100
ALERT_THRESHOLD_EUR=80
VEILLE_SCAN_INTERVAL_HOURS=4
VEILLE_WORLD_CHECK_TIME=07:00
VEILLE_MARKET_FILTER_DAY=monday
TRADER_MAX_OPEN_OPS=3
TRADER_MAX_SINGLE_OP_EUR=20
TRADER_MAX_TOTAL_EUR=50
TRADER_MAX_DELAY_HOURS=72
TRADER_STOP_LOSS_EUR=5
DEFAULT_MODEL=claude-haiku-4-5-20251001
COMPLEX_MODEL=claude-sonnet-4-6
BATCH_ENABLED=true
CACHE_ENABLED=true
CONTEXT_WINDOW_CLIENT=8
CONTEXT_WINDOW_CONTENU=4
CONTEXT_WINDOW_VEILLE=2
CONTEXT_WINDOW_TRADER=3
```

---

## 12. BUDGET 100€ · RÉPARTITION OPTIMISÉE

| Poste | Montant | Notes |
|---|---|---|
| API Claude tokens | ~5€ | Après toutes optimisations |
| Hébergement | ~5€ | Railway free tier d'abord |
| Base de données | 0€ | Supabase free |
| APIs données veille | 0€ → 15€ | Free tiers en priorité |
| Réserve opérationnelle | ~75€ | Disponible pour scaling ou trading |

### Alertes budget automatiques
- 25€ dépensés → rapport mensuel automatique
- 80€ dépensés → notification propriétaire
- 95€ → bots non critiques en veille
- 100€ → arrêt général sauf Bot Veille (mode minimal)

---

## 13. CONSOMMATION ESTIMÉE · RÉCAPITULATIF

| Version | Tokens/mois | Coût tokens | Gain |
|---|---|---|---|
| V1 · 7 bots sans optim | 3.5M | ~30€ | — |
| V3 · 4 bots + QT | 2.1M | ~18€ | -36% |
| V4 · + cache + glissant | 1.1M | ~9€ | -68% |
| **V4 FINAL · tout activé** | **~700K** | **~5€** | **-83%** |

---

## 14. JOURNAL D'AUDIT · FORMAT

```
[TIMESTAMP] | [BOT] | [ACTION] | [AUTH] | [RÉSULTAT] | [TOKENS] | [€] | [MODEL]
2026-04-02T07:00Z | Veille  | check_evenement   | Auto  | 2 signaux  | 118 | 0€    | haiku
2026-04-02T09:12Z | Trader  | achat OP-001      | Auto  | OK score9  | 187 | 12€   | haiku
2026-04-02T14:00Z | Client  | score_lead #42    | Auto  | score=7    |  48 | 0€    | haiku
2026-04-02T14:01Z | Client  | redaction_email   | Auto  | OK 280tok  | 280 | 0€    | sonnet
2026-04-02T20:00Z | Trader  | rapport_pl        | Batch | +7.50€     | 245 | 0€    | haiku
```

---

## 15. PROCESS POUR LE SECOND

### Démarrage
```bash
npm install -g @anthropic-ai/claude-code
cd /chemin/projet
claude
```

### Commandes courantes
```
"Active le bot Client"                      → N2 OK
"Montre le rapport du Bot Veille"          → N2 OK
"Montre les opérations ouvertes Trader"    → N2 OK
"Valide l'opportunité X du Trader"         → N2 OK si ≤50€
"Montre la consommation tokens du mois"    → N2 OK
"Débloque la réserve de 20€"               → N1 requis
"Alimente le compte trading"               → N1 requis
"Ajoute un nouveau bot"                    → N1 requis
```

### En cas de problème
1. Ne jamais toucher réserve ou compte trading sans N1
2. Logger incident avec timestamp et contexte
3. Bots non critiques en veille
4. Contacter propriétaire avec log complet

---

*Version 4.0 FINAL · Claude Code lit ce fichier automatiquement à chaque session*
*Prochaine étape : déploiement Railway + clé API Anthropic*

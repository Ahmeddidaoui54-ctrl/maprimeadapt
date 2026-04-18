# DÉPLOIEMENT · Chatbot Business

## Budget : 300€

### Répartition
| Poste | Coût | Détail |
|---|---|---|
| VPS Hetzner CX22 | 5€/mois | 2 vCPU, 4GB RAM, 40GB SSD |
| Domaine .fr | 8€/an | Ex: chatbot-pro.fr |
| API OpenAI | 10-20€/mois | Pour les chatbots IA |
| Réserve commerciale | ~250€ | Cartes de visite, démo tablette |

### Étape 1 : Acheter le VPS (5 min)
1. https://www.hetzner.com/cloud → CX22 → Ubuntu 22.04
2. Noter l'IP du serveur

### Étape 2 : Installer Docker sur le VPS (5 min)
```bash
ssh root@VOTRE_IP
curl -fsSL https://get.docker.com | sh
```

### Étape 3 : Déployer Typebot (5 min)
```bash
mkdir -p /opt/chatbot && cd /opt/chatbot
# Copier docker-compose.yml et .env sur le serveur
docker compose up -d
```

### Étape 4 : Configurer le domaine (10 min)
1. Acheter chatbot-pro.fr (ou autre) sur OVH/Gandi
2. DNS → A record → IP du VPS
3. Installer Caddy pour HTTPS automatique

### Étape 5 : Créer les templates dans Typebot
1. Aller sur https://votre-domaine.fr:3000
2. Créer un nouveau bot par template (immobilier, restaurant, dentiste)
3. Personnaliser avec les infos du client

### Étape 6 : Trouver les clients
Voir PROSPECTION.md

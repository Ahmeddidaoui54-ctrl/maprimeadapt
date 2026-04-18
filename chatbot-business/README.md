# ChatBot Pro - Business Chatbot IA pour PME

Projet complet pour lancer une activite de vente de chatbots IA aux PME francaises (immobilier, restaurant, dentiste).

## Structure du projet

```
chatbot-business/
  docker-compose.yml      # Infrastructure Typebot (builder + viewer + DB)
  .env                    # Configuration (SMTP, OpenAI, URLs)
  templates/              # Templates de chatbot par secteur
    immobilier.json
    restaurant.json
    dentiste.json
  site-vitrine/           # Site commercial + pages demo
    index.html            # Landing page (offres, FAQ, contact)
    demo-immobilier.html
    demo-restaurant.html
    demo-dentiste.html
  prospection/            # Outils de prospection
    email-immobilier.txt  # 3 emails a froid par secteur
    email-restaurant.txt
    email-dentiste.txt
    linkedin-messages.txt # 5 templates LinkedIn
    script-telephonique.txt
  contrats/               # Documents juridiques
    devis-template.html   # Devis imprimable en PDF
    cgv.txt               # Conditions generales de vente
  BUSINESS-PLAN.md        # Business plan complet
  DEPLOY.md               # Instructions de deploiement Typebot
  PROSPECTION.md          # Guide de prospection
```

## Demarrage rapide

### 1. Deployer Typebot (5 min)

```bash
cd chatbot-business
docker compose up -d
```

Acces :
- Builder : http://localhost:3000
- Viewer : http://localhost:3001

### 2. Ce qu'il reste a faire manuellement (le 1%)

1. **Importer les templates** : ouvrir le builder (localhost:3000), creer un nouveau typebot, importer les fichiers JSON depuis `templates/`
2. **Publier les chatbots** : dans chaque typebot, cliquer sur "Publier" et noter l'URL
3. **Mettre a jour les demos** : dans `site-vitrine/demo-*.html`, decommenter le bloc `<script>` et remplacer le typebot ID par celui de votre chatbot publie
4. **Configurer le formulaire de contact** : creer un compte Formspree.io (gratuit) et remplacer `VOTRE_ID` dans `index.html`
5. **Heberger le site vitrine** : deployer `site-vitrine/` sur Netlify, Vercel ou GitHub Pages (gratuit)
6. **Remplir le SIRET** dans `contrats/devis-template.html` et `contrats/cgv.txt`
7. **(Optionnel) Configurer SMTP** dans `.env` pour les notifications email

### 3. Commencer a prospecter

1. Ouvrir Google Maps, chercher "[dentiste/restaurant/agence immobiliere] + [ville]"
2. Trouver le site web du prospect, recuperer l'email
3. Copier un template depuis `prospection/email-*.txt`, personnaliser, envoyer
4. Objectif : 20 emails/jour

### 4. Quand un prospect est interesse

1. Lui envoyer le lien de demo correspondant a son secteur
2. Proposer un appel de 15 min
3. Generer le devis avec `contrats/devis-template.html` (ouvrir dans le navigateur, remplir, imprimer en PDF)
4. Envoyer devis + CGV
5. Une fois paye : configurer son chatbot personnalise, deployer en 48h

## Pricing

| Offre | Setup | Mensuel |
|-------|-------|---------|
| Starter | 149 EUR | 49 EUR/mois |
| Business | 299 EUR | 99 EUR/mois |
| Premium | 499 EUR | 199 EUR/mois |

## Stack technique

- **Typebot** : builder de chatbot open source (self-hosted)
- **PostgreSQL** : base de donnees
- **Docker** : conteneurisation
- **OpenAI API** : IA conversationnelle (optionnel)
- **Formspree** : formulaire de contact
- **VPS** : Hetzner/OVH (~5 EUR/mois en prod)

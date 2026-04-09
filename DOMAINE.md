# Connexion domaine maprimeadapt-idf.fr — Checklist

## Étape 1 — Cloudflare Pages : ajouter le domaine custom
1. Va sur https://dash.cloudflare.com
2. Pages → maprimeadapt-idf → Custom domains → Add custom domain
3. Entre : `maprimeadapt-idf.fr`
4. Cloudflare génère les enregistrements DNS à créer chez ton registrar

## Étape 2 — Chez ton registrar (OVH / Gandi / etc.)
Ajoute ces enregistrements DNS :

| Type  | Nom | Valeur                              |
|-------|-----|-------------------------------------|
| CNAME | @   | maprimeadapt-idf.pages.dev          |
| CNAME | www | maprimeadapt-idf.pages.dev          |

> Si ton registrar ne supporte pas CNAME sur l'apex (@), utilise un enregistrement ALIAS ou ANAME.
> OVH supporte CNAME apex nativement.

## Étape 3 — Vérification (délai : 5 min à 48h selon registrar)
- https://maprimeadapt-idf.fr → doit afficher le site
- https://www.maprimeadapt-idf.fr → redirige vers apex (géré par _redirects)
- HTTPS automatique via Cloudflare (certificat SSL gratuit)

## Étape 4 — Après connexion du domaine
Donne-moi les 3 IDs suivants, je les colle en 30 secondes :

### GA4
1. analytics.google.com → Admin → Flux de données → ton site
2. Copie l'ID format : G-XXXXXXXXXX

### Microsoft Clarity
1. clarity.microsoft.com → créer projet → type "Website" → URL : maprimeadapt-idf.fr
2. Copie l'ID format : abc12def (8 caractères)

### Google Search Console
1. search.google.com/search-console → Ajouter propriété → URL : https://maprimeadapt-idf.fr
2. Méthode : Balise HTML → copie le contenu du token (longue chaîne)

## Rappel — un seul endroit à modifier dans le HTML
Ouvre maprimeadapt-idf.html et cherche `window.SITE_CONFIG` (ligne ~857) :

```js
window.SITE_CONFIG = {
  GA4_ID:     'G-XXXXXXXXXX',   // ← colle ici
  CLARITY_ID: 'abc12def',       // ← colle ici
  GSC_TOKEN:  'aBcDeFg...',     // ← colle ici
};
```

Puis redéploie : `cd /Users/yourmacbookair/Desktop/maprimeadapt && npx wrangler pages deploy . --project-name maprimeadapt-idf --branch main`

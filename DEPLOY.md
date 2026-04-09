# Déploiement MaPrimeAdapt IDF — Guide complet

## État actuel
- Site : `local_only` → 0 leads
- Objectif : site public + formulaire qui capture les leads

---

## ÉTAPE 1 — Formspree (5 minutes, gratuit)

**Objectif :** Recevoir les leads par email sans serveur.

1. Aller sur **https://formspree.io** → créer un compte gratuit
2. Cliquer **"+ New Form"** → nommer "MaPrimeAdapt IDF"
3. Copier l'**ID** (ex: `xzzpdqwk`)
4. Dans `maprimeadapt-idf.html`, ligne ~2053 :
   ```javascript
   const FORMSPREE_ID = 'xzzpdqwk'; // ← remplacer par votre ID
   ```
5. Les leads arrivent par email + dashboard Formspree
6. Plan gratuit : **50 submissions/mois** (suffisant pour démarrer)

---

## ÉTAPE 2 — Cloudflare Pages (10 minutes, gratuit)

**Objectif :** Mettre le site en ligne sur votre domaine.

### Option A — Upload direct (le plus rapide)

1. Aller sur **https://pages.cloudflare.com**
2. Se connecter avec un compte Cloudflare (gratuit)
3. Cliquer **"Create application"** → **"Pages"** → **"Upload assets"**
4. Nommer le projet : `maprimeadapt-idf`
5. **Glisser-déposer** le fichier `maprimeadapt-idf.html`
6. Renommer en `index.html` si demandé
7. Cliquer **"Deploy site"**
8. URL temporaire : `maprimeadapt-idf.pages.dev` (immédiate)

### Option B — GitHub (recommandé pour mises à jour faciles)

1. Créer un repo GitHub : `maprimeadapt-idf`
2. Pousser `maprimeadapt-idf.html` → renommer en `index.html`
3. Cloudflare Pages → **"Connect to Git"** → sélectionner le repo
4. Build command : (vide) · Output directory : `/`
5. Chaque `git push` = déploiement automatique en ~30 secondes

---

## ÉTAPE 3 — Domaine personnalisé (5 minutes)

Si vous avez le domaine `maprimeadapt-idf.fr` :

1. Cloudflare Pages → votre site → **"Custom domains"**
2. Ajouter `maprimeadapt-idf.fr` et `www.maprimeadapt-idf.fr`
3. Si domaine chez OVH/Gandi : ajouter les CNAME fournis
4. Si domaine chez Cloudflare : automatique en 1 clic
5. SSL gratuit activé automatiquement

---

## ÉTAPE 4 — Google Search Console (10 minutes)

**Objectif :** Indexer le site sur Google.

1. **https://search.google.com/search-console**
2. Ajouter propriété : `https://www.maprimeadapt-idf.fr`
3. Vérification → copier le token HTML dans `maprimeadapt-idf.html` :
   ```javascript
   window.SITE_CONFIG = {
     GA4_ID: 'G-LNC21XL03M',  // déjà configuré
     GSC_TOKEN: 'VOTRE_TOKEN', // ← ajouter ici
   };
   ```
4. Soumettre sitemap : `https://www.maprimeadapt-idf.fr/sitemap.xml`
   (créer un fichier `sitemap.xml` simple avec l'URL du site)
5. Demander l'indexation de la page principale

---

## ÉTAPE 5 — Google My Business (15 minutes)

**Objectif :** Apparaître dans Google Maps et les recherches locales IDF.

1. **https://business.google.com**
2. Créer une fiche : "MaPrimeAdapt IDF"
3. Catégorie : "Service de rénovation de maisons"
4. Zone : Île-de-France (sans adresse physique si applicable)
5. Téléphone : 06 04 43 34 20
6. Site web : https://www.maprimeadapt-idf.fr
7. Vérification par SMS ou courrier

---

## Checklist finale

- [ ] Formspree ID mis à jour dans le HTML
- [ ] Site déployé sur Cloudflare Pages
- [ ] Domaine connecté + SSL actif
- [ ] GSC token ajouté + site indexé
- [ ] Google My Business créé et vérifié
- [ ] GA4 vérifié dans Analytics (ID: G-LNC21XL03M)
- [ ] Test formulaire : soumettre un faux lead et vérifier l'email

---

## Budget récapitulatif

| Service | Coût |
|---------|------|
| Cloudflare Pages | **Gratuit** |
| Formspree (50 leads/mois) | **Gratuit** |
| Google Analytics 4 | **Gratuit** |
| Google Search Console | **Gratuit** |
| Google My Business | **Gratuit** |
| SSL Cloudflare | **Gratuit** |
| **Total démarrage** | **0 €** |

Domaine `maprimeadapt-idf.fr` (si pas encore acheté) : ~8-12€/an chez OVH.

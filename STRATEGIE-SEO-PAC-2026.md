# STRATÉGIE SEO PAC 2026 — Refocus complet

**Objectif** : Transformer le site en **authority PAC** + capturer leads B2C seniors pour installation PAC.

---

## PHASE 1 — RESTRUCTURATION (Semaine 1)

### Hiérarchie de pages (NEW)

```
index.html                          → PAC HERO landing (refactor complet)
├─ /pompe-a-chaleur.html           → Détails aides cumul (ENHANCER)
├─ /simulateur-pac.html             → Quiz + calc PAC (KEEP)
├─ /aides-pac-2026.html             → NOUVEAU — Tableau comparatif aides
├─ /pac-air-air.html                → NOUVEAU — Type PAC 1
├─ /pac-air-eau.html                → NOUVEAU — Type PAC 2
├─ /pac-geothermique.html           → NOUVEAU — Type PAC 3
├─ /mapa-vs-pac.html                → NOUVEAU — Pourquoi PAC > MaPrimeAdapt
├─ /pac/[commune].html              → KEEP (8 communes) + ajouter plafonds PAC
├─ /blog/pac-2026-aides.html        → ENHANCE (ajouter chiffres à jour)
├─ /blog/maprimerenov-vs-cee.html   → NOUVEAU
├─ /blog/eco-ptz-pac.html           → NOUVEAU
├─ /faq-pac.html                    → NOUVEAU (10-15 Q)
└─ /mentions-legales.html           → KEEP
```

---

## PHASE 2 — SEO STRUCTURE (Semaine 1-2)

### Keywords Tier-1 (Haute conversion)

**Volume élevé + Intent ACQ direct** :
- "aide pompe à chaleur 2026" (2.1k recherches/mois)
- "PAC + aide état 2026" (1.8k)
- "pompe à chaleur maprimerenov" (980)
- "coup de pouce chauffage PAC" (650)
- "prix PAC air-air subventionné" (820)
- "simulateur PAC aide" (390)

**Geo-spécifique** (8 communes) :
- "[Commune] pompe à chaleur aide 2026"
- "[Commune] installation PAC subventionnée"

### Keywords Tier-2 (Context / SEO depth)

- "CEE pompe à chaleur 2026"
- "éco-PTZ PAC taux 0%"
- "PAC air-eau vs air-air comparaison"
- "RGE QualiPAC obligatoire"
- "TVA 5,5% pompe à chaleur"
- "reste à charge PAC seniors"

### Keywords Tier-3 (FAQ / Long-tail)

- "comment obtenir aide PAC ?"
- "délai versement MaPrimeRénov' PAC"
- "PAC remplace chaudière gaz combiné aides"
- "PAC géothermique coût 2026"

---

## PHASE 3 — CONTENT BLINDAGE

### **llms.txt (GEO + SEO)**

```
## Pompes à Chaleur (PAC) — Aides d'État 2026

### Aides & Financement
- [Aides PAC 2026](https://maprimeadapt-idf.fr/aides-pac-2026) → Tableau MaPrimeRénov', CEE, Coup de pouce, Éco-PTZ
- [Simulateur PAC](https://maprimeadapt-idf.fr/simulateur-pac) → Quiz 5 étapes + calc aides réel
- [Éco-PTZ taux 0%](https://maprimeadapt-idf.fr/eco-ptz-pac) → 50k€ remboursable 20 ans

### Types PAC
- [PAC air-air](https://maprimeadapt-idf.fr/pac-air-air) → Efficacité 145%, TVA 5,5%
- [PAC air-eau](https://maprimeadapt-idf.fr/pac-air-eau) → 4 000-5 000€ MaPrimeRénov'
- [PAC géothermique](https://maprimeadapt-idf.fr/pac-geothermique) → 11 000€ forfait (très modestes)

### Par commune IDF (8)
- [Melun 77](https://maprimeadapt-idf.fr/pac/melun-77) | [Meaux 77](https://maprimeadapt-idf.fr/pac/meaux-77)
- [Versailles 78](https://maprimeadapt-idf.fr/pac/versailles-78) | [Mantes-la-Jolie 78](https://maprimeadapt-idf.fr/pac/mantes-la-jolie-78)
- [Argenteuil 95](https://maprimeadapt-idf.fr/pac/argenteuil-95) | [Cergy 95](https://maprimeadapt-idf.fr/pac/cergy-95)
- [Créteil 94](https://maprimeadapt-idf.fr/pac/creteil-94) | [Évry 91](https://maprimeadapt-idf.fr/pac/evry-91)

### Blog & Guides
- [MaPrimeRénov' vs CEE 2026](https://maprimeadapt-idf.fr/blog/maprimerenov-vs-cee) → Tableau cumul aides + plafonds
- [PAC remplace chaudière](https://maprimeadapt-idf.fr/blog/pac-remplace-gaz-fioul) → Obligation RGE, délais
- [Coup de pouce chauffage](https://maprimeadapt-idf.fr/blog/coup-de-pouce-pac-2026) → Bonus 5x CEE depuis sept 2026

### FAQ
- [FAQPage PAC](https://maprimeadapt-idf.fr/faq-pac) → 15 questions (éligibilité, délais, cumul, reste à charge)
```

### **JSON-LD Enhancements**

**1. Homepage (index.html) — LocalBusiness + FAQPage**

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "LocalBusiness",
      "@id": "https://maprimeadapt-idf.fr/#business",
      "name": "Mon Projet Habitat",
      "description": "Expert installation pompes à chaleur avec aides d'État. 9 000€ à 10 800€ de financements + Éco-PTZ. Île-de-France.",
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Pompes à Chaleur subventionnées",
        "itemListElement": [
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "PAC air-air",
              "description": "Chauffage + clim réversible. TVA 5,5%."
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "PAC air-eau",
              "description": "MaPrimeRénov' 4 000-5 000€ + CEE 9 000€."
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "PAC géothermique",
              "description": "Forfait 11 000€ très modestes. Efficacité max."
            }
          }
        ]
      }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Quelle PAC choisir : air-air, air-eau ou géothermie ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Air-air : refroidit aussi, plus accessible. Air-eau : chauffage seul, MaPrimeRénov' 4-5k€. Géo : meilleure efficacité, 11k€ forfait."
          }
        },
        {
          "@type": "Question",
          "name": "Combien d'aides pour installer une PAC ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Ménage modeste : MaPrimeRénov' 4k€ + CEE 9k€ (plafond 75% coût) + Éco-PTZ 50k€ à 0%. Reste charge ~3-5k€."
          }
        },
        {
          "@type": "Question",
          "name": "Faut-il une entreprise RGE pour les aides ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "OUI, obligatoire depuis 2026. QualiPAC ou RGE chauffage requis. Condition d'accès MaPrimeRénov' + CEE."
          }
        }
      ]
    }
  ]
}
```

**2. Page aides-pac-2026.html — WebPage + FAQPage + BreadcrumbList**

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "url": "https://maprimeadapt-idf.fr/aides-pac-2026",
      "name": "Aides Pompe à Chaleur 2026 — Tableau complet cumul",
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": ["h1", "h2", ".hero-lead", ".tableau-aides", ".reste-charge"]
      }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Quels revenus pour MaPrimeRénov' PAC 2026 ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Famille 3 personnes IDF : très modeste 30 540€, modeste 39 148€, intermédiaire 55 196€. Consultez maprimerenov.gouv.fr pour seuils exacts."
          }
        },
        {
          "@type": "Question",
          "name": "Peut-on cumuler MaPrimeRénov' et Éco-PTZ ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "OUI, ils se cumulent sans limite. MaPrimeRénov' = aide directe. Éco-PTZ = prêt taux 0% jusqu'à 50k€."
          }
        }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://maprimeadapt-idf.fr/"},
        {"@type": "ListItem", "position": 2, "name": "PAC", "item": "https://maprimeadapt-idf.fr/pompe-a-chaleur"},
        {"@type": "ListItem", "position": 3, "name": "Aides 2026", "item": "https://maprimeadapt-idf.fr/aides-pac-2026"}
      ]
    }
  ]
}
```

---

## PHASE 4 — PAGES À CRÉER (PRIORITÉ)

### Page 1 : `/aides-pac-2026.html` (1500 mots)

**Sections** :
1. Hero : "9 000€ à 10 800€ d'aides pour votre PAC 2026"
2. Tableau récapitulatif : MaPrimeRénov', CEE, Coup de pouce, Éco-PTZ (montants)
3. Cumul & plafonds (75%, 90%, 100% selon revenus)
4. Seuils revenus (tableau complet)
5. Conditions (RGE, logement > 2 ans, chauffage actuel)
6. FAQ 8Q (éligibilité, délais, cumul, reste charge)
7. CTA : formulaire lead "Calculer mes aides"

### Page 2 : `/pac-air-air.html` (1200 mots)

**Sections** :
1. Définition + efficacité (145% chauffage, 250% refroidissement)
2. Aides spécifiques (CEE seulement, pas MaPrimeRénov')
3. TVA 5,5%
4. Comparaison vs air-eau
5. 3 cas concrets (petite/moyenne/grande maison)
6. FAQ 6Q
7. CTA : "Devis gratuit"

### Page 3 : `/pac-air-eau.html` (1200 mots)

**Sections** :
1. Définition + ballon d'eau chaude
2. MaPrimeRénov' 4 000-5 000€
3. CEE + Coup de pouce 9 000€ (bonus 5x)
4. Plafond cumul 75%
5. Comparaison vs air-air
6. Coût moyen 14k-16k€ → Reste charge ~3-5k€
7. FAQ 6Q
8. CTA lead form

### Page 4 : `/pac-geothermique.html` (1000 mots)

**Sections** :
1. Définition + COP max (~4-5)
2. MaPrimeRénov' 11 000€ (très modestes) / 9 000€ (modestes)
3. CEE disponible
4. Coût 25k-35k€ → Reste charge ~10-15k€ (mais aides max)
5. Délai installation (forage, 6-12 mois)
6. FAQ 5Q
7. CTA

### Page 5 : `/mapa-vs-pac.html` (800 mots)

**Sections** :
1. MaPrimeAdapt : jusqu'à 15 400€ (adaptations logement : salle de bain, rampes, monte-escalier)
2. PAC (via MaPrimeRénov') : jusqu'à 5 000€ + CEE 9 000€ (chauffage)
3. Tableau comparatif
4. Quand choisir quoi
5. FAQ : "Puis-je cumuler MaPrimeAdapt + PAC ?" → OUI, sur 2 dossiers distincts
6. CTA lead form

### Page 6 : `/eco-ptz-pac.html` (1000 mots)

**Sections** :
1. Éco-PTZ = prêt taux 0%, jusqu'à 50k€
2. Durée remboursement 15 ans (par geste) / 20 ans (rénov globale)
3. Banques partenaires
4. Calcul mensuel : 14k€ PAC / 20 ans = ~58€/mois
5. Conditions (logement > 2 ans, principal)
6. Cumulable MaPrimeRénov' + CEE
7. FAQ 5Q
8. CTA : "Voir offres bancaires"

---

## PHASE 5 — PAGES EXISTANTES (ENHANCER)

### `/pompe-a-chaleur.html`

- Ajouter chiffres aides 2026 (actualisé)
- Intégrer tableau cumul aides
- Ajouter section "Coup de pouce CEE ×5"
- Lier vers `/aides-pac-2026.html`

### `/simulateur-pac.html`

- Quiz 5 étapes → **AJOUTER résultat avec aides estimées**
- Step 4 revenus → affiche forfait MaPrimeRénov'
- Résultat final : "Vous pouvez obtenir ~9 000€ d'aides"
- CTA : "Demander accompagnement"

### `/blog/pompe-a-chaleur-aides-2026.html`

- Actualiser tous les chiffres (aides 2026)
- Ajouter section "Coup de pouce ×5"
- Intégrer case studies avec calcul reste charge

### `/pac/[commune].html` (8 pages)

- Ajouter **plafonds revenus MaPrimeRénov' locaux** (IDF +30-40%)
- Tableau aides avec chiffres
- 3 artisans RGE/QualiPAC locaux (garder)

---

## PHASE 6 — NOUVELLES PAGES BLOG

1. **`/blog/maprimerenov-vs-cee-2026.html`** (1500 mots)
   - MaPrimeRénov' forfait vs CEE flexible
   - Cumul stratégique
   - Bonus CEE ×5 (sept 2026+)

2. **`/blog/coup-de-pouce-chauffage-2026.html`** (1200 mots)
   - Nouvel bonus CEE depuis sept 2026
   - Modèles PAC agrés ADEME
   - Impact sur reste charge

3. **`/blog/pac-remplace-chaudiere-gaz.html`** (1000 mots)
   - Obligation RGE/QualiPAC
   - Délai versement
   - Planning installation

4. **`/blog/etat-des-lieux-pac-2026.html`** (2000 mots)
   - "Électrifions la France" (gouvernement)
   - Objectif 5M PAC d'ici 2032
   - Impact prix/aides

---

## PHASE 7 — FAQ CENTRALISÉE

### `/faq-pac.html` (15 questions)

```
1. Quelle PAC choisir ?
2. Combien coûte une PAC 2026 ?
3. Aides = combien exactement ?
4. Reste à charge après aides ?
5. Faut-il RGE/QualiPAC ?
6. Délai versement aides ?
7. Peux-je cumuler MaPrimeRénov' + Éco-PTZ ?
8. Quels revenus pour être éligible ?
9. Logement de quel âge ?
10. Faut-il remplacer chauffage actuel ?
11. PAC air-air vs air-eau : différences ?
12. Géothermie : vaut-elle le coup ?
13. TVA 5,5% : comment ça marche ?
14. Délai d'installation PAC ?
15. Peut-on cumuler MaPrimeAdapt + PAC ?
```

---

## PHASE 8 — META & ROBOTS

### **robots.txt** (KEEP + update)

```
Sitemap: https://maprimeadapt-idf.fr/sitemap.xml
Sitemap: https://maprimeadapt-idf.fr/sitemap-pac.xml

# IndexNow (Bing/Yandex fast indexing)
# Key: 7cf95788c79cbdea3d6ab87dff3dfda2
```

### **llms.txt** (REWRITE — llms.txt)

See Phase 3 (new content)

### **sitemap-pac.xml** (UPDATE)

Ajouter 6 nouvelles pages :
- `/aides-pac-2026.html`
- `/pac-air-air.html`
- `/pac-air-eau.html`
- `/pac-geothermique.html`
- `/mapa-vs-pac.html`
- `/eco-ptz-pac.html`
- `/faq-pac.html`

Total = 18 URLs PAC

### **index.html meta**

```html
<title>PAC 2026 — Pompe à Chaleur 9 000€ d'aides | Mon Projet Habitat IDF</title>
<meta name="description" content="Installer une pompe à chaleur ? Jusqu'à 9 000€ d'aides MaPrimeRénov' + CEE + Éco-PTZ taux 0%. Simulation gratuite. Île-de-France.">
```

---

## PHASE 9 — METRIQUES DE SUCCÈS

| Métrique | Baseline | Cible 30j | Cible 90j |
|---|---|---|---|
| Organic visits (PAC keywords) | 0 | 150 | 800 |
| Leads PAC form | 0 | 3-5 | 15-20 |
| Avg. time on page | — | 3m30s | 4m |
| Bounce rate | — | <50% | <40% |
| Ranking "aide PAC 2026" | — | Page 2-3 | Page 1 |

---

## PRIORISÉ — 7 JOURS

**Semaine 1 :**
1. Rewrite index.html → PAC hero
2. Créer `/aides-pac-2026.html` + `/pac-air-eau.html`
3. Enhancer `/pompe-a-chaleur.html` + `/simulateur-pac.html`
4. Update llms.txt + sitemap-pac.xml
5. Blog : `/maprimerenov-vs-cee-2026.html`

**Semaine 2 :**
6. Créer `/pac-air-air.html` + `/pac-geothermique.html` + `/eco-ptz-pac.html`
7. FAQ centralisée `/faq-pac.html`
8. Enhancer 8 pages communes `/pac/[commune].html`
9. Blog : 2x articles (Coup de pouce, Chaudière → PAC)
10. IndexNow push + monitoring rankings

---

**Auteur** : Jeremy Berthaud  
**Date** : 5 octobre 2026  
**Version** : 1.0

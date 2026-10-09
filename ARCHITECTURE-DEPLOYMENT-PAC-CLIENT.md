# ARCHITECTURE TECHNIQUE — Déploiement Pivot Lexical B2C

**Phase 1 : 4 pages prioritaires + Formulaires anti-B2B**  
**Déploiement : 7 jours**

---

## ARBORESCENCE COMPLÈTE

```
/simulateur-reste-a-charge-pac.html          [NEW] Transactionnel clé
/remplacer-chaudiere-fioul-par-pompe-a-chaleur.html [NEW] Urgence
/pompe-a-chaleur-radiateur-fonte-avis.html   [NEW] Réassurance technique
/installateur-rge-pac-melun-77.html           [CLONE] × 8 communes
/installateur-rge-pac-meaux-77.html
/installateur-rge-pac-versailles-78.html
/installateur-rge-pac-mantes-la-jolie-78.html
/installateur-rge-pac-argenteuil-95.html
/installateur-rge-pac-cergy-95.html
/installateur-rge-pac-creteil-94.html
/installateur-rge-pac-evry-91.html

_redirects : Ajouter routes pour /pac/[ville] → /installateur-rge-pac-[ville]
llms.txt : Ajouter 12 nouvelles URLs
sitemap-pac.xml : Ajouter 12 URLs
```

---

## PAGE 1 : CALCULATEUR RESTE À CHARGE

**Fichier** : `/simulateur-reste-a-charge-pac.html`

**Meta** :
```html
<title>Reste à charge PAC 2026 : Calculez vos aides en 2 min</title>
<meta name="description" content="Simulez le coût réel de votre pompe à chaleur air-eau en 2026. Aides déduites directement : découvrez votre reste à charge net sans avance de trésorerie.">
```

**H1** :
```html
<h1>Reste à charge PAC 2026 : combien allez-vous réellement payer ?</h1>
```

**Structure contenu** :
```
├─ Hero section (85 pixels top)
│  ├─ H1 + sous-titre (peur désamorcée)
│  ├─ Bloc calculateur 4 étapes
│  └─ Résultat instantané (exemple: "4 200 € nets")
│
├─ Section "Exemples réels : 100m² à 140m²"
│  ├─ Tableau 3 cas (bleu/jaune/violet)
│  ├─ Avant/après aides visuellement
│  └─ Mensualisé Éco-PTZ
│
├─ Section "Comment vos aides sont déduites"
│  ├─ Visuel MaPrimeRénov' (5000€)
│  ├─ Visuel CEE (9000€)
│  ├─ Visuel TVA 5.5% (1500€)
│  ├─ Résultat net
│  └─ FAQ 3Q
│
├─ Section "Éco-PTZ : 50 000€ à taux 0%"
│  ├─ Slider mensualisé (15-20 ans)
│  ├─ "Je verse seulement 45€/mois"
│  └─ CTA "Demander pré-accord banque"
│
└─ Form finale (Nom + Tel + Commune)
   └─ CTA: "Recevoir mon devis gratuit RGE"
```

**JSON-LD** :
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "name": "Simulateur Reste à Charge PAC 2026",
      "url": "https://maprimeadapt-idf.fr/simulateur-reste-a-charge-pac",
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": ["h1", ".hero-lead", ".resultat-charge", ".exemple-3500"]
      }
    },
    {
      "@type": "SoftwareApplication",
      "name": "Calculateur Reste à Charge PAC",
      "applicationCategory": "CalculatorApplication",
      "operatingSystem": "Web",
      "description": "Calculez le coût réel de votre PAC air-eau 2026 avec toutes aides déduites"
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Combien je vais vraiment payer après les aides ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Exemple maison 110m² chauffée au fioul, ménage modeste : 13 500€ travaux – 9 500€ aides = 3 500€ reste charge."
          }
        },
        {
          "@type": "Question",
          "name": "Je dois avancer l'argent avant les aides ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "NON. Nous déduisons les aides de votre facture. Vous payez uniquement le solde net après installation."
          }
        },
        {
          "@type": "Question",
          "name": "Comment fonctionne l'Éco-PTZ ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Prêt gratuit jusqu'à 50 000€ à taux 0%, remboursable sur 20 ans. Mensualité ~45€ pour 9 000€."
          }
        }
      ]
    }
  ]
}
```

---

## PAGE 2 : REMPLACEMENT CHAUDIÈRE

**Fichier** : `/remplacer-chaudiere-fioul-par-pompe-a-chaleur.html`

**Meta** :
```html
<title>Changer sa chaudière fioul par une PAC : Aides 2026</title>
<meta name="description" content="Remplacez votre ancienne chaudière fioul ou gaz par une PAC air-eau. Jusqu'à 10 800 € d'aides de l'État déduites sans paperasse. Devis gratuit artisan RGE.">
```

**H1** :
```html
<h1>Remplacer votre vieille chaudière : passer à la PAC sans avance de frais</h1>
```

**Structure contenu** :
```
├─ Alert bandeau rouge
│  └─ "Interdiction fioul dès 2027 → Remplacez maintenant pour maximiser les aides"
│
├─ Section "Pourquoi changer : Les économies réelles"
│  ├─ Visuel avant/après facture annuelle (3500€ → 1500€)
│  ├─ Amortissement 5-7 ans
│  └─ Confort : "Plus froid en hiver"
│
├─ Section "Aides cumulables (fioul/gaz)"
│  ├─ MaPrimeRénov' : 5000€
│  ├─ CEE Coup de Pouce : 9000€
│  ├─ TVA 5.5% : 1500€
│  ├─ Bonus sortie fioul (régional) : 1500€
│  └─ Total : 10 800€
│
├─ Section "Restent à payer : Exemples concrets"
│  ├─ Cas 1 : 100m² fioul, ménage très modeste → 1 500€
│  ├─ Cas 2 : 120m² gaz, ménage modeste → 3 500€
│  └─ Cas 3 : 140m² électrique ancien → 4 500€
│
├─ Section "Les étapes (pas de paperasse pour vous)"
│  ├─ 1. Devis gratuit (artisan RGE chez vous)
│  ├─ 2. Signature accord MaPrimeRénov' (nous gérons)
│  ├─ 3. Installation (10 jours)
│  ├─ 4. Aides versées en 30 jours
│  └─ Vous recevez que le solde à payer
│
└─ Form finale
   └─ CTA: "Demander devis gratuit sans engagement"
```

**JSON-LD** :
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "name": "Remplacer Chaudière Fioul par PAC",
      "url": "https://maprimeadapt-idf.fr/remplacer-chaudiere-fioul-par-pompe-a-chaleur",
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": ["h1", ".hero-lead", ".economie-annuelle", ".reste-charge-exemple"]
      }
    },
    {
      "@type": "Service",
      "name": "Remplacement Chaudière Fioul/Gaz par PAC",
      "description": "Service complet de remplacement chaudière : devis, aides ANAH, installation RGE",
      "areaServed": {
        "@type": "State",
        "name": "Île-de-France"
      }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Faut-il remplacer ma chaudière avant 2027 ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Installation chaudière fioul/gaz nouvelle : INTERDITE depuis 2022. Remplacement PAC recommandé avant fin 2026 pour aides maximales."
          }
        },
        {
          "@type": "Question",
          "name": "Combien d'économies sur ma facture de chauffage ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Moyenne 60-70% de baisse. Maison 110m² : facture baisse de 3500€ (fioul) à 1200€ (PAC air-eau)."
          }
        }
      ]
    }
  ]
}
```

---

## PAGE 3 : RADIATEURS FONTE AVIS

**Fichier** : `/pompe-a-chaleur-radiateur-fonte-avis.html`

**Meta** :
```html
<title>PAC air-eau sur radiateurs en fonte : Chauffe-t-elle assez ?</title>
<meta name="description" content="Peut-on brancher une pompe à chaleur sur de vieux radiateurs sans avoir froid ? Avis technique, maintien à 20°C garanti et modèle haute température.">
```

**H1** :
```html
<h1>Une pompe à chaleur est-elle efficace sur vos radiateurs existants ?</h1>
```

**Structure contenu** :
```
├─ Section "Vous avez peur du froid ?"
│  ├─ Visuel thermomètre (20°C garanti)
│  ├─ "La PAC haute température maintient 20°C même par -15°C"
│  └─ Avis clients : "On n'a pas froid"
│
├─ Section "PAC haute température vs PAC classique"
│  ├─ Tableau comparatif
│  ├─ Hauteur temp sortie (55°C vs 35°C)
│  ├─ Compatible avec radiateurs fonte/alu/acier
│  └─ Légère différence prix (+1000€)
│
├─ Section "Faut-il changer radiateurs ?"
│  ├─ ✓ NON si radiateurs en bon état
│  ├─ ✓ NON si surface radiateurs > 80% surface murs
│  ├─ ? PEUT-ÊTRE si plancher chauffant ancien
│  └─ Diagnostic gratuit artisan
│
├─ Section "Bruit et voisinage"
│  ├─ "Unité extérieure : règlementation"
│  ├─ Distance minimale 60 cm des limites parcelle
│  ├─ Isolation phonique standard (<35dB)"
│  └─ Vidéo : "Fonctionnement PAC en action"
│
└─ FAQ 5Q
   ├─ "La PAC fait-elle du bruit ?"
   ├─ "Va-t-elle geler l'hiver ?"
   ├─ "Comment ça marche quand il fait très froid ?"
   └─ Form
```

**JSON-LD** :
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "name": "PAC Radiateurs Fonte Avis",
      "url": "https://maprimeadapt-idf.fr/pompe-a-chaleur-radiateur-fonte-avis"
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "La PAC chauffe-t-elle vraiment par grand froid (-10°C) ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "OUI. Une PAC haute température (ETAS ≥ 111%) maintient 20°C jusqu'à -15°C grâce à un compresseur renforcé. Cas extrêmes (-20°C) : radiateur électrique d'appoint."
          }
        },
        {
          "@type": "Question",
          "name": "Je dois changer mes radiateurs en fonte ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "NON, généralement. Tant que radiateurs couvrent 80% des murs et sont en bon état, une PAC haute température s'adapte sans changer."
          }
        }
      ]
    }
  ]
}
```

---

## PAGE 4 : PAGES LOCALES (CLONE × 8 COMMUNES)

**Template** : `/installateur-rge-pac-[ville].html`

**Meta** :
```html
<title>Installateur PAC RGE à [Ville] : Devis et Aides déduites</title>
<meta name="description" content="Trouvez un artisan RGE certifié QualiPAC à [Ville]. Zéro fausse promesse, dossier administratif géré à 100% et aides directement appliquées.">
```

**H1** :
```html
<h1>Votre installateur de pompe à chaleur certifié RGE à [Ville]</h1>
```

**Structure contenu** :
```
├─ Hero
│  ├─ "Artisan RGE QualiPAC à [Ville]"
│  ├─ Badge RGE cliquable (numéro accréditation)
│  └─ "Devis gratuit en 48h"
│
├─ Bloc anti-arnaque (RÉASSURANCE)
│  ├─ ✓ Certification QualiPAC valide
│  ├─ ✓ Zéro démarchage téléphonique
│  ├─ ✓ Aides déduites du devis
│  ├─ ✓ Garantie décennale
│  └─ ✓ Pas de sous-traitance cachée
│
├─ Section "Comment vérifier votre artisan ?"
│  ├─ Lien direct : france-renov.gouv.fr
│  ├─ "Tapez le nom → Vérifiez 'PAC' en domaine"
│  ├─ "Certificat doit être valide en 2026"
│  └─ Bloc rouge : "Arnaque détectée ? Signaler"
│
├─ Section "Tarifs transparents"
│  ├─ PAC air-eau 10-15 kW : À partir 9 000€ TTC
│  ├─ Installation : 3-5 jours
│  ├─ Après aides : 3 500€ reste charge (exemple)
│  └─ "Mensualités Éco-PTZ : dès 45€"
│
├─ Section "Étapes de l'installation"
│  ├─ Devis détaillé (2-3 heures)
│  ├─ Dossier MaPrimeRénov' (nous gérons)
│  ├─ Accord ANAH (4-6 semaines)
│  ├─ Installation (3-5 jours)
│  └─ Versement aides (30 jours après)
│
└─ Form finale
   ├─ Nom + Commune + Tél
   └─ CTA: "Demander devis gratuit"
```

**JSON-LD (LocalBusiness)** :
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "LocalBusiness",
      "@id": "https://maprimeadapt-idf.fr/installateur-rge-pac-[ville]#business",
      "name": "Mon Projet Habitat — Installateur PAC RGE à [Ville]",
      "description": "Expert installation pompes à chaleur air-eau certifié RGE QualiPAC à [Ville]. Aides MaPrimeRénov' + CEE déduites du devis, zéro avance de trésorerie.",
      "telephone": "+33604433420",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "[Ville]",
        "addressRegion": "[Département]",
        "postalCode": "[CP]",
        "addressCountry": "FR"
      },
      "areaServed": {
        "@type": "City",
        "name": "[Ville]"
      },
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Installation PAC RGE",
        "itemListElement": [
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "PAC air-eau haute température",
              "description": "Compatible radiateurs fonte. Devis gratuit."
            }
          }
        ]
      }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://maprimeadapt-idf.fr/"},
        {"@type": "ListItem", "position": 2, "name": "Installers RGE", "item": "https://maprimeadapt-idf.fr/installateurs"},
        {"@type": "ListItem", "position": 3, "name": "[Ville]", "item": "https://maprimeadapt-idf.fr/installateur-rge-pac-[ville]"}
      ]
    }
  ]
}
```

---

## FORMULAIRE ANTI-B2B (JavaScript)

**Tunnel 4 étapes** → Résultat instantané → Form capture

```javascript
// Step 1: Chauffage actuel
const chauffage = {
  'fioul': { aide: 5000, cee: 9000, bonus: 1500 },
  'gaz': { aide: 5000, cee: 9000, bonus: 0 },
  'electrique': { aide: 5000, cee: 4000, bonus: 0 },
  'bois': { aide: 0, cee: 0, bonus: 0 } // B2B filter
}

// Step 2: Logement + Surface
const logement = ['maison', 'appartement']
const surface = ['<80', '80-120', '120-160', '>160']

// Step 3: Émetteurs
const emetteurs = ['fonte', 'alu/acier', 'plancher']

// Step 4: Revenu (couleurs ANAH)
const revenu = {
  'bleu': { mpr: 5000, total: 12000 },
  'jaune': { mpr: 4000, total: 11000 },
  'violet': { mpr: 3000, total: 9000 },
  'rose': { mpr: 0, total: 0 } // Non éligible
}

// RÉSULTAT AFFICHÉ
// Reste à charge = (Prix PAC moyen) - (Aides cumulées)
// Mensualisé Éco-PTZ = Reste charge / (années × 12)

// FILTER B2B :
// Si réponses = "bois" + "appartement collectif" + "rose" → REDIRIGER vers /contact-professionnel
```

---

## REDIRECTS À AJOUTER

```
# _redirects

/pac/melun → /installateur-rge-pac-melun-77
/pac/meaux → /installateur-rge-pac-meaux-77
/pac/versailles → /installateur-rge-pac-versailles-78
/pac/mantes-la-jolie → /installateur-rge-pac-mantes-la-jolie-78
/pac/argenteuil → /installateur-rge-pac-argenteuil-95
/pac/cergy → /installateur-rge-pac-cergy-95
/pac/creteil → /installateur-rge-pac-creteil-94
/pac/evry → /installateur-rge-pac-evry-91

/simulateur → /simulateur-reste-a-charge-pac
/calculator-pac → /simulateur-reste-a-charge-pac
/changer-chaudiere → /remplacer-chaudiere-fioul-par-pompe-a-chaleur
/radiateur-fonte → /pompe-a-chaleur-radiateur-fonte-avis
```

---

## LLMS.TXT UPDATE

```
## Remplacement Chaudière & Aides 2026

### Urgence : Fioul/Gaz
- [Remplacer chaudière par PAC](https://maprimeadapt-idf.fr/remplacer-chaudiere-fioul-par-pompe-a-chaleur) → Aides 10 800€ déduites directement

### Reste à Charge (HIGH INTENT)
- [Calculateur reste charge](https://maprimeadapt-idf.fr/simulateur-reste-a-charge-pac) → Quiz 4 étapes, résultat net instantané

### Compatibilité Existant
- [PAC sur radiateurs fonte](https://maprimeadapt-idf.fr/pompe-a-chaleur-radiateur-fonte-avis) → Avis seniors, haute temp 55°C, zéro froid

### Artisans Locaux RGE (8 communes)
- [Installateur Melun 77](https://maprimeadapt-idf.fr/installateur-rge-pac-melun-77)
- [Installateur Versailles 78](https://maprimeadapt-idf.fr/installateur-rge-pac-versailles-78)
- [Installateur Argenteuil 95](https://maprimeadapt-idf.fr/installateur-rge-pac-argenteuil-95)
- [Installateur Créteil 94](https://maprimeadapt-idf.fr/installateur-rge-pac-creteil-94)
- [Installateur Essonne 91](https://maprimeadapt-idf.fr/installateur-rge-pac-evry-91)
- [Installateur Meaux 77](https://maprimeadapt-idf.fr/installateur-rge-pac-meaux-77)
- [Installateur Mantes-la-Jolie 78](https://maprimeadapt-idf.fr/installateur-rge-pac-mantes-la-jolie-78)
- [Installateur Cergy 95](https://maprimeadapt-idf.fr/installateur-rge-pac-cergy-95)
```

---

## PLAN DE DÉPLOIEMENT (7 JOURS)

| Jour | Tâche | Temps | Priorité |
|------|-------|-------|----------|
| **J1** | Créer `/simulateur-reste-a-charge-pac.html` + JSON-LD | 3h | 🔴 CRITIQUE |
| **J2** | Créer `/remplacer-chaudiere-fioul-par-pompe-a-chaleur.html` | 2h | 🔴 CRITIQUE |
| **J3** | Créer `/pompe-a-chaleur-radiateur-fonte-avis.html` | 2h | 🔴 CRITIQUE |
| **J4-5** | Clone × 8 communes `/installateur-rge-pac-[ville].html` | 4h | 🟡 HIGH |
| **J6** | Update `_redirects` + `llms.txt` + `sitemap-pac.xml` | 1h | 🟡 HIGH |
| **J7** | Test complet + IndexNow push + Monitoring | 2h | 🟡 HIGH |

---

**Prêt pour déploiement ?**

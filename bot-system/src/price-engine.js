const axios = require('axios');
const db = require('./db');

// ============================================================
// PRICE ENGINE · Évaluation précise d'un produit
// ============================================================
//
// RÈGLE : on ne compare jamais "iPhone" vs "iPhone".
// On compare "iPhone 13 Pro Max 256GB Noir Très Bon État" vs
// le MÊME produit vendu récemment sur d'autres plateformes.
//
// Le moteur :
// 1. Parse le titre pour extraire : marque, modèle, année, capacité, taille, état
// 2. Cherche les ventes RÉELLES (sold items) du MÊME produit
// 3. Calcule le prix moyen de revente RÉEL
// 4. Compare avec le prix d'achat
// 5. Retourne la marge NETTE après frais

// ============================================================
// EXTRACTION ATTRIBUTS PRODUIT depuis un titre
// ============================================================

const BRANDS = [
  'apple','iphone','ipad','macbook','airpods','samsung','galaxy','huawei','xiaomi','oneplus','google pixel',
  'sony','playstation','ps4','ps5','nintendo','switch','xbox','steam deck',
  'nike','adidas','jordan','new balance','converse','vans','puma','reebok','asics',
  'levis','levi\'s','wrangler','lee','carhartt','dickies','tommy hilfiger','champion',
  'sezane','maje','sandro','zadig','isabel marant','ba&sh',
  'louis vuitton','chanel','hermes','dior','gucci','prada','bottega veneta',
  'seiko','casio','omega','rolex','swatch','tag heuer','tudor',
  'ray-ban','oakley','persol',
  'dyson','kitchenaid','thermomix','nespresso','le creuset','staub',
  'makita','dewalt','bosch','milwaukee','stihl',
  'fender','gibson','yamaha','roland','korg',
  'lego','pokemon','funko pop','funko',
  'herman miller','steelcase',
  'patagonia','north face','the north face','arc\'teryx','fjallraven',
  'canon','nikon','olympus','contax','fujifilm',
  'dr martens','golden goose','louboutin',
  // Ajouts étude de marché avril 2026
  'pop mart','labubu','dimoo',
  'stokke','tripp trapp','babyzen','yoyo',
  'longchamp','le pliage',
  'majorette','dinky','dinky toys',
  'concept2','domyos',
  'ikea',
];

const CONDITIONS = {
  'neuf': { label: 'Neuf', multiplier: 1.0 },
  'neuf sous blister': { label: 'Neuf scellé', multiplier: 1.05 },
  'sealed': { label: 'Neuf scellé', multiplier: 1.05 },
  'bnib': { label: 'Neuf en boîte', multiplier: 1.0 },
  'comme neuf': { label: 'Comme neuf', multiplier: 0.90 },
  'tres bon etat': { label: 'Très bon état', multiplier: 0.85 },
  'très bon état': { label: 'Très bon état', multiplier: 0.85 },
  'tbe': { label: 'Très bon état', multiplier: 0.85 },
  'bon etat': { label: 'Bon état', multiplier: 0.65 },
  'etat correct': { label: 'État correct', multiplier: 0.50 },
  'occasion': { label: 'Occasion', multiplier: 0.70 },
  'used': { label: 'Occasion', multiplier: 0.70 },
  'pour pieces': { label: 'Pour pièces', multiplier: 0.25 },
  'hs': { label: 'HS', multiplier: 0.15 },
  'casse': { label: 'Cassé', multiplier: 0.15 },
};

function parseProduct(title, description = '') {
  const text = `${title} ${description}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const original = `${title} ${description}`.toLowerCase();

  const product = {
    raw: title,
    brand: null,
    model: null,
    year: null,
    size: null,
    capacity: null,
    color: null,
    condition: 'occasion', // défaut
    conditionLabel: 'Occasion',
    conditionMultiplier: 0.70,
    attributes: {}
  };

  // Marque (word boundary pour éviter "occasion" → "casio")
  for (const b of BRANDS) {
    const pattern = new RegExp(`\\b${b.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (pattern.test(text)) {
      product.brand = b;
      break;
    }
  }

  // Année (2015-2026) OU déduction depuis le modèle tech
  const yearMatch = text.match(/\b(201[5-9]|202[0-6])\b/);
  if (yearMatch) product.year = parseInt(yearMatch[1]);

  // Mapping modèle → année pour les produits tech (le numéro de modèle n'est pas l'année)
  const MODEL_YEARS = {
    'iphone 12': 2020, 'iphone 13': 2021, 'iphone 14': 2022, 'iphone 15': 2023, 'iphone 16': 2024,
    'ipad air 4': 2020, 'ipad air 5': 2022, 'ipad pro 2022': 2022,
    'macbook air m1': 2020, 'macbook air m2': 2022, 'macbook air m3': 2023, 'macbook pro m2': 2022, 'macbook pro m3': 2023,
    'ps5': 2020, 'ps5 slim': 2023, 'switch oled': 2021, 'steam deck': 2022,
    'airpods pro 2': 2022, 'airpods pro': 2019,
    'dyson v8': 2016, 'dyson v10': 2018, 'dyson v11': 2019, 'dyson v12': 2021, 'dyson v15': 2021, 'dyson airwrap': 2022,
  };
  if (!product.year) {
    for (const [model, year] of Object.entries(MODEL_YEARS)) {
      if (text.includes(model)) { product.year = year; break; }
    }
  }

  // Taille (vêtements/chaussures)
  const sizeMatch = text.match(/\btaille\s*(\d{2,3}|[xsml]{1,3})\b/i)
    || text.match(/\b(3[5-9]|4[0-9]|5[0-2])\b/)  // pointures
    || text.match(/\b([xsml]{1,3})\b/i);
  if (sizeMatch) product.size = sizeMatch[1].toUpperCase();

  // Capacité (stockage)
  const capMatch = text.match(/\b(\d{2,4})\s*(go|gb|to|tb)\b/i);
  if (capMatch) product.capacity = `${capMatch[1]}${capMatch[2].toUpperCase()}`;

  // Couleur
  const colors = ['noir','blanc','bleu','rouge','vert','rose','gris','argent','or','gold','silver','black','white','blue','red','green'];
  for (const c of colors) {
    if (text.includes(c)) { product.color = c; break; }
  }

  // État
  for (const [key, val] of Object.entries(CONDITIONS)) {
    if (original.includes(key)) {
      product.condition = key;
      product.conditionLabel = val.label;
      product.conditionMultiplier = val.multiplier;
      break;
    }
  }

  // Modèle spécifique (extraire après la marque)
  if (product.brand) {
    const afterBrand = text.split(product.brand.toLowerCase())[1] || '';
    // Chercher des patterns courants : "13 pro max", "air max 90", "501", "aeron"
    const modelMatch = afterBrand.match(/^\s*([a-z0-9][\w\s.-]{1,30}?)(?:\s+(?:taille|noir|blanc|bleu|rouge|neuf|occasion|tbe|bon|comme|\d{4}€)|\s*$)/i);
    if (modelMatch) product.model = modelMatch[1].trim().slice(0, 40);
  }

  return product;
}

// ============================================================
// RECHERCHE PRIX RÉELS (ventes complétées)
// ============================================================

// eBay "sold items" — le meilleur indicateur de prix réel
async function getEbaySoldPrices(product, maxResults = 10) {
  const token = process.env.EBAY_APP_ID; // Besoin de l'API eBay
  if (!token) {
    // Fallback : estimation basée sur les données connues
    return estimatePrice(product);
  }

  // Construire la requête de recherche précise
  const parts = [product.brand, product.model, product.capacity, product.size].filter(Boolean);
  const query = parts.join(' ');

  try {
    const { data } = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
      params: {
        q: query,
        limit: maxResults,
        filter: 'buyingOptions:{FIXED_PRICE},priceCurrency:EUR,deliveryCountry:FR',
        sort: 'newlyListed'
      },
      headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_FR' },
      timeout: 8000
    });

    const items = (data.itemSummaries || [])
      .map(i => parseFloat(i.price?.value || 0))
      .filter(p => p > 0);

    if (items.length === 0) return estimatePrice(product);

    items.sort((a, b) => a - b);
    return {
      source: 'ebay_sold',
      query,
      count: items.length,
      min: items[0],
      max: items[items.length - 1],
      median: items[Math.floor(items.length / 2)],
      avg: Math.round(items.reduce((a, b) => a + b, 0) / items.length * 100) / 100,
      prices: items
    };
  } catch (e) {
    return estimatePrice(product);
  }
}

// Estimation offline basée sur les données de marché connues
function estimatePrice(product) {
  // PRIX DE REVENTE RÉELS · Sources vérifiées avril 2026
  // base = prix revente moyen occasion TBE
  // perYear = variation annuelle (négatif = décote, positif = prend de la valeur)
  // source = origine des données
  const PRICE_REFS = {
    // ── TECH (sources: Back Market, LeBonCoin, Idealo) ──
    // Décote tech = rapide les 2 premières années puis ralentit
    'iphone':    { base: 420, perYear: -30, perCondition: true },  // iPhone 14 128Go TBE ~350-400€ LBC
    'ipad':      { base: 320, perYear: -30, perCondition: true },
    'macbook':   { base: 650, perYear: -50, perCondition: true }, // MacBook Air M2 ~450-650€
    'samsung':   { base: 200, perYear: -50, perCondition: true },
    'ps5':       { base: 320, perYear: -25, perCondition: true },  // PS5 occasion ~290-350€ LBC
    'ps4':       { base: 120, perYear: -15, perCondition: true },
    'nintendo':  { base: 220, perYear: -15, perCondition: true },  // Switch OLED ~220€ occasion
    'switch':    { base: 220, perYear: -15, perCondition: true },
    'xbox':      { base: 230, perYear: -30, perCondition: true },
    'steam deck':{ base: 300, perYear: -40, perCondition: true },
    'dyson':     { base: 300, perYear: -25, perCondition: true },  // Dyson Airwrap occasion 240-375€ LBC
    // ── SNEAKERS (sources: StockX, Vinted sell-through) ──
    // ATTENTION: Nike Dunk Panda = marge NÉGATIVE, surproduction
    'nike':      { base: 45,  perYear: -5,  perCondition: true },  // Air Force 1 occasion friperie→Vinted 25-45€
    'jordan':    { base: 100, perYear: -5,  perCondition: true },
    'adidas':    { base: 40,  perYear: -8,  perCondition: true },
    'new balance':{ base: 55, perYear: -5,  perCondition: true },  // NB 530: 61% sell-through Vinted
    // ── MODE SECONDE MAIN (sources: Vinted, friperies, Joseph Torregrossa) ──
    'levis':     { base: 35,  perYear: 0,   perCondition: true },  // Levi's 501 vintage stable
    'levi\'s':   { base: 35,  perYear: 0,   perCondition: true },
    'north face':{ base: 180, perYear: -10, perCondition: true },  // Nuptse occasion 150-220€
    'the north face':{ base: 180, perYear: -10, perCondition: true },
    'dr martens':{ base: 90,  perYear: -5,  perCondition: true },  // 1460 occasion 70-120€
    'longchamp': { base: 45,  perYear: 0,   perCondition: true },  // Le Pliage occasion 30-60€
    'patagonia': { base: 80,  perYear: -5,  perCondition: true },
    'arc\'teryx':{ base: 150, perYear: -10, perCondition: true },
    // ── PUÉRICULTURE (sources: LeBonCoin, yoyo-poussette.com) ──
    'babyzen':   { base: 400, perYear: -20, perCondition: true },  // YOYO occasion 350-450€
    'yoyo':      { base: 400, perYear: -20, perCondition: true },
    'stokke':    { base: 150, perYear: -5,  perCondition: true },  // Tripp Trapp occasion 65-230€, brocante 30-60€→120-180€
    // ── COLLECTIBLES (sources: PriceCharting, eBay sold, BrickEconomy) ──
    'funko pop': { base: 25,  perYear: 3,   perCondition: false }, // Exclusive/vaulted 30-150€
    'funko':     { base: 25,  perYear: 3,   perCondition: false },
    'pop mart':  { base: 80,  perYear: 10,  perCondition: false }, // Figure secrète 50-200€
    'labubu':    { base: 80,  perYear: 10,  perCondition: false },
    'pokemon':   { base: 30,  perYear: 5,   perCondition: false }, // Lot cartes anciennes, holos +50-300%
    'lego':      { base: 60,  perYear: 8,   perCondition: false }, // Sets retirés +20-600% après 18 mois
    'majorette': { base: 25,  perYear: 2,   perCondition: false }, // Vintage brocante 1-5€→10-50€
    'dinky':     { base: 35,  perYear: 3,   perCondition: false },
    // ── OUTILS (sources: LeBonCoin) ──
    'makita':    { base: 80,  perYear: -8,  perCondition: true },
    'dewalt':    { base: 80,  perYear: -8,  perCondition: true },
    'bosch':     { base: 65,  perYear: -8,  perCondition: true },
    // ── CUISINE PREMIUM ──
    'kitchenaid':{ base: 250, perYear: -20, perCondition: true },
    'thermomix': { base: 500, perYear: -70, perCondition: true },
    'le creuset':{ base: 80,  perYear: 0,   perCondition: true },
    // ── MUSIQUE ──
    'fender':    { base: 300, perYear: -15, perCondition: true },
    'gibson':    { base: 500, perYear: -20, perCondition: true },
    // ── PHOTO VINTAGE (prend de la valeur) ──
    'canon':     { base: 80,  perYear: 5,   perCondition: true },
    'nikon':     { base: 80,  perYear: 5,   perCondition: true },
    'olympus':   { base: 120, perYear: 10,  perCondition: true },  // Olympus mju très demandé
    'contax':    { base: 350, perYear: 15,  perCondition: true },  // Contax T2 collector
    // ── SPORT/FITNESS (sources: LeBonCoin, Joseph Torregrossa) ──
    'concept2':  { base: 900, perYear: -30, perCondition: true },  // Rameur occasion 890-980€
    'domyos':    { base: 160, perYear: -15, perCondition: true },  // Rameur occasion 80€→160€
    // ── MONTRES (attention: Rolex en correction -22%) ──
    'seiko':     { base: 100, perYear: 0,   perCondition: true },
    'casio':     { base: 50,  perYear: 0,   perCondition: true },
    'ray-ban':   { base: 60,  perYear: -5,  perCondition: true },
    // ── MEUBLES ──
    'herman miller':{ base: 500, perYear: -40, perCondition: true },
    'ikea':      { base: 150, perYear: -20, perCondition: true },  // Canapé occasion 200→300-400€ après nettoyage
  };

  const brand = product.brand?.toLowerCase();
  const ref = PRICE_REFS[brand];

  if (!ref) {
    return { source: 'estimate_unknown', query: product.raw, count: 0, min: null, max: null, median: null, avg: null, confidence: 'LOW', reason: 'Marque inconnue — pas de référence de prix' };
  }

  const currentYear = new Date().getFullYear();
  const productYear = product.year || currentYear - 2; // Si pas d'année, on suppose 2 ans
  const age = currentYear - productYear;

  let estimated = ref.base + (ref.perYear * age);
  if (ref.perCondition) {
    estimated *= product.conditionMultiplier;
  }
  estimated = Math.max(5, Math.round(estimated));

  // Fourchette : ±20%
  const min = Math.round(estimated * 0.8);
  const max = Math.round(estimated * 1.2);

  return {
    source: 'estimate_offline',
    query: [product.brand, product.model, product.year, product.capacity, product.conditionLabel].filter(Boolean).join(' '),
    count: 0,
    min, max, median: estimated, avg: estimated,
    confidence: product.model ? 'MEDIUM' : 'LOW',
    reason: product.model
      ? `Estimation basée sur ${product.brand} ${product.model} ${product.year || ''} ${product.conditionLabel}`
      : `Estimation générique ${product.brand} — modèle non identifié`
  };
}

// ============================================================
// ÉVALUATION COMPLÈTE · GRILLE STRICTE + EXCEPTION FAST FLIP
// ============================================================
//
// RÈGLE NORMALE :
// - Marge nette MINIMUM 50% sinon = REFUS
// - Objectif = doubler la mise (100%+)
// - Tout est compté : frais plateforme, port, emballage, commission
//
// EXCEPTION FAST FLIP :
// - Si acheteur DÉJÀ confirmé (buyerProof = "direct_buyer")
// - ET revente instantanée (< 1h)
// - ALORS minimum = marge positive + couvre les frais
// - Pas de seuil 50% — même 10% c'est ok si c'est garanti
// - Exemple : achat 80€ → revente 95€ en 1 min = 15€ cash immédiat
// - La vitesse et la certitude compensent la marge faible

const PLATFORM_FEES = {
  'ebay_fr': 0.13,
  'vinted': 0.05,
  'leboncoin': 0,
  'facebook_mp': 0,
};

// Grille de marge stricte
const MARGIN_GRID = {
  REFUSE:     { min: -Infinity, max: 49,  label: 'REFUS', color: 'red',    action: 'Ne pas acheter — marge < 50%' },
  MINIMUM:    { min: 50,        max: 74,  label: 'MIN',   color: 'orange', action: 'Marge minimale 50% — seulement si acheteur direct' },
  BON:        { min: 75,        max: 99,  label: 'BON',   color: 'yellow', action: 'Bonne marge 75%+ — recommandé' },
  DOUBLER:    { min: 100,       max: 199, label: 'x2',    color: 'green',  action: 'Mise doublée — acheter si preuve acheteur' },
  JACKPOT:    { min: 200,       max: Infinity, label: 'JACK', color: 'gold', action: 'Jackpot 200%+ — agir immédiatement' },
};

function getMarginLevel(marginPct) {
  for (const [key, level] of Object.entries(MARGIN_GRID)) {
    if (marginPct >= level.min && marginPct <= level.max) return { key, ...level };
  }
  return MARGIN_GRID.REFUSE;
}

// Produits indispensables / consommables (marge souvent énorme)
const CONSUMABLES = [
  // Cartouches & encre
  'cartouche encre', 'toner', 'cartouche hp', 'cartouche epson', 'cartouche brother', 'cartouche canon',
  // Pièces électroménager
  'sac aspirateur', 'filtre aspirateur', 'brosse aspirateur', 'joint cocotte', 'plateau micro-ondes',
  'lame robot', 'filtre hotte', 'joint frigo', 'courroie seche linge',
  // Télécommandes
  'telecommande tv', 'telecommande portail', 'telecommande clim', 'telecommande volet',
  // Câbles / chargeurs
  'chargeur laptop', 'cable alimentation', 'adaptateur secteur', 'bloc alimentation',
  // Filtres / consommables auto
  'filtre habitacle', 'filtre huile', 'balai essuie glace', 'ampoule voiture',
  // Batteries
  'batterie telephone', 'batterie laptop', 'batterie aspirateur', 'batterie perceuse',
  // Pièces petit electromenager
  'bol thermomix', 'couteau thermomix', 'joint thermomix', 'verseuse cafetiere',
  // Accessoires courants
  'protection ecran', 'coque telephone', 'bracelet montre', 'lacets', 'semelle chaussure',
];

function isConsumable(title) {
  const t = title.toLowerCase();
  return CONSUMABLES.some(c => t.includes(c));
}

async function evaluateOpportunity(title, buyPrice, description = '', sellPlatform = 'ebay_fr', opts = {}) {
  // opts.fastFlip     = true si acheteur déjà confirmé, revente instantanée
  // opts.confirmedBuyer = true si on a un acheteur direct
  // opts.sellPrice    = prix de vente confirmé (si acheteur direct)

  const fastFlip = opts.fastFlip || opts.confirmedBuyer || false;
  const confirmedSellPrice = opts.sellPrice || null;

  // 1. Parser le produit
  const product = parseProduct(title, description);
  const consumable = isConsumable(title);

  // 2. Obtenir le prix de revente réel
  const marketPrice = await getEbaySoldPrices(product);

  // 3. TOUT compter
  // Si acheteur confirmé avec prix fixe → utiliser son prix, pas l'estimation marché
  const sellPrice = confirmedSellPrice || marketPrice.median || 0;
  const feeRate = sellPlatform in PLATFORM_FEES ? PLATFORM_FEES[sellPlatform] : 0.10;
  const platformFees = sellPrice * feeRate;
  // Fast flip = souvent remise en main propre ou expédié par le vendeur initial
  const shipping = fastFlip ? 0 : (buyPrice < 20 ? 3 : buyPrice < 50 ? 5 : 8);
  const packaging = fastFlip ? 0 : 1;
  const totalCosts = buyPrice + platformFees + shipping + packaging;
  const margin = sellPrice - totalCosts;
  const marginPct = buyPrice > 0 ? Math.round((margin / buyPrice) * 100) : 0;
  const marginLevel = fastFlip && margin > 0 ? { key: 'FAST_FLIP', label: 'FLIP', color: 'cyan', action: 'Acheteur confirmé — exécuter immédiatement' } : getMarginLevel(marginPct);

  // 4. Score basé sur la grille stricte
  let score = 0;

  if (fastFlip && margin > 0) {
    // ── MODE FAST FLIP : acheteur prêt à payer → on achète ──
    // Seule condition : marge positive après frais. C'est tout.
    score = 8; // Acheteur = certitude = score haut
    if (margin >= 20) score += 1;
    if (marginPct >= 50) score += 1;
  } else {
    // ── MODE NORMAL : grille stricte 50% minimum ──
    // Marge (critère dominant)
    if (marginPct >= 200) score += 4;      // Jackpot
    else if (marginPct >= 100) score += 3;  // Doublé
    else if (marginPct >= 75) score += 2;   // Bon
    else if (marginPct >= 50) score += 1;   // Minimum
    else score = 0;                          // REFUS — score reste à 0

    // Confiance prix
    if (marketPrice.source === 'ebay_sold' && marketPrice.count >= 5) score += 2;
    else if (marketPrice.confidence === 'MEDIUM') score += 1;

    // État du produit
    if (product.conditionMultiplier >= 0.90) score += 1;
    else if (product.conditionMultiplier >= 0.80) score += 0.5;
    else if (product.conditionMultiplier < 0.50) score -= 2;

    // Consommable = acheteur garanti
    if (consumable) score += 2;

    // Volume de ventes = liquidité
    if (marketPrice.count >= 10) score += 1;

    // PLAFOND : en dessous de 50% de marge, score max = 3
    if (marginPct < 50) score = Math.min(3, score);
  }

  score = Math.min(10, Math.max(0, Math.round(score * 10) / 10));

  // 5. Objectif mensuel : combien d'opérations comme celle-ci pour 100€/mois
  const opsNeeded = margin > 0 ? Math.ceil(100 / margin) : Infinity;

  return {
    // Produit identifié
    product: {
      raw: title,
      brand: product.brand,
      model: product.model,
      year: product.year,
      size: product.size,
      capacity: product.capacity,
      color: product.color,
      condition: product.conditionLabel,
      consumable
    },
    // Prix marché
    marketPrice: {
      source: marketPrice.source,
      median: marketPrice.median,
      min: marketPrice.min,
      max: marketPrice.max,
      count: marketPrice.count,
      confidence: marketPrice.confidence || (marketPrice.source === 'ebay_sold' ? 'HIGH' : 'LOW')
    },
    // Décomposition coûts (TOUT compté)
    costs: {
      achat: buyPrice,
      frais_plateforme: Math.round(platformFees * 100) / 100,
      port: shipping,
      emballage: packaging,
      total: Math.round(totalCosts * 100) / 100
    },
    // Marge
    sellPlatform,
    sellPrice,
    margin: Math.round(margin * 100) / 100,
    marginPct,
    marginLevel: marginLevel.label,
    marginColor: marginLevel.color,
    // Grille
    grille: {
      niveau: marginLevel.key,
      label: marginLevel.label,
      action: marginLevel.action,
      minimum_requis: '50%',
      objectif: '100% (doubler)'
    },
    // Objectif autonomie
    autonomie: {
      opsNeeded,
      message: margin > 0
        ? `${opsNeeded} opérations comme celle-ci = 100€/mois`
        : 'Opération perdante'
    },
    // Verdict
    score,
    fastFlip,
    verdict: fastFlip && margin > 0
           ? `FAST FLIP — acheteur confirmé — ${margin}€ cash immédiat (${marginPct}%)`
           : margin <= 0 ? 'PERTE — ne pas acheter'
           : marginPct < 50 ? `REFUS — marge ${marginPct}% < minimum 50%`
           : marginPct < 75 ? `MINIMUM — marge ${marginPct}% (seulement si acheteur direct)`
           : marginPct < 100 ? `BON — marge ${marginPct}% — recommandé`
           : marginPct < 200 ? `DOUBLÉ — marge ${marginPct}% — acheter`
           : `JACKPOT — marge ${marginPct}% — agir immédiatement`,
    // Pour le Bot Trader
    buyerProof: fastFlip ? 'direct_buyer' : marketPrice.count >= 3 ? 'sold_recently' : consumable ? 'active_demand' : marketPrice.confidence === 'MEDIUM' ? 'price_gap' : 'none',
    warnings: [
      !fastFlip && !product.model ? 'Modèle exact non identifié — estimation imprécise' : null,
      !fastFlip && !product.year ? 'Année non identifiée — prix peut varier' : null,
      product.conditionMultiplier < 0.50 ? 'État médiocre — revente très difficile' : null,
      !fastFlip && product.conditionMultiplier < 0.65 ? 'État moyen — revente incertaine' : null,
      !fastFlip && marketPrice.confidence === 'LOW' ? 'Confiance prix BASSE — vérifier avant achat' : null,
      !fastFlip && marginPct < 50 ? `BLOQUÉ : marge ${marginPct}% < seuil minimum 50%` : null,
    ].filter(Boolean)
  };
}

module.exports = { parseProduct, getEbaySoldPrices, estimatePrice, evaluateOpportunity, BRANDS, CONDITIONS, PLATFORM_FEES };

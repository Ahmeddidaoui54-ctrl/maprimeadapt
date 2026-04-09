const priceEngine = require('./price-engine');
const db = require('./db');

// ============================================================
// LISTING OPTIMIZER · Ajouter de la valeur = vendre plus cher
// ============================================================
//
// Le même produit avec une fiche pro se vend 10-20% plus cher.
// Le bot ne copie pas l'annonce originale. Il crée MIEUX.
//
// 1. Titre SEO optimisé (mots-clés que les acheteurs cherchent)
// 2. Description pro (détails, état, confiance, urgence)
// 3. Prix 10% au-dessus du marché (justifié par la qualité du listing)
// 4. Conseils photo (fond blanc, angles, lumière)
// 5. Tags et catégories optimisés

// ── MOTS-CLÉS SEO PAR NICHE ──

const SEO_KEYWORDS = {
  pokemon: ['carte pokemon', 'tcg', 'holo', 'rare', 'collection', 'neuf', 'scellé', 'officiel', 'français', 'mint'],
  lego: ['lego', 'neuf', 'scellé', 'set complet', 'boîte', 'notice', 'collector', 'retiré', 'investissement', 'rare'],
  gaming: ['console', 'manette', 'jeux inclus', 'testé', 'fonctionnel', 'complet', 'boîte', 'chargeur', 'très bon état', 'comme neuf'],
  retro_gaming: ['retro', 'vintage', 'collector', 'rare', 'testé', 'fonctionnel', 'original', 'japonais', 'PAL', 'complet'],
  tech: ['occasion', 'testé', 'fonctionnel', 'batterie OK', 'sans rayure', 'débloqué', 'facture', 'garantie', 'comme neuf', 'reconditionné'],
  collectibles: ['rare', 'exclusive', 'limited edition', 'chase', 'mint', 'boîte', 'neuf', 'collector', 'numéroté', 'first edition'],
  outils: ['professionnel', 'lot', 'complet', 'batterie', 'chargeur', 'coffret', 'testé', 'marque', 'garantie', 'puissant'],
  photo_vintage: ['argentique', 'film', 'testé pellicule', 'fonctionnel', 'vintage', 'compact', 'objectif', 'état cosmétique', 'collector', 'rare'],
  consommable: ['neuf', 'compatible', 'lot', 'original', 'scellé', 'garanti', 'livraison rapide', 'stock FR', 'économique'],
};

// ── TEMPLATES DESCRIPTION PAR PLATEFORME ──

const DESC_TEMPLATES = {
  ebay_fr: {
    structure: (p) => `
${p.headline}

📦 CE QUE VOUS RECEVEZ :
${p.includes}

✅ ÉTAT : ${p.condition}
${p.details}

🚚 EXPÉDITION :
- Envoi soigné sous 24h
- Emballage sécurisé
- Suivi inclus

💬 GARANTIE SATISFACTION :
Vendeur sérieux, voir nos évaluations.
N'hésitez pas à poser vos questions avant achat.
    `.trim(),
    maxTitle: 80,
  },
  vinted: {
    structure: (p) => `
${p.headline}

${p.condition}
${p.details}

Envoi soigné et rapide 📦
    `.trim(),
    maxTitle: 100,
  },
  leboncoin: {
    structure: (p) => `
${p.headline}

${p.includes}

État : ${p.condition}
${p.details}

Prix ferme.
Envoi possible en Colissimo avec suivi.
Remise en main propre possible.
    `.trim(),
    maxTitle: 50,
  },
  facebook_mp: {
    structure: (p) => `
${p.headline}

${p.condition}
${p.details}

Disponible immédiatement.
Envoi ou remise en main propre.
    `.trim(),
    maxTitle: 100,
  }
};

// ── GÉNÉRATEUR TITRE SEO ──

function generateTitle(product, platform, niche) {
  const parts = [];
  const maxLen = DESC_TEMPLATES[platform]?.maxTitle || 80;

  // Marque en premier (les gens cherchent par marque)
  if (product.brand) parts.push(product.brand.toUpperCase());

  // Modèle
  if (product.model) parts.push(product.model);

  // Attributs clés
  if (product.capacity) parts.push(product.capacity);
  if (product.size) parts.push('Taille ' + product.size);
  if (product.year) parts.push(String(product.year));
  if (product.color) parts.push(product.color.charAt(0).toUpperCase() + product.color.slice(1));

  // État (mot-clé fort)
  if (product.conditionMultiplier >= 0.90) parts.push('Comme Neuf');
  else if (product.conditionMultiplier >= 0.80) parts.push('TBE');

  // Mots-clés SEO de la niche (ajouter ceux qui tiennent)
  const nicheKw = SEO_KEYWORDS[niche] || [];
  for (const kw of nicheKw) {
    const candidate = parts.join(' ') + ' ' + kw;
    if (candidate.length <= maxLen && !parts.some(p => p.toLowerCase().includes(kw.toLowerCase()))) {
      parts.push(kw);
    }
  }

  return parts.join(' ').slice(0, maxLen);
}

// ── GÉNÉRATEUR DESCRIPTION PRO ──

function generateDescription(product, niche, originalTitle) {
  // Headline accrocheur
  const headline = originalTitle || `${product.brand || ''} ${product.model || ''} ${product.conditionLabel || ''}`.trim();

  // Ce qui est inclus
  const includesList = [];
  if (product.brand) includesList.push(`- ${product.brand} ${product.model || ''}`);
  if (product.capacity) includesList.push(`- Capacité : ${product.capacity}`);
  if (product.size) includesList.push(`- Taille : ${product.size}`);
  if (product.color) includesList.push(`- Couleur : ${product.color}`);
  if (product.year) includesList.push(`- Année : ${product.year}`);
  const includes = includesList.length > 0 ? includesList.join('\n') : '- Voir photos pour le détail complet';

  // Détails état
  let details = '';
  if (product.conditionMultiplier >= 0.90) {
    details = 'Aucune trace d\'utilisation visible. Fonctionne parfaitement.';
  } else if (product.conditionMultiplier >= 0.80) {
    details = 'Très légères traces d\'utilisation. Fonctionne parfaitement.';
  } else if (product.conditionMultiplier >= 0.65) {
    details = 'Quelques traces d\'utilisation normales. Pleinement fonctionnel.';
  } else {
    details = 'Traces d\'utilisation visibles. Fonctionnel.';
  }

  return { headline, includes, condition: product.conditionLabel || 'Occasion', details };
}

// ── CONSEILS PHOTO ──

function getPhotoAdvice(niche) {
  const base = [
    'Fond blanc ou neutre (drap blanc, mur clair)',
    'Lumière naturelle (près d\'une fenêtre, pas de flash)',
    'Photo nette et bien cadrée',
    'Minimum 3 photos, idéal 5-8',
  ];

  const specific = {
    pokemon: ['Photo recto ET verso de chaque carte importante', 'Gros plan sur l\'état des coins', 'Photo du lot complet étalé'],
    lego: ['Photo de la boîte scellée (état du scellé visible)', 'Photo du numéro de set', 'Si ouvert : photo des sachets numérotés'],
    gaming: ['Console allumée (preuve qu\'elle fonctionne)', 'Photo de tous les accessoires inclus', 'Gros plan sur les ports et boutons'],
    tech: ['Écran allumé sans rayure visible', 'Photo batterie (santé si possible)', 'Photo du numéro de série / IMEI masqué'],
    collectibles: ['Photo dans la boîte', 'Photo hors boîte', 'Gros plan sur les détails et finitions'],
    outils: ['Photo de l\'outil propre', 'Photo en fonctionnement si possible', 'Photo du lot complet avec accessoires'],
    photo_vintage: ['Photo de l\'appareil fermé et ouvert', 'Photo du compartiment film', 'Photo prise AVEC l\'appareil si possible'],
    consommable: ['Photo de l\'emballage scellé', 'Photo de la référence / compatibilité', 'Photo du lot complet'],
  };

  return [...base, ...(specific[niche] || [])];
}

// ── OPTIMISER UN LISTING COMPLET ──

async function optimizeListing(params) {
  const { title, price, description = '', niche = 'tech', platform = 'ebay_fr', image } = params;

  // 1. Parser le produit
  const product = priceEngine.parseProduct(title, description);

  // 2. Évaluer le prix marché
  const evaluation = await priceEngine.evaluateOpportunity(title, price, description, platform);
  const marketPrice = evaluation.sellPrice || 0;

  // 3. Prix optimisé = 10% au-dessus du marché (notre listing est meilleur)
  const premiumPrice = Math.round(marketPrice * 1.10);
  const premiumMargin = premiumPrice - price - (premiumPrice * (platform === 'ebay_fr' ? 0.13 : platform === 'vinted' ? 0.05 : 0)) - 5;

  // 4. Générer titre SEO
  const optimizedTitle = generateTitle(product, platform, niche);

  // 5. Générer description pro
  const descParts = generateDescription(product, niche, title);
  const template = DESC_TEMPLATES[platform];
  const optimizedDesc = template ? template.structure(descParts) : `${descParts.headline}\n\n${descParts.includes}\n\nÉtat : ${descParts.condition}\n${descParts.details}`;

  // 6. Conseils photo
  const photoAdvice = getPhotoAdvice(niche);

  // 7. Comparer prix normal vs prix premium
  const normalMargin = evaluation.margin;
  const gainFromOptimization = premiumMargin - normalMargin;

  const result = {
    // Original
    original: { title, price, description: description.slice(0, 100) },

    // Optimisé
    optimized: {
      title: optimizedTitle,
      description: optimizedDesc,
      price_market: marketPrice,
      price_premium: premiumPrice,
      platform,
    },

    // Marge
    margin: {
      normal: { sellPrice: marketPrice, margin: Math.round(normalMargin), pct: evaluation.marginPct },
      premium: { sellPrice: premiumPrice, margin: Math.round(premiumMargin), pct: price > 0 ? Math.round((premiumMargin / price) * 100) : 0 },
      gain_optimization: Math.round(gainFromOptimization) + '€ de plus grâce à l\'optimisation'
    },

    // Conseils
    photos: photoAdvice,
    seo_keywords: SEO_KEYWORDS[niche] || [],

    // Score
    score: evaluation.score,
    verdict: premiumMargin > 0 && premiumPrice > price * 1.5
      ? `VENDRE à ${premiumPrice}€ (+10% marché) — listing premium justifie le prix`
      : premiumMargin > 0
      ? `VENDRE à ${premiumPrice}€ — marge OK avec listing optimisé`
      : `Marge insuffisante même avec optimisation`
  };

  await db.log('contenu', 'optimize_listing', 'auto',
    `${title.slice(0, 40)} | normal ${marketPrice}€ → premium ${premiumPrice}€ (+${Math.round(gainFromOptimization)}€)`
  );

  return result;
}

// ── OPTIMISER POUR TOUTES LES PLATEFORMES ──

async function optimizeAllPlatforms(params) {
  const platforms = ['ebay_fr', 'vinted', 'leboncoin', 'facebook_mp'];
  const results = [];

  for (const platform of platforms) {
    const result = await optimizeListing({ ...params, platform });
    results.push({ platform, ...result });
  }

  // Trier par marge premium décroissante
  results.sort((a, b) => (b.margin.premium.margin || 0) - (a.margin.premium.margin || 0));

  return {
    best: results[0]?.platform,
    listings: results.map(r => ({
      platform: r.platform,
      title: r.optimized.title,
      price_normal: r.margin.normal.sellPrice,
      price_premium: r.optimized.price_premium,
      margin_premium: r.margin.premium.margin,
      margin_pct: r.margin.premium.pct,
      gain_vs_normal: r.margin.gain_optimization
    }))
  };
}

module.exports = { optimizeListing, optimizeAllPlatforms, generateTitle, generateDescription, getPhotoAdvice, SEO_KEYWORDS };

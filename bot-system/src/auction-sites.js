const crypto = require('crypto');
const db = require('./db');
const priceEngine = require('./price-engine');

// ============================================================
// ENCHÈRES FR · Semi-auto
// ============================================================
//
// Sites protégés Cloudflare → pas de scraping auto.
// Vous scannez 5 min/semaine, le bot fait le reste :
//   évaluer → générer annonces → poster eBay + LBC → tracker
//
// LIENS À OUVRIR CHAQUE LUNDI :
// - https://www.interencheres.com/recherche/lots?search=pokemon
// - https://www.interencheres.com/recherche/lots?search=lego
// - https://www.interencheres.com/recherche/lots?search=console
// - https://www.interencheres.com/recherche/lots?search=iphone
// - https://www.alcopa-auction.fr/recherche?q=informatique
// - https://www.drouot.com/lots?query=collection

// ── AJOUTER UN LOT TROUVÉ ──
// Vous donnez le titre, le prix estimé, l'URL → le bot fait le reste

async function addAuctionLot(params) {
  const { title, estimation, url, dateVente, source = 'interencheres', image } = params;

  if (!title) return { error: 'Titre requis' };
  if (!estimation) return { error: 'Estimation (prix bas) requise' };

  const buyPrice = typeof estimation === 'object' ? estimation.low : estimation;

  // 1. Évaluer le prix de revente sur eBay et LBC
  const evalEbay = await priceEngine.evaluateOpportunity(title, buyPrice, '', 'ebay_fr');
  const evalLbc = await priceEngine.evaluateOpportunity(title, buyPrice, '', 'leboncoin');

  // Prendre la meilleure plateforme
  const best = evalEbay.margin >= evalLbc.margin ? { eval: evalEbay, platform: 'ebay_fr', name: 'eBay' }
    : { eval: evalLbc, platform: 'leboncoin', name: 'LeBonCoin' };

  const margin = best.eval.margin;
  const marginPct = best.eval.marginPct;
  const sellPrice = best.eval.sellPrice;

  let score = 0;
  if (marginPct >= 100) score += 4;
  else if (marginPct >= 50) score += 2;
  else if (margin > 0) score += 1;
  if (sellPrice > 0) score += 1;
  if (dateVente) score += 1; // On connaît la date = on peut planifier
  if (best.eval.marketPrice?.confidence !== 'LOW') score += 1;
  score = Math.min(10, score);

  const urgence = score >= 8 ? 'ROUGE' : score >= 6 ? 'ORANGE' : 'VERTE';
  const hash = crypto.createHash('md5').update(`auction|${title}|${url || ''}`).digest('hex');

  // 2. Générer les annonces
  const product = { title, description: `Enchère ${source}. ${title}`, price: buyPrice, images: image ? [image] : [], url };

  const bots = require('./bots');
  const listingEbay = bots.contenuGenerateListing(product, 'ebay_fr', sellPrice > 0 ? Math.round(sellPrice * 0.95) : null);
  const listingLbc = bots.contenuGenerateListing(product, 'leboncoin', sellPrice > 0 ? Math.round(sellPrice * 0.90) : null);

  // 3. Stocker en base
  const op = await db.insert('ops', {
    type: 'auction_fr',
    source,
    signal: `[${source.toUpperCase()}] ${title.slice(0, 120)} | estim ${buyPrice}€ → revente ${sellPrice}€ (marge ${margin > 0 ? '+' : ''}${Math.round(margin)}€, ${marginPct}%)`,
    score, urgence, hash,
    status: margin > 3 ? 'new' : 'refused',
    data: {
      url, image, estimation, dateVente, source,
      buyPrice, sellPrice, margin: Math.round(margin), marginPct,
      bestPlatform: best.name,
      listings: { ebay: listingEbay, lbc: listingLbc },
      evalEbay: { margin: evalEbay.margin, marginPct: evalEbay.marginPct, sellPrice: evalEbay.sellPrice },
      evalLbc: { margin: evalLbc.margin, marginPct: evalLbc.marginPct, sellPrice: evalLbc.sellPrice },
      action: margin > 3
        ? `1. Poster sur ${best.name} à ${Math.round(sellPrice * 0.95)}€ | 2. Trouver acheteur + acompte | 3. Enchérir le ${dateVente || '?'} max ${buyPrice}€ | 4. Marge: ${Math.round(margin)}€`
        : `Marge insuffisante (${marginPct}%) — passer`
    }
  });

  // 4. Sauvegarder le listing prêt si la marge est bonne
  if (margin > 3 && marginPct >= 50) {
    await db.insert('items', {
      type: 'listing_ready',
      title: `${title.slice(0, 80)} → ${best.name} ${Math.round(sellPrice * 0.95)}€`,
      score,
      status: 'ready',
      data: {
        opportunityId: op?.id,
        source, dateVente,
        listingEbay, listingLbc,
        action: `Poster eBay à ${listingEbay?.sellPrice}€ ET LBC à ${listingLbc?.sellPrice}€ → enchérir max ${buyPrice}€`
      }
    });
  }

  await db.log('hunter', 'add_auction_lot', 'auto',
    `${title.slice(0, 60)} | ${buyPrice}€ → ${sellPrice}€ | marge ${margin}€ (${marginPct}%) | ${margin > 3 ? 'ACCEPTÉ' : 'REFUSÉ'}`
  );

  return {
    accepted: margin > 3,
    title, buyPrice, sellPrice,
    margin: Math.round(margin), marginPct,
    score, urgence,
    bestPlatform: best.name,
    listings: {
      ebay: listingEbay ? { title: listingEbay.title, price: listingEbay.sellPrice, margin: listingEbay.netMargin } : null,
      lbc: listingLbc ? { title: listingLbc.title, price: listingLbc.sellPrice, margin: listingLbc.netMargin } : null,
    },
    action: margin > 3
      ? `ACCEPTÉ → poster les annonces puis enchérir max ${buyPrice}€`
      : `REFUSÉ — marge ${marginPct}% insuffisante`,
    verdict: best.eval.verdict
  };
}

// ── AJOUTER PLUSIEURS LOTS D'UN COUP ──

async function addMultipleLots(lots) {
  const results = [];
  for (const lot of lots) {
    const result = await addAuctionLot(lot);
    results.push(result);
  }
  const accepted = results.filter(r => r.accepted);
  await db.log('hunter', 'batch_auction_lots', 'auto', `${lots.length} lots → ${accepted.length} acceptés`);
  return { total: lots.length, accepted: accepted.length, refused: lots.length - accepted.length, results };
}

// ── LIENS À SCANNER (pour le rappel hebdo) ──

const AUCTION_LINKS = [
  { site: 'Interenchères', searches: [
    { label: 'Pokemon', url: 'https://www.interencheres.com/recherche/lots?search=pokemon' },
    { label: 'LEGO', url: 'https://www.interencheres.com/recherche/lots?search=lego' },
    { label: 'Console jeux', url: 'https://www.interencheres.com/recherche/lots?search=console+jeux' },
    { label: 'iPhone', url: 'https://www.interencheres.com/recherche/lots?search=iphone' },
    { label: 'Figurines', url: 'https://www.interencheres.com/recherche/lots?search=figurine+collection' },
    { label: 'Appareil photo', url: 'https://www.interencheres.com/recherche/lots?search=appareil+photo' },
    { label: 'Outillage', url: 'https://www.interencheres.com/recherche/lots?search=makita+dewalt' },
  ]},
  { site: 'Alcopa Auction', searches: [
    { label: 'Informatique', url: 'https://www.alcopa-auction.fr/recherche?q=informatique' },
    { label: 'Outillage', url: 'https://www.alcopa-auction.fr/recherche?q=outillage' },
    { label: 'Loisirs', url: 'https://www.alcopa-auction.fr/recherche?q=loisirs' },
  ]},
  { site: 'Drouot', searches: [
    { label: 'Collection', url: 'https://www.drouot.com/lots?query=collection+jouets' },
    { label: 'Photographie', url: 'https://www.drouot.com/lots?query=photographie' },
  ]}
];

function getWeeklyLinks() { return AUCTION_LINKS; }

module.exports = { addAuctionLot, addMultipleLots, getWeeklyLinks, AUCTION_LINKS };

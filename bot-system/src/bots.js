const db = require('./db');
const sources = require('./sources');
const web3 = require('./web3-sources');
const lbc = require('./lbc-scanner');
const defi = require('./defi-actions');
const priceEngine = require('./price-engine');
const strategy = require('./strategy');

// ============================================================
// HELPER : trouver la niche correspondant à un keyword
// ============================================================

function findNicheForKeyword(keyword) {
  const kw = keyword.toLowerCase();
  for (const [id, n] of Object.entries(sources.NICHES)) {
    if (n.keywords.some(k => k.toLowerCase() === kw || kw.includes(k.toLowerCase()))) {
      return { id, ...n };
    }
  }
  return null;
}

// ============================================================
// BOT VEILLE · 100% JS pur, 0 LLM
// ============================================================

// Phase 1 : Filtrage marchés (lundi 6h, hebdo)
async function veilleFilterMarkets() {
  const active = sources.getActiveMarkets(7);
  await db.log('veille', 'filtrage_marches', 'auto', `${active.length} marchés actifs`);
  return active;
}

// Phase 2 : Check événements mondiaux (7h chaque matin)
async function veilleCheckEvents() {
  const articles = await sources.fetchNews();
  const scored = articles
    .map(a => ({ ...a, score: sources.scoreEvent(a), hash: sources.hashItem(a) }))
    .filter(a => a.score >= 5);

  let inserted = 0;
  for (const a of scored) {
    const exists = await db.hashExists(a.hash);
    if (exists) continue;

    const urgence = a.score >= 9 ? 'ROUGE' : a.score >= 7 ? 'ORANGE' : 'VERTE';
    await db.insert('ops', {
      type: 'evenement',
      source: 'newsapi',
      signal: a.title.slice(0, 200),
      score: a.score,
      urgence,
      hash: a.hash,
      data: { url: a.url, description: a.description }
    });
    inserted++;
  }

  await db.log('veille', 'check_evenement', 'auto', `${inserted} nouveaux événements (${articles.length} articles scannés)`);
  return { total: articles.length, new: inserted, scored: scored.length };
}

// Phase 3 : Scan différentiel (toutes les 4h)
// Utilise la sélection intelligente de niches selon le mois en cours
async function veilleScanMarkets() {
  const deals = await sources.fetchAllDeals();
  const ebayResults = [];

  // Sélection automatique des keywords selon les niches prioritaires du mois
  const keywords = sources.getSearchKeywords(15);
  for (const kw of keywords.slice(0, 8)) { // Max 8 recherches par cycle
    const niche = findNicheForKeyword(kw);
    const maxPrice = niche ? niche.priceMax : 50;
    const items = await sources.searchEbay(kw, maxPrice, 10);
    ebayResults.push(...items.map(i => ({ ...i, nicheId: niche?.id, nicheName: niche?.name })));
  }

  const allItems = [...deals, ...ebayResults];
  let inserted = 0;

  for (const item of allItems) {
    const hash = sources.hashItem(item);
    const exists = await db.hashExists(hash);
    if (exists) continue;

    // Scoring intelligent multi-critères
    let score = 4;
    // Prix bas = plus de marge potentielle
    if (item.price && item.price < 10) score += 2;
    else if (item.price && item.price < 20) score += 1;
    // Vendeur fiable
    if (item.sellerScore && item.sellerScore > 97) score += 2;
    else if (item.sellerScore && item.sellerScore > 95) score += 1;
    // Mots-clés à forte valeur dans le titre
    const title = (item.title || '').toLowerCase();
    if (/lot|bundle|pack|x\d+/i.test(title)) score += 1;
    if (/neuf|scelle|sealed|new|bnib/i.test(title)) score += 1;
    if (/vintage|retro|collector|rare|limited/i.test(title)) score += 1;
    if (/occasion|used|casse|broken|for parts/i.test(title)) score -= 1; // Risque
    score = Math.min(10, Math.max(0, score));

    if (score >= 5) {
      const urgence = score >= 9 ? 'ROUGE' : score >= 7 ? 'ORANGE' : 'VERTE';
      // Déterminer si un acheteur est identifiable
      // Un item en saison + demande haute + revente rapide = acheteur probable
      const niche = item.nicheId ? sources.NICHES[item.nicheId] : null;
      const currentMonth = new Date().getMonth() + 1;
      const inSeason = niche && niche.season ? niche.season.includes(currentMonth) : true;
      const hasBuyers = inSeason && niche && niche.demand !== 'low' && niche.speed !== 'slow';

      await db.insert('ops', {
        type: 'veille',
        source: item.source,
        signal: (item.title || '').slice(0, 200),
        score,
        urgence,
        hash,
        data: {
          url: item.url, price: item.price, seller: item.seller,
          nicheId: item.nicheId, nicheName: item.nicheName,
          buyerLikely: hasBuyers,
          buyerReason: hasBuyers
            ? `En saison + demande ${niche?.demand} + revente ${niche?.speed}`
            : 'Pas de preuve d\'acheteur — vérifier manuellement avant achat'
        }
      });
      inserted++;
    }
  }

  await db.log('veille', 'scan_differentiel', 'auto', `${inserted} nouveaux items (${allItems.length} scannés)`);
  return { total: allItems.length, new: inserted };
}

// Phase 4 : Scan Web3 + Metaverse (toutes les 4h, avec le scan classique)
async function veilleScanWeb3() {
  const data = await web3.scanWeb3();
  let inserted = 0;

  // NFTs trending avec opportunité
  for (const nft of data.nfts) {
    if (nft.score < 5) continue;
    const hash = web3.hashWeb3Item(nft);
    const exists = await db.hashExists(hash);
    if (exists) continue;
    const urgence = nft.score >= 9 ? 'ROUGE' : nft.score >= 7 ? 'ORANGE' : 'VERTE';
    await db.insert('ops', {
      type: 'web3_nft', source: 'coingecko', signal: `NFT ${nft.name} floor ${nft.floor_eur || '?'}€ (${nft.floor_7d_pct || 0}% 7j)`,
      score: nft.score, urgence, hash,
      data: { ...nft, buyerLikely: nft.volume_24h > 1, buyerReason: nft.volume_24h > 1 ? `Volume 24h: ${nft.volume_24h}` : 'Volume faible' }
    });
    inserted++;
  }

  // Yields DeFi intéressants
  for (const y of data.yields) {
    if (y.score < 6) continue;
    const hash = web3.hashWeb3Item(y);
    const exists = await db.hashExists(hash);
    if (exists) continue;
    await db.insert('ops', {
      type: 'web3_defi', source: 'defillama', signal: `${y.project} ${y.symbol} APY ${y.apy}% (TVL $${Math.round(y.tvl/1000)}K)`,
      score: y.score, urgence: y.score >= 8 ? 'ORANGE' : 'VERTE', hash,
      data: { ...y, buyerLikely: true, buyerReason: 'Yield passif — pas besoin d\'acheteur' }
    });
    inserted++;
  }

  // Metaverse lands pas chers
  for (const land of data.metaverse.slice(0, 10)) {
    const hash = web3.hashWeb3Item({ ...land, id: land.tokenId || land.coords });
    const exists = await db.hashExists(hash);
    if (exists) continue;
    await db.insert('ops', {
      type: 'web3_metaverse', source: land.source, signal: `${land.source} ${land.type} ${land.coords || land.name || ''} ${land.price_mana ? land.price_mana + ' MANA' : ''}`,
      score: 5, urgence: 'VERTE', hash,
      data: { ...land, buyerLikely: false, buyerReason: 'Marché metaverse peu liquide — vérifier manuellement' }
    });
    inserted++;
  }

  // Trending crypto (info seulement, pas d'action)
  const trendingCount = (data.trending?.coins?.length || 0) + (data.trending?.nfts?.length || 0);

  await db.log('veille', 'scan_web3', 'auto', `${inserted} opportunités Web3 (${trendingCount} trending, ${data.nfts.length} NFTs, ${data.yields.length} yields, ${data.metaverse.length} metaverse)`);
  return { inserted, trending: trendingCount, nfts: data.nfts.length, yields: data.yields.length, metaverse: data.metaverse.length };
}

// Rapport Web3 complet
async function veilleWeb3Report() {
  const [trending, yields, protocols] = await Promise.all([
    web3.cgTrending(),
    web3.dlTopYields(100000, 10),
    web3.dlProtocols(10)
  ]);
  return {
    trending_coins: trending.coins.slice(0, 5).map(c => `${c.name} (${c.symbol}) #${c.rank}`),
    trending_nfts: trending.nfts.slice(0, 5).map(n => `${n.name} floor: ${n.floor_eur || '?'}€`),
    top_yields: yields.slice(0, 5).map(y => `${y.project} ${y.symbol} ${y.apy}% APY ($${Math.round(y.tvl/1000)}K TVL)`),
    top_protocols: protocols.slice(0, 5).map(p => `${p.name} $${Math.round(p.tvl/1e6)}M TVL (${p.change_1d > 0 ? '+' : ''}${Math.round(p.change_1d || 0)}% 24h)`)
  };
}

// ============================================================
// BOT TRADER · RÈGLE ABSOLUE : PAS D'ACHAT SANS ACHETEUR
// ============================================================
//
// On n'achète JAMAIS "pour stocker". Chaque achat nécessite :
// 1. Une PREUVE que le produit se revend (ventes récentes, demande active)
// 2. Un CANAL de revente identifié (quelle plateforme, quel prix observé)
// 3. Un DÉLAI de revente réaliste (≤72h)
//
// Sans preuve d'acheteur → score plafonné à 5 → jamais d'achat autonome

const TRADER_LIMITS = {
  maxSingleOp: parseFloat(process.env.TRADER_MAX_SINGLE_OP_EUR || 20),
  maxTotal: parseFloat(process.env.TRADER_MAX_TOTAL_EUR || 50),
  maxOpenOps: parseInt(process.env.TRADER_MAX_OPEN_OPS || 3),
  maxDelayH: parseInt(process.env.TRADER_MAX_DELAY_HOURS || 72),
  stopLoss: parseFloat(process.env.TRADER_STOP_LOSS_EUR || 5)
};

// Types de preuves d'acheteur acceptées
const BUYER_PROOF_TYPES = {
  'sold_recently':    { label: 'Ventes récentes observées sur plateforme cible', weight: 3 },
  'active_demand':    { label: 'Demande active (recherches, watchlists, "je recherche")', weight: 2.5 },
  'price_gap':        { label: 'Écart de prix confirmé entre 2 plateformes', weight: 2 },
  'out_of_stock':     { label: 'Rupture de stock ailleurs = demande non satisfaite', weight: 2 },
  'direct_buyer':     { label: 'Acheteur identifié directement (message, commande)', weight: 4 },
  'trending':         { label: 'Produit viral/tendance avec volume de recherche', weight: 1.5 },
  'none':             { label: 'Aucune preuve — INTERDIT d\'acheter', weight: 0 }
};

function traderScoreOp(params) {
  const {
    prixAchat, prixReventeEstime, frais = 0,
    buyerProof = 'none',      // Type de preuve d'acheteur (OBLIGATOIRE)
    sellPlatform = null,       // Où on revend (OBLIGATOIRE)
    sellUrl = null,            // Lien vers ventes comparables (preuve)
    vitesseRevente = 5,        // Estimation 0-10
    fiabiliteVendeur = 5       // Note vendeur 0-10
  } = params;

  const margeNette = prixReventeEstime - prixAchat - frais;
  const margePct = prixAchat > 0 ? (margeNette / prixAchat) * 100 : 0;

  // Composants du score
  const margeScore = Math.min(10, margePct / 10);
  const proofWeight = BUYER_PROOF_TYPES[buyerProof]?.weight || 0;

  // Score brut
  let score = margeScore * 0.25            // 25% marge
            + vitesseRevente * 0.15        // 15% vitesse
            + proofWeight * 0.45           // 45% PREUVE D'ACHETEUR (critère dominant)
            + fiabiliteVendeur * 0.15;     // 15% fiabilité vendeur

  // PLAFOND : sans preuve d'acheteur, score max = 5 (jamais autonome)
  if (buyerProof === 'none') {
    score = Math.min(5, score);
  }

  // PLAFOND : sans plateforme de revente identifiée, score max = 4
  if (!sellPlatform) {
    score = Math.min(4, score);
  }

  // BONUS : acheteur direct identifié = +1
  if (buyerProof === 'direct_buyer') score += 1;

  // MALUS : marge négative = opération perdante
  if (margeNette <= 0) score = 0;

  score = Math.min(10, Math.max(0, Math.round(score * 10) / 10));

  return {
    score,
    margeNette: Math.round(margeNette * 100) / 100,
    margePct: Math.round(margePct),
    buyerProof,
    buyerProofLabel: BUYER_PROOF_TYPES[buyerProof]?.label,
    sellPlatform,
    sellUrl,
    canBuyAutonomous: score >= 8 && buyerProof !== 'none' && sellPlatform,
    reason: !sellPlatform ? 'REFUS: pas de plateforme de revente identifiée'
          : buyerProof === 'none' ? 'REFUS: aucune preuve d\'acheteur'
          : margeNette <= 0 ? 'REFUS: marge négative'
          : score < 6 ? 'Score trop bas'
          : score < 8 ? 'Demander validation N2'
          : 'Achat autonome autorisé'
  };
}

async function traderCheckGuardRails(prixAchat, buyerProof = 'none') {
  const openOps = await db.select('ops', { type: 'trade', status: 'open' });
  const totalEngaged = openOps.reduce((s, op) => s + parseFloat(op.prix_achat || 0), 0);

  const issues = [];
  if (openOps.length >= TRADER_LIMITS.maxOpenOps) issues.push(`Max ${TRADER_LIMITS.maxOpenOps} ops atteint`);
  if (prixAchat > TRADER_LIMITS.maxSingleOp) issues.push(`Prix ${prixAchat}€ > max ${TRADER_LIMITS.maxSingleOp}€`);
  if (totalEngaged + prixAchat > TRADER_LIMITS.maxTotal) issues.push(`Total engagé dépasserait ${TRADER_LIMITS.maxTotal}€`);
  if (buyerProof === 'none') issues.push('BLOQUANT: Aucune preuve d\'acheteur — pas d\'achat sans acheteur');

  return { ok: issues.length === 0, issues, openOps: openOps.length, totalEngaged };
}

async function traderRecordBuy(opportunityId, item, prixAchat, prixReventeEstime, frais, scoreDetails) {
  // GARDE-FOU ULTIME : refuser si pas de preuve d'acheteur
  if (!scoreDetails.buyerProof || scoreDetails.buyerProof === 'none') {
    await db.log('trader', 'achat_refuse', 'auto', 'BLOQUÉ: pas de preuve d\'acheteur', { item: item.title });
    return { error: 'REFUSÉ: pas de preuve d\'acheteur. Règle absolue: on n\'achète jamais sans savoir à qui on revend.' };
  }
  if (!scoreDetails.sellPlatform) {
    await db.log('trader', 'achat_refuse', 'auto', 'BLOQUÉ: pas de plateforme de revente', { item: item.title });
    return { error: 'REFUSÉ: aucune plateforme de revente identifiée.' };
  }

  const deadline = new Date(Date.now() + TRADER_LIMITS.maxDelayH * 3600000).toISOString();
  const op = await db.insert('ops', {
    type: 'trade',
    source: item.source || 'manual',
    signal: item.title || item.signal,
    score: Math.round(scoreDetails.score),
    status: 'open',
    prix_achat: prixAchat,
    prix_vente: prixReventeEstime,
    pnl: null,
    deadline,
    data: {
      url: item.url,
      frais,
      scoreDetails,
      opportunityId,
      buyerProof: scoreDetails.buyerProof,
      sellPlatform: scoreDetails.sellPlatform,
      sellUrl: scoreDetails.sellUrl
    }
  });
  await db.log('trader', 'achat', 'auto',
    `OP #${op?.id} score=${scoreDetails.score} prix=${prixAchat}€ preuve=${scoreDetails.buyerProof} revente=${scoreDetails.sellPlatform}`,
    { opId: op?.id }
  );
  return op;
}

async function traderRecordSell(opId, prixVente) {
  const ops = await db.select('ops', { id: opId });
  if (!ops.length) return { error: 'Opération introuvable' };
  const op = ops[0];
  const frais = op.data?.frais || 0;
  const pnl = prixVente - parseFloat(op.prix_achat) - frais;
  await db.update('ops', opId, { status: 'sold', prix_vente: prixVente, pnl: Math.round(pnl * 100) / 100 });
  await db.log('trader', 'vente', 'auto', `OP #${opId} PnL=${pnl.toFixed(2)}€`);
  return { opId, pnl: Math.round(pnl * 100) / 100 };
}

async function traderCheckDeadlines() {
  const openOps = await db.select('ops', { type: 'trade', status: 'open' });
  const alerts = [];
  for (const op of openOps) {
    if (op.deadline && new Date(op.deadline) < new Date()) {
      alerts.push({ opId: op.id, signal: op.signal, deadline: op.deadline });
      await db.log('trader', 'deadline_depassee', 'auto', `OP #${op.id} deadline dépassée`, { opId: op.id });
    }
  }
  return alerts;
}

async function traderDailyPnL() {
  const today = new Date().toISOString().slice(0, 10);
  const sold = await db.select('ops', { type: 'trade', status: 'sold' });
  const todaySold = sold.filter(op => op.ts && op.ts.startsWith(today));
  const totalPnl = todaySold.reduce((s, op) => s + parseFloat(op.pnl || 0), 0);
  const openOps = await db.select('ops', { type: 'trade', status: 'open' });
  const report = {
    date: today,
    ventes_jour: todaySold.length,
    pnl_jour: Math.round(totalPnl * 100) / 100,
    ops_ouvertes: openOps.length,
    total_engage: openOps.reduce((s, op) => s + parseFloat(op.prix_achat || 0), 0)
  };
  await db.log('trader', 'rapport_pl', 'auto', `PnL jour: ${report.pnl_jour}€`, report);
  return report;
}

// ============================================================
// BOT CLIENT · Scoring leads + gestion relances
// ============================================================

function clientScoreLead(lead) {
  const sourceScore = { 'website': 8, 'referral': 9, 'social': 6, 'cold': 3, 'ad': 5 }[lead.source] || 5;
  const completude = [lead.name, lead.email, lead.phone, lead.budget].filter(Boolean).length * 2.5;
  const budget = lead.budget > 1000 ? 9 : lead.budget > 500 ? 7 : lead.budget > 100 ? 5 : 3;
  const urgence = lead.urgent ? 8 : 5;

  const score = Math.round(sourceScore * 0.3 + completude * 0.3 + budget * 0.2 + urgence * 0.2);
  return Math.min(10, Math.max(0, score));
}

async function clientAddLead(leadData) {
  const score = clientScoreLead(leadData);
  if (score < 5) {
    await db.log('client', 'lead_archive', 'auto', `Score ${score} < 5 — archivé`);
    return { archived: true, score };
  }
  const item = await db.insert('items', {
    type: 'lead',
    title: leadData.name || 'Lead sans nom',
    score,
    status: 'new',
    data: leadData
  });
  await db.log('client', 'lead_new', 'auto', `Lead #${item?.id} score=${score}`);
  return { id: item?.id, score, status: 'new' };
}

async function clientCheckRelances() {
  const leads = await db.select('items', { type: 'lead', status: 'contacted' });
  const toRelance = [];
  for (const lead of leads) {
    if (lead.retries >= 3) {
      await db.update('items', lead.id, { status: 'archived' });
      await db.log('client', 'lead_archive_3x', 'auto', `Lead #${lead.id} archivé après 3 relances`);
      continue;
    }
    const lastContact = lead.data?.lastContact ? new Date(lead.data.lastContact) : new Date(lead.ts);
    const daysSince = (Date.now() - lastContact.getTime()) / 86400000;
    if (daysSince >= 3) {
      toRelance.push({ id: lead.id, title: lead.title, retries: lead.retries, daysSince: Math.round(daysSince) });
    }
  }
  if (toRelance.length) {
    await db.log('client', 'check_relances', 'auto', `${toRelance.length} leads à relancer`);
  }
  return toRelance;
}

// ============================================================
// BOT CONTENU · Listings + Documents + Publication auto
// ============================================================
//
// FLOW COMPLET ARBITRAGE :
// 1. Bot Veille détecte un produit à prix bas sur plateforme A
// 2. Bot Contenu scrape les infos (photos, titre, description)
// 3. Bot Contenu génère un listing optimisé pour plateforme B
// 4. Bot Contenu publie automatiquement l'annonce via Playwright
// 5. Quelqu'un achète sur B → acheteur confirmé
// 6. Bot Trader achète sur A et expédie
//
// Tout ça AVANT de dépenser 1 centime.

const { chromium } = require('playwright');

// --- SCRAPER : récupérer infos d'un produit source ---

async function contenuScrapeProduct(url) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Extraction générique (fonctionne sur la plupart des sites)
    const data = await page.evaluate(() => {
      const getText = sel => document.querySelector(sel)?.textContent?.trim() || '';
      const getAttr = (sel, attr) => document.querySelector(sel)?.getAttribute(attr) || '';

      // Titre : og:title > h1 > title
      const title = getAttr('meta[property="og:title"]', 'content')
                  || getText('h1')
                  || document.title;

      // Description : og:description > meta description > premier paragraphe
      const desc = getAttr('meta[property="og:description"]', 'content')
                || getAttr('meta[name="description"]', 'content')
                || getText('p');

      // Prix : chercher dans les formats courants
      const priceText = getText('[data-testid="price"]')
                     || getText('.price') || getText('.Price')
                     || getText('[itemprop="price"]')
                     || getText('.a-price-whole');
      const price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.')) || null;

      // Images : og:image > images produit > toutes les grandes images
      const ogImage = getAttr('meta[property="og:image"]', 'content');
      const images = [...document.querySelectorAll('img')]
        .map(img => img.src || img.dataset.src || '')
        .filter(src => src.startsWith('http') && (src.includes('photo') || src.includes('image') || src.includes('pic') || img_isBig(src)))
        .slice(0, 5);

      function img_isBig(src) {
        // Heuristique : URLs d'images produit contiennent souvent des tailles
        return /\d{3,4}x\d{3,4}|large|full|original/i.test(src);
      }

      return {
        title: title.slice(0, 200),
        description: desc.slice(0, 500),
        price,
        images: ogImage ? [ogImage, ...images] : images,
        url: window.location.href
      };
    });

    await browser.close();
    await db.log('contenu', 'scrape_product', 'auto', `Scrapé: ${data.title}`, { url });
    return data;
  } catch (e) {
    if (browser) await browser.close();
    await db.log('contenu', 'scrape_error', 'auto', e.message, { url });
    return { error: e.message, url };
  }
}

// --- GÉNÉRATEUR DE LISTING : crée l'annonce prête à poster ---

const PLATFORM_CONFIGS = {
  'ebay_fr': {
    name: 'eBay France',
    titleMax: 80,
    descMax: 4000,
    markupPct: 60,    // Marge cible par défaut
    fees: 0.13,       // ~13% frais eBay
    titlePrefix: '',
    descTemplate: (p) => `${p.title}\n\n${p.description}\n\nExpédition rapide sous 48h.\nN'hésitez pas à poser vos questions.`
  },
  'vinted': {
    name: 'Vinted',
    titleMax: 100,
    descMax: 2000,
    markupPct: 40,
    fees: 0.05,       // ~5% frais Vinted
    titlePrefix: '',
    descTemplate: (p) => `${p.description}\n\nTrès bon état. Envoi soigné.`
  },
  'leboncoin': {
    name: 'LeBonCoin',
    titleMax: 50,
    descMax: 4000,
    markupPct: 50,
    fees: 0,          // Gratuit pour le vendeur (hors options)
    titlePrefix: '',
    descTemplate: (p) => `${p.description}\n\nPrix ferme. Envoi possible.`
  },
  'facebook_mp': {
    name: 'Facebook Marketplace',
    titleMax: 100,
    descMax: 1000,
    markupPct: 45,
    fees: 0,
    titlePrefix: '',
    descTemplate: (p) => `${p.description}\n\nRemise en main propre ou envoi.`
  }
};

function contenuGenerateListing(product, sellPlatform, customPrice = null) {
  const config = PLATFORM_CONFIGS[sellPlatform];
  if (!config) return { error: `Plateforme inconnue: ${sellPlatform}. Disponibles: ${Object.keys(PLATFORM_CONFIGS).join(', ')}` };

  const buyPrice = product.price || 0;

  // Calcul prix de revente : prix achat + marge cible + frais plateforme
  const targetMargin = buyPrice * (config.markupPct / 100);
  const grossPrice = buyPrice + targetMargin;
  const platformFees = grossPrice * config.fees;
  const sellPrice = customPrice || Math.ceil(grossPrice + platformFees);

  // Marge nette réelle
  const netMargin = sellPrice - buyPrice - (sellPrice * config.fees);

  // Titre optimisé pour la plateforme
  const cleanTitle = product.title
    .replace(/\s+/g, ' ')
    .replace(/[^\w\sàâäéèêëïîôùûüç&'-]/gi, '')
    .trim();
  const title = (config.titlePrefix + cleanTitle).slice(0, config.titleMax);

  // Description
  const description = config.descTemplate(product).slice(0, config.descMax);

  const listing = {
    platform: sellPlatform,
    platformName: config.name,
    title,
    description,
    sellPrice,
    buyPrice,
    netMargin: Math.round(netMargin * 100) / 100,
    netMarginPct: buyPrice > 0 ? Math.round((netMargin / buyPrice) * 100) : 0,
    platformFees: Math.round(platformFees * 100) / 100,
    images: product.images || [],
    sourceUrl: product.url,
    status: 'draft', // draft → posted → sold → fulfilled
    createdAt: new Date().toISOString()
  };

  return listing;
}

// Générer des listings sur TOUTES les plateformes pour comparaison
function contenuGenerateAllListings(product) {
  return Object.keys(PLATFORM_CONFIGS).map(platform => {
    const listing = contenuGenerateListing(product, platform);
    return listing;
  }).sort((a, b) => (b.netMargin || 0) - (a.netMargin || 0)); // Meilleure marge en premier
}

// --- PUBLICATION AUTOMATIQUE via Playwright ---

async function contenuPublishListing(listing) {
  if (process.env.DRY_RUN !== 'false') {
    await db.log('contenu', 'publish_dryrun', 'auto', `[SIM] Publierait sur ${listing.platformName}: "${listing.title}" à ${listing.sellPrice}€`);
    return { status: 'simulated', platform: listing.platformName, title: listing.title, price: listing.sellPrice };
  }

  // Chaque plateforme a son propre flow Playwright
  const publishers = {
    'leboncoin': publishToLeBonCoin,
    'vinted': publishToVinted,
    'facebook_mp': publishToFacebookMP,
    'ebay_fr': publishToEbayFR
  };

  const publisher = publishers[listing.platform];
  if (!publisher) return { error: `Publication auto non supportée pour ${listing.platform}` };

  try {
    const result = await publisher(listing);
    await db.log('contenu', 'publish_success', 'auto', `Publié sur ${listing.platformName}: ${listing.title}`, result);

    // Sauvegarder en DB
    await db.insert('items', {
      type: 'listing',
      title: listing.title,
      status: 'posted',
      data: { ...listing, publishResult: result, status: 'posted' }
    });

    return { status: 'posted', ...result };
  } catch (e) {
    await db.log('contenu', 'publish_error', 'auto', `Erreur ${listing.platformName}: ${e.message}`);
    return { status: 'error', error: e.message, platform: listing.platformName };
  }
}

// --- Publishers par plateforme ---

async function publishToLeBonCoin(listing) {
  let browser;
  try {
    browser = await chromium.launch({ headless: false }); // Visible car login requis
    const ctx = await browser.newContext({ storageState: process.env.LBC_SESSION_FILE || undefined });
    const page = await ctx.newPage();

    await page.goto('https://www.leboncoin.fr/deposer-une-annonce', { waitUntil: 'domcontentloaded' });
    // Remplir le formulaire
    await page.fill('input[name="subject"]', listing.title);
    await page.fill('textarea[name="body"]', listing.description);
    await page.fill('input[name="price"]', String(listing.sellPrice));

    // Upload images
    if (listing.images.length > 0) {
      const fileInput = page.locator('input[type="file"]').first();
      // Télécharger les images temporairement pour upload
      for (const imgUrl of listing.images.slice(0, 3)) {
        try {
          const axios = require('axios');
          const fs = require('fs');
          const path = require('path');
          const tmpFile = path.join('/tmp', `listing-${Date.now()}.jpg`);
          const resp = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 10000 });
          fs.writeFileSync(tmpFile, resp.data);
          await fileInput.setInputFiles(tmpFile);
          fs.unlinkSync(tmpFile);
        } catch (e) { /* Image skip */ }
      }
    }

    // NE PAS cliquer "Publier" automatiquement — on attend confirmation humaine
    // Le navigateur reste ouvert pour que l'utilisateur vérifie et clique lui-même
    await db.log('contenu', 'lbc_ready', 'auto', 'Annonce prête sur LeBonCoin — vérification humaine requise');

    // Attendre que l'utilisateur ferme le navigateur
    await page.waitForTimeout(300000); // 5 min max
    await browser.close();
    return { platform: 'leboncoin', status: 'ready_for_review' };
  } catch (e) {
    if (browser) await browser.close();
    throw e;
  }
}

async function publishToVinted(listing) {
  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const ctx = await browser.newContext({ storageState: process.env.VINTED_SESSION_FILE || undefined });
    const page = await ctx.newPage();

    await page.goto('https://www.vinted.fr/items/new', { waitUntil: 'domcontentloaded' });
    await page.fill('[data-testid="title-input"], input[name="title"]', listing.title);
    await page.fill('[data-testid="description-input"], textarea[name="description"]', listing.description);
    await page.fill('[data-testid="price-input"], input[name="price"]', String(listing.sellPrice));

    await db.log('contenu', 'vinted_ready', 'auto', 'Annonce prête sur Vinted — vérification humaine requise');
    await page.waitForTimeout(300000);
    await browser.close();
    return { platform: 'vinted', status: 'ready_for_review' };
  } catch (e) {
    if (browser) await browser.close();
    throw e;
  }
}

async function publishToFacebookMP(listing) {
  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const ctx = await browser.newContext({ storageState: process.env.FB_SESSION_FILE || undefined });
    const page = await ctx.newPage();

    await page.goto('https://www.facebook.com/marketplace/create/item', { waitUntil: 'domcontentloaded' });
    // Facebook MP a des sélecteurs dynamiques, on utilise les labels
    await page.getByLabel('Titre').fill(listing.title);
    await page.getByLabel('Prix').fill(String(listing.sellPrice));
    await page.getByLabel('Description').fill(listing.description);

    await db.log('contenu', 'fb_ready', 'auto', 'Annonce prête sur Facebook MP — vérification humaine requise');
    await page.waitForTimeout(300000);
    await browser.close();
    return { platform: 'facebook_mp', status: 'ready_for_review' };
  } catch (e) {
    if (browser) await browser.close();
    throw e;
  }
}

async function publishToEbayFR(listing) {
  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const ctx = await browser.newContext({ storageState: process.env.EBAY_SESSION_FILE || undefined });
    const page = await ctx.newPage();

    await page.goto('https://www.ebay.fr/sl/sell', { waitUntil: 'domcontentloaded' });
    await page.fill('#Title', listing.title);

    await db.log('contenu', 'ebay_ready', 'auto', 'Annonce prête sur eBay FR — vérification humaine requise');
    await page.waitForTimeout(300000);
    await browser.close();
    return { platform: 'ebay_fr', status: 'ready_for_review' };
  } catch (e) {
    if (browser) await browser.close();
    throw e;
  }
}

// --- FLOW COMPLET : de l'opportunité à l'annonce publiée ---

async function contenuFullArbitrageFlow(opportunityId) {
  // 1. Récupérer l'opportunité
  const ops = await db.select('ops', { id: opportunityId });
  if (!ops.length) return { error: 'Opportunité introuvable' };
  const opp = ops[0];
  const sourceUrl = opp.data?.url;
  if (!sourceUrl) return { error: 'Pas d\'URL source dans l\'opportunité' };

  // 2. Scraper le produit source
  const product = await contenuScrapeProduct(sourceUrl);
  if (product.error) return { error: `Scrape échoué: ${product.error}` };

  // 3. Générer des listings sur toutes les plateformes
  const listings = contenuGenerateAllListings(product);

  // 4. Identifier la meilleure plateforme (marge nette max)
  const best = listings[0];

  // 5. Sauvegarder en DB
  await db.insert('items', {
    type: 'listing_draft',
    title: product.title,
    status: 'draft',
    data: {
      opportunityId,
      sourceUrl,
      product,
      listings,
      bestPlatform: best.platform,
      bestMargin: best.netMargin
    }
  });

  // 6. Mettre à jour le statut de l'opportunité
  await db.update('ops', opportunityId, { status: 'listing_created' });

  await db.log('contenu', 'arbitrage_flow', 'auto',
    `Listings générés pour "${product.title}" — meilleur: ${best.platformName} à ${best.sellPrice}€ (marge ${best.netMargin}€)`,
    { opportunityId }
  );

  return {
    product: { title: product.title, price: product.price, images: product.images.length },
    listings: listings.map(l => ({
      platform: l.platformName,
      sellPrice: l.sellPrice,
      netMargin: l.netMargin,
      netMarginPct: l.netMarginPct
    })),
    best: {
      platform: best.platformName,
      sellPrice: best.sellPrice,
      netMargin: best.netMargin,
      action: `Publier sur ${best.platformName} à ${best.sellPrice}€ → marge nette ${best.netMargin}€`
    }
  };
}

// --- Anciens helpers conservés ---

async function contenuAddDocument(type, title, data = {}) {
  const item = await db.insert('items', { type, title, status: 'draft', data });
  await db.log('contenu', `new_${type}`, 'auto', `Doc #${item?.id}: ${title}`);
  return item;
}

async function contenuList(type = null) {
  const filters = type ? { type } : {};
  return db.select('items', filters, { order: 'ts', limit: 50 });
}

async function contenuUpdateStatus(id, status) {
  await db.update('items', id, { status });
  await db.log('contenu', 'update_status', 'auto', `Doc #${id} → ${status}`);
}

// ============================================================
// STATS NICHES (pour dashboard)
// ============================================================

function veilleNicheStats() {
  return sources.getNicheStats();
}

function veilleTopNiches(max = 15) {
  return sources.getNichesToScan(max).map(n => ({
    id: n.id, name: n.name, cat: n.cat,
    margin: n.margin, speed: n.speed, demand: n.demand,
    score: n.score, strategy: n.strategy,
    keywords: n.keywords.length,
    seasonal: n.season ? `mois ${n.season.join(',')}` : 'toute année',
    ...(n.strategy === 'buy_low' ? { sellIn: n.sellIn, monthsUntilSeason: n.monthsUntilSeason } : {})
  }));
}

// Niches avec acheteurs actifs MAINTENANT (arbitrage rapide uniquement)
function veilleArbitrageNiches(max = 10) {
  const month = new Date().getMonth() + 1;
  return sources.getNichesToScan(max).map(n => {
    const inSeason = n.season ? n.season.includes(month) : true;
    return {
      id: n.id, name: n.name, cat: n.cat, score: n.score,
      margin: n.margin, speed: n.speed, demand: n.demand,
      keywords: n.keywords.slice(0, 3),
      buyersActive: inSeason && n.demand !== 'low' && n.speed !== 'slow',
      tip: inSeason
        ? `Acheteurs actifs ce mois → arbitrage rapide possible`
        : `Hors saison → PEU d'acheteurs → arbitrage risqué`
    };
  });
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Veille
  veilleFilterMarkets, veilleCheckEvents, veilleScanMarkets,
  veilleScanWeb3, veilleWeb3Report,
  veilleScanLBC: () => lbc.scanLBC(5),
  defiActions: (p) => defi.getActionableYields(p?.minScore || 6, p?.max || 10),
  defiSimulation: (p) => defi.defiSimulation(p?.capital || 100),
  evaluateProduct: (p) => priceEngine.evaluateOpportunity(p.title, p.price, p.description, p.platform, { fastFlip: p.fastFlip, confirmedBuyer: p.confirmedBuyer, sellPrice: p.sellPrice }),
  parseProduct: (p) => priceEngine.parseProduct(p.title, p.description),
  // Stratégie
  getStrategy: (p) => strategy.getStrategy(p?.capital),
  getWeekPlan: (p) => strategy.getWeekPlan(p?.week),
  getOperation: (p) => strategy.getOperationDetail(p?.id),
  getProjection: (p) => strategy.getMonthProjection(p?.capital, p?.flips, p?.margin),
  veilleNicheStats, veilleTopNiches, veilleArbitrageNiches,
  BUYER_PROOF_TYPES,
  // Trader
  traderScoreOp, traderCheckGuardRails, traderRecordBuy, traderRecordSell,
  traderCheckDeadlines, traderDailyPnL, TRADER_LIMITS,
  // Client
  clientScoreLead, clientAddLead, clientCheckRelances,
  // Contenu
  contenuAddDocument, contenuList, contenuUpdateStatus,
  contenuScrapeProduct, contenuGenerateListing, contenuGenerateAllListings,
  contenuPublishListing, contenuFullArbitrageFlow,
  PLATFORM_CONFIGS
};

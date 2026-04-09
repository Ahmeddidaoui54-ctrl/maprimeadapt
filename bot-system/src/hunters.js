const { chromium } = require('playwright');
const crypto = require('crypto');
const db = require('./db');
const priceEngine = require('./price-engine');

// ============================================================
// HUNTERS · Les bots trouvent les opportunités EUX-MÊMES
// ============================================================
//
// Le user ne cherche rien. Les bots scannent, évaluent, et remontent
// uniquement les affaires qui passent la grille (≥50% ou fast flip).
//
// Plateformes scannées :
// - Vinted (session Playwright)
// - eBay FR (session Playwright)
// - Facebook Marketplace (session Playwright)
// - Dealabs RSS (gratuit)
//
// Chaque hunter : scrape → parse produit → évalue marge → stocke si ≥50%

const TIMEOUT = 15000;

// ── RECHERCHES PAR PLATEFORME ──
// Les meilleures niches avec les termes exacts de chaque plateforme

// ── RECHERCHES BASÉES SUR L'ÉTUDE DE MARCHÉ RÉELLE (avril 2026) ──
// Données vérifiées : prix réels, sell-through, marges observées
// Classées par rentabilité décroissante

const HUNT_QUERIES = [
  // ═══ TIER 1 : MARGE 200%+ (brocante → marketplace) ═══
  // Jouets vintage : achat 1-5€ brocante → revente 10-50€ eBay
  { q: 'majorette voiture lot', max: 10, niche: 'vintage_toys' },
  { q: 'dinky toys', max: 15, niche: 'vintage_toys' },
  { q: 'jouet vintage lot', max: 10, niche: 'vintage_toys' },
  // POP MART / Labubu : figure secrète 15€ → 50-200€
  { q: 'pop mart labubu', max: 25, niche: 'pop_mart' },
  { q: 'pop mart figure secrete', max: 30, niche: 'pop_mart' },
  { q: 'pop mart dimoo', max: 20, niche: 'pop_mart' },
  // Longchamp brocante : 10-25€ → 30-60€
  { q: 'sac longchamp pliage', max: 25, niche: 'longchamp' },

  // ═══ TIER 2 : MARGE 100-200% (collectibles forte demande) ═══
  // Pokemon : 30 ans en 2026, marché massif
  { q: 'lot carte pokemon ancienne', max: 30, niche: 'pokemon' },
  { q: 'carte pokemon 1ere edition', max: 50, niche: 'pokemon' },
  { q: 'booster pokemon scellé français', max: 40, niche: 'pokemon' },
  { q: 'display pokemon neuf scellé', max: 50, niche: 'pokemon' },
  { q: 'carte pokemon holo rare', max: 20, niche: 'pokemon' },
  // Funko Pop exclusive/vaulted : 12-18€ → 30-150€
  { q: 'funko pop chase', max: 20, niche: 'funko' },
  { q: 'funko pop exclusive convention', max: 25, niche: 'funko' },
  { q: 'funko pop vaulted', max: 20, niche: 'funko' },
  // Puériculture premium : Stokke brocante 30-60€ → 120-180€
  { q: 'stokke tripp trapp occasion', max: 70, niche: 'puericulture' },
  { q: 'babyzen yoyo occasion', max: 50, niche: 'puericulture' },
  // Rameur : occasion 80€ → 160€
  { q: 'rameur domyos occasion', max: 50, niche: 'fitness' },

  // ═══ TIER 3 : MARGE 50-100% (mode seconde main, sell-through élevé) ═══
  // Nike AF1 : 61% sell-through Vinted, friperie 5-15€ → 25-45€
  { q: 'nike air force 1 occasion', max: 20, niche: 'sneakers' },
  // New Balance 530 : meilleur sell-through Vinted (61%)
  { q: 'new balance 530 occasion', max: 30, niche: 'sneakers' },
  // Doc Martens : 30-60€ → 70-120€
  { q: 'doc martens 1460 occasion', max: 50, niche: 'doc_martens' },
  // North Face Nuptse : achat été 80-120€ → revente hiver 150-220€
  { q: 'north face nuptse occasion', max: 50, niche: 'north_face' },

  // ═══ TIER 4 : LEGO RETIRÉS (marge 35-600%, patience requise) ═══
  { q: 'lego star wars retiré neuf scellé', max: 50, niche: 'lego' },
  { q: 'lego technic neuf scellé', max: 50, niche: 'lego' },
  { q: 'lego creator expert retiré', max: 50, niche: 'lego' },
  { q: 'lego pokemon neuf', max: 50, niche: 'lego' },
  { q: 'lego modular neuf scellé', max: 50, niche: 'lego' },

  // ═══ TIER 5 : TECH (fast flip uniquement, décote rapide) ═══
  // iPhone 14 : Back Market 270€ → LBC 350-400€
  { q: 'iphone 14 occasion', max: 50, niche: 'tech' },
  // Dyson Airwrap : occasion 150-200€ → 300-375€
  { q: 'dyson airwrap occasion', max: 50, niche: 'tech' },

  // ═══ CONSOMMABLES (marge 200-800%, achat indispensable) ═══
  { q: 'telecommande samsung neuf lot', max: 8, niche: 'consommable' },
  { q: 'telecommande portail lot', max: 10, niche: 'consommable' },
  { q: 'cartouche hp 302 304 lot neuf', max: 12, niche: 'consommable' },
  { q: 'plateau micro ondes verre', max: 8, niche: 'consommable' },
];

// ── RECHERCHES ENCHÈRES eBay ──
// Articles mis en ligne AVANT que l'enchère commence
// = temps de poster une annonce et trouver un acheteur avec acompte

// ── ENCHÈRES : mêmes produits, triés par marge vérifiée ──
const AUCTION_QUERIES = [
  // Pokemon (forte demande enchères, 30 ans en 2026)
  { q: 'lot carte pokemon', niche: 'pokemon' },
  { q: 'carte pokemon 1ere edition', niche: 'pokemon' },
  { q: 'display pokemon scellé', niche: 'pokemon' },
  { q: 'booster pokemon ancien', niche: 'pokemon' },
  // LEGO retirés (les enchères partent souvent sous le prix marché)
  { q: 'lego star wars neuf', niche: 'lego' },
  { q: 'lego technic neuf', niche: 'lego' },
  { q: 'lego creator expert', niche: 'lego' },
  // Collectibles (Funko, POP MART, figurines)
  { q: 'funko pop lot', niche: 'funko' },
  { q: 'pop mart labubu', niche: 'pop_mart' },
  { q: 'figurine collection lot', niche: 'collectibles' },
  // Puériculture (Stokke, Babyzen en enchères = très bon prix)
  { q: 'poussette babyzen', niche: 'puericulture' },
  { q: 'stokke tripp trapp', niche: 'puericulture' },
  // Tech (iPhone, Dyson en enchères = prix cassés)
  { q: 'iphone 14 15', niche: 'tech' },
  { q: 'dyson airwrap', niche: 'tech' },
];

// ── SCANNER VINTED ──

async function huntVinted(maxSearches = 8) {
  const sessionFile = process.env.VINTED_SESSION_FILE;
  let browser, results = [];

  try {
    browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
    const ctx = await browser.newContext(sessionFile ? { storageState: sessionFile } : {});
    const page = await ctx.newPage();

    // Sélectionner les recherches aléatoirement
    const searches = [...HUNT_QUERIES].sort(() => Math.random() - 0.5).slice(0, maxSearches);

    for (const search of searches) {
      try {
        const url = `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(search.q)}&price_to=${search.max}&order=newest_first&status_ids[]=1&status_ids[]=2`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        await page.waitForTimeout(2000 + Math.random() * 2000); // Anti-détection

        const items = await page.evaluate(() => {
          const ads = document.querySelectorAll('[data-testid*="grid-item"], .feed-grid__item, .ItemBox_overlay__');
          const results = [];
          ads.forEach(ad => {
            const container = ad.closest('a') || ad.querySelector('a') || ad;
            const titleEl = ad.querySelector('[data-testid*="description"], .ItemBox_title__, p');
            const priceEl = ad.querySelector('[data-testid*="price"], .ItemBox_price__, span');
            const imgEl = ad.querySelector('img');
            const href = container.getAttribute?.('href') || '';

            const title = titleEl?.textContent?.trim() || '';
            const priceText = priceEl?.textContent?.trim() || '';
            const price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.')) || null;
            const image = imgEl?.src || '';

            if (title && price && price > 0) {
              results.push({
                title, price,
                url: href.startsWith('/') ? 'https://www.vinted.fr' + href : href,
                image
              });
            }
          });
          return results.slice(0, 10);
        });

        results.push(...items.map(i => ({ ...i, source: 'vinted', niche: search.niche, query: search.q })));
      } catch (e) {
        // Skip cette recherche, continuer
      }
    }

    await browser.close();
  } catch (e) {
    if (browser) await browser.close();
    console.error('[HUNT-VINTED]', e.message);
  }

  return results;
}

// ── SCANNER EBAY FR ──

async function huntEbay(maxSearches = 8) {
  const sessionFile = process.env.EBAY_SESSION_FILE;
  let browser, results = [];

  try {
    browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
    const ctx = await browser.newContext(sessionFile ? { storageState: sessionFile } : {});
    const page = await ctx.newPage();

    const searches = [...HUNT_QUERIES].sort(() => Math.random() - 0.5).slice(0, maxSearches);

    for (const search of searches) {
      try {
        const url = `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent(search.q)}&_sop=10&LH_BIN=1&_udhi=${search.max}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        await page.waitForTimeout(1500 + Math.random() * 1500);

        const items = await page.evaluate(() => {
          const ads = document.querySelectorAll('.s-item');
          const results = [];
          ads.forEach(ad => {
            const titleEl = ad.querySelector('.s-item__title span, .s-item__title');
            const priceEl = ad.querySelector('.s-item__price');
            const linkEl = ad.querySelector('.s-item__link');
            const imgEl = ad.querySelector('.s-item__image-wrapper img');

            const title = titleEl?.textContent?.trim() || '';
            const priceText = priceEl?.textContent?.trim() || '';
            const price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.')) || null;
            const url = linkEl?.getAttribute('href') || '';
            const image = imgEl?.src || '';

            if (title && price && price > 0 && !title.includes('Shop on eBay')) {
              results.push({ title, price, url, image });
            }
          });
          return results.slice(0, 10);
        });

        results.push(...items.map(i => ({ ...i, source: 'ebay', niche: search.niche, query: search.q })));
      } catch (e) { /* skip */ }
    }

    await browser.close();
  } catch (e) {
    if (browser) await browser.close();
    console.error('[HUNT-EBAY]', e.message);
  }

  return results;
}

// ── SCANNER FACEBOOK MP ──

async function huntFacebook(maxSearches = 5) {
  const sessionFile = process.env.FB_SESSION_FILE;
  let browser, results = [];

  try {
    browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
    const ctx = await browser.newContext(sessionFile ? { storageState: sessionFile } : {});
    const page = await ctx.newPage();

    const searches = [...HUNT_QUERIES].sort(() => Math.random() - 0.5).slice(0, maxSearches);

    for (const search of searches) {
      try {
        const url = `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent(search.q)}&maxPrice=${search.max}&sortBy=creation_time_descend`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        await page.waitForTimeout(3000 + Math.random() * 2000);

        const items = await page.evaluate(() => {
          const ads = document.querySelectorAll('[data-testid="marketplace_feed_item"], a[href*="/marketplace/item/"]');
          const results = [];
          ads.forEach(ad => {
            const texts = ad.querySelectorAll('span');
            let title = '', price = null;
            texts.forEach(t => {
              const txt = t.textContent.trim();
              if (txt.includes('€') && !price) price = parseFloat(txt.replace(/[^\d.,]/g, '').replace(',', '.'));
              else if (txt.length > 5 && txt.length < 100 && !title) title = txt;
            });
            const href = ad.getAttribute?.('href') || ad.closest('a')?.getAttribute('href') || '';
            if (title && price && price > 0) {
              results.push({
                title, price,
                url: href.startsWith('/') ? 'https://www.facebook.com' + href : href,
              });
            }
          });
          return results.slice(0, 8);
        });

        results.push(...items.map(i => ({ ...i, source: 'facebook', niche: search.niche, query: search.q })));
      } catch (e) { /* skip */ }
    }

    await browser.close();
  } catch (e) {
    if (browser) await browser.close();
    console.error('[HUNT-FB]', e.message);
  }

  return results;
}

// ============================================================
// HUNT COMPLET : scanner → évaluer → stocker les bonnes affaires
// ============================================================

async function huntAll(platforms = ['vinted', 'ebay', 'facebook']) {
  const allItems = [];
  const report = { scanned: 0, evaluated: 0, opportunities: 0, refused: 0, errors: 0 };

  // 1. Scanner les plateformes
  if (platforms.includes('vinted')) {
    const v = await huntVinted(6);
    allItems.push(...v);
    await db.log('hunter', 'scan_vinted', 'auto', `${v.length} produits trouvés`);
  }
  if (platforms.includes('ebay')) {
    const e = await huntEbay(6);
    allItems.push(...e);
    await db.log('hunter', 'scan_ebay', 'auto', `${e.length} produits trouvés`);
  }
  if (platforms.includes('facebook')) {
    const f = await huntFacebook(4);
    allItems.push(...f);
    await db.log('hunter', 'scan_facebook', 'auto', `${f.length} produits trouvés`);
  }

  report.scanned = allItems.length;

  // 2. Dédupliquer
  const seen = new Set();
  const unique = allItems.filter(item => {
    const hash = crypto.createHash('md5').update(`${item.source}|${item.title}|${item.price}`).digest('hex');
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });

  // 3. Évaluer chaque produit
  for (const item of unique) {
    const hash = crypto.createHash('md5').update(`hunt|${item.title}|${item.url}`).digest('hex');
    const exists = await db.hashExists(hash);
    if (exists) continue;

    try {
      // Évaluer : trouver le prix de revente sur une AUTRE plateforme
      const sellPlatform = item.source === 'vinted' ? 'ebay_fr'
                         : item.source === 'ebay' ? 'leboncoin'
                         : 'ebay_fr';

      const evaluation = await priceEngine.evaluateOpportunity(
        item.title, item.price, '', sellPlatform
      );
      report.evaluated++;

      // Ne garder que si marge ≥ 50%
      if (evaluation.marginPct >= 50 && evaluation.margin > 3) {
        report.opportunities++;
        const urgence = evaluation.marginPct >= 200 ? 'ROUGE'
                      : evaluation.marginPct >= 100 ? 'ORANGE'
                      : 'VERTE';

        await db.insert('ops', {
          type: 'hunt',
          source: item.source,
          signal: `${item.title.slice(0, 150)} — ${item.price}€ → ${evaluation.sellPrice}€ (${evaluation.marginPct}%)`,
          score: evaluation.score,
          urgence,
          hash,
          status: 'new',
          data: {
            url: item.url,
            image: item.image,
            price: item.price,
            niche: item.niche,
            query: item.query,
            evaluation,
            sellPlatform,
            buyerLikely: evaluation.buyerProof !== 'none',
            buyerReason: evaluation.buyerProof !== 'none'
              ? `Prix marché ${evaluation.sellPrice}€ confirmé (${evaluation.marketPrice.source})`
              : 'Vérifier manuellement'
          }
        });
      } else {
        report.refused++;
      }
    } catch (e) {
      report.errors++;
    }
  }

  await db.log('hunter', 'hunt_complete', 'auto',
    `Scannés: ${report.scanned} | Évalués: ${report.evaluated} | Opportunités ≥50%: ${report.opportunities} | Refusés: ${report.refused}`
  );

  return report;
}

// ============================================================
// SCANNER ENCHÈRES eBay · Le vrai avantage
// ============================================================
//
// STRATÉGIE :
// 1. Trouver les enchères qui commencent (nouvellement listées)
// 2. Le produit est visible AVANT que le prix monte
// 3. On poste une annonce au prix marché sur une autre plateforme
// 4. Un acheteur se manifeste et verse un acompte
// 5. On enchérit (ou achète en "Achat immédiat" si disponible)
// 6. On livre → profit
//
// L'enchère nous donne du TEMPS. Le prix de départ est souvent bas.
// On connaît le prix final moyen grâce au price engine.

async function huntAuctions(maxSearches = 8) {
  const sessionFile = process.env.EBAY_SESSION_FILE;
  let browser, results = [];

  try {
    browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
    const ctx = await browser.newContext(sessionFile ? { storageState: sessionFile } : {});
    const page = await ctx.newPage();

    const searches = [...AUCTION_QUERIES].sort(() => Math.random() - 0.5).slice(0, maxSearches);

    for (const search of searches) {
      try {
        // _sop=10 = nouvellement listé, LH_Auction=1 = enchères uniquement
        const url = `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent(search.q)}&_sop=10&LH_Auction=1`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        await page.waitForTimeout(1500 + Math.random() * 1500);

        const items = await page.evaluate(() => {
          const ads = document.querySelectorAll('.s-item');
          const results = [];
          ads.forEach(ad => {
            const titleEl = ad.querySelector('.s-item__title span, .s-item__title');
            const priceEl = ad.querySelector('.s-item__price');
            const linkEl = ad.querySelector('.s-item__link');
            const imgEl = ad.querySelector('.s-item__image-wrapper img');
            const timeEl = ad.querySelector('.s-item__time-left, .s-item__time');
            const bidsEl = ad.querySelector('.s-item__bids');

            const title = titleEl?.textContent?.trim() || '';
            const priceText = priceEl?.textContent?.trim() || '';
            const price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.')) || null;
            const url = linkEl?.getAttribute('href') || '';
            const image = imgEl?.src || '';
            const timeLeft = timeEl?.textContent?.trim() || '';
            const bids = parseInt(bidsEl?.textContent?.replace(/[^\d]/g, '') || '0');

            if (title && price && price > 0 && !title.includes('Shop on eBay')) {
              results.push({ title, price, url, image, timeLeft, bids });
            }
          });
          return results.slice(0, 15);
        });

        results.push(...items.map(i => ({
          ...i,
          source: 'ebay_auction',
          niche: search.niche,
          query: search.q,
          type: 'auction'
        })));
      } catch (e) { /* skip */ }
    }

    await browser.close();
  } catch (e) {
    if (browser) await browser.close();
    console.error('[HUNT-AUCTION]', e.message);
  }

  return results;
}

// ── ÉVALUER LES ENCHÈRES ──
// Prix actuel = prix de départ (souvent très bas)
// Prix final estimé = prix marché du price engine
// Marge = prix de vente (notre annonce) - prix final estimé de l'enchère

async function processAuctions(auctions) {
  const opportunities = [];

  for (const item of auctions) {
    const hash = crypto.createHash('md5').update(`auction|${item.title}|${item.url}`).digest('hex');
    const exists = await db.hashExists(hash);
    if (exists) continue;

    // Évaluer le prix marché du produit
    const evaluation = await priceEngine.evaluateOpportunity(
      item.title, item.price, '', 'leboncoin' // On revend sur LBC (0% frais)
    );

    // Le prix actuel de l'enchère est le prix de DÉPART, pas le prix final
    // On estime le prix final à 60-80% du prix marché
    const estimatedFinal = evaluation.sellPrice ? Math.round(evaluation.sellPrice * 0.7) : null;
    const ourSellPrice = evaluation.sellPrice || 0;
    const estimatedMargin = estimatedFinal ? ourSellPrice - estimatedFinal : null;
    const estimatedMarginPct = estimatedFinal && estimatedFinal > 0 ? Math.round((estimatedMargin / estimatedFinal) * 100) : 0;

    // Temps restant = notre fenêtre pour trouver un acheteur
    const hasTime = item.timeLeft && (
      item.timeLeft.includes('j') || // jours
      item.timeLeft.includes('d') || // days
      item.timeLeft.includes('h') && parseInt(item.timeLeft) > 6 // > 6h
    );

    // Peu d'enchères = prix final sera bas
    const lowBids = item.bids <= 2;

    let score = 0;
    if (estimatedMarginPct >= 100) score += 3;
    else if (estimatedMarginPct >= 50) score += 2;
    else if (estimatedMarginPct > 0) score += 1;
    if (hasTime) score += 2; // Temps pour trouver acheteur
    if (lowBids) score += 2; // Peu de concurrence
    if (evaluation.marketPrice?.confidence !== 'LOW') score += 1;
    if (item.price < 10) score += 1; // Prix de départ très bas
    score = Math.min(10, score);

    if (score >= 5 && estimatedMargin > 3) {
      const urgence = score >= 9 ? 'ROUGE' : score >= 7 ? 'ORANGE' : 'VERTE';

      const op = await db.insert('ops', {
        type: 'auction',
        source: 'ebay_auction',
        signal: `ENCHÈRE ${item.title.slice(0, 120)} — départ ${item.price}€ | final estimé ~${estimatedFinal}€ | revente ${ourSellPrice}€ | ${item.bids} enchère(s) | ${item.timeLeft}`,
        score, urgence, hash,
        status: 'new',
        data: {
          url: item.url,
          image: item.image,
          currentPrice: item.price,
          estimatedFinal,
          ourSellPrice,
          estimatedMargin,
          estimatedMarginPct,
          bids: item.bids,
          timeLeft: item.timeLeft,
          niche: item.niche,
          hasTime,
          lowBids,
          evaluation,
          action: hasTime
            ? `1. Poster annonce à ${ourSellPrice}€ maintenant | 2. Trouver acheteur + acompte | 3. Enchérir jusqu'à ${estimatedFinal}€ max | 4. Marge estimée: ${estimatedMargin}€`
            : `Peu de temps restant — fast flip si acheteur immédiat`
        }
      });
      opportunities.push(op);
    }
  }

  return opportunities;
}

// ── HUNT COMPLET AVEC ENCHÈRES ──

async function huntAllWithAuctions(platforms = ['vinted', 'ebay', 'facebook']) {
  const report = await huntAll(platforms);

  // Scanner les enchères en plus
  const auctions = await huntAuctions(8);
  await db.log('hunter', 'scan_auctions', 'auto', `${auctions.length} enchères trouvées`);

  const auctionOps = await processAuctions(auctions);
  report.auctions = auctions.length;
  report.auctionOpportunities = auctionOps.length;

  await db.log('hunter', 'hunt_full', 'auto',
    `Produits: ${report.scanned} | Enchères: ${auctions.length} | Opportunités totales: ${report.opportunities + auctionOps.length}`
  );

  return report;
}

module.exports = {
  huntVinted, huntEbay, huntFacebook, huntAuctions,
  huntAll, huntAllWithAuctions, processAuctions,
  HUNT_QUERIES, AUCTION_QUERIES
};

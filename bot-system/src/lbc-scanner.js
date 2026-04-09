const { chromium } = require('playwright');
const crypto = require('crypto');
const db = require('./db');

// ============================================================
// SCANNER LEBONCOIN · Playwright · Session sauvegardée
// ============================================================

const LBC_BASE = 'https://www.leboncoin.fr';

// Catégories LBC mappées aux niches du système
const LBC_SEARCHES = [
  // Tech
  { query: 'iphone occasion', cat: 'telephones', maxPrice: 50, niche: 'smartphones' },
  { query: 'macbook', cat: 'informatique', maxPrice: 50, niche: 'laptops' },
  { query: 'nintendo switch', cat: 'consoles', maxPrice: 50, niche: 'gaming' },
  { query: 'ps5', cat: 'consoles', maxPrice: 50, niche: 'gaming' },
  { query: 'appareil photo argentique', cat: 'image_son', maxPrice: 40, niche: 'vintage_cameras' },
  { query: 'calculatrice graphique', cat: 'informatique', maxPrice: 20, niche: 'boring_tech' },
  // Mode
  { query: 'nike dunk', cat: 'chaussures', maxPrice: 50, niche: 'sneakers_limited' },
  { query: 'jordan 1', cat: 'chaussures', maxPrice: 50, niche: 'sneakers_limited' },
  { query: 'levis 501 vintage', cat: 'vetements', maxPrice: 25, niche: 'denim' },
  { query: 'sezane', cat: 'vetements', maxPrice: 40, niche: 'women_premium' },
  { query: 'dr martens', cat: 'chaussures', maxPrice: 40, niche: 'luxury_shoes' },
  // Collectibles
  { query: 'lego star wars neuf', cat: 'jeux_jouets', maxPrice: 50, niche: 'lego' },
  { query: 'carte pokemon', cat: 'jeux_jouets', maxPrice: 30, niche: 'trading_cards' },
  { query: 'funko pop', cat: 'jeux_jouets', maxPrice: 20, niche: 'funko_figurines' },
  // Maison
  { query: 'le creuset', cat: 'ameublement', maxPrice: 30, niche: 'vintage_kitchen' },
  { query: 'dyson aspirateur', cat: 'electromenager', maxPrice: 50, niche: 'vacuum' },
  { query: 'kitchenaid', cat: 'electromenager', maxPrice: 50, niche: 'kitchen_appliances' },
  { query: 'thermomix', cat: 'electromenager', maxPrice: 50, niche: 'kitchen_appliances' },
  // Outils
  { query: 'makita', cat: 'outillage', maxPrice: 40, niche: 'power_tools' },
  { query: 'dewalt', cat: 'outillage', maxPrice: 40, niche: 'power_tools' },
  // Musique
  { query: 'guitare fender', cat: 'instruments_de_musique', maxPrice: 50, niche: 'guitars' },
  // Sport
  { query: 'velo electrique', cat: 'velos', maxPrice: 50, niche: 'cycling' },
  // Pièces détachées (mine d'or)
  { query: 'cartouche encre neuve', cat: 'informatique', maxPrice: 15, niche: 'printer_ink' },
  { query: 'telecommande', cat: 'image_son', maxPrice: 10, niche: 'remotes' },
  // Luxe
  { query: 'sac louis vuitton', cat: 'accessoires_bagagerie', maxPrice: 50, niche: 'luxury_bags' },
  { query: 'montre seiko', cat: 'montres_bijoux', maxPrice: 50, niche: 'watches' },
];

async function scrapeLBC(searchConfig, sessionFile) {
  let browser;
  try {
    const storageState = sessionFile || process.env.LBC_SESSION_FILE;
    browser = await chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled']
    });
    const context = await browser.newContext(storageState ? { storageState } : {});
    const page = await context.newPage();

    const url = `${LBC_BASE}/recherche?text=${encodeURIComponent(searchConfig.query)}&price=0-${searchConfig.maxPrice}&sort=time&owner_type=private`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const items = await page.evaluate(() => {
      const results = [];
      const ads = document.querySelectorAll('[data-qa-id="aditem_container"], a[data-test-id="ad"]');
      ads.forEach(ad => {
        const titleEl = ad.querySelector('[data-qa-id="aditem_title"], [data-test-id="ad-subject"]') || ad.querySelector('p, span');
        const priceEl = ad.querySelector('[data-qa-id="aditem_price"], [data-test-id="ad-price"]') || ad.querySelector('.price, span[aria-label]');
        const linkEl = ad.closest('a') || ad.querySelector('a');
        const imgEl = ad.querySelector('img');

        const title = titleEl?.textContent?.trim() || '';
        const priceText = priceEl?.textContent?.trim() || '';
        const price = parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.')) || null;
        const href = linkEl?.getAttribute('href') || '';
        const image = imgEl?.src || '';

        if (title && price) {
          results.push({ title, price, url: href.startsWith('/') ? 'https://www.leboncoin.fr' + href : href, image });
        }
      });
      return results;
    });

    await browser.close();
    return items.map(i => ({ ...i, source: 'leboncoin', niche: searchConfig.niche, query: searchConfig.query }));
  } catch (e) {
    if (browser) await browser.close();
    console.error(`[LBC] Erreur scrape "${searchConfig.query}":`, e.message);
    return [];
  }
}

// Scan complet : 5 recherches aléatoires parmi les plus pertinentes ce mois
async function scanLBC(maxSearches = 5) {
  const month = new Date().getMonth() + 1;
  const sources = require('./sources');

  // Prioriser les recherches dont la niche est en saison
  const scored = LBC_SEARCHES.map(s => {
    const niche = sources.NICHES[s.niche];
    let priority = 5;
    if (niche) {
      if (niche.margin === 'high') priority += 2;
      if (niche.speed === 'fast') priority += 2;
      if (niche.season && niche.season.includes(month)) priority += 3;
      if (!niche.season) priority += 1;
    }
    return { ...s, priority };
  }).sort((a, b) => b.priority - a.priority);

  // Prendre les top + un peu de random
  const top = scored.slice(0, Math.ceil(maxSearches * 0.7));
  const rest = scored.slice(Math.ceil(maxSearches * 0.7));
  const random = rest.sort(() => Math.random() - 0.5).slice(0, maxSearches - top.length);
  const toSearch = [...top, ...random].slice(0, maxSearches);

  let totalItems = 0;
  let inserted = 0;

  for (const search of toSearch) {
    const items = await scrapeLBC(search);
    totalItems += items.length;

    for (const item of items) {
      const hash = crypto.createHash('md5').update(`lbc|${item.title}|${item.url}`).digest('hex');
      const exists = await db.hashExists(hash);
      if (exists) continue;

      // Scoring
      let score = 5;
      if (item.price < 10) score += 2;
      else if (item.price < 20) score += 1;
      const t = item.title.toLowerCase();
      if (/neuf|scelle|sealed|bnib|sous blister/i.test(t)) score += 2;
      if (/lot|pack|bundle/i.test(t)) score += 1;
      if (/vintage|collector|rare|limited/i.test(t)) score += 1;
      if (/casse|hs|pour piece|en panne/i.test(t)) score -= 2;
      score = Math.min(10, Math.max(0, score));

      if (score >= 5) {
        const urgence = score >= 9 ? 'ROUGE' : score >= 7 ? 'ORANGE' : 'VERTE';
        await db.insert('ops', {
          type: 'veille', source: 'leboncoin',
          signal: `[${search.niche}] ${item.title.slice(0, 150)} — ${item.price}€`,
          score, urgence, hash,
          data: {
            url: item.url, price: item.price, image: item.image,
            nicheId: search.niche, query: search.query,
            buyerLikely: true,
            buyerReason: 'LeBonCoin = prix source. Revente sur eBay/Vinted à marge.'
          }
        });
        inserted++;
      }
    }
  }

  await db.log('veille', 'scan_lbc', 'auto', `${inserted} opportunités LBC (${totalItems} annonces, ${toSearch.length} recherches)`);
  return { searches: toSearch.length, totalItems, inserted, queries: toSearch.map(s => s.query) };
}

module.exports = { scrapeLBC, scanLBC, LBC_SEARCHES };

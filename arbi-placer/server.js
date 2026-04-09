require('dotenv').config();
// Validation .env au démarrage
const REQUIRED_ONE_OF = ['ODDSAPIIO_KEY','THERUNDOWN_KEY','ODDS_API_KEY'];
const hasAnySource = REQUIRED_ONE_OF.some(k => process.env[k]);
if(!hasAnySource) console.warn('[WARN] Aucune clé API configurée — mode scraping uniquement (limité à 20 req/h)');
else console.log('[OK] Sources actives:', REQUIRED_ONE_OF.filter(k=>process.env[k]).join(', '));

const express  = require('express');
const { WebSocketServer } = require('ws');
const axios    = require('axios');
const cron     = require('node-cron');

const PORT     = process.env.PORT || 3001;
const WS_PORT  = process.env.WS_PORT || 3002;
const MIN_MARGIN = parseFloat(process.env.MIN_ARB_MARGIN || 0.3);

// Niche sports disponibles via différentes sources
const SPORT_SOURCES = {
  // The Odds API — disponibles
  'aussierules_afl':    { name:'Footy Australien', src:'oddsapi' },
  'rugbyleague_nrl':    { name:'Rugby League',      src:'oddsapi' },
  'handball_WHC':       { name:'Handball',          src:'oddsapi' },
  'waterpolo':          { name:'Water-polo',        src:'oddsapi' },
  // Sportradar — sports méconnus étendus
  'floorball':          { name:'Floorball',         src:'sportradar' },
  'bandy':              { name:'Bandy',             src:'sportradar' },
  'futsal':             { name:'Futsal',            src:'sportradar' },
  // Sports supplémentaires via odds-api.io
  'gaelic_football':    { name:'Football Gaélique', src:'oddsapi' },
  'hurling':            { name:'Hurling',           src:'oddsapi' },
  // OddsMatrix — ultra niche
  'kabaddi':            { name:'Kabaddi',           src:'oddsmatrix' },
  'pesapallo':          { name:'Pesäpallo',         src:'oddsmatrix' },
  'korfball':           { name:'Korfball',          src:'oddsmatrix' },
};

const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Set();
wss.on('connection', ws => {
  clients.add(ws);
  ws.send(JSON.stringify({ type:'connected', msg:'ArbiBot Server prêt' }));
  ws.on('close', () => clients.delete(ws));
});
function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => ws.readyState === 1 && ws.send(msg));
}

// odds-api.io — URL correct selon leur doc v2
async function fetchOddsApiIo(sportKey) {
  if(!process.env.ODDSAPIIO_KEY) return null;
  try {
    // Essaie d'abord en tant que clé the-odds-api.com (même format 64-hex)
    const { data } = await axios.get('https://api.the-odds-api.com/v4/sports/' + sportKey + '/odds', {
      params: { apiKey: process.env.ODDSAPIIO_KEY, regions:'eu', markets:'h2h', oddsFormat:'decimal' },
      timeout: 8000
    });
    return data;
  } catch(e) { return null; }
}

async function fetchRundown(sportId) {
  if(!process.env.THERUNDOWN_KEY) return null;
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await axios.get(`https://therundown-therundown-v1.p.rapidapi.com/sports/${sportId}/events/${today}`, {
      headers: { 'x-rapidapi-key': process.env.THERUNDOWN_KEY, 'x-rapidapi-host':'therundown-therundown-v1.p.rapidapi.com' },
      timeout: 8000
    });
    return data?.events || null;
  } catch(e) { return null; }
}

async function fetchOddsAPI(sportKey) {
  if(!process.env.ODDS_API_KEY) return null;
  try {
    const { data } = await axios.get('https://api.the-odds-api.com/v4/sports/' + sportKey + '/odds', {
      params: { apiKey: process.env.ODDS_API_KEY, regions:'eu', markets:'h2h', oddsFormat:'decimal' },
      timeout: 8000
    });
    return data;
  } catch(e) { return null; }
}

// Utilisé comme fallback si aucune clé API disponible
const { chromium } = require('playwright');
let scrapeCount = 0;
const MAX_SCRAPE_PER_HOUR = 20; // respecter le serveur
async function scrapeOddsPortal(sport) {
  if(scrapeCount >= MAX_SCRAPE_PER_HOUR) return null;
  scrapeCount++;
  let browser;
  try {
    browser = await chromium.launch({ headless:true, args:['--no-sandbox','--disable-gpu'] });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9' });
    await page.goto(`https://www.oddsportal.com/${sport}/`, { waitUntil:'domcontentloaded', timeout:15000 });
    // Parse les lignes de matchs + cotes
    const matches = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.eventRow, [class*="eventRow"]')];
      return rows.slice(0,10).map(r => {
        const teams = r.querySelector('[class*="participant"]')?.textContent?.trim();
        const odds  = [...r.querySelectorAll('[class*="odds-val"], .oddsCell')].map(o => parseFloat(o.textContent));
        return { teams, odds: odds.filter(o => !isNaN(o) && o > 1) };
      }).filter(m => m.teams && m.odds.length >= 2);
    });
    await browser.close();
    return matches.length ? matches : null;
  } catch(e) { browser?.close(); return null; }
}


function detectArbs(events) {
  const arbs = [];
  events.forEach(ev => {
    if(!ev.bookmakers || ev.bookmakers.length < 2) return;
    const outcomes = {};
    ev.bookmakers.forEach(bk => {
      bk.markets?.[0]?.outcomes?.forEach(o => {
        if(!outcomes[o.name] || outcomes[o.name].price < o.price) {
          outcomes[o.name] = { price: o.price, book: bk.key };
        }
      });
    });
    const vals = Object.values(outcomes);
    if(vals.length < 2) return;
    const sumRecip = vals.reduce((s,o) => s + 1/o.price, 0);
    const margin = (1/sumRecip - 1) * 100;
    if(margin >= MIN_MARGIN) {
      arbs.push({
        id: ev.id,
        match: ev.home_team + ' vs ' + ev.away_team,
        sport: ev.sport_key,
        time: ev.commence_time,
        outcomes: Object.entries(outcomes).map(([name,o]) => ({ name, odd: o.price, book: o.book })),
        margin: parseFloat(margin.toFixed(4)),
        sumRecip: parseFloat(sumRecip.toFixed(6)),
      });
    }
  });
  return arbs.sort((a,b) => b.margin - a.margin);
}

let scanCount = 0;
let totalArbs  = 0;
async function runScan() {
  scanCount++;
  const ts = new Date().toISOString();
  broadcast({ type:'scan_start', scan: scanCount, ts });
  console.log(`[${ts}] Scan #${scanCount} démarré`);

  const allArbs = [];
  const keysToScan = Object.entries(SPORT_SOURCES).filter(([,v]) => v.src === 'oddsapi').map(([k]) => k);

  const hasOddsKey = !!process.env.ODDS_API_KEY;

  for(const key of keysToScan) {
    let events = null;
    // Cascade FR : oddsapiio (bookmakers FR) → therundown → the-odds-api → scrape
    if(process.env.ODDSAPIIO_KEY)            events = await fetchOddsApiIo(key);
    if(!events && process.env.THERUNDOWN_KEY) events = await fetchRundown(key);
    if(!events && hasOddsKey)                events = await fetchOddsAPI(key);
    if(!events) {
      const scraped = await scrapeOddsPortal(key.split('_')[0]);
      if(scraped) {
        events = scraped.map((m,i) => ({
          id: key+'_'+i, sport_key: key,
          home_team: m.teams?.split(' - ')[0] || '?',
          away_team: m.teams?.split(' - ')[1] || '?',
          commence_time: new Date().toISOString(),
          bookmakers:[{ key:'oddsportal', markets:[{ outcomes: m.odds.map((o,j)=>({ name:['1','X','2'][j]||String(j), price:o })) }] }]
        }));
      }
    }
    if(!events) continue;
    const arbs = detectArbs(events);
    allArbs.push(...arbs);
    const src = process.env.ODDSAPIIO_KEY ? '[oddsapiio]' : hasOddsKey ? '[oddsapi]' : '[scrape]';
    if(arbs.length) console.log(`  ✓ ${src} ${SPORT_SOURCES[key]?.name} — ${arbs.length} arb(s)`);
    else console.log(`  · ${src} ${SPORT_SOURCES[key]?.name} — aucun arb`);
  }

  totalArbs += allArbs.length;
  broadcast({ type:'scan_result', scan: scanCount, ts, arbs: allArbs, total: totalArbs });
  console.log(`[${ts}] Scan #${scanCount} terminé — ${allArbs.length} arb(s)`);
}

// ── CRYPTO SCANNER ──────────────────────────────────────────────
const { runCryptoScan, getLastCryptoResult, getCryptoScanCount } = require('./crypto-scanner');

const CRYPTO_ENABLED      = process.env.CRYPTO_ENABLED !== 'false';
const CRYPTO_INTERVAL_SEC = parseInt(process.env.CRYPTO_INTERVAL_SEC || '30');

if(CRYPTO_ENABLED) {
  const cryptoScanAndBroadcast = async () => {
    const result = await runCryptoScan();
    broadcast({ type: 'crypto_result', ...result });
  };
  cryptoScanAndBroadcast();
  cron.schedule(`*/${CRYPTO_INTERVAL_SEC} * * * * *`, cryptoScanAndBroadcast);
  console.log(`[CRYPTO] Scanner activé (scan toutes les ${CRYPTO_INTERVAL_SEC}s)`);
}

const app = express();
app.use(express.json());
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost,https://maprimeadapt-idf.fr,https://maprimeadapt-idf.pages.dev').split(',');
app.use((req,res,next) => {
  const origin = req.headers.origin;
  if(!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Headers','Content-Type');
  }
  next();
});
require('./leads')(app);

app.get('/status', (req,res) => res.json({
  status:'running', scans: scanCount, totalArbs,
  apis: {
    oddsapiio:  !!process.env.ODDSAPIIO_KEY,
    therundown: !!process.env.THERUNDOWN_KEY,
    oddsapi:    !!process.env.ODDS_API_KEY,
    brevo:      !!process.env.BREVO_API_KEY,
  }
}));

const SCAN_TOKEN = process.env.SCAN_TOKEN;
app.post('/scan', async (req,res) => {
  if(SCAN_TOKEN && req.headers['x-scan-token'] !== SCAN_TOKEN) return res.status(401).json({ error:'Non autorisé' });
  await runScan(); res.json({ ok:true });
});

// ── ENDPOINTS CRYPTO ────────────────────────────────────────────
app.get('/crypto/health', (req,res) => res.json({
  status:   CRYPTO_ENABLED ? 'ok' : 'disabled',
  scans:    getCryptoScanCount(),
  lastScan: getLastCryptoResult().ts,
  summary:  getLastCryptoResult().summary,
}));

app.get('/crypto/arbs', (req,res) => {
  const r = getLastCryptoResult();
  res.json({
    ts:    r.ts,
    scan:  r.scan,
    arbs:  [...(r.cex||[]), ...(r.triangular||[])],
    total: (r.cex?.length||0) + (r.triangular?.length||0),
  });
});

app.get('/crypto/funding', (req,res) => {
  const r = getLastCryptoResult();
  res.json({ ts: r.ts, funding: r.funding||[], total: r.funding?.length||0 });
});

app.get('/crypto/all', (req,res) => res.json(getLastCryptoResult()));

// ── ENDPOINT UNIFIÉ (sport + crypto) ────────────────────────────
// Utilisé par hourly-check.sh et plan-action.html
app.get('/api/opportunities', (req,res) => {
  if(SCAN_TOKEN && req.query.token !== SCAN_TOKEN) return res.status(401).json({ error:'Non autorisé' });
  const cryptoResult = getLastCryptoResult();
  const cryptoArbs   = CRYPTO_ENABLED
    ? [...(cryptoResult.cex||[]), ...(cryptoResult.triangular||[]), ...(cryptoResult.funding||[])]
    : [];
  res.json({
    opportunities: cryptoArbs,
    crypto: {
      cex:        cryptoResult.cex?.length        || 0,
      triangular: cryptoResult.triangular?.length || 0,
      funding:    cryptoResult.funding?.length    || 0,
    },
    sport: { scans: scanCount, arbs: totalArbs },
    ts:    new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────

app.get('/health', (req,res) => res.json({
  status:'ok',
  uptime: Math.floor(process.uptime())+'s',
  scans: scanCount,
  arbs: totalArbs,
  sources:{
    oddsapiio:  !!process.env.ODDSAPIIO_KEY,
    therundown: !!process.env.THERUNDOWN_KEY,
    oddsapi:    !!process.env.ODDS_API_KEY,
    scraping:   true,
    crypto:     CRYPTO_ENABLED,
  },
  crypto: CRYPTO_ENABLED ? getLastCryptoResult().summary : null,
  active_sources: [
    process.env.ODDSAPIIO_KEY  && 'oddsapiio',
    process.env.THERUNDOWN_KEY && 'therundown',
    process.env.ODDS_API_KEY   && 'oddsapi',
    'scraping'
  ].filter(Boolean),
}));

const interval = parseInt(process.env.SCAN_INTERVAL_SEC || 10);
cron.schedule(`*/${interval} * * * * *`, runScan);

app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  ArbiBot Server  ·  port ${PORT}              ║`);
  console.log(`║  WebSocket       ·  port ${WS_PORT}              ║`);
  console.log(`╠═══════════════════════════════════════════╣`);
  const cfg = {
    'odds-api.io':   process.env.ODDSAPIIO_KEY  ? '✓ connecté' : '✗ clé manquante',
    'TheRundown':    process.env.THERUNDOWN_KEY  ? '✓ connecté' : '✗ clé manquante',
    'The Odds API':  process.env.ODDS_API_KEY    ? '✓ connecté' : '✗ clé manquante',
    'Brevo CRM':     process.env.BREVO_API_KEY   ? '✓ connecté' : '✗ clé manquante',
    'Scraping':      '✓ actif (fallback)',
  };
  Object.entries(cfg).forEach(([k,v]) => console.log(`║  ${k.padEnd(14)} ${v.padEnd(26)}║`));
  console.log(`╠═══════════════════════════════════════════╣`);
  console.log(`║  Scan toutes les ${String(interval)+'s'} · Marge min ${MIN_MARGIN}%      ║`);
  console.log(`╚═══════════════════════════════════════════╝\n`);
  runScan();
});

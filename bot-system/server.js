require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { dispatch, getStatus, checkAuth, setBotActive } = require('./src/orchestrator');
const db = require('./src/db');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// --- Middleware auth optionnel ---
function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'] || req.query.token;
  req.authLevel = checkAuth(token);
  next();
}

// ============================================================
// ROUTES
// ============================================================

// Health check
app.get('/health', async (req, res) => {
  try {
    const status = await getStatus();
    res.json({ status: 'ok', ...status });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Status détaillé
app.get('/api/status', authMiddleware, async (req, res) => {
  const status = await getStatus();
  res.json(status);
});

// Dispatch une tâche
app.post('/api/dispatch', authMiddleware, async (req, res) => {
  const { task, payload } = req.body;
  if (!task) return res.status(400).json({ error: 'Champ "task" requis' });
  const result = await dispatch(task, payload || {}, req.headers['x-auth-token']);
  res.json(result);
});

// Contrôle bots (N2 minimum)
app.post('/api/bot/:name/:action', authMiddleware, async (req, res) => {
  if (!req.authLevel) return res.status(401).json({ error: 'Auth requise' });
  const { name, action } = req.params;
  if (action === 'activate') { setBotActive(name, true); await db.log('orchestrator', `activate_${name}`, req.authLevel, 'OK'); }
  else if (action === 'deactivate') { setBotActive(name, false); await db.log('orchestrator', `deactivate_${name}`, req.authLevel, 'OK'); }
  else return res.status(400).json({ error: 'Action: activate ou deactivate' });
  res.json({ ok: true, bot: name, active: action === 'activate' });
});

// Logs récents
app.get('/api/logs', authMiddleware, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || 20), 100);
  const bot = req.query.bot;
  const filters = bot ? { bot } : {};
  const logs = await db.select('logs', filters, { order: 'ts', limit });
  res.json(logs);
});

// Opportunités
app.get('/api/opportunities', async (req, res) => {
  const status = req.query.status || 'new';
  const ops = await db.select('ops', { status }, { order: 'ts', limit: 20 });
  res.json(ops);
});

// Trades ouverts
app.get('/api/trades', async (req, res) => {
  const trades = await db.select('ops', { type: 'trade', status: 'open' }, { order: 'ts' });
  res.json(trades);
});

// Webhook lead entrant
app.post('/api/lead', async (req, res) => {
  const result = await dispatch('add_lead', req.body);
  res.json(result);
});

// Stats niches (toutes les niches verrouillées)
app.get('/api/niches/stats', (req, res) => {
  const bots = require('./src/bots');
  res.json(bots.veilleNicheStats());
});

// Top niches du mois (classées par score, double stratégie)
app.get('/api/niches/top', (req, res) => {
  const bots = require('./src/bots');
  const max = parseInt(req.query.max || 15);
  res.json(bots.veilleTopNiches(max));
});

// Niches avec acheteurs actifs → arbitrage rapide possible
app.get('/api/niches/arbitrage', (req, res) => {
  const bots = require('./src/bots');
  res.json(bots.veilleArbitrageNiches(parseInt(req.query.max || 10)));
});

// Types de preuves d'acheteur acceptées
app.get('/api/trader/proof-types', (req, res) => {
  const bots = require('./src/bots');
  res.json(bots.BUYER_PROOF_TYPES);
});

// Web3 rapport complet
app.get('/api/web3/report', async (req, res) => {
  const result = await dispatch('web3_report');
  res.json(result);
});

// Scan Web3 manuel
app.post('/api/web3/scan', async (req, res) => {
  const result = await dispatch('scan_web3');
  res.json(result);
});

// Opportunités Web3
app.get('/api/web3/opportunities', async (req, res) => {
  const db = require('./src/db');
  const nfts = await db.select('ops', { type: 'web3_nft' }, { order: 'ts', limit: 20 });
  const defi = await db.select('ops', { type: 'web3_defi' }, { order: 'ts', limit: 20 });
  const meta = await db.select('ops', { type: 'web3_metaverse' }, { order: 'ts', limit: 20 });
  res.json({ nfts, defi, metaverse: meta });
});

// Stratégie complète
app.get('/api/strategy', async (req, res) => {
  const result = await dispatch('strategy', { capital: parseInt(req.query.capital || 100) });
  res.json(result);
});
app.get('/api/strategy/week/:week', async (req, res) => {
  const result = await dispatch('week_plan', { week: parseInt(req.params.week) });
  res.json(result);
});
app.get('/api/strategy/operation/:id', async (req, res) => {
  const result = await dispatch('operation', { id: req.params.id });
  res.json(result);
});
app.get('/api/strategy/projection', async (req, res) => {
  const result = await dispatch('projection', {
    capital: parseInt(req.query.capital || 100),
    flips: parseInt(req.query.flips || 10),
    margin: parseInt(req.query.margin || 15)
  });
  res.json(result);
});

// HUNT : lancer une chasse manuelle (produits + enchères)
app.post('/api/hunt', async (req, res) => {
  const platforms = req.body.platforms || ['vinted', 'ebay'];
  const result = await hunters.huntAllWithAuctions(platforms);
  res.json(result);
});

// HUNT : résultats produits
app.get('/api/hunt/results', async (req, res) => {
  const ops = await db.select('ops', { type: 'hunt', status: 'new' }, { order: 'score', limit: 20 });
  res.json(ops);
});

// ENCHÈRES FR : ajouter un lot (vous trouvez, le bot évalue et poste)
app.post('/api/auction/add', async (req, res) => {
  const result = await auctionSites.addAuctionLot(req.body);
  res.json(result);
});

// ENCHÈRES FR : ajouter plusieurs lots d'un coup
app.post('/api/auction/batch', async (req, res) => {
  const result = await auctionSites.addMultipleLots(req.body.lots || []);
  res.json(result);
});

// ENCHÈRES FR : liens à scanner cette semaine
app.get('/api/auction/links', (req, res) => {
  res.json(auctionSites.getWeeklyLinks());
});

// ENCHÈRES FR : résultats
app.get('/api/auction/results', async (req, res) => {
  const ops = await db.select('ops', { type: 'auction_fr', status: 'new' }, { order: 'score', limit: 20 });
  res.json(ops);
});

// ENCHÈRES eBay : résultats enchères avec timing
app.get('/api/hunt/auctions', async (req, res) => {
  const ops = await db.select('ops', { type: 'auction', status: 'new' }, { order: 'score', limit: 20 });
  res.json(ops.map(o => ({
    id: o.id, score: o.score, urgence: o.urgence,
    signal: o.signal,
    prix_depart: o.data?.currentPrice,
    prix_final_estime: o.data?.estimatedFinal,
    prix_revente: o.data?.ourSellPrice,
    marge_estimee: o.data?.estimatedMargin,
    encheres: o.data?.bids,
    temps_restant: o.data?.timeLeft,
    action: o.data?.action,
    url: o.data?.url
  })));
});

// Pipeline : listings prêts à poster
app.get('/api/pipeline/ready', async (req, res) => {
  const listings = await pipeline.getReadyListings();
  res.json(listings);
});

// Pipeline : forcer le process des opportunités maintenant
app.post('/api/pipeline/process', async (req, res) => {
  const result = await pipeline.processNewOpportunities();
  res.json(result);
});

// Pipeline : rapport du soir
app.get('/api/pipeline/report', async (req, res) => {
  const result = await pipeline.eveningReport();
  res.json(result);
});

// ── ENTONNOIR D'ALERTES ──

// Recevoir une alerte (titre + prix + source)
app.post('/api/funnel/alert', async (req, res) => {
  const result = await funnel.processAlert(req.body);
  res.json(result);
});

// Recevoir un batch d'alertes
app.post('/api/funnel/batch', async (req, res) => {
  const results = [];
  for (const alert of (req.body.alerts || [])) {
    results.push(await funnel.processAlert(alert));
  }
  const accepted = results.filter(r => r.accepted);
  res.json({ total: results.length, accepted: accepted.length, results });
});

// Stats entonnoir
app.get('/api/funnel/stats', async (req, res) => {
  res.json(await funnel.funnelStats());
});

// Guide de setup complet
app.get('/api/funnel/setup', (req, res) => {
  res.json(funnel.getSetupGuide());
});

// Mots-clés à configurer en alertes
app.get('/api/funnel/keywords', (req, res) => {
  res.json(funnel.ALERT_KEYWORDS);
});

// ── OPTIMIZER : fiches premium ──

// Optimiser un listing pour 1 plateforme
app.post('/api/optimize', async (req, res) => {
  const result = await optimizer.optimizeListing(req.body);
  res.json(result);
});

// Optimiser pour TOUTES les plateformes (comparaison)
app.post('/api/optimize/all', async (req, res) => {
  const result = await optimizer.optimizeAllPlatforms(req.body);
  res.json(result);
});

// Conseils photo par niche
app.get('/api/optimize/photos/:niche', (req, res) => {
  res.json(optimizer.getPhotoAdvice(req.params.niche));
});

// Évaluer un produit (prix réel, marge, verdict)
app.post('/api/evaluate', async (req, res) => {
  const { title, price, description, platform, fastFlip, confirmedBuyer, sellPrice } = req.body;
  if (!title || !price) return res.status(400).json({ error: 'title et price requis' });
  const result = await dispatch('evaluate_product', {
    title, price: parseFloat(price), description, platform,
    fastFlip, confirmedBuyer, sellPrice: sellPrice ? parseFloat(sellPrice) : undefined
  });
  res.json(result);
});

// Scan LeBonCoin manuel
app.post('/api/lbc/scan', async (req, res) => {
  const result = await dispatch('scan_lbc');
  res.json(result);
});

// DeFi : yields actionnables avec liens directs
app.get('/api/defi/actions', async (req, res) => {
  const result = await dispatch('defi_actions', { minScore: parseInt(req.query.min || 6), max: parseInt(req.query.max || 10) });
  res.json(result);
});

// DeFi : simulation gains avec X€
app.get('/api/defi/simulation', async (req, res) => {
  const capital = parseInt(req.query.capital || 100);
  const result = await dispatch('defi_simulation', { capital });
  res.json(result);
});

// Plateformes de publication supportées
app.get('/api/contenu/platforms', (req, res) => {
  const bots = require('./src/bots');
  res.json(Object.entries(bots.PLATFORM_CONFIGS).map(([id, c]) => ({
    id, name: c.name, fees: c.fees, markupPct: c.markupPct
  })));
});

// Flow complet : opportunité → listings générés → prêt à publier
app.post('/api/contenu/arbitrage', authMiddleware, async (req, res) => {
  const { opportunityId } = req.body;
  if (!opportunityId) return res.status(400).json({ error: 'opportunityId requis' });
  const result = await dispatch('arbitrage_flow', { opportunityId }, req.headers['x-auth-token']);
  res.json(result);
});

// Publier un listing sur une plateforme (Playwright)
app.post('/api/contenu/publish', authMiddleware, async (req, res) => {
  if (!req.authLevel) return res.status(401).json({ error: 'Auth N2 minimum requise pour publier' });
  const result = await dispatch('publish_listing', { listing: req.body }, req.headers['x-auth-token']);
  res.json(result);
});

// ============================================================
// PIPELINE AUTOMATIQUE · Les bots se chaînent
// ============================================================
//
// AVANT : chaque bot travaille seul, résultats dorment en base
// MAINTENANT : Veille → évalue → génère listing → alerte
//
// Consommation optimisée :
// - LBC scan retiré (bloqué par anti-bot)
// - Scan différentiel retiré (pas d'eBay API)
// - Garde uniquement ce qui PRODUIT des résultats

const pipeline = require('./src/pipeline');
const hunters = require('./src/hunters');
const auctionSites = require('./src/auction-sites');
const funnel = require('./src/alert-funnel');
const optimizer = require('./src/listing-optimizer');

// ── Matin 8h : CHASSE complète (produits + enchères + Web3) ──
cron.schedule('0 8 * * *', async () => {
  console.log('[HUNT] Chasse matinale complète');
  await hunters.huntAllWithAuctions(['vinted', 'ebay']);
  await dispatch('scan_web3');
  await pipeline.processNewOpportunities();
});

// ── 13h : Chasse midi (nouveaux produits + enchères fraîches) ──
cron.schedule('0 13 * * *', async () => {
  console.log('[HUNT] Chasse midi');
  await hunters.huntAllWithAuctions(['vinted', 'ebay']);
  await pipeline.processNewOpportunities();
});

// ── 19h : Chasse soir (annonces après le travail) ──
cron.schedule('0 19 * * *', async () => {
  console.log('[HUNT] Chasse soir');
  await hunters.huntAllWithAuctions(['vinted', 'ebay']);
  await pipeline.processNewOpportunities();
});

// ── 7h : Check événements mondiaux ──
cron.schedule('0 7 * * *', async () => {
  await dispatch('check_evenement');
});

// ── Lundi 9h : Rappel scan enchères FR (semi-auto) ──
cron.schedule('0 9 * * 1', async () => {
  const links = auctionSites.getWeeklyLinks();
  const total = links.reduce((s, site) => s + site.searches.length, 0);
  await db.log('pipeline', 'weekly_auction_reminder', 'auto',
    `RAPPEL: ${total} liens à scanner sur ${links.length} sites. GET /api/auction/links pour la liste.`
  );
});

// ── 20h30 : Rapport journalier ──
cron.schedule('30 20 * * *', async () => {
  console.log('[PIPELINE] Rapport soir');
  await pipeline.eveningReport();
});

// ── Toutes les 30 min : Check deadlines trades ──
cron.schedule('*/30 * * * *', async () => {
  await dispatch('check_deadlines');
});

// ============================================================
// DÉMARRAGE
// ============================================================

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   BOT SYSTEM v4.0 · 0€/mois · Actif    ║
╠══════════════════════════════════════════╣
║  Port     : ${PORT}                        ║
║  Env      : ${process.env.NODE_ENV || 'dev'}                  ║
║  Supabase : ${process.env.SUPABASE_URL ? 'Connecté' : 'Mode local'}              ║
║  DRY_RUN  : ${process.env.DRY_RUN || 'true'}                     ║
╠══════════════════════════════════════════╣
║  CRONS ACTIFS :                          ║
║  · Lun 6h  : filtrage marchés           ║
║  · 7h/jour : events mondiaux            ║
║  · /4h     : scan différentiel          ║
║  · /30min  : check deadlines trades     ║
║  · 20h     : rapport P&L               ║
║  · L-V 9h  : relances leads            ║
╠══════════════════════════════════════════╣
║  GET  /health                            ║
║  GET  /api/status                        ║
║  POST /api/dispatch {task, payload}      ║
║  GET  /api/logs?bot=veille&limit=20      ║
║  GET  /api/opportunities                 ║
║  GET  /api/trades                        ║
║  POST /api/lead {name, email, ...}       ║
║  POST /api/bot/:name/activate            ║
╚══════════════════════════════════════════╝
  `);

  // Log démarrage
  db.log('orchestrator', 'system_start', 'auto', `Port ${PORT} · ${new Date().toISOString()}`);
});

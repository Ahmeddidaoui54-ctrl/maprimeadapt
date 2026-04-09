const db = require('./db');
const bots = require('./bots');

// --- Auth simple (token .env) ---

function checkAuth(token) {
  if (!token) return null;
  if (token === process.env.OWNER_TOKEN) return 'n1';
  if (token === process.env.SECOND_TOKEN) return 'n2';
  return null;
}

// --- État des bots ---

const botState = {
  veille:  { active: true,  name: 'Bot Veille' },
  trader:  { active: true,  name: 'Bot Trader' },
  client:  { active: true,  name: 'Bot Client' },
  contenu: { active: true,  name: 'Bot Contenu' }
};

function setBotActive(botName, active) {
  if (botState[botName]) botState[botName].active = active;
}

// --- Actions nécessitant N1 ---
const N1_ACTIONS = new Set([
  'add_bot', 'remove_bot', 'emergency_stop', 'unlock_reserve', 'fund_trading'
]);

// --- Actions nécessitant au moins N2 ---
const N2_ACTIONS = new Set([
  'activate_bot', 'deactivate_bot', 'validate_trade_over_20'
]);

// --- Routing des tâches ---

const TASK_ROUTES = {
  // Veille
  filtrage_marches:    { bot: 'veille', fn: () => bots.veilleFilterMarkets() },
  check_evenement:     { bot: 'veille', fn: () => bots.veilleCheckEvents() },
  scan_differentiel:   { bot: 'veille', fn: () => bots.veilleScanMarkets() },
  scan_web3:           { bot: 'veille', fn: () => bots.veilleScanWeb3() },
  web3_report:         { bot: 'veille', fn: () => bots.veilleWeb3Report() },
  scan_lbc:            { bot: 'veille', fn: () => bots.veilleScanLBC() },
  defi_actions:        { bot: 'veille', fn: (p) => bots.defiActions(p) },
  defi_simulation:     { bot: 'veille', fn: (p) => bots.defiSimulation(p) },
  evaluate_product:    { bot: 'trader', fn: (p) => bots.evaluateProduct(p) },
  parse_product:       { bot: 'trader', fn: (p) => bots.parseProduct(p) },
  strategy:            { bot: 'trader', fn: (p) => bots.getStrategy(p) },
  week_plan:           { bot: 'trader', fn: (p) => bots.getWeekPlan(p) },
  operation:           { bot: 'trader', fn: (p) => bots.getOperation(p) },
  projection:          { bot: 'trader', fn: (p) => bots.getProjection(p) },
  niche_stats:         { bot: 'veille', fn: () => bots.veilleNicheStats() },
  top_niches:          { bot: 'veille', fn: (p) => bots.veilleTopNiches(p?.max) },
  arbitrage_niches:    { bot: 'veille', fn: (p) => bots.veilleArbitrageNiches(p?.max) },
  // Trader
  score_operation:     { bot: 'trader', fn: (p) => bots.traderScoreOp(p) },
  check_guardrails:    { bot: 'trader', fn: (p) => bots.traderCheckGuardRails(p.prixAchat, p.buyerProof) },
  record_buy:          { bot: 'trader', fn: (p) => bots.traderRecordBuy(p.opportunityId, p.item, p.prixAchat, p.prixRevente, p.frais, p.scoreDetails) },
  record_sell:         { bot: 'trader', fn: (p) => bots.traderRecordSell(p.opId, p.prixVente) },
  check_deadlines:     { bot: 'trader', fn: () => bots.traderCheckDeadlines() },
  rapport_pl:          { bot: 'trader', fn: () => bots.traderDailyPnL() },
  // Client
  add_lead:            { bot: 'client', fn: (p) => bots.clientAddLead(p) },
  check_relances:      { bot: 'client', fn: () => bots.clientCheckRelances() },
  // Contenu
  add_document:        { bot: 'contenu', fn: (p) => bots.contenuAddDocument(p.type, p.title, p.data) },
  list_documents:      { bot: 'contenu', fn: (p) => bots.contenuList(p?.type) },
  update_doc_status:   { bot: 'contenu', fn: (p) => bots.contenuUpdateStatus(p.id, p.status) },
  // Contenu — Arbitrage listings
  scrape_product:      { bot: 'contenu', fn: (p) => bots.contenuScrapeProduct(p.url) },
  generate_listing:    { bot: 'contenu', fn: (p) => bots.contenuGenerateListing(p.product, p.platform, p.price) },
  generate_all_listings: { bot: 'contenu', fn: (p) => bots.contenuGenerateAllListings(p.product) },
  publish_listing:     { bot: 'contenu', fn: (p) => bots.contenuPublishListing(p.listing) },
  arbitrage_flow:      { bot: 'contenu', fn: (p) => bots.contenuFullArbitrageFlow(p.opportunityId) }
};

// --- Dispatch central ---

async function dispatch(taskType, payload = {}, authToken = null) {
  const route = TASK_ROUTES[taskType];
  if (!route) {
    return { error: `Tâche inconnue: ${taskType}` };
  }

  // Vérifier que le bot est actif
  if (!botState[route.bot]?.active) {
    return { error: `Bot ${route.bot} est en veille` };
  }

  // Vérifier auth si nécessaire
  if (N1_ACTIONS.has(taskType)) {
    const level = checkAuth(authToken);
    if (level !== 'n1') return { error: 'Autorisation Niveau 1 requise' };
  }
  if (N2_ACTIONS.has(taskType)) {
    const level = checkAuth(authToken);
    if (!level) return { error: 'Autorisation Niveau 2 minimum requise' };
  }

  // Exécuter
  try {
    const result = await route.fn(payload);
    return { ok: true, bot: route.bot, task: taskType, result };
  } catch (err) {
    await db.log(route.bot, taskType, 'auto', `ERREUR: ${err.message}`);
    return { error: err.message, bot: route.bot, task: taskType };
  }
}

// --- Status système ---

async function getStatus() {
  const recentLogs = await db.select('logs', {}, { order: 'ts', limit: 10 });
  const openTrades = await db.select('ops', { type: 'trade', status: 'open' });
  const newOpportunities = await db.select('ops', { status: 'new' }, { order: 'ts', limit: 5 });

  return {
    timestamp: new Date().toISOString(),
    bots: botState,
    trades: {
      open: openTrades.length,
      totalEngaged: openTrades.reduce((s, op) => s + parseFloat(op.prix_achat || 0), 0)
    },
    opportunities: newOpportunities.length,
    recentActivity: recentLogs.slice(0, 5).map(l => `${l.bot}: ${l.action} → ${l.result}`)
  };
}

module.exports = { dispatch, getStatus, checkAuth, botState, setBotActive };

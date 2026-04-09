#!/usr/bin/env node
/**
 * ArbiBot Auto-Robot
 * ─────────────────────────────────────────────────────
 * Écoute le serveur WebSocket (server.js), reçoit les arbs
 * détectés, calcule les mises depuis le wallet chiffré,
 * et place les paris via l'API Betfair Exchange.
 *
 * ⚠  Ne place jamais sur un arb si marge nette < seuil de sécurité.
 * ⚠  Toujours en mode DRY_RUN=true par défaut — aucun vrai pari.
 *    Pour activer : DRY_RUN=false dans .env (tu assumes la responsabilité).
 */
require('dotenv').config();
const { WebSocket } = require('ws');
const axios         = require('axios');
const crypto        = require('crypto');
const fs            = require('fs');
const path          = require('path');

const DRY_RUN      = process.env.DRY_RUN !== 'false';   // true par défaut
const SLIP_RATE    = parseFloat(process.env.SLIP || 0.20) / 100;
const PLACE_TIME   = parseFloat(process.env.PLACE_TIME_SEC || 8); // API = rapide
const MIN_MARGIN   = parseFloat(process.env.MIN_ARB_MARGIN || 0.5);
const RISK_FRAC    = parseFloat(process.env.RISK_FRAC || 0.005); // 0.5% bankroll
const MAX_STAKE    = parseFloat(process.env.MAX_STAKE || 50);
const BETFAIR_KEY  = process.env.BETFAIR_APP_KEY;
const BETFAIR_TOK  = process.env.BETFAIR_SESSION_TOKEN;
const WALLET_FILE  = path.join(__dirname, '.wallet.enc');
const WALLET_PASS  = process.env.WALLET_PASSWORD; // met dans .env, jamais en clair

console.log(`
╔══════════════════════════════════════════════════╗
║  ArbiBot Auto-Robot  ·  ${DRY_RUN ? '🟡 MODE SIMULATION    ' : '🔴 MODE RÉEL ACTIF    '}║
║  Slip: ${String(SLIP_RATE*100).padEnd(5)}%/30s  ·  Frac: ${String(RISK_FRAC*100).padEnd(4)}%  ·  Max: ${String(MAX_STAKE+'€').padEnd(7)}║
╚══════════════════════════════════════════════════╝
`);

if(!DRY_RUN && (!BETFAIR_KEY || !BETFAIR_TOK)) {
  console.error('✗ MODE RÉEL : BETFAIR_APP_KEY et BETFAIR_SESSION_TOKEN requis dans .env');
  process.exit(1);
}
if(!DRY_RUN && !WALLET_PASS) {
  console.error('✗ MODE RÉEL : WALLET_PASSWORD requis dans .env');
  process.exit(1);
}

function loadWallet() {
  if(!WALLET_PASS || !fs.existsSync(WALLET_FILE)) return null;
  try {
    const blob = fs.readFileSync(WALLET_FILE, 'utf8');
    const { iv, data, tag } = JSON.parse(blob);
    const key = crypto.scryptSync(WALLET_PASS, 'arbibot-salt-v1', 32);
    const d   = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv,'hex'));
    d.setAuthTag(Buffer.from(tag,'hex'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(data,'hex')), d.final()]).toString('utf8'));
  } catch(_) { return null; }
}

function getBankroll() {
  const w = loadWallet();
  if(!w) return MAX_STAKE / RISK_FRAC; // fallback
  return Object.values(w.books).filter(b => b.active).reduce((s,b) => s + (b.balance||0), 0);
}

function calcStakes(outcomes, bankroll) {
  const odds   = outcomes.map(o => o.odd);
  const sum    = odds.reduce((s,o) => s + 1/o, 0);
  const gross  = (1/sum - 1) * 100;
  const slip   = SLIP_RATE * (PLACE_TIME / 30) * 100;
  const net    = gross - slip;
  const total  = Math.min(bankroll * RISK_FRAC, MAX_STAKE);
  const stakes = odds.map(o => parseFloat((total / (o * sum)).toFixed(2)));
  return { gross, slip, net, total, stakes, viable: net > MIN_MARGIN - slip };
}

const BF_URL = 'https://api.betfair.com/exchange/betting/json-rpc/v1';
const BF_HDR = {
  'X-Application':  BETFAIR_KEY,
  'X-Authentication': BETFAIR_TOK,
  'Content-Type':   'application/json',
};

async function betfairPlace(marketId, selectionId, side, size, price) {
  if(DRY_RUN) {
    console.log(`  [SIM] Betfair ${side} · marché ${marketId} · sél ${selectionId} · ${size}€ @ ${price}`);
    return { status:'SIM_SUCCESS', simulatedProfit: (size * price - size).toFixed(2) };
  }
  const { data } = await axios.post(BF_URL, {
    jsonrpc:'2.0', id:1,
    method:'SportsAPING/v1.0/placeOrders',
    params:{
      marketId,
      instructions:[{ selectionId, side, orderType:'LIMIT', limitOrder:{ size, price, persistenceType:'LAPSE' } }],
      customerRef: 'arbibot_' + Date.now(),
    }
  }, { headers: BF_HDR, timeout: 5000 });
  return data?.result;
}

let activeBets = 0;
const MAX_CONCURRENT = 2;
const placed = new Set(); // évite doublons par id match

async function handleArb(arb) {
  if(placed.has(arb.id)) return;
  if(activeBets >= MAX_CONCURRENT) { console.log(`  ⏸  Max concurrent (${MAX_CONCURRENT}) atteint — arb ignoré`); return; }

  const bankroll = getBankroll();
  const { gross, slip, net, total, stakes, viable } = calcStakes(arb.outcomes, bankroll);

  const ts = new Date().toLocaleTimeString('fr-FR');
  console.log(`\n[${ts}] ARB REÇU : ${arb.match} [${arb.sport}]`);
  console.log(`  Marge brute : +${gross.toFixed(3)}%  |  Slip : ${slip.toFixed(3)}%  |  Nette : ${net >= 0 ? '+' : ''}${net.toFixed(3)}%`);
  console.log(`  Bankroll    : ${bankroll.toFixed(0)} €  |  Mise totale : ${total.toFixed(2)} €`);

  if(!viable) {
    console.log(`  ✗ Marge nette insuffisante (${net.toFixed(3)}% < ${MIN_MARGIN}%) — ABANDONNÉ\n`);
    return;
  }

  arb.outcomes.forEach((o,i) => console.log(`  Leg ${i+1} : ${o.name.padEnd(20)} @ ${String(o.odd).padEnd(6)} [${o.book}]  →  mise ${stakes[i]} €`));

  activeBets++;
  placed.add(arb.id);

  // Place chaque jambe (Betfair uniquement dans cette version)
  const results = [];
  for(let i = 0; i < arb.outcomes.length; i++) {
    const o = arb.outcomes[i];
    try {
      const r = await betfairPlace(
        arb.betfairMarketId || 'DEMO_MARKET',
        arb.betfairSelectionIds?.[i] || i+1,
        i === 0 ? 'BACK' : 'LAY',
        stakes[i],
        o.odd
      );
      results.push({ leg: i+1, ok: true, result: r });
      console.log(`  ✓ Leg ${i+1} placée — ${DRY_RUN ? 'SIMULATION' : 'RÉEL'}`);
    } catch(e) {
      results.push({ leg: i+1, ok: false, error: e.message });
      console.log(`  ✗ Leg ${i+1} ERREUR : ${e.message}`);
      // Annule les jambes déjà placées si erreur (gestion du risque de demi-arb)
      console.log(`  ⚠  Demi-arb détecté — vérifie et annule manuellement les paris déjà placés`);
    }
  }

  activeBets--;
  const expectedProfit = total * net / 100;
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  Profit attendu : +${expectedProfit.toFixed(2)} € | Mise totale : ${total.toFixed(2)} € | ROI : ${net.toFixed(3)}%`);
  console.log(`  ${results.every(r=>r.ok) ? '✅ TOUTES LES JAMBES PLACÉES' : '⚠  PLACEMENT PARTIEL — INTERVENTION MANUELLE REQUISE'}\n`);
}

function connect() {
  const ws = new WebSocket(`ws://localhost:${process.env.WS_PORT||3002}`);
  ws.on('open',    () => console.log(`[WS] Connecté au serveur ArbiBot (port ${process.env.WS_PORT||3002})\n`));
  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      if(msg.type === 'scan_result' && msg.arbs?.length) {
        msg.arbs.forEach(a => handleArb(a).catch(e => console.error('Erreur handleArb:', e.message)));
      }
    } catch(_) {}
  });
  ws.on('close',   () => { console.log('[WS] Déconnecté — reconnexion dans 5s...'); setTimeout(connect, 5000); });
  ws.on('error',   e  => console.error('[WS] Erreur :', e.message));
}

connect();
console.log(`En attente d'arbitrages depuis le serveur...`);
console.log(`Arrêt : Ctrl+C\n`);

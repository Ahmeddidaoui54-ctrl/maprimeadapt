#!/usr/bin/env node
/**
 * Calculateur capital de départ — ArbiBot
 * node capital-calc.js
 */
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(r => rl.question(q, r));

const LEVELS = [
  { name:'Risque 0',      frac:0.005, arbs_day:2,  net_margin:0.004 },
  { name:'Conservateur',  frac:0.010, arbs_day:3,  net_margin:0.006 },
  { name:'Modéré',        frac:0.030, arbs_day:5,  net_margin:0.008 },
  { name:'Agressif',      frac:0.050, arbs_day:8,  net_margin:0.012 },
];

const line  = '─'.repeat(48);
const dline = '═'.repeat(48);

function calcCapital(target_month, level, books) {
  const { frac, arbs_day, net_margin } = LEVELS[level];
  // Profit/mois = bankroll × frac × net_margin × arbs_day × 22j
  // → bankroll = target / (frac × net_margin × arbs_day × 22)
  const bankroll = target_month / (frac * net_margin * arbs_day * 22);
  const stake    = bankroll * frac;
  const per_book = bankroll / books * 1.2; // 20% buffer
  const daily    = stake * net_margin * arbs_day;
  const monthly  = daily * 22;
  const growth   = monthly / bankroll * 100;
  return { bankroll, stake, per_book, daily, monthly, growth };
}

function fmt(n) { return n.toLocaleString('fr-FR', { minimumFractionDigits:2, maximumFractionDigits:2 }); }

(async () => {
  console.log(`\n╔${dline}╗`);
  console.log(`║  CALCULATEUR CAPITAL DE DÉPART — ArbiBot  ║`);
  console.log(`╚${dline}╝\n`);

  const target = parseFloat(await ask('  Revenu mensuel cible (€) : ')) || 200;
  console.log(`\n  Niveau de risque :`);
  LEVELS.forEach((l,i) => console.log(`    [${i}] ${l.name.padEnd(14)} ${(l.frac*100).toFixed(1)}%/mise · ${l.arbs_day} arbs/j`));
  const level  = parseInt(await ask('\n  Votre choix [0-3] : ')) || 0;
  const books  = parseInt(await ask('  Nombre de bookmakers (3-5) : ')) || 4;
  rl.close();

  const r = calcCapital(target, level, books);

  console.log(`\n╔${dline}╗`);
  console.log(`║  RÉSULTATS — ${LEVELS[level].name.padEnd(33)}║`);
  console.log(`╠${dline}╣`);
  console.log(`║  Capital total recommandé  :  ${fmt(r.bankroll).padStart(12)} €  ║`);
  console.log(`║  Par bookmaker (×${books})        :  ${fmt(r.per_book).padStart(12)} €  ║`);
  console.log(`╠${dline}╣`);
  console.log(`║  Mise max par arbitrage    :  ${fmt(r.stake).padStart(12)} €  ║`);
  console.log(`║  Gain estimé / arb         :  ${fmt(r.stake * LEVELS[level].net_margin).padStart(12)} €  ║`);
  console.log(`║  Gain estimé / jour        :  ${fmt(r.daily).padStart(12)} €  ║`);
  console.log(`║  Gain estimé / mois        :  ${fmt(r.monthly).padStart(12)} €  ║`);
  console.log(`║  Croissance mensuelle      :  ${r.growth.toFixed(2).padStart(11)} %  ║`);
  console.log(`╠${dline}╣`);
  console.log(`║  RÉPARTITION RECOMMANDÉE                   ║`);
  console.log(`╠${dline}╣`);

  // Répartition par book
  const bookList = ['Betfair Exchange','Pinnacle','Unibet','Winamax','Betclic'].slice(0, books);
  bookList.forEach(b => console.log(`║  ${b.padEnd(20)} →  ${fmt(r.per_book).padStart(10)} €      ║`));

  console.log(`╠${dline}╣`);

  // Avertissements
  if(r.bankroll < 1000)
    console.log(`║  ⚠  Capital minimum absolu : 1 000 €          ║`);
  if(level >= 2)
    console.log(`║  ⚠  Risque élevé — drawdown possible -${(LEVELS[level].frac*100*5).toFixed(0)}%   ║`);
  if(level === 0)
    console.log(`║  ✓  Niveau le plus sûr — ruine quasi nulle     ║`);

  console.log(`╚${dline}╝\n`);

  console.log(`  → Étape suivante : renseigne tes credentials dans wallet.json`);
  console.log(`    puis lance : node wallet.js\n`);
})();

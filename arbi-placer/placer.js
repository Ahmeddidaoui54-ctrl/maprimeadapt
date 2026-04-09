#!/usr/bin/env node
/**
 * ArbiBot Placer — Playwright local
 * Usage: node placer.js --book1 betclic --odd1 2.10 --stake1 47.30
 *                       --book2 winamax --odd2 2.05 --stake2 48.78
 * ⚠️  Tu restes maître du clic final de confirmation.
 * ⚠️  Vérifie les ToS de chaque bookmaker — l'automatisation peut être restreinte.
 */

const { chromium } = require('playwright');
const readline = require('readline');
const { execSync } = require('child_process');
const cfg = require('./config.json');

const args = process.argv.slice(2).reduce((a,v,i,arr) => {
  if(v.startsWith('--')) a[v.slice(2)] = arr[i+1];
  return a;
}, {});

const legs = [];
let i = 1;
while(args[`book${i}`]) {
  legs.push({ book: args[`book${i}`], odd: args[`odd${i}`], stake: args[`stake${i}`], url: args[`url${i}`] || null });
  i++;
}
if(!legs.length) {
  console.log(`
Usage: node placer.js \\
  --book1 betclic  --odd1 2.10  --stake1 47.30  --url1 "https://..." \\
  --book2 winamax  --odd2 2.05  --stake2 48.78  --url2 "https://..."

Sans --url : le navigateur ouvre le site, tu navigues manuellement jusqu'au coupon.
Le robot attend que le champ de mise soit visible, remplit le montant, et s'arrête.
Tu cliques toi-même sur "Valider".
`);
  process.exit(0);
}

if(cfg.kill_apps_before_run) {
  const targets = ['Slack','Discord','Spotify','Teams','zoom.us','figma','notion','TextEdit','Photos','Mail'];
  let killed = 0;
  targets.forEach(app => {
    try { execSync(`killall "${app}" 2>/dev/null`); killed++; } catch(_) {}
  });
  // Ferme les autres instances Chrome/Chromium sauf celle qu'on va ouvrir
  try { execSync(`pkill -f "Google Chrome Helper" 2>/dev/null`); } catch(_) {}
  console.log(`[RAM] ${killed} app(s) fermée(s) — RAM libérée pour Playwright`);
}

const t0 = Date.now();
const slip = parseFloat(process.env.SLIP || '0.20'); // %/30s depuis env
function elapsed() { return ((Date.now()-t0)/1000).toFixed(1)+'s'; }
function slipNow(gross) {
  const s = slip/100 * ((Date.now()-t0)/1000/30);
  const net = gross - s * 100;
  return { slip: (s*100).toFixed(3), net: net.toFixed(3), ok: net > 0 };
}

function ask(q) {
  return new Promise(r => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); r(a.trim()); });
  });
}

async function fillStake(page, sel, amount) {
  await page.waitForSelector(sel, { timeout: 30000 });
  await page.click(sel);
  await page.fill(sel, '');
  await page.type(sel, String(amount), { delay: 30 });
}

(async () => {
  console.log(`\n╔═══════════════════════════════════════╗`);
  console.log(`║  ArbiBot Placer  ·  ${legs.length} jambe(s)         ║`);
  console.log(`╚═══════════════════════════════════════╝`);
  legs.forEach((l,i) => console.log(`  Leg ${i+1}: ${l.book.padEnd(10)} | cote ${l.odd} | mise ${l.stake} €${l.url ? ' | URL fournie' : ''}`));
  console.log('');

  const browser = await chromium.launch({
    headless: cfg.headless,
    args: ['--disable-blink-features=AutomationControlled','--disable-gpu','--no-sandbox','--memory-pressure-off'],
  });

  // Ouvre un contexte par jambe (profils isolés)
  const contexts = await Promise.all(legs.map(() => browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'fr-FR',
  })));

  const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));

  // Navigation parallèle
  console.log(`[${elapsed()}] Navigation parallèle...`);
  await Promise.all(legs.map(async (leg, i) => {
    const bk = cfg.bookmakers[leg.book];
    if(!bk) { console.error(`  ✗ Bookmaker inconnu: ${leg.book}`); return; }
    const target = leg.url || bk.base;
    await pages[i].goto(target, { waitUntil:'domcontentloaded', timeout:20000 });
    console.log(`  ✓ [${elapsed()}] ${leg.book} chargé`);
  }));

  // Pause : l'utilisateur navigue jusqu'au coupon si pas d'URL directe
  const noUrl = legs.some(l => !l.url);
  if(noUrl) {
    console.log(`\n⚡ Navigue jusqu'aux coupons dans chaque onglet, puis appuie sur ENTRÉE`);
    await ask('  → Prêt ? [ENTRÉE] ');
  }

  // Remplissage des mises en parallèle
  console.log(`\n[${elapsed()}] Remplissage des mises...`);
  await Promise.all(legs.map(async (leg, i) => {
    const sel = cfg.bookmakers[leg.book]?.sel?.stake_input;
    if(!sel) return;
    try {
      await fillStake(pages[i], sel, leg.stake);
      console.log(`  ✓ [${elapsed()}] ${leg.book} → ${leg.stake} € saisi`);
    } catch(e) {
      console.log(`  ✗ [${elapsed()}] ${leg.book} → champ non trouvé (navigue manuellement)`);
    }
  }));

  // Alerte slip
  const gross = legs.reduce((s,l) => s + 1/parseFloat(l.odd), 0);
  const arbMarginPct = ((1/gross - 1) * 100);
  const { slip: slipUsed, net, ok } = slipNow(arbMarginPct);
  console.log(`\n┌─ ANALYSE MARGE ──────────────────────────┐`);
  console.log(`│  Marge brute   : ${arbMarginPct > 0 ? '+' : ''}${arbMarginPct.toFixed(3)}%`);
  console.log(`│  Slip écoulé   : ${slipUsed}%  (${elapsed()})`);
  console.log(`│  Marge nette   : ${ok ? '+' : ''}${net}%  ${ok ? '✓ VALIDE' : '✗ ABANDONNER'}`);
  console.log(`└──────────────────────────────────────────┘`);

  if(!ok) {
    console.log(`\n🛑 Slip trop élevé — marge négative. Abandon recommandé.`);
    const force = await ask('  Forcer quand même ? (o/N) ');
    if(force.toLowerCase() !== 'o') { await browser.close(); process.exit(0); }
  }

  if(cfg.confirm_before_bet) {
    const totalStake = legs.reduce((s,l) => s + parseFloat(l.stake), 0).toFixed(2);
    console.log(`\n💶 Mise totale : ${totalStake} €`);
    console.log(`📋 Valide les coupons dans CHAQUE onglet (toi-même), puis ENTRÉE pour fermer.`);
    await ask('  → Confirmé ? [ENTRÉE] ');
  }

  await browser.close();
  const finalSlip = slipNow(arbMarginPct);
  console.log(`\n✅ Terminé en ${elapsed()} — Marge finale : ${finalSlip.net}%`);
  console.log(`   Profit attendu : +${(parseFloat(finalSlip.net)/100 * legs.reduce((s,l)=>s+parseFloat(l.stake),0)).toFixed(2)} €\n`);
})();

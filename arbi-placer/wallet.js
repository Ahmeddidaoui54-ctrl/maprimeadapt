#!/usr/bin/env node
/**
 * ArbiBot Wallet — gestionnaire de bankroll chiffré
 * Stocke les credentials et les soldes par bookmaker.
 * Les mots de passe sont chiffrés AES-256 localement.
 * Rien n'est envoyé à l'extérieur.
 */
require('dotenv').config();
const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const WALLET_FILE = path.join(__dirname, '.wallet.enc');
const ALGO        = 'aes-256-gcm';

function deriveKey(pass) {
  return crypto.scryptSync(pass, 'arbibot-salt-v1', 32);
}
function encrypt(text, pass) {
  const key = deriveKey(pass);
  const iv  = crypto.randomBytes(16);
  const c   = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([c.update(text,'utf8'), c.final()]);
  return JSON.stringify({ iv: iv.toString('hex'), data: enc.toString('hex'), tag: c.getAuthTag().toString('hex') });
}
function decrypt(blob, pass) {
  const { iv, data, tag } = JSON.parse(blob);
  const key = deriveKey(pass);
  const d   = crypto.createDecipheriv(ALGO, key, Buffer.from(iv,'hex'));
  d.setAuthTag(Buffer.from(tag,'hex'));
  return Buffer.concat([d.update(Buffer.from(data,'hex')), d.final()]).toString('utf8');
}

const rl = readline.createInterface({ input:process.stdin, output:process.stdout });
const ask  = q => new Promise(r => rl.question(q, r));
const askH = q => new Promise(r => {   // hidden (password)
  process.stdout.write(q);
  const stdin = process.openStdin();
  let pw = '';
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', c => {
    if(c === '\n' || c === '\r') { process.stdin.setRawMode(false); process.stdout.write('\n'); r(pw); }
    else if(c === '\u0003') process.exit();
    else { pw += c; process.stdout.write('*'); }
  });
});

function loadWallet(pass) {
  if(!fs.existsSync(WALLET_FILE)) return { books:{}, history:[], created: new Date().toISOString() };
  try { return JSON.parse(decrypt(fs.readFileSync(WALLET_FILE,'utf8'), pass)); }
  catch(_) { console.error('\n  ✗ Mot de passe incorrect ou fichier corrompu'); process.exit(1); }
}
function saveWallet(wallet, pass) {
  fs.writeFileSync(WALLET_FILE, encrypt(JSON.stringify(wallet, null,2), pass));
}

function printWallet(w) {
  const line = '─'.repeat(56);
  console.log(`\n╔${'═'.repeat(56)}╗`);
  console.log(`║  WALLET ArbiBot'.padEnd(55) ║`);
  console.log(`╠${line}╣`);
  let total = 0;
  if(!Object.keys(w.books).length) {
    console.log(`║  Aucun compte configuré'.padEnd(55) ║`);
  }
  Object.entries(w.books).forEach(([name, b]) => {
    total += b.balance || 0;
    const status = b.active ? '● ACTIF  ' : '○ inactif';
    console.log(`║  ${status} ${name.padEnd(14)} ${String(b.balance?.toFixed(2)||'0.00').padStart(10)} €  ${(b.login||'').padEnd(18)} ║`);
  });
  console.log(`╠${line}╣`);
  console.log(`║  TOTAL BANKROLL'.padEnd(38) ${String(total.toFixed(2)).padStart(10)} €  ║`);
  console.log(`╚${'═'.repeat(56)}╝\n`);
}

async function menu(wallet, pass) {
  console.log(`\n  [1] Voir le wallet`);
  console.log(`  [2] Ajouter un bookmaker`);
  console.log(`  [3] Mettre à jour un solde`);
  console.log(`  [4] Historique des transactions`);
  console.log(`  [5] Supprimer un bookmaker`);
  console.log(`  [6] Exporter (JSON déchiffré — usage interne)`);
  console.log(`  [0] Quitter`);
  const c = await ask('\n  Choix : ');

  if(c === '1') {
    printWallet(wallet);
  }
  else if(c === '2') {
    const name    = (await ask('  Nom bookmaker (ex: betfair) : ')).toLowerCase().trim();
    const login   = await ask('  Login / email : ');
    const pw      = await askH('  Mot de passe  : ');
    const balance = parseFloat(await ask('  Solde actuel (€) : ')) || 0;
    const apiKey  = await ask('  Clé API (laisser vide si aucune) : ');
    wallet.books[name] = { login, password: pw, balance, apiKey: apiKey||null, active: true, added: new Date().toISOString() };
    saveWallet(wallet, pass);
    console.log(`\n  ✓ ${name} ajouté — solde : ${balance} €`);
    logTx(wallet, name, balance, 'Dépôt initial');
    saveWallet(wallet, pass);
  }
  else if(c === '3') {
    const names = Object.keys(wallet.books);
    if(!names.length) { console.log('  Aucun compte'); return; }
    names.forEach((n,i) => console.log(`  [${i+1}] ${n} — ${wallet.books[n].balance} €`));
    const idx  = parseInt(await ask('  Numéro : ')) - 1;
    if(idx < 0 || idx >= names.length) return;
    const name = names[idx];
    const prev = wallet.books[name].balance;
    const newB = parseFloat(await ask(`  Nouveau solde (€) : `));
    const diff = newB - prev;
    wallet.books[name].balance = newB;
    logTx(wallet, name, diff, diff >= 0 ? 'Dépôt' : 'Retrait / perte');
    saveWallet(wallet, pass);
    console.log(`  ✓ Mis à jour : ${prev} € → ${newB} € (${diff >= 0 ? '+' : ''}${diff.toFixed(2)} €)`);
  }
  else if(c === '4') {
    const last = wallet.history?.slice(-20).reverse() || [];
    if(!last.length) { console.log('  Aucune transaction'); return; }
    console.log(`\n  ${'Date'.padEnd(22)} ${'Book'.padEnd(14)} ${'Montant'.padStart(10)}  Note`);
    console.log('  ' + '─'.repeat(60));
    last.forEach(t => console.log(`  ${t.date.slice(0,19).replace('T',' ').padEnd(22)} ${t.book.padEnd(14)} ${String((t.amount>=0?'+':'')+t.amount.toFixed(2)).padStart(10)} €  ${t.note}`));
  }
  else if(c === '5') {
    const names = Object.keys(wallet.books);
    names.forEach((n,i) => console.log(`  [${i+1}] ${n}`));
    const idx = parseInt(await ask('  Numéro à supprimer : ')) - 1;
    if(idx >= 0 && idx < names.length) {
      delete wallet.books[names[idx]];
      saveWallet(wallet, pass);
      console.log('  ✓ Supprimé');
    }
  }
  else if(c === '6') {
    const out = path.join(__dirname, 'wallet-export.json');
    fs.writeFileSync(out, JSON.stringify({ ...wallet, exported: new Date().toISOString() }, null, 2));
    console.log(`  ✓ Exporté → ${out}`);
    console.log(`  ⚠  ATTENTION : ce fichier contient tous tes mots de passe en CLAIR.`);
    console.log(`  ⚠  Supprime-le immédiatement après usage : rm ${out}`);
  }
  else if(c === '0') { rl.close(); process.exit(0); }

  return menu(wallet, pass);
}

function logTx(wallet, book, amount, note) {
  if(!wallet.history) wallet.history = [];
  wallet.history.push({ date: new Date().toISOString(), book, amount, note });
}

(async () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  ArbiBot Wallet  ·  Chiffrement AES-256  ║');
  console.log('╚══════════════════════════════════════════╝\n');
  const isNew = !fs.existsSync(WALLET_FILE);
  if(isNew) console.log('  Premier lancement — création du wallet chiffré.\n');
  const pass = await askH(isNew ? '  Choisissez un mot de passe maître : ' : '  Mot de passe maître : ');
  const wallet = loadWallet(pass);
  if(isNew) { saveWallet(wallet, pass); console.log('\n  ✓ Wallet créé et chiffré localement.'); }
  else console.log('\n  ✓ Wallet déchiffré.');
  printWallet(wallet);
  await menu(wallet, pass);
})();

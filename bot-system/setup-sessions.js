#!/usr/bin/env node
// ============================================================
// SETUP-SESSIONS.JS
// Ouvre un navigateur par plateforme pour se connecter manuellement.
// Les cookies/sessions sont sauvegardés dans ./sessions/
// À lancer 1 seule fois. Les sessions durent des semaines/mois.
// ============================================================

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PLATFORMS = [
  { id: 'lbc',    name: 'LeBonCoin',          url: 'https://www.leboncoin.fr/compte/connexion', file: './sessions/lbc.json' },
  { id: 'vinted', name: 'Vinted',              url: 'https://www.vinted.fr/member/general/login', file: './sessions/vinted.json' },
  { id: 'ebay',   name: 'eBay France',         url: 'https://signin.ebay.fr/ws/eBayISAPI.dll?SignIn', file: './sessions/ebay.json' },
  { id: 'fb',     name: 'Facebook Marketplace', url: 'https://www.facebook.com/login', file: './sessions/fb.json' },
];

const target = process.argv[2]; // ex: node setup-sessions.js lbc

async function setupPlatform(platform) {
  console.log(`\n🌐 Ouverture de ${platform.name}...`);
  console.log(`   Connectez-vous manuellement dans le navigateur.`);
  console.log(`   Fermez le navigateur quand c'est fait.\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(platform.url, { waitUntil: 'domcontentloaded' });

  // Attendre que l'utilisateur ferme le navigateur
  await new Promise(resolve => {
    browser.on('disconnected', resolve);
    // Aussi vérifier si la page navigue vers une page connectée
    page.on('close', resolve);
  });

  // Sauvegarder la session
  try {
    const state = await context.storageState();
    fs.mkdirSync(path.dirname(platform.file), { recursive: true });
    fs.writeFileSync(platform.file, JSON.stringify(state, null, 2));
    console.log(`✅ Session ${platform.name} sauvegardée → ${platform.file}`);
  } catch (e) {
    console.log(`⚠️  Navigateur fermé avant sauvegarde. Relancez pour ${platform.name}.`);
  }

  try { await browser.close(); } catch (e) { /* déjà fermé */ }
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  SETUP SESSIONS · Bot System v4.0       ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  Un navigateur va s\'ouvrir pour chaque  ║');
  console.log('║  plateforme. Connectez-vous, puis       ║');
  console.log('║  fermez le navigateur. C\'est tout.      ║');
  console.log('╚══════════════════════════════════════════╝');

  if (target) {
    const platform = PLATFORMS.find(p => p.id === target);
    if (!platform) {
      console.error(`Plateforme inconnue: ${target}. Options: ${PLATFORMS.map(p => p.id).join(', ')}`);
      process.exit(1);
    }
    await setupPlatform(platform);
  } else {
    // Toutes les plateformes, une par une
    for (const platform of PLATFORMS) {
      await setupPlatform(platform);
    }
  }

  console.log('\n🎉 Toutes les sessions sont prêtes.');
  console.log('   Le bot peut maintenant publier automatiquement.');
  console.log('   Relancez ce script si une session expire.\n');
}

main().catch(e => { console.error(e); process.exit(1); });

const db = require('./db');
const priceEngine = require('./price-engine');

// ============================================================
// ENTONNOIR D'ALERTES · Chaque plateforme nous prévient
// ============================================================
//
// ARCHITECTURE :
//
//   eBay        → alerte email → webhook → BOT ANALYSE
//   Vinted      → alerte email → webhook → BOT ANALYSE
//   LeBonCoin   → alerte email → webhook → BOT ANALYSE
//   Facebook MP → notification  → webhook → BOT ANALYSE
//   Interenchères → alerte email → webhook → BOT ANALYSE
//
//   Toutes les alertes convergent dans le MÊME entonnoir.
//   Le bot filtre : marge ≥ 50% ? acheteur probable ? → GO ou POUBELLE
//
// POURQUOI C'EST MIEUX QUE LE SCRAPING :
// - 100% légal (fonctionnalité native de chaque site)
// - 0% détectable (vous êtes un utilisateur normal avec des alertes)
// - Temps réel (le site vous prévient LUI-MÊME)
// - Gratuit
// - Pas de Playwright, pas de session, pas de ban
//
// COMMENT ÇA MARCHE :
// 1. Créer un compte dédié par plateforme
// 2. Configurer des alertes sur les mêmes produits partout
// 3. Toutes les alertes arrivent sur la même boîte email
// 4. Un webhook parse les emails → extrait titre + prix + lien
// 5. Le bot évalue → filtre → génère listing → notifie si bon

// ── COMPTES À CRÉER (1 par plateforme) ──

const ACCOUNTS = {
  ebay: {
    platform: 'eBay France',
    signupUrl: 'https://signup.ebay.fr',
    alertSetup: 'Mon eBay → Recherches sauvegardées → Activer alertes email',
    email: 'botsystem.ebay@gmail.com', // À créer
    features: ['Recherches sauvegardées avec alerte email', 'Enchères suivies', 'Vendeur: annonces illimitées'],
  },
  vinted: {
    platform: 'Vinted',
    signupUrl: 'https://www.vinted.fr/member/general/sign-up',
    alertSetup: 'Recherche → Sauvegarder → Activer notifications',
    email: 'botsystem.vinted@gmail.com',
    features: ['Recherches sauvegardées avec notifications push + email', 'Acheteur ET vendeur'],
  },
  leboncoin: {
    platform: 'LeBonCoin',
    signupUrl: 'https://www.leboncoin.fr/compte/creation',
    alertSetup: 'Recherche → Créer une alerte → Fréquence: immédiate',
    email: 'botsystem.lbc@gmail.com',
    features: ['Alertes email immédiates sur recherches sauvegardées', 'Gratuit sans limite'],
  },
  facebook: {
    platform: 'Facebook Marketplace',
    signupUrl: 'https://www.facebook.com/r.php',
    alertSetup: 'Marketplace → Recherche → Enregistrer → Notifications ON',
    email: 'botsystem.fb@gmail.com',
    features: ['Notifications in-app quand nouveau produit matche', 'Marketplace local + envoi'],
  },
  interencheres: {
    platform: 'Interenchères',
    signupUrl: 'https://www.interencheres.com/inscription',
    alertSetup: 'Mon compte → Alertes → Créer alerte par mot-clé',
    email: 'botsystem.encheres@gmail.com',
    features: ['Alertes email sur nouveaux lots', 'Suivi enchères en cours', 'Enchères en ligne'],
  },
  drouot: {
    platform: 'Drouot',
    signupUrl: 'https://www.drouot.com/inscription',
    alertSetup: 'Mon compte → Alertes → Mots-clés',
    email: 'botsystem.encheres@gmail.com', // Même email que interenchères
    features: ['Alertes lots par mot-clé', 'Enchères live en ligne'],
  }
};

// ── ALERTES À CONFIGURER SUR CHAQUE PLATEFORME ──
// Les MÊMES recherches partout = entonnoir qui compare les prix

// ── ALERTES BASÉES SUR L'ÉTUDE DE MARCHÉ RÉELLE ──
// 25 alertes ciblées sur les produits à marge vérifiée ≥50%
const ALERT_KEYWORDS = [
  // MARGE 200%+ : jouets vintage & POP MART
  'majorette lot',
  'dinky toys',
  'pop mart labubu',
  'pop mart figure secrete',
  'sac longchamp pliage',
  // MARGE 100-200% : Pokemon & Funko
  'lot carte pokemon ancienne',
  'carte pokemon 1ere edition',
  'booster pokemon scellé français',
  'display pokemon neuf',
  'funko pop chase',
  'funko pop exclusive convention',
  'stokke tripp trapp occasion',
  'babyzen yoyo occasion',
  'rameur domyos',
  // MARGE 50-100% : mode seconde main (sell-through vérifié)
  'nike air force 1 occasion',
  'new balance 530 occasion',
  'doc martens 1460',
  'north face nuptse occasion',
  // LEGO retirés (marge 35-600%)
  'lego star wars retiré neuf',
  'lego creator expert retiré',
  'lego pokemon neuf',
  // TECH fast flip
  'iphone 14 occasion',
  'dyson airwrap occasion',
  // CONSOMMABLES (marge 200-800%)
  'telecommande samsung lot',
  'contax t2',
  'canon ae-1',
  // Consommables marge haute
  'telecommande samsung lot',
  'cartouche hp 302 lot',
  'plateau micro ondes verre',
];

// ── WEBHOOK : recevoir et traiter les alertes ──
// Les emails d'alerte sont forwardés vers ce webhook
// Format attendu : { source, title, price, url, raw_email }

async function processAlert(alert) {
  const { source, title, price, url, image, raw } = alert;

  if (!title) return { error: 'Titre requis' };

  // 1. Parser le produit
  const product = priceEngine.parseProduct(title, '');

  // 2. Évaluer sur toutes les plateformes de revente
  const platforms = ['ebay_fr', 'vinted', 'leboncoin', 'facebook_mp'];
  const evaluations = [];

  for (const platform of platforms) {
    // Ne pas évaluer la revente sur la même plateforme que la source
    if (platform === source) continue;
    const eval_ = await priceEngine.evaluateOpportunity(title, price || 0, '', platform);
    evaluations.push({ platform, ...eval_ });
  }

  // Trouver la meilleure plateforme de revente
  const best = evaluations.sort((a, b) => b.margin - a.margin)[0];

  if (!best || best.margin <= 0) {
    await db.log('funnel', 'alert_refused', 'auto', `${source}: ${title.slice(0, 60)} → pas de marge`);
    return { accepted: false, title, reason: 'Aucune plateforme de revente rentable' };
  }

  // 3. Appliquer la grille
  const passesGrid = best.marginPct >= 50;
  const score = best.score;

  // 4. Stocker si ça passe
  if (passesGrid && best.margin > 3) {
    const hash = require('crypto').createHash('md5').update(`alert|${source}|${title}|${price}`).digest('hex');
    const urgence = best.marginPct >= 200 ? 'ROUGE' : best.marginPct >= 100 ? 'ORANGE' : 'VERTE';

    await db.insert('ops', {
      type: 'alert',
      source,
      signal: `[ALERTE ${source.toUpperCase()}] ${title.slice(0, 120)} — ${price}€ → ${best.sellPrice}€ sur ${best.sellPlatform} (marge ${best.margin}€, ${best.marginPct}%)`,
      score, urgence, hash,
      status: 'new',
      data: {
        url, image, price, source,
        product,
        bestPlatform: best.sellPlatform,
        sellPrice: best.sellPrice,
        margin: best.margin,
        marginPct: best.marginPct,
        allEvaluations: evaluations.map(e => ({ platform: e.sellPlatform, margin: e.margin, marginPct: e.marginPct })),
        action: `Acheter à ${price}€ sur ${source} → Revendre à ${best.sellPrice}€ sur ${best.sellPlatform} → Marge ${best.margin}€ (${best.marginPct}%)`
      }
    });

    await db.log('funnel', 'alert_accepted', 'auto',
      `${source}: ${title.slice(0, 50)} | ${price}€ → ${best.sellPrice}€ | +${best.margin}€ (${best.marginPct}%)`
    );

    return {
      accepted: true, title, price,
      bestPlatform: best.sellPlatform,
      sellPrice: best.sellPrice,
      margin: best.margin, marginPct: best.marginPct,
      score, urgence,
      action: `Acheter ${price}€ → Revendre ${best.sellPrice}€ sur ${best.sellPlatform}`,
      allPlatforms: evaluations.map(e => ({ platform: e.sellPlatform, margin: e.margin, pct: e.marginPct }))
    };
  }

  await db.log('funnel', 'alert_below_grid', 'auto', `${source}: ${title.slice(0, 50)} | marge ${best.marginPct}% < 50%`);
  return { accepted: false, title, margin: best.margin, marginPct: best.marginPct, reason: `Marge ${best.marginPct}% < minimum 50%` };
}

// ── STATS ENTONNOIR ──

async function funnelStats() {
  const allAlerts = await db.select('ops', { type: 'alert' }, { order: 'ts', limit: 100 });
  const accepted = allAlerts.filter(a => a.status === 'new');
  const totalMargin = accepted.reduce((s, a) => s + (a.data?.margin || 0), 0);

  return {
    total_alerts: allAlerts.length,
    accepted: accepted.length,
    refused: allAlerts.length - accepted.length,
    conversion_rate: allAlerts.length > 0 ? Math.round((accepted.length / allAlerts.length) * 100) + '%' : '0%',
    potential_margin: Math.round(totalMargin) + '€',
    by_source: allAlerts.reduce((acc, a) => {
      const src = a.source || 'unknown';
      if (!acc[src]) acc[src] = { total: 0, accepted: 0 };
      acc[src].total++;
      if (a.status === 'new') acc[src].accepted++;
      return acc;
    }, {})
  };
}

// ── GUIDE DE SETUP (affiché au user) ──

function getSetupGuide() {
  return {
    step1_email: {
      action: 'Créer 1 adresse Gmail dédiée (ex: botsystem.alerts@gmail.com)',
      pourquoi: 'Toutes les alertes de toutes les plateformes arrivent au même endroit',
      temps: '2 min'
    },
    step2_accounts: Object.entries(ACCOUNTS).map(([id, a]) => ({
      id,
      platform: a.platform,
      url: a.signupUrl,
      email: 'botsystem.alerts@gmail.com',
      setup: a.alertSetup,
      temps: '3 min par compte'
    })),
    step3_alerts: {
      action: 'Sur CHAQUE compte, créer des alertes pour ces mots-clés :',
      keywords: ALERT_KEYWORDS,
      frequence: 'Immédiate (temps réel)',
      temps: '10 min pour tout configurer'
    },
    step4_forward: {
      action: 'Dans Gmail : Paramètres → Transfert → Ajouter une adresse de transfert',
      destination: 'http://localhost:3001/api/funnel/email (ou votre URL Railway)',
      pourquoi: 'Les emails d\'alerte arrivent automatiquement dans le bot',
      alternative: 'Ou copier-coller le titre + prix manuellement via /api/funnel/alert'
    },
    total_temps: '~25 min pour tout configurer, puis c\'est 100% automatique'
  };
}

module.exports = { ACCOUNTS, ALERT_KEYWORDS, processAlert, funnelStats, getSetupGuide };

const db = require('./db');

// ============================================================
// STRATÉGIE 100€ · PLAN D'EXÉCUTION RÉALISTE
// ============================================================
//
// Capital : 100€
// Objectif mois 1 : autonomie (couvrir les 100€ + générer du profit)
// Méthode : le capital TOURNE — chaque flip libère l'argent pour le suivant
//
// Semaine 1 : Apprendre (5-10 petits flips, objectif 50€ de gain)
// Semaine 2 : Accélérer (10-15 flips, objectif 100€ cumulé)
// Semaine 3 : Mixer (petits + moyens, objectif 200€ cumulé)
// Semaine 4 : Scaler (volume + gros flips, objectif 300€+ cumulé)

// ── CATALOGUE D'OPÉRATIONS RÉALISTES ──
// Chaque entrée = testée et observée sur le marché français

const OPERATIONS = {

  // ════════════════════════════════════════
  // TIER 1 · MICRO-FLIPS (1-10€ d'achat)
  // Capital bloqué : 1-10€ pendant 24-72h
  // Idéal pour démarrer et apprendre
  // ════════════════════════════════════════

  telecommandes: {
    tier: 1,
    name: 'Télécommandes TV/portail',
    description: 'Acheter en lot sur AliExpress ou vide-greniers. Revendre à l\'unité sur eBay/LBC.',
    achatMin: 1, achatMax: 3,
    venteMin: 8, venteMax: 25,
    fraisMoyen: 1.5,
    margeTypique: '200-800%',
    difficulte: 'facile',
    tempsRevente: '24-72h',
    ou_acheter: ['AliExpress lot', 'Temu', 'vide-greniers', 'brocantes', 'Emmaüs'],
    ou_revendre: ['eBay FR', 'LeBonCoin', 'Facebook MP'],
    pourquoi_ca_marche: 'Les gens perdent leur télécommande et en ont besoin MAINTENANT. Ils ne comparent pas les prix.',
    risques: ['Modèle incompatible', 'Contrefaçon bas de gamme'],
    volume_estime: '3-5/semaine',
    conseil: 'Se spécialiser sur 3-4 marques (Samsung, LG, Sony). Stocker les modèles les plus courants.'
  },

  cartouches_encre: {
    tier: 1,
    name: 'Cartouches d\'encre neuves',
    description: 'Acheter des lots de cartouches compatibles. Revendre à l\'unité.',
    achatMin: 2, achatMax: 8,
    venteMin: 10, venteMax: 30,
    fraisMoyen: 2,
    margeTypique: '150-400%',
    difficulte: 'facile',
    tempsRevente: '24-48h',
    ou_acheter: ['AliExpress lot', 'Destockage en ligne', 'Liquidations'],
    ou_revendre: ['eBay FR', 'Amazon (si compte pro)', 'LeBonCoin'],
    pourquoi_ca_marche: 'Consommable obligatoire. Les gens cherchent moins cher que la marque officielle.',
    risques: ['Qualité variable des compatibles', 'Modèle obsolète'],
    volume_estime: '3-4/semaine',
    conseil: 'Cibler HP 302, 304, 305. Canon PG-540/CL-541. Epson 603. Ce sont les plus vendus.'
  },

  coques_lots: {
    tier: 1,
    name: 'Coques téléphone en lot',
    description: 'Acheter lot x20-50 sur Temu/AliExpress. Revendre 3-5€ pièce.',
    achatMin: 5, achatMax: 15,
    venteMin: 40, venteMax: 100,
    fraisMoyen: 5,
    margeTypique: '200-500%',
    difficulte: 'facile',
    tempsRevente: '1-2 semaines (vente progressive)',
    ou_acheter: ['Temu', 'AliExpress', '1688.com'],
    ou_revendre: ['Vinted', 'eBay', 'Facebook MP', 'marchés'],
    pourquoi_ca_marche: 'Tout le monde a un téléphone. Les coques se cassent. Achat impulsif.',
    risques: ['Délai livraison AliExpress (2-3 sem)', 'Tailles de téléphone qui changent'],
    volume_estime: '2-3 lots/mois',
    conseil: 'Commander les modèles iPhone 14/15/16 et Samsung S23/S24. Ce sont 70% du marché.'
  },

  pieces_electromenager: {
    tier: 1,
    name: 'Pièces détachées électroménager',
    description: 'Joint cocotte, plateau micro-ondes, sac aspirateur. Achat en lot, vente unitaire.',
    achatMin: 1, achatMax: 5,
    venteMin: 8, venteMax: 20,
    fraisMoyen: 2,
    margeTypique: '200-600%',
    difficulte: 'moyen',
    tempsRevente: '48-72h',
    ou_acheter: ['AliExpress', 'Destockage', 'Emmaüs'],
    ou_revendre: ['eBay FR', 'LeBonCoin', 'Amazon'],
    pourquoi_ca_marche: 'Pièce cassée = appareil inutilisable. L\'acheteur paie vite pour réparer.',
    risques: ['Compatibilité exacte du modèle', 'Retours si mauvaise pièce'],
    volume_estime: '2-3/semaine',
    conseil: 'Les plateaux micro-ondes en verre sont excellents : universels, fragiles, toujours demandés.'
  },

  cables_chargeurs: {
    tier: 1,
    name: 'Câbles & chargeurs en lot',
    description: 'Lot de câbles USB-C, Lightning, chargeurs rapides. Marge énorme en unitaire.',
    achatMin: 3, achatMax: 10,
    venteMin: 20, venteMax: 50,
    fraisMoyen: 3,
    margeTypique: '200-500%',
    difficulte: 'facile',
    tempsRevente: '1-2 semaines',
    ou_acheter: ['Temu lot', 'AliExpress', '1688.com'],
    ou_revendre: ['eBay', 'Vinted', 'Facebook MP', 'marchés'],
    pourquoi_ca_marche: 'Tout le monde perd ou casse ses câbles. Achat récurrent.',
    risques: ['Qualité variable', 'Normes CE'],
    volume_estime: '2/semaine',
    conseil: 'USB-C est le standard maintenant. Chargeurs 20W-65W se vendent très bien.'
  },

  // ════════════════════════════════════════
  // TIER 2 · PETITS FLIPS (10-30€ d'achat)
  // Capital bloqué : 10-30€ pendant 48h-1 semaine
  // ════════════════════════════════════════

  vintage_clothing: {
    tier: 2,
    name: 'Vêtements vintage (friperies)',
    description: 'Acheter en friperie/Emmaüs. Revendre sur Vinted/eBay avec photos soignées.',
    achatMin: 2, achatMax: 15,
    venteMin: 15, venteMax: 60,
    fraisMoyen: 3,
    margeTypique: '200-1000%',
    difficulte: 'moyen',
    tempsRevente: '3-14 jours',
    ou_acheter: ['Emmaüs', 'Friperies', 'Vide-greniers', 'Kilo shops'],
    ou_revendre: ['Vinted', 'eBay', 'Depop'],
    pourquoi_ca_marche: 'La mode vintage est en plein boom. Les marques 90s-2000s se vendent au prix du neuf.',
    risques: ['Pas de demande sur certaines pièces', 'Tailles non standard'],
    volume_estime: '3-5/semaine',
    conseil: 'Cibler : Levi\'s 501, Carhartt, Champion, Tommy Hilfiger, Starter jackets. Photo sur cintre blanc.'
  },

  sneakers: {
    tier: 2,
    name: 'Sneakers occasion/neuves',
    description: 'Acheter sous le prix marché. Revendre aux collectionneurs.',
    achatMin: 15, achatMax: 50,
    venteMin: 40, venteMax: 120,
    fraisMoyen: 5,
    margeTypique: '50-200%',
    difficulte: 'moyen',
    tempsRevente: '3-7 jours',
    ou_acheter: ['Vinted (erreurs de prix)', 'LeBonCoin', 'vide-greniers', 'outlets'],
    ou_revendre: ['eBay', 'Vinted', 'StockX (si neuf)'],
    pourquoi_ca_marche: 'Marché énorme. Les gens sous-estiment la valeur de leurs sneakers.',
    risques: ['Contrefaçons', 'Tailles invendables'],
    volume_estime: '1-2/semaine',
    conseil: 'Jordan 1, Nike Dunk, New Balance 550, Adidas Samba. Vérifier l\'authenticité.'
  },

  lego_retire: {
    tier: 2,
    name: 'LEGO sets retirés',
    description: 'Acheter des sets LEGO récemment retirés du catalogue. La valeur monte.',
    achatMin: 20, achatMax: 50,
    venteMin: 40, venteMax: 120,
    fraisMoyen: 5,
    margeTypique: '50-150%',
    difficulte: 'facile',
    tempsRevente: '1-4 semaines',
    ou_acheter: ['LeBonCoin', 'vide-greniers', 'soldes en magasin'],
    ou_revendre: ['eBay', 'BrickLink', 'LeBonCoin'],
    pourquoi_ca_marche: 'Les LEGO retirés prennent 10-20% de valeur par an. Marché de collectionneurs.',
    risques: ['Set incomplet', 'Boîte abîmée = -30% de valeur'],
    volume_estime: '1-2/semaine',
    conseil: 'Vérifier sur BrickLink le prix moyen. Privilégier les sets Star Wars et Technic.'
  },

  trading_cards: {
    tier: 2,
    name: 'Cartes Pokemon / Yu-Gi-Oh',
    description: 'Acheter des lots ou des boosters. Revendre les cartes de valeur individuellement.',
    achatMin: 5, achatMax: 30,
    venteMin: 15, venteMax: 100,
    fraisMoyen: 2,
    margeTypique: '100-500%',
    difficulte: 'moyen',
    tempsRevente: '24h-1 semaine',
    ou_acheter: ['Vide-greniers', 'LeBonCoin lots', 'Emmaüs', 'Temu (boosters)'],
    ou_revendre: ['eBay', 'Cardmarket', 'Facebook groupes'],
    pourquoi_ca_marche: 'Marché massif, surtout Pokemon. Les lots contiennent souvent des cartes de valeur ignorées.',
    risques: ['Contrefaçons', 'Valeur qui fluctue avec les rééditions'],
    volume_estime: '2-3/semaine',
    conseil: 'App TCGPlayer pour scanner les cartes et connaître le prix instantanément.'
  },

  parfums: {
    tier: 2,
    name: 'Parfums neufs sous blister',
    description: 'Acheter en déstockage ou duty-free. Revendre en ligne.',
    achatMin: 10, achatMax: 30,
    venteMin: 25, venteMax: 70,
    fraisMoyen: 3,
    margeTypique: '50-150%',
    difficulte: 'facile',
    tempsRevente: '3-7 jours',
    ou_acheter: ['Action', 'Destockage', 'Lidl/Aldi (marques)', 'Duty Free'],
    ou_revendre: ['Vinted', 'eBay', 'Facebook MP'],
    pourquoi_ca_marche: 'Les parfums ont une marge de base de 80%+. Même en déstockage, la marge reste.',
    risques: ['Réglementation transport', 'Authenticité questionnée en ligne'],
    volume_estime: '2-3/semaine',
    conseil: 'Coffrets cadeaux et miniatures ont le meilleur ratio marge/poids.'
  },

  // ════════════════════════════════════════
  // TIER 3 · FLIPS MOYENS (30-60€ d'achat)
  // Capital bloqué : 30-60€ pendant 1-2 semaines
  // ════════════════════════════════════════

  small_electronics: {
    tier: 3,
    name: 'Petit électronique reconditionné',
    description: 'AirPods, enceintes Bluetooth, casques. Tester, nettoyer, revendre.',
    achatMin: 20, achatMax: 50,
    venteMin: 50, venteMax: 120,
    fraisMoyen: 8,
    margeTypique: '50-150%',
    difficulte: 'moyen',
    tempsRevente: '3-7 jours',
    ou_acheter: ['LeBonCoin', 'Cash Converters', 'vide-greniers'],
    ou_revendre: ['eBay', 'Back Market', 'LeBonCoin'],
    pourquoi_ca_marche: 'Les gens vendent leurs anciens appareils pas cher quand ils upgradent.',
    risques: ['Panne cachée', 'Batterie fatiguée'],
    volume_estime: '1-2/semaine',
    conseil: 'Toujours tester avant d\'acheter. Les AirPods Pro 1ère gen se trouvent à 30€ et se revendent à 60-70€.'
  },

  outils_marque: {
    tier: 3,
    name: 'Outillage de marque (Makita, DeWalt)',
    description: 'Acheter en brocante/succession. Revendre sur eBay.',
    achatMin: 10, achatMax: 40,
    venteMin: 40, venteMax: 100,
    fraisMoyen: 7,
    margeTypique: '100-300%',
    difficulte: 'facile',
    tempsRevente: '3-7 jours',
    ou_acheter: ['Vide-greniers', 'Emmaüs', 'LeBonCoin (successions)', 'enchères en ligne'],
    ou_revendre: ['eBay FR', 'LeBonCoin'],
    pourquoi_ca_marche: 'Les artisans connaissent la valeur. Les particuliers qui vident un garage non.',
    risques: ['Batterie HS (perceuses sans fil)', 'Pièces manquantes'],
    volume_estime: '1-2/semaine',
    conseil: 'Les outils Makita bleu (pro) valent 2x plus que les verts (grand public). Vérifier la batterie.'
  },

  kitchen_premium: {
    tier: 3,
    name: 'Électroménager premium (KitchenAid, Le Creuset)',
    description: 'Acheter d\'occasion. Ces marques gardent leur valeur.',
    achatMin: 15, achatMax: 50,
    venteMin: 40, venteMax: 120,
    fraisMoyen: 8,
    margeTypique: '80-200%',
    difficulte: 'moyen',
    tempsRevente: '1-2 semaines',
    ou_acheter: ['Emmaüs', 'vide-greniers', 'LeBonCoin'],
    ou_revendre: ['eBay', 'Vinted (cuisine)', 'LeBonCoin'],
    pourquoi_ca_marche: 'Le Creuset neuf = 200-400€. D\'occasion à 20€ en brocante, ça se revend 60-80€.',
    risques: ['Poids = frais de port élevés', 'Émail abîmé = -50% de valeur'],
    volume_estime: '1/semaine',
    conseil: 'Les couleurs rares (bleu, vert) valent plus. Le Creuset vintage des années 70 est très demandé.'
  },

  // ════════════════════════════════════════
  // TIER 4 · GROS FLIPS (60-100€ d'achat)
  // Fast flip uniquement — acheteur déjà trouvé
  // ════════════════════════════════════════

  smartphones: {
    tier: 4,
    name: 'Smartphones (fast flip uniquement)',
    description: 'Achat-revente rapide. JAMAIS sans acheteur confirmé.',
    achatMin: 60, achatMax: 100,
    venteMin: 90, venteMax: 180,
    fraisMoyen: 10,
    margeTypique: '20-80%',
    difficulte: 'difficile',
    tempsRevente: 'immédiat (fast flip)',
    ou_acheter: ['LeBonCoin', 'Cash Converters', 'Renouvellement pro'],
    ou_revendre: ['eBay', 'Back Market', 'Swappie'],
    pourquoi_ca_marche: 'Volume énorme. Beaucoup de gens vendent en dessous du prix marché par urgence.',
    risques: ['Téléphone volé (IMEI blacklisté)', 'Batterie HS', 'iCloud lock'],
    volume_estime: '0.5-1/semaine',
    conseil: 'TOUJOURS vérifier IMEI sur imei.info. TOUJOURS tester avant de payer.'
  },

  gaming_consoles: {
    tier: 4,
    name: 'Consoles gaming (fast flip)',
    description: 'PS5, Switch, Steam Deck. Achat quand le prix est bas, revente immédiate.',
    achatMin: 80, achatMax: 100,
    venteMin: 120, venteMax: 200,
    fraisMoyen: 10,
    margeTypique: '20-60%',
    difficulte: 'moyen',
    tempsRevente: 'immédiat (fast flip)',
    ou_acheter: ['LeBonCoin (urgence)', 'Cash Converters', 'vide-greniers'],
    ou_revendre: ['eBay', 'LeBonCoin', 'Facebook Gaming'],
    pourquoi_ca_marche: 'Noël, anniversaires, sorties de jeux = pics de demande prévisibles.',
    risques: ['Console bannie en ligne', 'Manettes drift'],
    volume_estime: '0.5/semaine',
    conseil: 'Acheter en été (prix bas). Les bundles avec jeux se vendent mieux.'
  },
};

// ════════════════════════════════════════
// PLAN SEMAINE PAR SEMAINE
// ════════════════════════════════════════

const WEEKLY_PLAN = [
  {
    semaine: 1,
    titre: 'APPRENDRE — Petits flips sûrs',
    capital_depart: 100,
    budget_ops: 30,
    reserve: 70,
    objectif_gain: 50,
    nb_ops: '5-8',
    focus: ['telecommandes', 'cartouches_encre', 'cables_chargeurs'],
    actions: [
      'Créer comptes vendeur eBay FR + Vinted si pas fait',
      'Acheter 1 lot de télécommandes (5-10€)',
      'Acheter 1 lot de câbles USB-C (5-10€)',
      'Acheter 2-3 cartouches encre en déstockage',
      'Poster les annonces AVANT de recevoir (photos fournisseur)',
      'Première vente = première preuve que ça marche'
    ],
    kpi: 'Objectif : 5 ventes, 50€ de gain, capital récupéré'
  },
  {
    semaine: 2,
    titre: 'ACCÉLÉRER — Volume + premiers moyens flips',
    capital_depart: 150,
    budget_ops: 60,
    reserve: 90,
    objectif_gain: 100,
    nb_ops: '8-12',
    focus: ['telecommandes', 'cartouches_encre', 'vintage_clothing', 'trading_cards'],
    actions: [
      'Réinvestir les gains de S1 dans plus de stock',
      'Aller dans 1-2 friperies/Emmaüs chercher du vintage',
      'Scanner des lots Pokemon/Yu-Gi-Oh sur LBC',
      'Optimiser les annonces qui ne vendent pas (prix, photos, titre)',
      'Commencer à identifier les best-sellers (ce qui part vite)'
    ],
    kpi: 'Objectif : 10 ventes, 100€ cumulé, identifier 3 produits qui marchent'
  },
  {
    semaine: 3,
    titre: 'MIXER — Ajouter les moyens flips',
    capital_depart: 200,
    budget_ops: 80,
    reserve: 120,
    objectif_gain: 150,
    nb_ops: '10-15',
    focus: ['vintage_clothing', 'sneakers', 'outils_marque', 'parfums', 'lego_retire'],
    actions: [
      'Premier achat de sneakers ou LEGO (20-40€)',
      'Premier achat outil de marque en brocante',
      'Tester 1 nouveau canal (Facebook MP ou Depop)',
      'Automatiser : templates d\'annonces, photos standard',
      'Commencer les fast flips si opportunité (acheteur trouvé avant)'
    ],
    kpi: 'Objectif : 200€ cumulé, 2+ canaux de vente actifs'
  },
  {
    semaine: 4,
    titre: 'SCALER — Volume + gros flips ciblés',
    capital_depart: 300,
    budget_ops: 100,
    reserve: 200,
    objectif_gain: 200,
    nb_ops: '12-20',
    focus: ['tous les tiers', 'fast_flip si opportunité'],
    actions: [
      'Réinvestir dans les catégories qui marchent le mieux',
      'Premier gros flip (60-100€) UNIQUEMENT en fast flip',
      'Bilan du mois : quels produits, quelles marges, quel volume',
      'Ajuster la stratégie pour le mois 2',
      'DeFi : placer les gains excédentaires en yield stablecoin'
    ],
    kpi: 'Objectif : 300€+ cumulé, système rodé, prêt à scaler'
  }
];

// ════════════════════════════════════════
// FONCTIONS
// ════════════════════════════════════════

function getStrategy(capital = 100) {
  const tiers = {};
  for (const [id, op] of Object.entries(OPERATIONS)) {
    if (!tiers[op.tier]) tiers[op.tier] = [];
    const margeMin = op.venteMin - op.achatMax - op.fraisMoyen;
    const margeMax = op.venteMax - op.achatMin - op.fraisMoyen;
    const margePctMin = Math.round((margeMin / op.achatMax) * 100);
    const margePctMax = Math.round((margeMax / op.achatMin) * 100);
    tiers[op.tier].push({
      id, ...op,
      margeMin: Math.round(margeMin),
      margeMax: Math.round(margeMax),
      margePctMin,
      margePctMax
    });
  }
  return { capital, tiers, plan: WEEKLY_PLAN, totalOperations: Object.keys(OPERATIONS).length };
}

function getWeekPlan(week = 1) {
  const plan = WEEKLY_PLAN[week - 1];
  if (!plan) return { error: 'Semaine 1-4 uniquement' };
  const ops = plan.focus.map(id => OPERATIONS[id]).filter(Boolean);
  return { ...plan, operations: ops };
}

function getOperationDetail(id) {
  return OPERATIONS[id] || { error: 'Opération inconnue. Disponibles: ' + Object.keys(OPERATIONS).join(', ') };
}

function getMonthProjection(capital = 100, flipsPerWeek = 10, avgMargin = 15) {
  const weeks = 4;
  let currentCapital = capital;
  const projection = [];

  for (let w = 1; w <= weeks; w++) {
    const gain = flipsPerWeek * avgMargin;
    currentCapital += gain;
    projection.push({
      semaine: w,
      flips: flipsPerWeek,
      gain_semaine: gain,
      capital_cumule: currentCapital,
      gain_cumule: currentCapital - capital
    });
  }

  return {
    capital_depart: capital,
    flips_par_semaine: flipsPerWeek,
    marge_moyenne: avgMargin,
    projection,
    gain_total: currentCapital - capital,
    roi: Math.round(((currentCapital - capital) / capital) * 100) + '%'
  };
}

module.exports = { OPERATIONS, WEEKLY_PLAN, getStrategy, getWeekPlan, getOperationDetail, getMonthProjection };

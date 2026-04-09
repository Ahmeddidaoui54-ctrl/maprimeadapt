const db = require('./db');
const bots = require('./bots');
const priceEngine = require('./price-engine');

// ============================================================
// PIPELINE · Les bots se chaînent automatiquement
// ============================================================
//
// AVANT : Veille scanne → résultat dort en base → personne ne fait rien
// MAINTENANT :
//   Veille scanne
//     → Price Engine évalue chaque trouvaille (marque, modèle, état, prix réel)
//     → Si marge ≥ 50% : Bot Contenu génère le listing de revente
//     → Si score ≥ 8 : alerte immédiate
//     → Tout est loggé avec le détail
//
// CONSOMMATION :
//   0 appel API Claude. Tout est JS pur.
//   NewsAPI : 1 appel/jour (gratuit)
//   CoinGecko : ~10 appels/jour (gratuit, pas de clé)
//   DeFi Llama : ~4 appels/jour (gratuit, pas de clé)
//   Supabase : ~50 inserts/jour (gratuit, loin de la limite)

// ── PIPELINE MATIN (7h) ──
async function morningPipeline() {
  const results = { events: 0, web3: 0, processed: 0, listings: 0, alerts: [] };

  // 1. Check événements mondiaux
  const events = await bots.veilleCheckEvents();
  results.events = events.new;

  // 2. Scan Web3
  const web3 = await bots.veilleScanWeb3();
  results.web3 = web3.inserted;

  // 3. Process les nouvelles opportunités
  const processed = await processNewOpportunities();
  results.processed = processed.evaluated;
  results.listings = processed.listings;
  results.alerts = processed.alerts;

  await db.log('pipeline', 'morning', 'auto',
    `Events: ${results.events} | Web3: ${results.web3} | Évalués: ${results.processed} | Listings: ${results.listings} | Alertes: ${results.alerts.length}`
  );

  return results;
}

// ── PROCESS OPPORTUNITÉS EN ATTENTE ──
// Prend toutes les ops "new", les évalue, génère des listings si ça passe
async function processNewOpportunities() {
  const newOps = await db.select('ops', { status: 'new' }, { order: 'ts', limit: 20 });
  const results = { evaluated: 0, passed: 0, refused: 0, listings: 0, alerts: [] };

  for (const op of newOps) {
    // Ignorer les ops sans prix (DeFi yields, events)
    if (['web3_defi', 'evenement'].includes(op.type)) {
      // DeFi = pas d'achat/revente, c'est du yield
      // Events = info seulement
      await db.update('ops', op.id, { status: 'processed' });
      continue;
    }

    const price = op.data?.price;
    const title = op.signal || '';

    if (!price || !title) {
      await db.update('ops', op.id, { status: 'skipped' });
      continue;
    }

    // Évaluer avec le price engine
    const evaluation = await priceEngine.evaluateOpportunity(title, price, '', 'ebay_fr');
    results.evaluated++;

    // Stocker l'évaluation dans l'op
    await db.update('ops', op.id, {
      data: { ...op.data, evaluation },
      score: evaluation.score
    });

    if (evaluation.marginPct >= 50 && evaluation.margin > 3) {
      // ✅ Marge suffisante → générer listing
      results.passed++;

      const listing = bots.contenuGenerateListing
        ? require('./bots').contenuGenerateListing(
            { title, description: '', price, images: [], url: op.data?.url },
            'ebay_fr'
          )
        : null;

      if (listing && !listing.error) {
        await db.insert('items', {
          type: 'listing_ready',
          title: `${title.slice(0, 100)} → ${listing.sellPrice}€ sur ${listing.platformName}`,
          score: evaluation.score,
          status: 'ready',
          data: {
            opportunityId: op.id,
            evaluation,
            listing,
            action: `Acheter à ${price}€ → Revendre à ${listing.sellPrice}€ → Marge ${evaluation.margin}€ (${evaluation.marginPct}%)`
          }
        });
        results.listings++;
      }

      await db.update('ops', op.id, { status: 'listing_created' });

      // Alerte si score élevé
      if (evaluation.score >= 8) {
        results.alerts.push({
          type: 'high_score',
          score: evaluation.score,
          title,
          price,
          margin: evaluation.margin,
          marginPct: evaluation.marginPct,
          verdict: evaluation.verdict
        });
      }
    } else {
      // ❌ Marge insuffisante
      results.refused++;
      await db.update('ops', op.id, { status: 'refused', data: { ...op.data, evaluation, refuseReason: evaluation.verdict } });
    }
  }

  if (results.evaluated > 0) {
    await db.log('pipeline', 'process_opportunities', 'auto',
      `${results.evaluated} évalués | ${results.passed} passent (${results.listings} listings) | ${results.refused} refusés | ${results.alerts.length} alertes`
    );
  }

  return results;
}

// ── RAPPORT SOIR (20h) ──
async function eveningReport() {
  // Compter les activités du jour
  const today = new Date().toISOString().slice(0, 10);
  const allLogs = await db.select('logs', {}, { order: 'ts', limit: 100 });
  const todayLogs = allLogs.filter(l => l.ts && l.ts.startsWith(today));

  // Trades
  const trades = await db.select('ops', { type: 'trade' }, { order: 'ts' });
  const openTrades = trades.filter(t => t.status === 'open');
  const soldToday = trades.filter(t => t.status === 'sold' && t.ts?.startsWith(today));
  const pnlToday = soldToday.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);

  // Listings prêts
  const readyListings = await db.select('items', { type: 'listing_ready', status: 'ready' }, { order: 'ts' });

  // Opportunités
  const newOps = await db.select('ops', { status: 'new' }, {});
  const processedOps = await db.select('ops', { status: 'listing_created' }, {});

  const report = {
    date: today,
    activite: {
      logs_jour: todayLogs.length,
      par_bot: todayLogs.reduce((acc, l) => { acc[l.bot] = (acc[l.bot] || 0) + 1; return acc; }, {})
    },
    opportunites: {
      en_attente: newOps.length,
      avec_listing: processedOps.length,
      listings_prets: readyListings.length
    },
    trades: {
      ouverts: openTrades.length,
      vendus_aujourd: soldToday.length,
      pnl_jour: Math.round(pnlToday * 100) / 100,
      capital_engage: openTrades.reduce((s, t) => s + parseFloat(t.prix_achat || 0), 0)
    },
    listings_a_poster: readyListings.slice(0, 5).map(l => ({
      titre: l.title,
      action: l.data?.action
    })),
    consommation: {
      api_calls_jour: todayLogs.filter(l => ['check_evenement', 'scan_web3', 'scan_lbc'].includes(l.action)).length,
      cout_jour: '0€',
      supabase_rows: todayLogs.length
    }
  };

  await db.log('pipeline', 'evening_report', 'auto', JSON.stringify({
    ops: report.opportunites.en_attente + report.opportunites.avec_listing,
    listings: report.opportunites.listings_prets,
    pnl: report.trades.pnl_jour,
    logs: report.activite.logs_jour
  }));

  return report;
}

// ── OBTENIR LES LISTINGS PRÊTS À POSTER ──
async function getReadyListings() {
  return db.select('items', { type: 'listing_ready', status: 'ready' }, { order: 'score', limit: 20 });
}

module.exports = { morningPipeline, processNewOpportunities, eveningReport, getReadyListings };

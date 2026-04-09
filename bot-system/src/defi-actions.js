const web3 = require('./web3-sources');
const db = require('./db');

// ============================================================
// DEFI ACTIONS · Transformer les yields détectés en actions concrètes
// ============================================================

// Plateformes DeFi avec liens directs
const DEFI_PLATFORMS = {
  'aave-v3':              { name: 'Aave V3',          url: 'https://app.aave.com', chain: 'multi' },
  'compound-v3':          { name: 'Compound V3',      url: 'https://app.compound.finance', chain: 'ethereum' },
  'curve-dex':            { name: 'Curve',            url: 'https://curve.fi/#/ethereum/pools', chain: 'multi' },
  'convex-finance':       { name: 'Convex',           url: 'https://www.convexfinance.com/stake', chain: 'ethereum' },
  'yearn-finance':        { name: 'Yearn',            url: 'https://yearn.fi/vaults', chain: 'multi' },
  'morpho-v1':            { name: 'Morpho',           url: 'https://app.morpho.org', chain: 'ethereum' },
  'pendle':               { name: 'Pendle',           url: 'https://app.pendle.finance/trade/pools', chain: 'multi' },
  'aerodrome-slipstream': { name: 'Aerodrome',        url: 'https://aerodrome.finance/liquidity', chain: 'base' },
  'uniswap-v3':           { name: 'Uniswap V3',      url: 'https://app.uniswap.org/pools', chain: 'multi' },
  'uniswap-v4':           { name: 'Uniswap V4',      url: 'https://app.uniswap.org/pools', chain: 'multi' },
  'beefy':                { name: 'Beefy',            url: 'https://app.beefy.com', chain: 'multi' },
  'lido':                 { name: 'Lido',             url: 'https://stake.lido.fi', chain: 'ethereum' },
  'rocket-pool':          { name: 'Rocket Pool',      url: 'https://stake.rocketpool.net', chain: 'ethereum' },
  'blackhole-clmm':       { name: 'BlackHole',        url: 'https://app.blackhole.money', chain: 'multi' },
  'sky':                  { name: 'Sky (ex-Maker)',   url: 'https://app.sky.money', chain: 'ethereum' },
};

// Évaluer le risque d'un yield
function assessRisk(pool) {
  const risks = [];
  let riskLevel = 'LOW';

  // TVL trop bas = risque de rug
  if (pool.tvl < 200000) { risks.push('TVL < $200K — risque de liquidité'); riskLevel = 'HIGH'; }
  else if (pool.tvl < 500000) { risks.push('TVL < $500K — liquidité moyenne'); riskLevel = 'MEDIUM'; }

  // APY trop élevé = suspect
  if (pool.apy > 500) { risks.push(`APY ${pool.apy}% — probablement temporaire ou incitatif`); riskLevel = 'HIGH'; }
  else if (pool.apy > 100) { risks.push(`APY ${pool.apy}% — vérifier la source du rendement`); if (riskLevel === 'LOW') riskLevel = 'MEDIUM'; }

  // Stablecoin = moins risqué
  if (pool.stablecoin) { risks.push('Stablecoin — pas de risque de prix'); }
  else { risks.push('Non-stablecoin — risque de perte en capital'); if (riskLevel === 'LOW') riskLevel = 'MEDIUM'; }

  return { riskLevel, risks };
}

// Générer des actions concrètes pour les meilleurs yields
async function getActionableYields(minScore = 6, maxResults = 10) {
  const yields = await web3.dlTopYields(100000, 30);

  const actionable = yields
    .map(y => {
      const score = web3.scoreYield(y);
      if (score < minScore) return null;

      const platform = DEFI_PLATFORMS[y.project] || { name: y.project, url: null, chain: y.chain };
      const risk = assessRisk(y);

      return {
        // Identité
        project: y.project,
        platformName: platform.name,
        symbol: y.symbol,
        chain: y.chain,
        // Rendement
        apy: y.apy,
        apyBase: y.apyBase,
        apyReward: y.apyReward,
        tvl: y.tvl,
        stablecoin: y.stablecoin,
        // Score & risque
        score,
        riskLevel: risk.riskLevel,
        risks: risk.risks,
        // Action
        url: platform.url,
        action: `Déposer sur ${platform.name} (${y.chain}) — ${y.symbol} — ${y.apy}% APY`,
        // Simulation gains
        gains_100eur: Math.round(100 * (y.apy / 100) / 12 * 100) / 100,  // gain mensuel pour 100€
        gains_500eur: Math.round(500 * (y.apy / 100) / 12 * 100) / 100,
        gains_1000eur: Math.round(1000 * (y.apy / 100) / 12 * 100) / 100,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      // Trier par : risque LOW d'abord, puis score, puis APY
      const riskOrder = { LOW: 0, MEDIUM: 1, HIGH: 2 };
      if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      return b.score - a.score;
    })
    .slice(0, maxResults);

  await db.log('veille', 'defi_actions', 'auto', `${actionable.length} yields actionnables (min score ${minScore})`);
  return actionable;
}

// Rapport DeFi simplifié : combien je gagne avec X€
async function defiSimulation(capitalEur = 100) {
  const yields = await getActionableYields(6, 5);
  return {
    capital: capitalEur,
    currency: 'EUR',
    topOpportunities: yields.map(y => ({
      platform: y.platformName,
      pool: y.symbol,
      chain: y.chain,
      apy: y.apy + '%',
      risk: y.riskLevel,
      gainMensuel: Math.round(capitalEur * (y.apy / 100) / 12 * 100) / 100 + '€',
      gainAnnuel: Math.round(capitalEur * (y.apy / 100) * 100) / 100 + '€',
      url: y.url,
      action: y.action
    }))
  };
}

module.exports = { getActionableYields, defiSimulation, assessRisk, DEFI_PLATFORMS };

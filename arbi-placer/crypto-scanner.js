// ═══════════════════════════════════════════════════════════════
//  CRYPTO ARBITRAGE SCANNER — ArbiBot Extension
//  Stratégies: CEX/CEX spot · Triangulaire · Funding Rate
//  100% APIs publiques (aucune clé requise pour la lecture)
// ═══════════════════════════════════════════════════════════════

const axios = require('axios');

// ── CONFIG ──────────────────────────────────────────────────────
const CRYPTO_MIN_MARGIN   = parseFloat(process.env.CRYPTO_MIN_MARGIN   || '0.20');  // % min
const CRYPTO_TRI_MIN      = parseFloat(process.env.CRYPTO_TRI_MIN      || '0.15');  // % triangulaire
const CRYPTO_FUNDING_MIN  = parseFloat(process.env.CRYPTO_FUNDING_MIN  || '0.05');  // % funding 8h
const CRYPTO_MAX_STAKE    = parseFloat(process.env.CRYPTO_MAX_STAKE_USDT || '100'); // USDT
const CRYPTO_DRY_RUN      = process.env.CRYPTO_DRY_RUN !== 'false';

// Frais taker par défaut par exchange (%)
const FEES = { binance: 0.10, kraken: 0.26, bybit: 0.10, coinbase: 0.60 };

// Paires actives pour CEX/CEX (top liquidité)
const PAIRS_CEX = [
  'BTC/USDT','ETH/USDT','BNB/USDT','SOL/USDT','XRP/USDT',
  'DOGE/USDT','ADA/USDT','AVAX/USDT','MATIC/USDT','DOT/USDT',
  'LINK/USDT','UNI/USDT','LTC/USDT','BCH/USDT','ATOM/USDT',
];

// Triangles à scanner sur Binance
const TRIANGLES = [
  ['BTC','ETH','USDT'],
  ['BTC','BNB','USDT'],
  ['ETH','BNB','USDT'],
  ['BTC','SOL','USDT'],
  ['ETH','SOL','USDT'],
  ['BTC','XRP','USDT'],
  ['ETH','ADA','USDT'],
  ['BTC','AVAX','USDT'],
  ['BTC','DOT','USDT'],
  ['ETH','LINK','USDT'],
];

// ── FETCH PRICES ─────────────────────────────────────────────────

// Binance: renvoie { symbol: { bid, ask } }
async function fetchBinancePrices() {
  try {
    const { data } = await axios.get(
      'https://api.binance.com/api/v3/ticker/bookTicker',
      { timeout: 5000 }
    );
    const out = {};
    data.forEach(t => {
      out[t.symbol] = { bid: parseFloat(t.bidPrice), ask: parseFloat(t.askPrice) };
    });
    return out;
  } catch(e) { return null; }
}

// Kraken: renvoie { symbol: { bid, ask } }
async function fetchKrakenPrices() {
  try {
    // Mapper vers notation Kraken (XBT au lieu de BTC)
    const krakenPairs = PAIRS_CEX.map(p => p.replace('BTC','XBT').replace('/',''));
    const { data } = await axios.get(
      `https://api.kraken.com/0/public/Ticker?pair=${krakenPairs.join(',')}`,
      { timeout: 5000 }
    );
    if(data.error?.length) return null;
    const out = {};
    Object.entries(data.result).forEach(([sym, t]) => {
      // Renormaliser XBT→BTC
      const normalized = sym.replace('XBT','BTC').replace('ZEUR','EUR').replace('ZUSD','USD').replace('XXBT','BTC');
      out[normalized] = { bid: parseFloat(t.b[0]), ask: parseFloat(t.a[0]) };
    });
    return out;
  } catch(e) { return null; }
}

// Bybit: renvoie { symbol: { bid, ask } }
async function fetchBybitPrices() {
  try {
    const { data } = await axios.get(
      'https://api.bybit.com/v5/market/tickers?category=spot',
      { timeout: 5000 }
    );
    if(data.retCode !== 0) return null;
    const out = {};
    data.result.list.forEach(t => {
      if(t.bid1Price && t.ask1Price) {
        out[t.symbol] = { bid: parseFloat(t.bid1Price), ask: parseFloat(t.ask1Price) };
      }
    });
    return out;
  } catch(e) { return null; }
}

// Binance Futures: renvoie funding rates { symbol: { fundingRate, nextFundingTime } }
async function fetchBinanceFunding() {
  try {
    const { data } = await axios.get(
      'https://fapi.binance.com/fapi/v1/premiumIndex',
      { timeout: 5000 }
    );
    const out = {};
    data.forEach(t => {
      out[t.symbol] = {
        fundingRate:    parseFloat(t.lastFundingRate) * 100, // en %
        nextFundingTime: t.nextFundingTime,
        markPrice:      parseFloat(t.markPrice),
        indexPrice:     parseFloat(t.indexPrice),
      };
    });
    return out;
  } catch(e) { return null; }
}

// ── STRATÉGIE 1 : CEX/CEX SPOT ───────────────────────────────────
// Principe: acheter sur exchange A (ask) + vendre sur exchange B (bid)
// Profit = (bid_B - ask_A) / ask_A * 100 - frais_A - frais_B

function detectCEXArbs(pricesByExchange) {
  const arbs = [];
  const exchanges = Object.keys(pricesByExchange).filter(k => pricesByExchange[k]);

  PAIRS_CEX.forEach(pair => {
    // Construire symbol pour chaque exchange
    const symbolMap = {
      binance: pair.replace('/',''),           // BTCUSDT
      kraken:  pair.replace('BTC','BTC').replace('/',''), // BTCUSDT
      bybit:   pair.replace('/',''),           // BTCUSDT
    };

    const quotes = {};
    exchanges.forEach(ex => {
      const sym = symbolMap[ex];
      const p = pricesByExchange[ex]?.[sym];
      if(p && p.bid > 0 && p.ask > 0) quotes[ex] = p;
    });

    const exList = Object.keys(quotes);
    if(exList.length < 2) return;

    // Comparer toutes les paires d'exchanges
    for(let i = 0; i < exList.length; i++) {
      for(let j = 0; j < exList.length; j++) {
        if(i === j) continue;
        const buyEx  = exList[i];
        const sellEx = exList[j];
        const askA   = quotes[buyEx].ask;
        const bidB   = quotes[sellEx].bid;
        const feeA   = FEES[buyEx]  || 0.10;
        const feeB   = FEES[sellEx] || 0.10;

        // Spread net après frais
        const grossPct = (bidB - askA) / askA * 100;
        const netPct   = grossPct - feeA - feeB;

        if(netPct >= CRYPTO_MIN_MARGIN) {
          const stake   = Math.min(CRYPTO_MAX_STAKE / askA, CRYPTO_MAX_STAKE);
          const profit  = stake * askA * (netPct / 100);
          arbs.push({
            type:     'CEX_SPOT',
            pair,
            buyOn:    buyEx,
            sellOn:   sellEx,
            askPrice: parseFloat(askA.toFixed(6)),
            bidPrice: parseFloat(bidB.toFixed(6)),
            grossPct: parseFloat(grossPct.toFixed(4)),
            netPct:   parseFloat(netPct.toFixed(4)),
            feesPct:  parseFloat((feeA + feeB).toFixed(4)),
            stakeUSDT: parseFloat((stake * askA).toFixed(2)),
            profitUSDT: parseFloat(profit.toFixed(3)),
            action:   CRYPTO_DRY_RUN ? 'DRY_RUN' : 'PLACE',
          });
        }
      }
    }
  });

  return arbs.sort((a,b) => b.netPct - a.netPct);
}

// ── STRATÉGIE 2 : ARBITRAGE TRIANGULAIRE (Binance) ───────────────
// Principe: USDT → A → B → USDT
// Si produit des 3 conversions > 1 + frais → profit

function detectTriangularArbs(binancePrices) {
  if(!binancePrices) return [];
  const arbs = [];
  const FEE  = 1 - FEES.binance / 100;

  TRIANGLES.forEach(([a, b, base]) => {
    // Route 1: USDT → A → B → USDT
    // Achète A avec USDT: diviser par ask(AUSDT)
    // Achète B avec A:    diviser par ask(ABUSDT)... ou multiplier par bid(BAUSDT)
    // Vend B pour USDT:   multiplier par bid(BUSDT)

    const symABase = a + base;   // ex BTCUSDT
    const symAB    = a + b;      // ex BTCETH
    const symBBase = b + base;   // ex ETHUSDT
    const symBA    = b + a;      // ex ETHBTC

    const pABase = binancePrices[symABase];
    const pBBase = binancePrices[symBBase];
    const pAB    = binancePrices[symAB];
    const pBA    = binancePrices[symBA];

    // Route: USDT → A → B → USDT (via symABase, symBA, symBBase)
    if(pABase && pBA && pBBase) {
      const r = (1 / pABase.ask) * FEE   // achat A
              * pBA.bid * FEE             // vente A pour B (bid du côté BA)
              * pBBase.bid * FEE;         // vente B pour USDT
      const profitPct = (r - 1) * 100;
      if(profitPct >= CRYPTO_TRI_MIN) {
        const stakeUSDT = CRYPTO_MAX_STAKE;
        arbs.push({
          type:      'TRIANGULAR',
          path:      `USDT→${a}→${b}→USDT`,
          exchange:  'binance',
          ratio:     parseFloat(r.toFixed(8)),
          profitPct: parseFloat(profitPct.toFixed(4)),
          stakeUSDT,
          profitUSDT: parseFloat(stakeUSDT * (profitPct/100)).toFixed(3),
          route: [
            { buy: a, with: base, price: pABase.ask },
            { buy: b, with: a,    price: pBA.bid, side: 'sell_A' },
            { sell: b, for: base, price: pBBase.bid },
          ],
          action: CRYPTO_DRY_RUN ? 'DRY_RUN' : 'PLACE',
        });
      }
    }

    // Route inverse: USDT → B → A → USDT
    if(pBBase && pAB && pABase) {
      const r2 = (1 / pBBase.ask) * FEE
               * pAB.bid * FEE
               * pABase.bid * FEE;
      const profitPct2 = (r2 - 1) * 100;
      if(profitPct2 >= CRYPTO_TRI_MIN) {
        arbs.push({
          type:      'TRIANGULAR',
          path:      `USDT→${b}→${a}→USDT`,
          exchange:  'binance',
          ratio:     parseFloat(r2.toFixed(8)),
          profitPct: parseFloat(profitPct2.toFixed(4)),
          stakeUSDT: CRYPTO_MAX_STAKE,
          profitUSDT: parseFloat(CRYPTO_MAX_STAKE * (profitPct2/100)).toFixed(3),
          route: [
            { buy: b, with: base,  price: pBBase.ask },
            { buy: a, with: b,     price: pAB.bid, side: 'sell_B' },
            { sell: a, for: base,  price: pABase.bid },
          ],
          action: CRYPTO_DRY_RUN ? 'DRY_RUN' : 'PLACE',
        });
      }
    }
  });

  return arbs.sort((a,b) => b.profitPct - a.profitPct);
}

// ── STRATÉGIE 3 : FUNDING RATE ────────────────────────────────────
// Principe: si funding > seuil → short perp + long spot = revenu passif
// Profit par période 8h = fundingRate * position_USDT

function detectFundingArbs(funding, spotPrices) {
  if(!funding) return [];
  const arbs = [];

  Object.entries(funding).forEach(([perpSym, f]) => {
    // Seulement les paires USDT
    if(!perpSym.endsWith('USDT')) return;
    const absRate = Math.abs(f.fundingRate);
    if(absRate < CRYPTO_FUNDING_MIN) return;

    const spotSym = perpSym; // même symbole sur spot
    const spot    = spotPrices?.[spotSym];
    if(!spot) return;

    // APR estimé (3 périodes/jour × 365)
    const dailyPct = absRate * 3;
    const aprPct   = dailyPct * 365;

    arbs.push({
      type:        'FUNDING_RATE',
      pair:        perpSym,
      exchange:    'binance',
      fundingPct:  parseFloat(f.fundingRate.toFixed(6)),
      absRatePct:  parseFloat(absRate.toFixed(6)),
      direction:   f.fundingRate > 0 ? 'SHORT_PERP+LONG_SPOT' : 'LONG_PERP+SHORT_SPOT',
      nextFunding: new Date(f.nextFundingTime).toISOString(),
      markPrice:   f.markPrice,
      spotAsk:     spot.ask,
      slippage:    parseFloat(Math.abs(f.markPrice - spot.ask) / spot.ask * 100).toFixed(4),
      dailyPct:    parseFloat(dailyPct.toFixed(4)),
      aprPct:      parseFloat(aprPct.toFixed(2)),
      stakeUSDT:   CRYPTO_MAX_STAKE,
      profit8hUSDT: parseFloat(CRYPTO_MAX_STAKE * absRate / 100).toFixed(4),
      action:      CRYPTO_DRY_RUN ? 'DRY_RUN' : 'PLACE',
    });
  });

  return arbs
    .sort((a,b) => b.absRatePct - a.absRatePct)
    .slice(0, 20); // Top 20 seulement
}

// ── SCAN PRINCIPAL ────────────────────────────────────────────────

let cryptoScanCount  = 0;
let lastCryptoResult = { cex: [], triangular: [], funding: [], ts: null };

async function runCryptoScan() {
  cryptoScanCount++;
  const ts = new Date().toISOString();
  console.log(`[CRYPTO] Scan #${cryptoScanCount} démarré...`);

  // Fetch toutes les sources en parallèle
  const [binance, kraken, bybit, funding] = await Promise.all([
    fetchBinancePrices(),
    fetchKrakenPrices(),
    fetchBybitPrices(),
    fetchBinanceFunding(),
  ]);

  const sourceStatus = {
    binance: !!binance,
    kraken:  !!kraken,
    bybit:   !!bybit,
    funding: !!funding,
  };

  const available = Object.entries(sourceStatus).filter(([,v]) => v).map(([k]) => k);
  console.log(`[CRYPTO] Sources: ${available.join(', ') || 'aucune'}`);

  // Détecter les arbs
  const cexArbs = detectCEXArbs({ binance, kraken, bybit });
  const triArbs = detectTriangularArbs(binance);
  const fundArbs = detectFundingArbs(funding, binance);

  lastCryptoResult = {
    ts, scan: cryptoScanCount,
    sources: sourceStatus,
    cex:        cexArbs,
    triangular: triArbs,
    funding:    fundArbs,
    summary: {
      total:      cexArbs.length + triArbs.length + fundArbs.length,
      cex:        cexArbs.length,
      triangular: triArbs.length,
      funding:    fundArbs.length,
      bestNetPct: cexArbs[0]?.netPct || triArbs[0]?.profitPct || fundArbs[0]?.absRatePct || 0,
    },
  };

  const total = lastCryptoResult.summary.total;
  console.log(`[CRYPTO] Scan #${cryptoScanCount} terminé — ${total} opportunité(s) | CEX:${cexArbs.length} TRI:${triArbs.length} FUND:${fundArbs.length}`);

  if(cexArbs.length > 0) {
    const best = cexArbs[0];
    console.log(`[CRYPTO] ★ Meilleure CEX: ${best.pair} ${best.buyOn}→${best.sellOn} +${best.netPct}% net (~${best.profitUSDT} USDT)`);
  }

  return lastCryptoResult;
}

function getLastCryptoResult()  { return lastCryptoResult; }
function getCryptoScanCount()   { return cryptoScanCount; }

module.exports = { runCryptoScan, getLastCryptoResult, getCryptoScanCount };

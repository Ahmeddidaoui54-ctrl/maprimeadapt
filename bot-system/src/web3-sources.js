const axios = require('axios');
const crypto = require('crypto');

// ============================================================
// WEB3 + METAVERSE · Sources de données gratuites
// ============================================================
//
// APIs 100% gratuites utilisées :
// - CoinGecko     : prix crypto, trending, NFT floor prices (0€, pas de clé)
// - DeFi Llama    : TVL, yields, protocoles DeFi (0€, pas de clé)
// - OpenSea       : NFT collections, stats (gratuit avec clé)
// - Alchemy       : NFT metadata, transfers (free tier 300M CU/mois)
// - The Sandbox   : LAND data (API publique)
// - Decentraland  : parcels, wearables (API publique)

const TIMEOUT = 8000;

// ============================================================
// COINGECKO · Prix crypto + trending + NFT floors (0€)
// ============================================================

async function cgTrending() {
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/search/trending', { timeout: TIMEOUT });
    return {
      coins: (data.coins || []).map(c => ({
        id: c.item.id, name: c.item.name, symbol: c.item.symbol,
        rank: c.item.market_cap_rank, price_btc: c.item.price_btc,
        thumb: c.item.thumb
      })),
      nfts: (data.nfts || []).map(n => ({
        id: n.id, name: n.name, symbol: n.symbol,
        thumb: n.thumb, floor_eur: n.data?.floor_price
      }))
    };
  } catch (e) { console.error('[CG] trending:', e.message); return { coins: [], nfts: [] }; }
}

async function cgNftCollections(order = 'market_cap_usd_desc', perPage = 50) {
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/nfts/list', {
      params: { order, per_page: perPage, page: 1 },
      timeout: TIMEOUT
    });
    return (data || []).map(n => ({
      id: n.id, name: n.name, symbol: n.symbol,
      platform: n.asset_platform_id, contract: n.contract_address
    }));
  } catch (e) { console.error('[CG] nft list:', e.message); return []; }
}

async function cgNftDetail(id) {
  try {
    const { data } = await axios.get(`https://api.coingecko.com/api/v3/nfts/${id}`, { timeout: TIMEOUT });
    return {
      id: data.id, name: data.name,
      floor_price: data.floor_price, floor_eur: data.floor_price?.eur,
      market_cap: data.market_cap, volume_24h: data.volume_24h,
      holders: data.number_of_unique_addresses,
      floor_7d_pct: data.floor_price_7d_percentage_change,
      floor_30d_pct: data.floor_price_30d_percentage_change,
      total_supply: data.total_supply,
      links: { homepage: data.links?.homepage, twitter: data.links?.twitter }
    };
  } catch (e) { console.error('[CG] nft detail:', e.message); return null; }
}

async function cgTokenPrice(ids) {
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids: ids.join(','), vs_currencies: 'eur', include_24hr_change: true },
      timeout: TIMEOUT
    });
    return data;
  } catch (e) { console.error('[CG] price:', e.message); return {}; }
}

// ============================================================
// DEFI LLAMA · Yields, protocoles, TVL (0€)
// ============================================================

async function dlTopYields(minTvl = 100000, maxResults = 30) {
  try {
    const { data } = await axios.get('https://yields.llama.fi/pools', { timeout: TIMEOUT });
    return (data.data || [])
      .filter(p => p.tvlUsd >= minTvl && p.apy > 0 && p.stablecoin === true)
      .sort((a, b) => b.apy - a.apy)
      .slice(0, maxResults)
      .map(p => ({
        pool: p.pool, project: p.project, chain: p.chain,
        symbol: p.symbol, apy: Math.round(p.apy * 100) / 100,
        tvl: Math.round(p.tvlUsd), stablecoin: p.stablecoin,
        apyBase: p.apyBase, apyReward: p.apyReward
      }));
  } catch (e) { console.error('[DL] yields:', e.message); return []; }
}

async function dlProtocols(maxResults = 20) {
  try {
    const { data } = await axios.get('https://api.llama.fi/protocols', { timeout: TIMEOUT });
    return (data || [])
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, maxResults)
      .map(p => ({
        name: p.name, symbol: p.symbol, chain: p.chain,
        tvl: Math.round(p.tvl || 0), change_1d: p.change_1d,
        change_7d: p.change_7d, category: p.category
      }));
  } catch (e) { console.error('[DL] protocols:', e.message); return []; }
}

// ============================================================
// OPENSEA · Collections NFT + stats (gratuit avec clé optionnelle)
// ============================================================

async function osTopCollections(limit = 20) {
  const apiKey = process.env.OPENSEA_API_KEY;
  const headers = apiKey ? { 'X-API-KEY': apiKey } : {};
  try {
    const { data } = await axios.get('https://api.opensea.io/api/v2/collections', {
      params: { order_by: 'one_day_volume', limit },
      headers, timeout: TIMEOUT
    });
    return (data.collections || []).map(c => ({
      slug: c.collection, name: c.name, description: (c.description || '').slice(0, 100),
      image: c.image_url, opensea_url: c.opensea_url,
      total_supply: c.total_supply, created_date: c.created_date
    }));
  } catch (e) { console.error('[OS] collections:', e.message); return []; }
}

async function osCollectionStats(slug) {
  const apiKey = process.env.OPENSEA_API_KEY;
  const headers = apiKey ? { 'X-API-KEY': apiKey } : {};
  try {
    const { data } = await axios.get(`https://api.opensea.io/api/v2/collections/${slug}/stats`, {
      headers, timeout: TIMEOUT
    });
    return {
      slug,
      total: data.total,
      floor_price: data.total?.floor_price,
      volume_24h: data.intervals?.[0]?.volume,
      sales_24h: data.intervals?.[0]?.sales
    };
  } catch (e) { console.error('[OS] stats:', e.message); return null; }
}

// ============================================================
// METAVERSE · Decentraland + The Sandbox
// ============================================================

async function dcLandListings(maxResults = 20) {
  try {
    const { data } = await axios.get('https://nft-api.decentraland.org/v1/orders', {
      params: { contractAddress: '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d', status: 'open', sortBy: 'cheapest', first: maxResults },
      timeout: TIMEOUT
    });
    return (data.data || []).map(o => ({
      source: 'decentraland',
      type: 'LAND',
      tokenId: o.nftId,
      price_mana: parseFloat(o.price) / 1e18,
      seller: o.owner,
      coords: o.nft?.data?.parcel ? `${o.nft.data.parcel.x},${o.nft.data.parcel.y}` : null,
      url: `https://market.decentraland.org/contracts/0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d/tokens/${o.nftId}`
    }));
  } catch (e) { console.error('[DC] land:', e.message); return []; }
}

async function dcWearables(maxResults = 20) {
  try {
    const { data } = await axios.get('https://nft-api.decentraland.org/v1/orders', {
      params: { category: 'wearable', status: 'open', sortBy: 'cheapest', first: maxResults },
      timeout: TIMEOUT
    });
    return (data.data || []).map(o => ({
      source: 'decentraland',
      type: 'wearable',
      name: o.nft?.name,
      rarity: o.nft?.data?.wearable?.rarity,
      price_mana: parseFloat(o.price) / 1e18,
      url: o.nft?.url
    }));
  } catch (e) { console.error('[DC] wearables:', e.message); return []; }
}

async function sandboxLands() {
  try {
    const { data } = await axios.get('https://api.sandbox.game/lands/api/v2/lands', {
      params: { limit: 20 },
      timeout: TIMEOUT
    });
    return (data.lands || data || []).slice(0, 20).map(l => ({
      source: 'sandbox',
      type: 'LAND',
      id: l.id || l.tokenId,
      x: l.x, y: l.y,
      owner: l.owner,
      premium: l.premium || false
    }));
  } catch (e) { console.error('[SAND] lands:', e.message); return []; }
}

// ============================================================
// NICHES WEB3 + METAVERSE (ajoutées au système de niches)
// ============================================================

const WEB3_NICHES = {
  nft_bluechip: {
    cat: 'web3', name: 'NFT Blue Chip (BAYC, Azuki, Pudgy...)',
    keywords: ['bored ape', 'azuki', 'pudgy penguins', 'doodles', 'moonbirds', 'cool cats', 'cryptopunks'],
    margin: 'high', speed: 'fast', demand: 'high', season: null, priceMax: 50
  },
  nft_gaming: {
    cat: 'web3', name: 'NFT Gaming (Axie, Gods Unchained...)',
    keywords: ['axie infinity', 'gods unchained', 'illuvium', 'parallel tcg', 'big time nft', 'pixels nft'],
    margin: 'high', speed: 'medium', demand: 'medium', season: null, priceMax: 30
  },
  nft_art: {
    cat: 'web3', name: 'NFT Art génératif (Art Blocks...)',
    keywords: ['art blocks', 'generative art nft', 'fidenza', 'chromie squiggle', 'autoglyphs'],
    margin: 'high', speed: 'slow', demand: 'medium', season: null, priceMax: 50
  },
  nft_music: {
    cat: 'web3', name: 'NFT Musique (Sound.xyz, Catalog...)',
    keywords: ['sound xyz', 'catalog music nft', 'royal music nft', 'music nft', 'songcamp'],
    margin: 'medium', speed: 'medium', demand: 'medium', season: null, priceMax: 20
  },
  nft_domain: {
    cat: 'web3', name: 'Domaines Web3 (ENS, Unstoppable)',
    keywords: ['ens domain', 'ethereum name service', 'unstoppable domains', '.eth domain', '3 letter ens'],
    margin: 'high', speed: 'medium', demand: 'high', season: null, priceMax: 20
  },
  metaverse_land: {
    cat: 'metaverse', name: 'Terrains Metaverse (DCL, Sandbox)',
    keywords: ['decentraland land', 'sandbox land', 'otherside land', 'somnium space', 'voxels land'],
    margin: 'high', speed: 'slow', demand: 'medium', season: null, priceMax: 50
  },
  metaverse_wearables: {
    cat: 'metaverse', name: 'Wearables & Skins Metaverse',
    keywords: ['decentraland wearable', 'sandbox avatar', 'metaverse fashion', 'digital wearable', 'virtual clothing'],
    margin: 'high', speed: 'fast', demand: 'medium', season: null, priceMax: 15
  },
  metaverse_events: {
    cat: 'metaverse', name: 'Événements & Tickets Metaverse',
    keywords: ['metaverse event ticket', 'virtual concert nft', 'poap', 'metaverse conference', 'virtual gallery'],
    margin: 'medium', speed: 'fast', demand: 'medium', season: null, priceMax: 10
  },
  defi_yield: {
    cat: 'web3', name: 'DeFi Yield (stablecoins, LP)',
    keywords: ['stablecoin yield', 'liquidity pool', 'aave', 'compound', 'curve finance', 'convex', 'pendle'],
    margin: 'medium', speed: 'fast', demand: 'high', season: null, priceMax: 50
  },
  defi_airdrop: {
    cat: 'web3', name: 'Airdrops & Points farming',
    keywords: ['airdrop crypto', 'points farming', 'testnet airdrop', 'retroactive airdrop', 'eigenlayer points'],
    margin: 'high', speed: 'slow', demand: 'high', season: null, priceMax: 0
  },
  crypto_arbitrage: {
    cat: 'web3', name: 'Arbitrage CEX/DEX crypto',
    keywords: ['crypto arbitrage', 'dex cex spread', 'cross chain arbitrage', 'bridge arbitrage', 'mev'],
    margin: 'high', speed: 'fast', demand: 'high', season: null, priceMax: 50
  },
  rwa_tokenized: {
    cat: 'web3', name: 'RWA tokenisés (immobilier, art...)',
    keywords: ['tokenized real estate', 'rwa crypto', 'real world assets', 'tokenized art', 'ondo finance'],
    margin: 'medium', speed: 'slow', demand: 'medium', season: null, priceMax: 50
  },
  virtual_real_estate: {
    cat: 'metaverse', name: 'Immobilier virtuel (renting)',
    keywords: ['virtual land rental', 'metaverse rental', 'land lease nft', 'virtual real estate income'],
    margin: 'medium', speed: 'medium', demand: 'medium', season: null, priceMax: 50
  },
  web3_gaming_assets: {
    cat: 'web3', name: 'Assets jeux Web3 (skins, items)',
    keywords: ['web3 game item', 'blockchain game nft', 'play to earn', 'gaming nft floor', 'in-game nft'],
    margin: 'high', speed: 'fast', demand: 'high', season: null, priceMax: 20
  },
  ordinals_btc: {
    cat: 'web3', name: 'Bitcoin Ordinals & BRC-20',
    keywords: ['bitcoin ordinals', 'brc-20', 'bitcoin nft', 'ordinals inscription', 'runes bitcoin'],
    margin: 'high', speed: 'fast', demand: 'high', season: null, priceMax: 30
  },
  solana_nft: {
    cat: 'web3', name: 'Solana NFTs (Mad Lads, Tensorians...)',
    keywords: ['solana nft', 'mad lads', 'tensorians', 'claynosaurz', 'magic eden solana', 'tensor trade'],
    margin: 'high', speed: 'fast', demand: 'high', season: null, priceMax: 30
  }
};

// ============================================================
// SCORING WEB3 opportunités
// ============================================================

function scoreNftOpportunity(nft) {
  let score = 0;
  // Floor price en baisse = opportunité d'achat
  if (nft.floor_7d_pct && nft.floor_7d_pct < -20) score += 3;
  else if (nft.floor_7d_pct && nft.floor_7d_pct < -10) score += 2;
  // Volume élevé = liquidité
  if (nft.volume_24h && nft.volume_24h > 10) score += 2;
  else if (nft.volume_24h && nft.volume_24h > 1) score += 1;
  // Holders élevé = communauté solide
  if (nft.holders && nft.holders > 5000) score += 2;
  else if (nft.holders && nft.holders > 1000) score += 1;
  // Tendance 30j positive après dip = rebond
  if (nft.floor_30d_pct && nft.floor_30d_pct > 0 && nft.floor_7d_pct < 0) score += 2;
  return Math.min(10, score);
}

function scoreYield(pool) {
  let score = 0;
  // APY élevé
  if (pool.apy > 20) score += 3;
  else if (pool.apy > 10) score += 2;
  else if (pool.apy > 5) score += 1;
  // TVL élevé = sécurité
  if (pool.tvl > 10000000) score += 3;
  else if (pool.tvl > 1000000) score += 2;
  else if (pool.tvl > 100000) score += 1;
  // Stablecoin = moins de risque
  if (pool.stablecoin) score += 2;
  return Math.min(10, score);
}

// ============================================================
// SCAN WEB3 COMPLET (appelé par Bot Veille)
// ============================================================

async function scanWeb3() {
  const results = { nfts: [], yields: [], trending: null, metaverse: [] };

  // 1. Trending
  results.trending = await cgTrending();

  // 2. Top yields DeFi (stablecoins uniquement, TVL > 100K)
  results.yields = (await dlTopYields(100000, 15)).map(y => ({
    ...y, score: scoreYield(y),
    type: 'defi_yield', source: 'defillama'
  }));

  // 3. NFT trending avec scoring
  for (const nft of (results.trending.nfts || []).slice(0, 5)) {
    if (nft.id) {
      const detail = await cgNftDetail(nft.id);
      if (detail) {
        results.nfts.push({
          ...detail, score: scoreNftOpportunity(detail),
          type: 'nft', source: 'coingecko'
        });
      }
    }
  }

  // 4. Metaverse lands
  const dcLands = await dcLandListings(10);
  const dcWear = await dcWearables(10);
  results.metaverse = [...dcLands, ...dcWear];

  return results;
}

// ============================================================
// HASH pour déduplication
// ============================================================

function hashWeb3Item(item) {
  const key = `${item.source || 'web3'}|${item.id || item.name || item.pool}|${item.type}`;
  return crypto.createHash('md5').update(key).digest('hex');
}

module.exports = {
  // CoinGecko
  cgTrending, cgNftCollections, cgNftDetail, cgTokenPrice,
  // DeFi Llama
  dlTopYields, dlProtocols,
  // OpenSea
  osTopCollections, osCollectionStats,
  // Metaverse
  dcLandListings, dcWearables, sandboxLands,
  // Niches & scoring
  WEB3_NICHES, scoreNftOpportunity, scoreYield,
  // Scan complet
  scanWeb3, hashWeb3Item
};

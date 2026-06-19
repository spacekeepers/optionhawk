const TRADIER_BASE = "https://sandbox.tradier.com/v1";

const DTE_TARGET_BY_SETUP = {
  "Gap Fill Setup": 14,
  "IV Spike + Oversold": 14,
  "High OI Strike Magnet": 14,
  "Reversal at Key Level": 21,
  "Support Bounce": 21,
  "Resistance Break": 21,
  "Bull Flag Breakout": 35,
  "Bear Flag Breakdown": 35,
  "Momentum Continuation": 35,
};

async function tradierGet(path, params = {}) {
  const url = new URL(TRADIER_BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.TRADIER_API_KEY}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Tradier ${path} returned ${response.status}`);
  }
  return response.json();
}

function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdev(values) {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

function dailyLogReturns(closes) {
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  return returns;
}

function annualizedVol(returns, window, endIndex) {
  const slice = returns.slice(Math.max(0, endIndex - window + 1), endIndex + 1);
  if (slice.length < 2) return null;
  return stdev(slice) * Math.sqrt(252);
}

// Proxy for IV rank: percentile of current realized vol within its own trailing distribution.
// Tradier's free tier exposes a snapshot IV per contract but no historical IV series to rank against.
function percentileRank(series, value) {
  const valid = series.filter((v) => v !== null);
  if (valid.length === 0) return 50;
  const below = valid.filter((v) => v <= value).length;
  return Math.round((below / valid.length) * 100);
}

function sma(values, window) {
  return mean(values.slice(-window));
}

async function fetchDailyCloses(symbol) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 130);
  const fmt = (d) => d.toISOString().slice(0, 10);

  const data = await tradierGet("/markets/history", {
    symbol,
    interval: "daily",
    start: fmt(start),
    end: fmt(end),
  });
  return toArray(data.history?.day)
    .map((d) => +d.close)
    .filter((c) => Number.isFinite(c));
}

function classifySetup({ price, sma20, sma50, momentum5, momentum20, high20, low20, volRank, gapPct }) {
  const uptrend = price > sma20 && sma20 > sma50;
  const downtrend = price < sma20 && sma20 < sma50;
  const nearHigh = price >= high20 * 0.98;
  const nearLow = price <= low20 * 1.02;
  const divergence = momentum20 !== 0 && Math.sign(momentum5) !== Math.sign(momentum20);

  if (Math.abs(gapPct) >= 0.015) return "Gap Fill Setup";
  if (uptrend) return nearHigh ? "Resistance Break" : "Bull Flag Breakout";
  if (downtrend) return nearLow ? "Support Bounce" : "Bear Flag Breakdown";
  if (volRank >= 70 && Math.abs(momentum5) <= 0.01) return "IV Spike + Oversold";
  if (divergence) return "Reversal at Key Level";
  return "Momentum Continuation";
}

async function buildAlert(stock) {
  const symbol = stock.ticker;

  const [quoteData, closes] = await Promise.all([
    tradierGet("/markets/quotes", { symbols: symbol }),
    fetchDailyCloses(symbol),
  ]);

  const quote = toArray(quoteData.quotes?.quote)[0];
  if (!quote || !Number.isFinite(quote.last)) {
    throw new Error(`No quote data for ${symbol}`);
  }
  if (closes.length < 10) {
    throw new Error(`Not enough price history for ${symbol}`);
  }

  const price = quote.last;
  const n = closes.length;
  const sma20v = sma(closes, Math.min(20, n));
  const sma50v = sma(closes, Math.min(50, n));
  const momentum5 = n > 5 ? (price - closes[n - 6]) / closes[n - 6] : 0;
  const momentum20 = n > 20 ? (price - closes[n - 21]) / closes[n - 21] : 0;
  const recent20 = closes.slice(-20);
  const high20 = Math.max(...recent20, price);
  const low20 = Math.min(...recent20, price);
  const gapPct = quote.prevclose ? (quote.open - quote.prevclose) / quote.prevclose : 0;

  const returns = dailyLogReturns(closes);
  const volSeries = [];
  for (let i = 19; i < returns.length; i++) {
    volSeries.push(annualizedVol(returns, 20, i));
  }
  const currentVol20 = annualizedVol(returns, 20, returns.length - 1);
  const volRank = currentVol20 === null ? 50 : percentileRank(volSeries.slice(-60), currentVol20);

  const uptrend = price > sma20v && sma20v > sma50v;
  const downtrend = price < sma20v && sma20v < sma50v;
  const setupBase = classifySetup({
    price, sma20: sma20v, sma50: sma50v, momentum5, momentum20, high20, low20, volRank, gapPct,
  });
  const direction = uptrend ? "CALL" : downtrend ? "PUT" : momentum5 >= 0 ? "CALL" : "PUT";

  const trendStrength = uptrend || downtrend ? 1 : 0.4;
  const momentumStrength = Math.min(Math.abs(momentum20) / 0.1, 1);
  const volStrength = volRank / 100;
  const rawScore = 0.45 * trendStrength + 0.35 * momentumStrength + 0.2 * volStrength;
  const confidence = Math.round(55 + rawScore * 40);
  const signal = confidence >= 80 ? "STRONG" : confidence >= 65 ? "MODERATE" : "WATCH";

  const expirationsData = await tradierGet("/markets/options/expirations", {
    symbol, includeAllRoots: "true", strikes: "false",
  });
  const expirations = toArray(expirationsData.expirations?.date);
  if (expirations.length === 0) {
    throw new Error(`No option expirations for ${symbol}`);
  }

  const today = new Date();
  const targetDays = DTE_TARGET_BY_SETUP[setupBase] || 30;
  let chosenExpiration = expirations[0];
  let chosenDte = Infinity;
  for (const exp of expirations) {
    const dte = Math.round((new Date(exp) - today) / 86400000);
    if (dte < 3) continue;
    if (Math.abs(dte - targetDays) < Math.abs(chosenDte - targetDays)) {
      chosenExpiration = exp;
      chosenDte = dte;
    }
  }
  if (!Number.isFinite(chosenDte)) {
    chosenDte = Math.round((new Date(chosenExpiration) - today) / 86400000);
  }

  const chainData = await tradierGet("/markets/options/chains", {
    symbol, expiration: chosenExpiration, greeks: "true",
  });
  const contracts = toArray(chainData.options?.option);
  if (contracts.length === 0) {
    throw new Error(`No option chain for ${symbol}`);
  }

  const wantType = direction === "CALL" ? "call" : "put";
  const sameType = contracts.filter((c) => c.option_type === wantType);
  const offsetPct = 0.03 + (1 - rawScore) * 0.05;
  const idealStrike = direction === "CALL" ? price * (1 + offsetPct) : price * (1 - offsetPct);

  const otm = sameType.filter((c) => (direction === "CALL" ? c.strike > price : c.strike < price));
  const pool = otm.length > 0 ? otm : sameType;
  if (pool.length === 0) {
    throw new Error(`No usable strikes for ${symbol}`);
  }
  let contract = pool[0];
  let bestDiff = Infinity;
  for (const c of pool) {
    const diff = Math.abs(c.strike - idealStrike);
    if (diff < bestDiff) {
      bestDiff = diff;
      contract = c;
    }
  }

  let maxOiStrike = null;
  let maxOi = -1;
  for (const c of contracts) {
    const oi = c.open_interest || 0;
    if (oi > maxOi) {
      maxOi = oi;
      maxOiStrike = c.strike;
    }
  }
  const isOiMagnet = maxOiStrike !== null && Math.abs(maxOiStrike - price) / price < 0.015;
  const setup = isOiMagnet ? "High OI Strike Magnet" : setupBase;

  const bid = contract.bid || 0;
  const ask = contract.ask || 0;
  const premium = +(bid > 0 && ask > 0 ? (bid + ask) / 2 : contract.last || 0.05).toFixed(2);
  const riskReward = +(2 + rawScore * 3).toFixed(1);
  const targetPremium = +(premium * riskReward).toFixed(2);

  return {
    id: `${symbol}-${chosenExpiration}-${contract.strike}`,
    ticker: symbol,
    name: quote.description || stock.name || symbol,
    sector: stock.sector || "—",
    price: +price.toFixed(2),
    direction,
    setup,
    ivRank: volRank,
    confidence,
    dte: chosenDte,
    strike: contract.strike,
    premium,
    targetPremium,
    riskReward,
    signal,
    timestamp: new Date().toLocaleTimeString(),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.TRADIER_API_KEY) {
    return res.status(500).json({ error: "TRADIER_API_KEY is not configured" });
  }

  const watchlist = Array.isArray(req.body?.watchlist) ? req.body.watchlist : [];
  if (watchlist.length === 0) {
    return res.status(400).json({ error: "watchlist is required" });
  }

  const alerts = [];
  const errors = [];
  const batchSize = 5;
  for (let i = 0; i < watchlist.length; i += batchSize) {
    const batch = watchlist.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((stock) => buildAlert(stock)));
    results.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        alerts.push(result.value);
      } else {
        errors.push({ ticker: batch[idx].ticker, message: result.reason?.message || "Unknown error" });
      }
    });
  }

  alerts.sort((a, b) => b.confidence - a.confidence);
  return res.status(200).json({ alerts, errors });
}

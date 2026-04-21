// Synthetic instrument calculations

export interface SyntheticLeg {
  symbol: string;
  coefficient: number;
  side: "long" | "short";
}

export interface SyntheticKline {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface KlineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Calculate the effective coefficient for a leg
 * Long side: +coefficient, Short side: -coefficient
 */
function effectiveCoefficient(leg: SyntheticLeg): number {
  return leg.side === "long" ? leg.coefficient : -leg.coefficient;
}

/**
 * Calculate synthetic price from legs and current prices
 */
export function calculateSyntheticPrice(
  legs: SyntheticLeg[],
  prices: Record<string, number>
): number {
  let syntheticPrice = 0;

  for (const leg of legs) {
    const price = prices[leg.symbol];
    if (price === undefined) {
      console.warn(`Price not found for ${leg.symbol}`);
      continue;
    }
    syntheticPrice += effectiveCoefficient(leg) * price;
  }

  return syntheticPrice;
}

/**
 * Build synthetic kline series from component klines
 * All kline data must be aligned by timestamp first
 */
export function calculateSyntheticKline(
  legs: SyntheticLeg[],
  klineData: Record<string, KlineData[]>
): SyntheticKline[] {
  if (legs.length === 0) return [];

  // Find common timestamps
  const timestampSets = legs.map((leg) => {
    const klines = klineData[leg.symbol] || [];
    return new Set(klines.map((k) => k.timestamp));
  });

  let commonTimestamps = [...timestampSets[0]];
  for (let i = 1; i < timestampSets.length; i++) {
    const tsSet = timestampSets[i];
    commonTimestamps = commonTimestamps.filter((ts) => tsSet.has(ts));
  }

  commonTimestamps.sort((a, b) => a - b);

  // Create timestamp-to-index maps for each leg's klines
  const klineMaps = legs.map((leg) => {
    const klines = klineData[leg.symbol] || [];
    const map = new Map<number, KlineData>();
    for (const k of klines) {
      map.set(k.timestamp, k);
    }
    return map;
  });

  // Build synthetic klines
  return commonTimestamps.map((ts) => {
    let open = 0;
    let close = 0;
    let high = 0;
    let low = 0;
    let volume = 0;

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const kline = klineMaps[i].get(ts);
      if (!kline) continue;

      const coeff = effectiveCoefficient(leg);

      // For synthetic candles, we compute weighted OHLCV
      const weightedOpen = coeff * kline.open;
      const weightedClose = coeff * kline.close;
      const weightedHigh = coeff * kline.high;
      const weightedLow = coeff * kline.low;

      open += weightedOpen;
      close += weightedClose;

      // For high/low of the synthetic instrument:
      // If coefficient is positive, high contributes to high and low contributes to low
      // If coefficient is negative, high contributes to low and low contributes to high
      if (coeff >= 0) {
        high += weightedHigh;
        low += weightedLow;
      } else {
        high += weightedLow;  // Most negative value (closest to zero) becomes high
        low += weightedHigh;  // Most negative value (furthest from zero) becomes low
      }

      volume += Math.abs(coeff) * kline.volume;
    }

    return {
      timestamp: ts,
      open,
      high,
      low,
      close,
      volume,
    };
  });
}

/**
 * Auto-generate name from legs
 * e.g., "1.0*BTC - 0.85*ETH"
 */
export function generateSyntheticName(legs: SyntheticLeg[]): string {
  if (legs.length === 0) return "Empty";

  return legs
    .map((leg, index) => {
      const sign = leg.side === "long" ? (index === 0 ? "" : "+ ") : "- ";
      const coeff = Math.abs(leg.coefficient);
      const coeffStr =
        coeff === 1 ? "" : `${coeff.toFixed(4)}*`;
      return `${sign}${coeffStr}${leg.symbol.replace("USDT", "")}`;
    })
    .join(" ");
}

/**
 * Determine if a synthetic is a pair (2 legs) or basket (3+ legs)
 */
export function getSyntheticType(legs: SyntheticLeg[]): "pair" | "basket" {
  return legs.length === 2 ? "pair" : "basket";
}

/**
 * Format the synthetic formula for display
 */
export function formatSyntheticFormula(legs: SyntheticLeg[]): string {
  if (legs.length === 0) return "No legs defined";

  return legs
    .map((leg, index) => {
      const sign = leg.side === "long" ? (index === 0 ? "" : "+ ") : "- ";
      const coeff = Math.abs(leg.coefficient);
      const coeffStr = coeff === 1 ? "" : `${coeff.toFixed(4)} * `;
      return `${sign}${coeffStr}${leg.symbol}`;
    })
    .join(" ");
}

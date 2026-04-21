// Bybit V5 API Client for market data

export interface BybitInstrument {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  status: string;
  lotSizeFilter: {
    basePrecision: string;
    quotePrecision: string;
    minOrderQty: string;
    maxOrderQty: string;
    minOrderAmt: string;
    maxOrderAmt: string;
  };
  priceFilter: {
    minPrice: string;
    maxPrice: string;
    tickSize: string;
  };
}

export interface BybitTicker {
  symbol: string;
  lastPrice: string;
  highPrice24h: string;
  lowPrice24h: string;
  volume24h: string;
  turnover24h: string;
  priceChangePercent24h: string;
  fundingRate: string;
  markPrice: string;
  indexPrice: string;
}

export interface BybitKline {
  startTime: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: string;
  turnover: string;
}

export interface InstrumentInfo {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  lastPrice: number;
  volume24h: number;
}

export interface KlineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const BASE_URL = "https://api.bybit.com";

export async function getInstruments(category: string = "linear"): Promise<InstrumentInfo[]> {
  try {
    const url = `${BASE_URL}/v5/market/instruments-info?category=${category}&limit=1000`;
    const response = await fetch(url, { next: { revalidate: 300 } });

    if (!response.ok) {
      throw new Error(`Bybit API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.retCode !== 0) {
      throw new Error(`Bybit API error: ${data.retMsg}`);
    }

    const instruments: BybitInstrument[] = data.result.list;

    return instruments
      .filter(
        (inst) =>
          inst.status === "Trading" &&
          inst.quoteCoin === "USDT" &&
          inst.symbol.endsWith("USDT")
      )
      .map((inst) => ({
        symbol: inst.symbol,
        baseCoin: inst.baseCoin,
        quoteCoin: inst.quoteCoin,
        lastPrice: 0,
        volume24h: 0,
      }));
  } catch (error) {
    console.error("Error fetching instruments:", error);
    return [];
  }
}

export async function getKline(
  symbol: string,
  interval: string,
  limit: number = 200
): Promise<KlineData[]> {
  try {
    const url = `${BASE_URL}/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Bybit API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.retCode !== 0) {
      throw new Error(`Bybit API error: ${data.retMsg}`);
    }

    const klines: string[][] = data.result.list;

    return klines.map((k) => ({
      timestamp: Number(k[0]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));
  } catch (error) {
    console.error(`Error fetching kline for ${symbol}:`, error);
    return [];
  }
}

export async function getTicker(symbol: string): Promise<BybitTicker | null> {
  try {
    const url = `${BASE_URL}/v5/market/tickers?category=linear&symbol=${symbol}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Bybit API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.retCode !== 0 || !data.result.list?.length) {
      throw new Error(`Bybit API error: ${data.retMsg}`);
    }

    return data.result.list[0];
  } catch (error) {
    console.error(`Error fetching ticker for ${symbol}:`, error);
    return null;
  }
}

export async function getTickers(category: string = "linear"): Promise<BybitTicker[]> {
  try {
    const url = `${BASE_URL}/v5/market/tickers?category=${category}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Bybit API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.retCode !== 0) {
      throw new Error(`Bybit API error: ${data.retMsg}`);
    }

    return data.result.list;
  } catch (error) {
    console.error("Error fetching tickers:", error);
    return [];
  }
}

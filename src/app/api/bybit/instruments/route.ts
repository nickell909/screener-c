import { NextResponse } from "next/server";
import { getInstruments, getTickers } from "@/lib/bybit";

// Simple in-memory cache
let cachedInstruments: {
  data: {
    instruments: {
      symbol: string;
      baseCoin: string;
      quoteCoin: string;
      lastPrice: number;
      volume24h: number;
    }[];
  };
  timestamp: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    // Check cache
    if (cachedInstruments && Date.now() - cachedInstruments.timestamp < CACHE_TTL) {
      return NextResponse.json(cachedInstruments.data);
    }

    // Fetch instruments and tickers in parallel
    const [instruments, tickers] = await Promise.all([
      getInstruments("linear"),
      getTickers("linear"),
    ]);

    // Create a price/volume map from tickers
    const tickerMap = new Map(
      tickers.map((t) => [
        t.symbol,
        {
          lastPrice: parseFloat(t.lastPrice),
          volume24h: parseFloat(t.turnover24h), // Use turnover for more accurate ranking
        },
      ])
    );

    // Merge instrument info with ticker data
    const result = instruments
      .map((inst) => {
        const ticker = tickerMap.get(inst.symbol);
        return {
          symbol: inst.symbol,
          baseCoin: inst.baseCoin,
          quoteCoin: inst.quoteCoin,
          lastPrice: ticker?.lastPrice ?? 0,
          volume24h: ticker?.volume24h ?? 0,
        };
      })
      .filter((inst) => inst.lastPrice > 0)
      .sort((a, b) => b.volume24h - a.volume24h); // Sort by volume descending

    const data = { instruments: result };

    // Update cache
    cachedInstruments = { data, timestamp: Date.now() };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in instruments API:", error);
    return NextResponse.json(
      { error: "Failed to fetch instruments" },
      { status: 500 }
    );
  }
}

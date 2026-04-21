import { NextRequest, NextResponse } from "next/server";
import { getKline } from "@/lib/bybit";

// Simple in-memory cache
const klineCache = new Map<
  string,
  { data: { data: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[] }; timestamp: number }
>();
const CACHE_TTL = 60 * 1000; // 1 minute

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const interval = searchParams.get("interval") || "60";
    const limit = parseInt(searchParams.get("limit") || "200", 10);

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol parameter is required" },
        { status: 400 }
      );
    }

    // Check cache
    const cacheKey = `${symbol}-${interval}-${limit}`;
    const cached = klineCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const klines = await getKline(symbol, interval, limit);

    // Sort by timestamp ascending
    klines.sort((a, b) => a.timestamp - b.timestamp);

    const data = { data: klines };

    // Update cache
    klineCache.set(cacheKey, { data, timestamp: Date.now() });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in kline API:", error);
    return NextResponse.json(
      { error: "Failed to fetch kline data" },
      { status: 500 }
    );
  }
}

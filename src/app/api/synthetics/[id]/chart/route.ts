import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getKline } from "@/lib/bybit";
import { calculateSyntheticKline } from "@/lib/synthetic";
import type { SyntheticLeg, KlineData } from "@/lib/synthetic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const synthetic = await db.syntheticInstrument.findUnique({
      where: { id },
    });

    if (!synthetic) {
      return NextResponse.json(
        { error: "Synthetic not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const interval = searchParams.get("interval") || "60";
    const limit = parseInt(searchParams.get("limit") || "200", 10);

    const legs: SyntheticLeg[] = JSON.parse(synthetic.legs);

    // Fetch kline data for all legs in parallel
    const klinePromises = legs.map(async (leg) => {
      const klines = await getKline(leg.symbol, interval, limit);
      return { symbol: leg.symbol, klines };
    });

    const klineResults = await Promise.all(klinePromises);

    // Build kline data map
    const klineData: Record<string, KlineData[]> = {};
    for (const result of klineResults) {
      klineData[result.symbol] = result.klines;
    }

    // Calculate synthetic kline
    const syntheticKlines = calculateSyntheticKline(legs, klineData);

    // Calculate spread statistics
    const closePrices = syntheticKlines.map((k) => k.close);
    const mean =
      closePrices.length > 0
        ? closePrices.reduce((s, v) => s + v, 0) / closePrices.length
        : 0;
    const variance =
      closePrices.length > 1
        ? closePrices.reduce((s, v) => s + (v - mean) ** 2, 0) /
          (closePrices.length - 1)
        : 0;
    const stdDev = Math.sqrt(variance);
    const lastPrice = closePrices.length > 0 ? closePrices[closePrices.length - 1] : 0;
    const lastZScore = stdDev > 0 ? (lastPrice - mean) / stdDev : 0;

    return NextResponse.json({
      synthetic: {
        ...synthetic,
        legs: JSON.parse(synthetic.legs),
      },
      klines: syntheticKlines,
      stats: {
        mean,
        stdDev,
        lastPrice,
        lastZScore,
        percentDeviation: mean !== 0 ? ((lastPrice - mean) / mean) * 100 : 0,
        dataPoints: closePrices.length,
      },
    });
  } catch (error) {
    console.error("Error fetching synthetic chart:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}

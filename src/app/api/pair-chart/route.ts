import { NextRequest, NextResponse } from "next/server";
import { getKline } from "@/lib/bybit";
import { engleGrangerTest, calculateSpread, zScore } from "@/lib/cointegration";
import { alignSeries } from "@/lib/normalization";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol1 = searchParams.get("symbol1");
    const symbol2 = searchParams.get("symbol2");
    const interval = searchParams.get("interval") || "60";
    const limit = parseInt(searchParams.get("limit") || "200", 10);

    if (!symbol1 || !symbol2) {
      return NextResponse.json(
        { error: "Both symbol1 and symbol2 are required" },
        { status: 400 }
      );
    }

    // Fetch kline data for both symbols in parallel
    const [klines1, klines2] = await Promise.all([
      getKline(symbol1, interval, limit),
      getKline(symbol2, interval, limit),
    ]);

    if (klines1.length < 30 || klines2.length < 30) {
      return NextResponse.json(
        { error: "Insufficient data for analysis" },
        { status: 400 }
      );
    }

    // Align series by timestamp
    const series1 = klines1.map((k) => ({ timestamp: k.timestamp, value: k.close }));
    const series2 = klines2.map((k) => ({ timestamp: k.timestamp, value: k.close }));

    const [aligned1, aligned2] = alignSeries(series1, series2);

    if (aligned1.length < 30) {
      return NextResponse.json(
        { error: "Insufficient aligned data points" },
        { status: 400 }
      );
    }

    // Run Engle-Granger cointegration test
    const testResult = engleGrangerTest(aligned1, aligned2);

    // Calculate spread
    const spread = calculateSpread(aligned1, aligned2, testResult.hedgeRatio, testResult.intercept);

    // Calculate z-score of spread
    const spreadZScore = zScore(spread);

    // Calculate Bollinger Bands on the spread (20-period, 2 std dev)
    const bbPeriod = 20;
    const bbMultiplier = 2;
    const bbUpper: (number | null)[] = [];
    const bbMiddle: (number | null)[] = [];
    const bbLower: (number | null)[] = [];

    for (let i = 0; i < spread.length; i++) {
      if (i < bbPeriod - 1) {
        bbUpper.push(null);
        bbMiddle.push(null);
        bbLower.push(null);
      } else {
        const slice = spread.slice(i - bbPeriod + 1, i + 1);
        const m = slice.reduce((s, v) => s + v, 0) / slice.length;
        const v = slice.reduce((s, val) => s + (val - m) ** 2, 0) / (slice.length - 1);
        const sd = Math.sqrt(v);
        bbMiddle.push(m);
        bbUpper.push(m + bbMultiplier * sd);
        bbLower.push(m - bbMultiplier * sd);
      }
    }

    // Build aligned kline data for charting
    const timestamps1 = new Map(klines1.map((k) => [k.timestamp, k]));
    const timestamps2 = new Map(klines2.map((k) => [k.timestamp, k]));

    // Get common timestamps
    const commonTimestamps = klines1
      .filter((k) => timestamps2.has(k.timestamp))
      .map((k) => k.timestamp)
      .sort((a, b) => a - b);

    const alignedKlines1 = commonTimestamps.map((ts) => timestamps1.get(ts)!);
    const alignedKlines2 = commonTimestamps.map((ts) => timestamps2.get(ts)!);

    const spreadMean = spread.length > 0 ? spread.reduce((s, v) => s + v, 0) / spread.length : 0;
    const spreadStdDev =
      spread.length > 1
        ? Math.sqrt(spread.reduce((s, v) => s + (v - spreadMean) ** 2, 0) / (spread.length - 1))
        : 0;

    return NextResponse.json({
      symbol1,
      symbol2,
      interval,
      klines1: alignedKlines1,
      klines2: alignedKlines2,
      spread,
      zScore: spreadZScore,
      bollingerBands: { upper: bbUpper, middle: bbMiddle, lower: bbLower },
      cointegration: {
        pValue: testResult.pValue,
        adfStatistic: testResult.adfStatistic,
        hedgeRatio: testResult.hedgeRatio,
        intercept: testResult.intercept,
        halfLife: testResult.halfLife,
        cointegrated: testResult.cointegrated,
      },
      stats: {
        mean: spreadMean,
        stdDev: spreadStdDev,
        lastSpread: spread.length > 0 ? spread[spread.length - 1] : 0,
        lastZScore: spreadZScore.length > 0 ? spreadZScore[spreadZScore.length - 1] : 0,
        dataPoints: spread.length,
      },
    });
  } catch (error) {
    console.error("Error in pair chart API:", error);
    return NextResponse.json(
      { error: "Failed to fetch pair chart data" },
      { status: 500 }
    );
  }
}

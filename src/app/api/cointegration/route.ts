import { NextRequest, NextResponse } from "next/server";
import { getKline } from "@/lib/bybit";
import { scanCointegration, calculateSpread, zScore } from "@/lib/cointegration";
import { alignMultipleSeries } from "@/lib/normalization";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbols, interval, limit = 200, significanceLevel = 0.05 } = body;

    if (!symbols || !Array.isArray(symbols) || symbols.length < 2) {
      return NextResponse.json(
        { error: "At least 2 symbols are required" },
        { status: 400 }
      );
    }

    if (!interval) {
      return NextResponse.json(
        { error: "Interval is required" },
        { status: 400 }
      );
    }

    // Limit the number of symbols to prevent excessive API calls
    const maxSymbols = 30;
    const limitedSymbols = symbols.slice(0, maxSymbols);

    // Fetch kline data for all symbols in parallel
    const klinePromises = limitedSymbols.map(async (symbol: string) => {
      const klines = await getKline(symbol, interval, limit);
      return { symbol, klines };
    });

    const klineResults = await Promise.all(klinePromises);

    // Filter out symbols with no data
    const validResults = klineResults.filter(
      (r) => r.klines && r.klines.length >= 30
    );

    if (validResults.length < 2) {
      return NextResponse.json({
        results: [],
        message: "Insufficient data for cointegration analysis",
      });
    }

    // Prepare time series data for alignment
    const validSymbols = validResults.map((r) => r.symbol);
    const seriesArrays = validResults.map((r) =>
      r.klines.map((k) => ({ timestamp: k.timestamp, value: k.close }))
    );

    // Align all series by timestamp
    const { values: priceMatrix } = alignMultipleSeries(seriesArrays);

    if (priceMatrix.length < 2 || priceMatrix[0].length < 30) {
      return NextResponse.json({
        results: [],
        message: "Insufficient aligned data points",
      });
    }

    // Run cointegration scan
    const scanResults = scanCointegration(
      validSymbols,
      priceMatrix,
      significanceLevel
    );

    // Sort by p-value ascending and limit to top 100
    const sortedResults = scanResults
      .sort((a, b) => a.pValue - b.pValue)
      .slice(0, 100)
      .map((r) => {
        // Calculate spread and z-score for the top results
        const spread = calculateSpread(
          priceMatrix[validSymbols.indexOf(r.symbol1)] || [],
          priceMatrix[validSymbols.indexOf(r.symbol2)] || [],
          r.hedgeRatio,
          r.intercept
        );
        const spreadZScore = zScore(spread);
        const lastZScore =
          spreadZScore.length > 0 ? spreadZScore[spreadZScore.length - 1] : 0;
        const lastSpread = spread.length > 0 ? spread[spread.length - 1] : 0;

        return {
          symbol1: r.symbol1,
          symbol2: r.symbol2,
          pValue: r.pValue,
          adfStatistic: r.adfStatistic,
          hedgeRatio: r.hedgeRatio,
          intercept: r.intercept,
          halfLife: r.halfLife,
          correlation: r.correlation,
          cointegrated: r.cointegrated,
          lastSpread,
          lastZScore,
        };
      });

    return NextResponse.json({ results: sortedResults });
  } catch (error) {
    console.error("Error in cointegration API:", error);
    return NextResponse.json(
      { error: "Failed to run cointegration analysis" },
      { status: 500 }
    );
  }
}

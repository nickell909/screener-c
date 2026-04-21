"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSyntheticStore, type SavedSynthetic } from "@/store/synthetic-store";
import { useScreenerStore } from "@/store/screener-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createChart,
  LineSeries,
  HistogramSeries,
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type DeepPartial,
  type ChartOptions,
  type Time,
} from "lightweight-charts";
import {
  CandlestickChart,
  TrendingUp,
  BarChart3,
  Activity,
  Layers,
} from "lucide-react";

interface PairChartData {
  symbol1: string;
  symbol2: string;
  interval: string;
  klines1: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[];
  klines2: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[];
  spread: number[];
  zScore: number[];
  bollingerBands: { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] };
  cointegration: {
    pValue: number;
    adfStatistic: number;
    hedgeRatio: number;
    intercept: number;
    halfLife: number;
    cointegrated: boolean;
  };
  stats: {
    mean: number;
    stdDev: number;
    lastSpread: number;
    lastZScore: number;
    dataPoints: number;
  };
}

interface SyntheticChartData {
  synthetic: SavedSynthetic;
  klines: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[];
  stats: {
    mean: number;
    stdDev: number;
    lastPrice: number;
    lastZScore: number;
    percentDeviation: number;
    dataPoints: number;
  };
}

// ============ Chart sub-component using lightweight-charts ============

interface PairChartProps {
  data: PairChartData;
  showSpread: boolean;
  showZScore: boolean;
  showBB: boolean;
}

function PairChart({ data, showSpread, showZScore, showBB }: PairChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<{
    spread?: ISeriesApi<"Line">;
    bbUpper?: ISeriesApi<"Line">;
    bbLower?: ISeriesApi<"Line">;
    bbFill?: ISeriesApi<"Area">;
    zScore?: ISeriesApi<"Line">;
    zScoreFill?: ISeriesApi<"Area">;
    meanLine?: ISeriesApi<"Line">;
  }>({});

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!data?.spread) return null;

    const spreadData: { time: Time; value: number }[] = [];
    const bbUpperData: { time: Time; value: number }[] = [];
    const bbLowerData: { time: Time; value: number }[] = [];
    const bbFillTopData: { time: Time; value: number }[] = [];
    const bbFillBottomData: { time: Time; value: number }[] = [];
    const zScoreData: { time: Time; value: number }[] = [];
    const zScoreFillData: { time: Time; value: number }[] = [];
    const meanData: { time: Time; value: number }[] = [];

    const mean = data.stats.mean;

    for (let i = 0; i < data.spread.length; i++) {
      const kline = data.klines1?.[i];
      if (!kline) continue;
      const time = Math.floor(kline.timestamp / 1000) as Time;

      spreadData.push({ time, value: data.spread[i] });
      meanData.push({ time, value: mean });

      // Bollinger Bands
      const bbU = data.bollingerBands?.upper?.[i];
      const bbL = data.bollingerBands?.lower?.[i];
      if (bbU !== null && bbU !== undefined) {
        bbUpperData.push({ time, value: bbU });
      }
      if (bbL !== null && bbL !== undefined) {
        bbLowerData.push({ time, value: bbL });
      }

      // Z-Score
      if (data.zScore?.[i] !== undefined) {
        zScoreData.push({ time, value: data.zScore[i] });
        zScoreFillData.push({ time, value: data.zScore[i] });
      }
    }

    return {
      spreadData,
      bbUpperData,
      bbLowerData,
      zScoreData,
      zScoreFillData,
      meanData,
    };
  }, [data]);

  // Create and update chart
  useEffect(() => {
    if (!chartContainerRef.current || !chartData) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = {};
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.5)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(6,182,212,0.4)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "rgba(6,182,212,0.8)",
        },
        horzLine: {
          color: "rgba(6,182,212,0.4)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "rgba(6,182,212,0.8)",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
        minBarSpacing: 2,
      },
      handleScroll: { vertTouchDrag: false },
    } as DeepPartial<ChartOptions>);

    chartRef.current = chart;

    // ---- Main Pane (pane 0): Spread + BB + Mean ----

    // Mean reference line
    if (showSpread) {
      const meanSeries = chart.addSeries(LineSeries, {
        color: "rgba(255,255,255,0.2)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      meanSeries.setData(chartData.meanData);
      seriesRef.current.meanLine = meanSeries;
    }

    // Bollinger Bands - fill area
    if (showBB && chartData.bbUpperData.length > 0) {
      // BB Upper line
      const bbUpperSeries = chart.addSeries(LineSeries, {
        color: "rgba(239,68,68,0.35)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      bbUpperSeries.setData(chartData.bbUpperData);
      seriesRef.current.bbUpper = bbUpperSeries;

      // BB Lower line
      const bbLowerSeries = chart.addSeries(LineSeries, {
        color: "rgba(239,68,68,0.35)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      bbLowerSeries.setData(chartData.bbLowerData);
      seriesRef.current.bbLower = bbLowerSeries;

      // BB Fill - use area series with upper band data, base value at lower band
      // We'll use a semi-transparent area on the upper band
      const bbFillSeries = chart.addSeries(AreaSeries, {
        topColor: "rgba(239,68,68,0.08)",
        bottomColor: "rgba(239,68,68,0.02)",
        lineColor: "transparent",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      bbFillSeries.setData(chartData.bbUpperData);
      seriesRef.current.bbFill = bbFillSeries;
    }

    // Spread line
    if (showSpread) {
      const spreadSeries = chart.addSeries(LineSeries, {
        color: "#06b6d4",
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
        crosshairMarkerRadius: 4,
      });
      spreadSeries.setData(chartData.spreadData);
      seriesRef.current.spread = spreadSeries;
    }

    // ---- Z-Score Pane (pane 1) ----
    if (showZScore && chartData.zScoreData.length > 0) {
      const zScorePane = chart.addPane();
      zScorePane.setStretchFactor(0.3);

      // Z-Score area fill
      const zScoreFillSeries = chart.addSeries(AreaSeries, {
        topColor: "rgba(167,139,250,0.15)",
        bottomColor: "rgba(167,139,250,0.02)",
        lineColor: "transparent",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      }, 1);
      zScoreFillSeries.setData(chartData.zScoreFillData);
      seriesRef.current.zScoreFill = zScoreFillSeries;

      // Z-Score line
      const zScoreSeries = chart.addSeries(LineSeries, {
        color: "#a78bfa",
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
        crosshairMarkerRadius: 3,
        priceScaleId: "zscore",
      }, 1);
      zScoreSeries.setData(chartData.zScoreData);

      // Reference lines for Z-Score at ±2
      zScoreSeries.createPriceLine({
        price: 2,
        color: "rgba(239,68,68,0.3)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "+2",
      });
      zScoreSeries.createPriceLine({
        price: -2,
        color: "rgba(239,68,68,0.3)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "-2",
      });
      zScoreSeries.createPriceLine({
        price: 0,
        color: "rgba(255,255,255,0.15)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "0",
      });

      seriesRef.current.zScore = zScoreSeries;

      // Configure z-score price scale
      const zScorePriceScale = chart.priceScale("zscore", 1);
      zScorePriceScale.applyOptions({
        scaleMargins: { top: 0.1, bottom: 0.1 },
        borderVisible: true,
        borderColor: "rgba(255,255,255,0.1)",
      });
    }

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = {};
    };
  }, [chartData, showSpread, showZScore, showBB]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full h-full min-h-[400px]"
    />
  );
}

interface SyntheticChartProps {
  data: SyntheticChartData;
  showZScore: boolean;
  showBB: boolean;
}

function SyntheticChart({ data, showZScore, showBB }: SyntheticChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!data?.klines) return null;

    const klines = data.klines;
    const mean = data.stats.mean;
    const stdDev = data.stats.stdDev;
    const bbPeriod = 20;
    const bbMultiplier = 2;

    const closeData: { time: Time; value: number }[] = [];
    const meanData: { time: Time; value: number }[] = [];
    const bbUpperData: { time: Time; value: number }[] = [];
    const bbLowerData: { time: Time; value: number }[] = [];
    const zScoreData: { time: Time; value: number }[] = [];
    const volumeData: { time: Time; value: number; color: string }[] = [];

    for (let i = 0; i < klines.length; i++) {
      const kline = klines[i];
      const time = Math.floor(kline.timestamp / 1000) as Time;

      closeData.push({ time, value: kline.close });
      meanData.push({ time, value: mean });

      // Bollinger Bands
      if (showBB && i >= bbPeriod - 1) {
        const slice = klines.slice(i - bbPeriod + 1, i + 1).map((k) => k.close);
        const m = slice.reduce((s, v) => s + v, 0) / slice.length;
        const v = slice.reduce((s, val) => s + (val - m) ** 2, 0) / (slice.length - 1);
        const sd = Math.sqrt(v);
        bbUpperData.push({ time, value: m + bbMultiplier * sd });
        bbLowerData.push({ time, value: m - bbMultiplier * sd });
      }

      // Z-Score
      const zs = stdDev > 0 ? (kline.close - mean) / stdDev : 0;
      zScoreData.push({ time, value: zs });

      // Volume
      const volColor = kline.close >= kline.open
        ? "rgba(6,182,212,0.3)"
        : "rgba(239,68,68,0.3)";
      volumeData.push({ time, value: kline.volume, color: volColor });
    }

    return {
      closeData,
      meanData,
      bbUpperData,
      bbLowerData,
      zScoreData,
      volumeData,
    };
  }, [data, showBB]);

  // Create and update chart
  useEffect(() => {
    if (!chartContainerRef.current || !chartData) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.5)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(6,182,212,0.4)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "rgba(6,182,212,0.8)",
        },
        horzLine: {
          color: "rgba(6,182,212,0.4)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "rgba(6,182,212,0.8)",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
        minBarSpacing: 2,
      },
      handleScroll: { vertTouchDrag: false },
    } as DeepPartial<ChartOptions>);

    chartRef.current = chart;

    // ---- Main Pane (pane 0): Close + BB + Mean ----

    // Mean reference line
    const meanSeries = chart.addSeries(LineSeries, {
      color: "rgba(255,255,255,0.2)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    meanSeries.setData(chartData.meanData);

    // Bollinger Bands
    if (showBB && chartData.bbUpperData.length > 0) {
      const bbUpperSeries = chart.addSeries(LineSeries, {
        color: "rgba(239,68,68,0.35)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      bbUpperSeries.setData(chartData.bbUpperData);

      const bbLowerSeries = chart.addSeries(LineSeries, {
        color: "rgba(239,68,68,0.35)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      bbLowerSeries.setData(chartData.bbLowerData);

      // BB fill area
      const bbFillSeries = chart.addSeries(AreaSeries, {
        topColor: "rgba(239,68,68,0.08)",
        bottomColor: "rgba(239,68,68,0.02)",
        lineColor: "transparent",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      bbFillSeries.setData(chartData.bbUpperData);
    }

    // Close price line
    const closeSeries = chart.addSeries(LineSeries, {
      color: "#06b6d4",
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
      crosshairMarkerRadius: 4,
    });
    closeSeries.setData(chartData.closeData);

    // ---- Volume Pane (pane 1) ----
    const volumePane = chart.addPane();
    volumePane.setStretchFactor(0.15);

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
      priceScaleId: "volume",
    }, 1);
    volumeSeries.setData(chartData.volumeData);

    chart.priceScale("volume", 1).applyOptions({
      scaleMargins: { top: 0.0, bottom: 0.0 },
      borderVisible: false,
      visible: false,
    });

    // ---- Z-Score Pane (pane 2) ----
    if (showZScore && chartData.zScoreData.length > 0) {
      const zScorePane = chart.addPane();
      zScorePane.setStretchFactor(0.25);

      // Z-Score area fill
      const zScoreFillSeries = chart.addSeries(AreaSeries, {
        topColor: "rgba(167,139,250,0.15)",
        bottomColor: "rgba(167,139,250,0.02)",
        lineColor: "transparent",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      }, 2);
      zScoreFillSeries.setData(chartData.zScoreData);

      // Z-Score line
      const zScoreSeries = chart.addSeries(LineSeries, {
        color: "#a78bfa",
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
        crosshairMarkerRadius: 3,
      }, 2);
      zScoreSeries.setData(chartData.zScoreData);

      // Reference lines
      zScoreSeries.createPriceLine({
        price: 2,
        color: "rgba(239,68,68,0.3)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "+2",
      });
      zScoreSeries.createPriceLine({
        price: -2,
        color: "rgba(239,68,68,0.3)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "-2",
      });
      zScoreSeries.createPriceLine({
        price: 0,
        color: "rgba(255,255,255,0.15)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "0",
      });
    }

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [chartData, showZScore, showBB]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full h-full min-h-[400px]"
    />
  );
}

// ============ Main ChartPanel component ============

export default function ChartPanel() {
  const {
    activeSyntheticId,
    setActiveSyntheticId,
    savedSynthetics,
    chartInterval,
    setChartInterval,
  } = useSyntheticStore();

  const { selectedPair, scanInterval } = useScreenerStore();

  const [chartMode, setChartMode] = useState<"pair" | "synthetic">("pair");
  const [pairSymbol1Input, setPairSymbol1Input] = useState("BTCUSDT");
  const [pairSymbol2Input, setPairSymbol2Input] = useState("ETHUSDT");
  const [showSpread, setShowSpread] = useState(true);
  const [showZScore, setShowZScore] = useState(false);
  const [showBB, setShowBB] = useState(true);

  // When selectedPair changes (from Screener), switch to pair mode
  const effectiveMode = selectedPair ? "pair" : chartMode;
  const pairSymbol1 = selectedPair?.symbol1 || pairSymbol1Input;
  const pairSymbol2 = selectedPair?.symbol2 || pairSymbol2Input;

  const currentInterval = chartInterval || scanInterval;

  // Fetch pair chart data
  const { data: pairData, isLoading: pairLoading } = useQuery<PairChartData>({
    queryKey: ["pairChart", pairSymbol1, pairSymbol2, currentInterval],
    queryFn: async () => {
      const params = new URLSearchParams({
        symbol1: pairSymbol1,
        symbol2: pairSymbol2,
        interval: currentInterval,
        limit: "500",
      });
      const res = await fetch(`/api/pair-chart?${params}`);
      return res.json();
    },
    enabled: effectiveMode === "pair",
    staleTime: 60 * 1000,
  });

  // Fetch synthetic chart data
  const { data: syntheticData, isLoading: syntheticLoading } = useQuery<SyntheticChartData>({
    queryKey: ["syntheticChart", activeSyntheticId, currentInterval],
    queryFn: async () => {
      if (!activeSyntheticId) return null as unknown as SyntheticChartData;
      const params = new URLSearchParams({
        interval: currentInterval,
        limit: "500",
      });
      const res = await fetch(`/api/synthetics/${activeSyntheticId}/chart?${params}`);
      return res.json();
    },
    enabled: effectiveMode === "synthetic" && !!activeSyntheticId,
    staleTime: 60 * 1000,
  });

  const handleSelectSynthetic = useCallback(
    (id: string) => {
      setActiveSyntheticId(id);
      setChartMode("synthetic");
    },
    [setActiveSyntheticId]
  );

  const isLoading = effectiveMode === "pair" ? pairLoading : syntheticLoading;

  return (
    <div className="flex gap-3 h-full overflow-hidden">
      {/* Chart sidebar */}
      <div className="w-52 flex-shrink-0 flex flex-col gap-2.5 overflow-y-auto">
        {/* Mode selector */}
        <Card className="bg-card/80 border-border/50">
          <CardContent className="p-2.5">
            <Tabs value={effectiveMode} onValueChange={(v) => setChartMode(v as "pair" | "synthetic")}>
              <TabsList className="w-full h-8">
                <TabsTrigger value="pair" className="text-xs flex-1">Pair</TabsTrigger>
                <TabsTrigger value="synthetic" className="text-xs flex-1">Synthetic</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Pair selectors */}
        {effectiveMode === "pair" && (
          <Card className="bg-card/80 border-border/50">
            <CardHeader className="pb-1.5">
              <CardTitle className="text-xs font-medium text-muted-foreground">Select Pair</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Symbol 1</label>
                <Input
                  value={pairSymbol1}
                  onChange={(e) => setPairSymbol1Input(e.target.value.toUpperCase())}
                  className="h-7 text-xs font-mono bg-background/50"
                  placeholder="BTCUSDT"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Symbol 2</label>
                <Input
                  value={pairSymbol2}
                  onChange={(e) => setPairSymbol2Input(e.target.value.toUpperCase())}
                  className="h-7 text-xs font-mono bg-background/50"
                  placeholder="ETHUSDT"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Synthetic selector */}
        {effectiveMode === "synthetic" && (
          <Card className="bg-card/80 border-border/50">
            <CardHeader className="pb-1.5">
              <CardTitle className="text-xs font-medium text-muted-foreground">Select Synthetic</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="max-h-40">
                <div className="space-y-1">
                  {savedSynthetics.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-2">
                      No saved synthetics
                    </div>
                  ) : (
                    savedSynthetics.map((synth) => (
                      <button
                        key={synth.id}
                        onClick={() => handleSelectSynthetic(synth.id)}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                          activeSyntheticId === synth.id
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                            : "bg-background/30 text-muted-foreground hover:bg-background/50 border border-transparent"
                        }`}
                      >
                        {synth.name}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Interval selector */}
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground">Timeframe</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Select value={currentInterval} onValueChange={setChartInterval}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1m</SelectItem>
                <SelectItem value="3">3m</SelectItem>
                <SelectItem value="5">5m</SelectItem>
                <SelectItem value="15">15m</SelectItem>
                <SelectItem value="30">30m</SelectItem>
                <SelectItem value="60">1H</SelectItem>
                <SelectItem value="120">2H</SelectItem>
                <SelectItem value="240">4H</SelectItem>
                <SelectItem value="360">6H</SelectItem>
                <SelectItem value="720">12H</SelectItem>
                <SelectItem value="D">1D</SelectItem>
                <SelectItem value="W">1W</SelectItem>
                <SelectItem value="M">1M</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Overlay toggles */}
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground">Overlays</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5">
              {effectiveMode === "pair" && (
                <button
                  onClick={() => setShowSpread(!showSpread)}
                  className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                    showSpread
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "bg-background/30 text-muted-foreground"
                  }`}
                >
                  <TrendingUp className="h-3 w-3 inline mr-1.5" />
                  Spread Line
                </button>
              )}
              <button
                onClick={() => setShowZScore(!showZScore)}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                  showZScore
                    ? "bg-purple-500/20 text-purple-300"
                    : "bg-background/30 text-muted-foreground"
                }`}
              >
                <Activity className="h-3 w-3 inline mr-1.5" />
                Z-Score
              </button>
              <button
                onClick={() => setShowBB(!showBB)}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                  showBB
                    ? "bg-red-500/20 text-red-300"
                    : "bg-background/30 text-muted-foreground"
                }`}
              >
                <BarChart3 className="h-3 w-3 inline mr-1.5" />
                Bollinger Bands
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Stats panel */}
        {effectiveMode === "pair" && pairData && !isLoading && (
          <Card className="bg-card/80 border-border/50">
            <CardHeader className="pb-1.5">
              <CardTitle className="text-xs font-medium text-muted-foreground">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">P-Value</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {pairData.cointegration.pValue.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">Last Spread</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {pairData.stats.lastSpread.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">Z-Score</span>
                <span className={`text-xs font-mono font-bold ${
                  Math.abs(pairData.stats.lastZScore) > 2 ? "text-yellow-400" : "text-foreground"
                }`}>
                  {pairData.stats.lastZScore.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">Mean</span>
                <span className="text-xs font-mono text-foreground">
                  {pairData.stats.mean.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">Std Dev</span>
                <span className="text-xs font-mono text-foreground">
                  {pairData.stats.stdDev.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">Half-Life</span>
                <span className="text-xs font-mono text-foreground">
                  {pairData.cointegration.halfLife === Infinity
                    ? "∞"
                    : `${pairData.cointegration.halfLife.toFixed(1)} bars`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">Hedge Ratio</span>
                <span className="text-xs font-mono text-foreground">
                  {pairData.cointegration.hedgeRatio.toFixed(4)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {effectiveMode === "synthetic" && syntheticData && !isLoading && (
          <Card className="bg-card/80 border-border/50">
            <CardHeader className="pb-1.5">
              <CardTitle className="text-xs font-medium text-muted-foreground">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">Last Price</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {syntheticData.stats.lastPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">Z-Score</span>
                <span className={`text-xs font-mono font-bold ${
                  Math.abs(syntheticData.stats.lastZScore) > 2 ? "text-yellow-400" : "text-foreground"
                }`}>
                  {syntheticData.stats.lastZScore.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">Mean</span>
                <span className="text-xs font-mono text-foreground">
                  {syntheticData.stats.mean.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">Std Dev</span>
                <span className="text-xs font-mono text-foreground">
                  {syntheticData.stats.stdDev.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">% Dev</span>
                <span className={`text-xs font-mono font-bold ${
                  Math.abs(syntheticData.stats.percentDeviation) > 5 ? "text-yellow-400" : "text-foreground"
                }`}>
                  {syntheticData.stats.percentDeviation.toFixed(2)}%
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main chart area */}
      <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0">
        {/* Chart header */}
        {isLoading ? (
          <Card className="bg-card/80 border-border/50 flex-1">
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-muted-foreground text-sm animate-pulse">Loading chart data...</div>
            </CardContent>
          </Card>
        ) : effectiveMode === "pair" && pairData ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2 flex-shrink-0">
              <h2 className="text-lg font-semibold">
                <span className="text-cyan-300">{pairSymbol1.replace("USDT", "")}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-teal-300">{pairSymbol2.replace("USDT", "")}</span>
              </h2>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  pairData.cointegration.cointegrated
                    ? "border-emerald-500/30 text-emerald-400"
                    : "border-red-500/30 text-red-400"
                }`}
              >
                {pairData.cointegration.cointegrated ? "COINTEGRATED" : "NOT COINTEGRATED"}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-border/30 text-muted-foreground">
                P={pairData.cointegration.pValue.toFixed(4)}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-border/30 text-muted-foreground">
                HL={pairData.cointegration.halfLife === Infinity ? "∞" : `${pairData.cointegration.halfLife.toFixed(1)}`}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-border/30 text-muted-foreground">
                β={pairData.cointegration.hedgeRatio.toFixed(4)}
              </Badge>
            </div>
            {/* Chart */}
            <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border/30 bg-[#0a0e17]">
              <PairChart
                data={pairData}
                showSpread={showSpread}
                showZScore={showZScore}
                showBB={showBB}
              />
            </div>
          </div>
        ) : effectiveMode === "synthetic" && syntheticData ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2 flex-shrink-0">
              <Layers className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-cyan-300">
                {syntheticData.synthetic.name}
              </h2>
              <Badge variant="outline" className="text-[10px] border-teal-500/30 text-teal-400">
                {syntheticData.synthetic.type}
              </Badge>
            </div>
            {/* Chart */}
            <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border/30 bg-[#0a0e17]">
              <SyntheticChart
                data={syntheticData}
                showZScore={showZScore}
                showBB={showBB}
              />
            </div>
          </div>
        ) : (
          <Card className="bg-card/80 border-border/50 flex-1">
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center">
                <CandlestickChart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <div className="text-muted-foreground text-sm">
                  {effectiveMode === "synthetic"
                    ? "Select a synthetic instrument to view its chart"
                    : "Enter a pair to view spread analysis"}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

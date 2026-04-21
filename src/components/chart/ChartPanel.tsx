"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSyntheticStore, type SavedSynthetic } from "@/store/synthetic-store";
import { useScreenerStore } from "@/store/screener-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  ComposedChart,
  Area,
} from "recharts";
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

export default function ChartPanel() {
  const {
    activeSyntheticId,
    setActiveSyntheticId,
    savedSynthetics,
    chartInterval,
    setChartInterval,
  } = useSyntheticStore();

  const { selectedPair, scanInterval } = useScreenerStore();

  const [chartMode, setChartMode] = useState<"pair" | "synthetic">(
    selectedPair ? "pair" : "synthetic"
  );
  const [pairSymbol1, setPairSymbol1] = useState(
    selectedPair?.symbol1 || "BTCUSDT"
  );
  const [pairSymbol2, setPairSymbol2] = useState(
    selectedPair?.symbol2 || "ETHUSDT"
  );
  const [showSpread, setShowSpread] = useState(true);
  const [showZScore, setShowZScore] = useState(false);
  const [showBB, setShowBB] = useState(true);

  const currentInterval = chartInterval || scanInterval;

  // Fetch pair chart data
  const { data: pairData, isLoading: pairLoading } = useQuery<PairChartData>({
    queryKey: ["pairChart", pairSymbol1, pairSymbol2, currentInterval],
    queryFn: async () => {
      const params = new URLSearchParams({
        symbol1: pairSymbol1,
        symbol2: pairSymbol2,
        interval: currentInterval,
        limit: "200",
      });
      const res = await fetch(`/api/pair-chart?${params}`);
      return res.json();
    },
    enabled: chartMode === "pair",
    staleTime: 60 * 1000,
  });

  // Fetch synthetic chart data
  const { data: syntheticData, isLoading: syntheticLoading } = useQuery<SyntheticChartData>({
    queryKey: ["syntheticChart", activeSyntheticId, currentInterval],
    queryFn: async () => {
      if (!activeSyntheticId) return null as unknown as SyntheticChartData;
      const params = new URLSearchParams({
        interval: currentInterval,
        limit: "200",
      });
      const res = await fetch(`/api/synthetics/${activeSyntheticId}/chart?${params}`);
      return res.json();
    },
    enabled: chartMode === "synthetic" && !!activeSyntheticId,
    staleTime: 60 * 1000,
  });

  // Build pair chart data
  const pairChartData = useMemo(() => {
    if (!pairData?.spread) return [];

    return pairData.spread.map((val: number, i: number) => {
      const kline1 = pairData.klines1?.[i];
      const kline2 = pairData.klines2?.[i];
      const bb = pairData.bollingerBands;

      return {
        index: i,
        time: kline1 ? new Date(kline1.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : String(i),
        spread: val,
        zScore: pairData.zScore?.[i] ?? 0,
        price1: kline1?.close ?? 0,
        price2: kline2?.close ?? 0,
        volume1: kline1?.volume ?? 0,
        bbUpper: bb?.upper?.[i],
        bbMiddle: bb?.middle?.[i],
        bbLower: bb?.lower?.[i],
      };
    });
  }, [pairData]);

  // Build synthetic chart data
  const syntheticChartData = useMemo(() => {
    if (!syntheticData?.klines) return [];

    const klines = syntheticData.klines;
    const mean = syntheticData.stats.mean;
    const stdDev = syntheticData.stats.stdDev;

    // Calculate Bollinger Bands
    const bbPeriod = 20;
    const bbMultiplier = 2;

    return klines.map((kline, i) => {
      let bbUpper: number | null = null;
      let bbMiddle: number | null = null;
      let bbLower: number | null = null;

      if (i >= bbPeriod - 1) {
        const slice = klines.slice(i - bbPeriod + 1, i + 1).map((k) => k.close);
        const m = slice.reduce((s, v) => s + v, 0) / slice.length;
        const v = slice.reduce((s, val) => s + (val - m) ** 2, 0) / (slice.length - 1);
        const sd = Math.sqrt(v);
        bbMiddle = m;
        bbUpper = m + bbMultiplier * sd;
        bbLower = m - bbMultiplier * sd;
      }

      const zs = stdDev > 0 ? (kline.close - mean) / stdDev : 0;

      return {
        index: i,
        time: new Date(kline.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
        volume: kline.volume,
        zScore: zs,
        bbUpper,
        bbMiddle,
        bbLower,
      };
    });
  }, [syntheticData]);

  const handleSelectSynthetic = useCallback(
    (id: string) => {
      setActiveSyntheticId(id);
      setChartMode("synthetic");
    },
    [setActiveSyntheticId]
  );

  const isLoading = chartMode === "pair" ? pairLoading : syntheticLoading;

  return (
    <div className="flex gap-4 h-full">
      {/* Chart sidebar */}
      <div className="w-56 flex-shrink-0 flex flex-col gap-3">
        {/* Mode selector */}
        <Card className="bg-card/80 border-border/50">
          <CardContent className="p-3">
            <Tabs value={chartMode} onValueChange={(v) => setChartMode(v as "pair" | "synthetic")}>
              <TabsList className="w-full h-8">
                <TabsTrigger value="pair" className="text-xs flex-1">Pair</TabsTrigger>
                <TabsTrigger value="synthetic" className="text-xs flex-1">Synthetic</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Pair selectors */}
        {chartMode === "pair" && (
          <Card className="bg-card/80 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Select Pair</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Symbol 1</label>
                <Input
                  value={pairSymbol1}
                  onChange={(e) => setPairSymbol1(e.target.value.toUpperCase())}
                  className="h-7 text-xs font-mono bg-background/50"
                  placeholder="BTCUSDT"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Symbol 2</label>
                <Input
                  value={pairSymbol2}
                  onChange={(e) => setPairSymbol2(e.target.value.toUpperCase())}
                  className="h-7 text-xs font-mono bg-background/50"
                  placeholder="ETHUSDT"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Synthetic selector */}
        {chartMode === "synthetic" && (
          <Card className="bg-card/80 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Select Synthetic</CardTitle>
            </CardHeader>
            <CardContent>
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
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Timeframe</CardTitle>
          </CardHeader>
          <CardContent>
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
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Overlays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
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
      </div>

      {/* Main chart area */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {isLoading ? (
          <Card className="bg-card/80 border-border/50 flex-1">
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-muted-foreground text-sm">Loading chart data...</div>
            </CardContent>
          </Card>
        ) : chartMode === "pair" && pairData ? (
          <>
            {/* Chart header */}
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">
                <span className="text-cyan-300">{pairSymbol1.replace("USDT", "")}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-teal-300">{pairSymbol2.replace("USDT", "")}</span>
              </h2>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  pairData.cointegrated
                    ? "border-emerald-500/30 text-emerald-400"
                    : "border-red-500/30 text-red-400"
                }`}
              >
                {pairData.cointegrated ? "COINTEGRATED" : "NOT COINTEGRATED"}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-border/30 text-muted-foreground">
                P={pairData.cointegration.pValue.toFixed(4)}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-border/30 text-muted-foreground">
                HL={pairData.cointegration.halfLife === Infinity ? "∞" : `${pairData.cointegration.halfLife.toFixed(1)}`}
              </Badge>
            </div>

            {/* Spread chart */}
            <Card className="bg-card/80 border-border/50 flex-1 min-h-0">
              <CardContent className="p-2">
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={pairChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15,23,42,0.95)",
                        border: "1px solid rgba(6,182,212,0.3)",
                        borderRadius: "6px",
                        fontSize: "10px",
                      }}
                    />
                    <ReferenceLine y={pairData.stats.mean} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                    {showBB && (
                      <>
                        <Area
                          dataKey="bbUpper"
                          stroke="none"
                          fill="rgba(239,68,68,0.05)"
                          name="BB Upper"
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="bbUpper"
                          stroke="rgba(239,68,68,0.3)"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                          dot={false}
                          name="BB Upper"
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="bbLower"
                          stroke="rgba(239,68,68,0.3)"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                          dot={false}
                          name="BB Lower"
                          connectNulls={false}
                        />
                      </>
                    )}
                    {showSpread && (
                      <Line
                        type="monotone"
                        dataKey="spread"
                        stroke="#06b6d4"
                        strokeWidth={1.5}
                        dot={false}
                        name="Spread"
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Z-Score chart */}
            {showZScore && (
              <Card className="bg-card/80 border-border/50">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    Z-Score
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 p-2">
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={pairChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(15,23,42,0.95)",
                          border: "1px solid rgba(6,182,212,0.3)",
                          borderRadius: "6px",
                          fontSize: "10px",
                        }}
                      />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                      <ReferenceLine y={2} stroke="rgba(239,68,68,0.3)" strokeDasharray="3 3" />
                      <ReferenceLine y={-2} stroke="rgba(239,68,68,0.3)" strokeDasharray="3 3" />
                      <Line
                        type="monotone"
                        dataKey="zScore"
                        stroke="#a78bfa"
                        strokeWidth={1.5}
                        dot={false}
                        name="Z-Score"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Statistics panel */}
            <Card className="bg-card/80 border-border/50">
              <CardContent className="p-3">
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <div className="text-[10px] text-muted-foreground">Last Spread</div>
                    <div className="text-sm font-mono font-bold text-foreground">
                      {pairData.stats.lastSpread.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Z-Score</div>
                    <div
                      className={`text-sm font-mono font-bold ${
                        Math.abs(pairData.stats.lastZScore) > 2
                          ? "text-yellow-400"
                          : "text-foreground"
                      }`}
                    >
                      {pairData.stats.lastZScore.toFixed(3)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Mean</div>
                    <div className="text-sm font-mono text-foreground">
                      {pairData.stats.mean.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Std Dev</div>
                    <div className="text-sm font-mono text-foreground">
                      {pairData.stats.stdDev.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Half-Life</div>
                    <div className="text-sm font-mono text-foreground">
                      {pairData.cointegration.halfLife === Infinity
                        ? "∞"
                        : `${pairData.cointegration.halfLife.toFixed(1)} bars`}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : chartMode === "synthetic" && syntheticData ? (
          <>
            {/* Synthetic chart header */}
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-cyan-300">
                {syntheticData.synthetic.name}
              </h2>
              <Badge variant="outline" className="text-[10px] border-teal-500/30 text-teal-400">
                {syntheticData.synthetic.type}
              </Badge>
            </div>

            {/* Synthetic line chart */}
            <Card className="bg-card/80 border-border/50 flex-1 min-h-0">
              <CardContent className="p-2">
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={syntheticChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                      width={70}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15,23,42,0.95)",
                        border: "1px solid rgba(6,182,212,0.3)",
                        borderRadius: "6px",
                        fontSize: "10px",
                      }}
                    />
                    <ReferenceLine y={syntheticData.stats.mean} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                    {showBB && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="bbUpper"
                          stroke="rgba(239,68,68,0.3)"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                          dot={false}
                          name="BB Upper"
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="bbLower"
                          stroke="rgba(239,68,68,0.3)"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                          dot={false}
                          name="BB Lower"
                          connectNulls={false}
                        />
                      </>
                    )}
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="#06b6d4"
                      strokeWidth={1.5}
                      dot={false}
                      name="Close"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Z-Score for synthetic */}
            {showZScore && (
              <Card className="bg-card/80 border-border/50">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Z-Score</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 p-2">
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={syntheticChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                        width={40}
                      />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                      <ReferenceLine y={2} stroke="rgba(239,68,68,0.3)" strokeDasharray="3 3" />
                      <ReferenceLine y={-2} stroke="rgba(239,68,68,0.3)" strokeDasharray="3 3" />
                      <Line
                        type="monotone"
                        dataKey="zScore"
                        stroke="#a78bfa"
                        strokeWidth={1.5}
                        dot={false}
                        name="Z-Score"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Volume chart */}
            <Card className="bg-card/80 border-border/50">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">Volume</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 p-2">
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={syntheticChartData}>
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 8, fill: "rgba(255,255,255,0.2)" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.05)" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis hide />
                    <Bar dataKey="volume" fill="rgba(6,182,212,0.3)" name="Volume" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="bg-card/80 border-border/50">
              <CardContent className="p-3">
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <div className="text-[10px] text-muted-foreground">Last Price</div>
                    <div className="text-sm font-mono font-bold text-foreground">
                      {syntheticData.stats.lastPrice.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Z-Score</div>
                    <div
                      className={`text-sm font-mono font-bold ${
                        Math.abs(syntheticData.stats.lastZScore) > 2
                          ? "text-yellow-400"
                          : "text-foreground"
                      }`}
                    >
                      {syntheticData.stats.lastZScore.toFixed(3)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Mean</div>
                    <div className="text-sm font-mono text-foreground">
                      {syntheticData.stats.mean.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Std Dev</div>
                    <div className="text-sm font-mono text-foreground">
                      {syntheticData.stats.stdDev.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">% Dev</div>
                    <div
                      className={`text-sm font-mono font-bold ${
                        Math.abs(syntheticData.stats.percentDeviation) > 5
                          ? "text-yellow-400"
                          : "text-foreground"
                      }`}
                    >
                      {syntheticData.stats.percentDeviation.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="bg-card/80 border-border/50 flex-1">
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center">
                <CandlestickChart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <div className="text-muted-foreground text-sm">
                  {chartMode === "synthetic"
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

"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useScreenerStore } from "@/store/screener-store";
import { useSyntheticStore } from "@/store/synthetic-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Play,
  Loader2,
  TrendingUp,
  TrendingDown,
  Plus,
  BarChart3,
  X,
  ArrowRight,
  Info,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { CointegrationResult } from "@/store/screener-store";

interface Instrument {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  lastPrice: number;
  volume24h: number;
}

interface ScreenerPanelProps {
  onSwitchTab?: (tab: "screener" | "synthetics" | "chart") => void;
}

export default function ScreenerPanel({ onSwitchTab }: ScreenerPanelProps) {
  const {
    selectedSymbols,
    toggleSymbol,
    setSelectedSymbols,
    scanInterval,
    setScanInterval,
    scanLimit,
    setScanLimit,
    significanceLevel,
    setSignificanceLevel,
    scanResults,
    setScanResults,
    isScanning,
    setIsScanning,
    selectedPair,
    setSelectedPair,
  } = useScreenerStore();

  const { addLeg, clearLegs } = useSyntheticStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [showInstrumentSelector, setShowInstrumentSelector] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Show toast notification
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Fetch instruments
  const { data: instrumentsData } = useQuery({
    queryKey: ["instruments"],
    queryFn: async () => {
      const res = await fetch("/api/bybit/instruments");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const instruments: Instrument[] = useMemo(
    () => instrumentsData?.instruments ?? [],
    [instrumentsData]
  );

  // Filter instruments based on search
  const filteredInstruments = useMemo(() => {
    if (!searchQuery) return instruments.slice(0, 50);
    const q = searchQuery.toUpperCase();
    return instruments
      .filter(
        (inst) =>
          inst.symbol.includes(q) || inst.baseCoin.includes(q)
      )
      .slice(0, 50);
  }, [instruments, searchQuery]);

  // Run cointegration scan mutation
  const scanMutation = useMutation({
    mutationFn: async () => {
      setIsScanning(true);
      const res = await fetch("/api/cointegration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: selectedSymbols,
          interval: scanInterval,
          limit: scanLimit,
          significanceLevel,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setScanResults(data.results || []);
      setIsScanning(false);
    },
    onError: () => {
      setIsScanning(false);
    },
  });

  // Fetch pair detail chart data
  const { data: pairChartData } = useQuery({
    queryKey: ["pairChart", selectedPair?.symbol1, selectedPair?.symbol2, scanInterval],
    queryFn: async () => {
      if (!selectedPair) return null;
      const params = new URLSearchParams({
        symbol1: selectedPair.symbol1,
        symbol2: selectedPair.symbol2,
        interval: scanInterval,
        limit: String(scanLimit),
      });
      const res = await fetch(`/api/pair-chart?${params}`);
      return res.json();
    },
    enabled: !!selectedPair,
    staleTime: 60 * 1000,
  });

  const handleRunScan = useCallback(() => {
    if (selectedSymbols.length < 2) return;
    scanMutation.mutate();
  }, [selectedSymbols, scanMutation]);

  /**
   * Create synthetic from a cointegration result.
   *
   * The Engle-Granger test regresses: Y = hedgeRatio * X + intercept + residual
   * The spread is: spread = Y - hedgeRatio * X - intercept
   *
   * So for a "long spread" position:
   *   - Long Y (symbol1) with coefficient 1.0
   *   - Short X (symbol2) with coefficient = hedgeRatio (if hedgeRatio > 0)
   *
   * If hedgeRatio < 0 (negative relationship, rare), both are long with adjusted coefficients.
   */
  const handleCreateSynthetic = useCallback(
    (result: CointegrationResult) => {
      clearLegs();

      // Symbol1 (Y in the regression) is always long with coefficient 1.0
      addLeg({
        symbol: result.symbol1,
        coefficient: 1.0,
        side: "long",
      });

      // Symbol2 (X in the regression):
      // If hedgeRatio > 0: short with coefficient = hedgeRatio
      // If hedgeRatio < 0: long with coefficient = |hedgeRatio| (rare case)
      if (result.hedgeRatio >= 0) {
        addLeg({
          symbol: result.symbol2,
          coefficient: result.hedgeRatio,
          side: "short",
        });
      } else {
        addLeg({
          symbol: result.symbol2,
          coefficient: Math.abs(result.hedgeRatio),
          side: "long",
        });
      }

      // Switch to Synthetics tab
      if (onSwitchTab) {
        onSwitchTab("synthetics");
      }

      showToast(
        `Synthetic created: ${result.symbol1.replace("USDT", "")} / ${result.symbol2.replace("USDT", "")} (HR: ${result.hedgeRatio.toFixed(4)})`
      );
    },
    [addLeg, clearLegs, onSwitchTab, showToast]
  );

  // Open pair in Chart tab
  const handleViewChart = useCallback(
    (result: CointegrationResult) => {
      setSelectedPair(result);
      if (onSwitchTab) {
        onSwitchTab("chart");
      }
    },
    [setSelectedPair, onSwitchTab]
  );

  // Spread chart data
  const spreadChartData = useMemo(() => {
    if (!pairChartData?.spread) return [];
    const spread = pairChartData.spread;
    const zScore = pairChartData.zScore || [];
    const bb = pairChartData.bollingerBands || {
      upper: [],
      middle: [],
      lower: [],
    };

    return spread.map((val: number, i: number) => ({
      index: i,
      spread: val,
      zScore: zScore[i] ?? 0,
      bbUpper: bb.upper[i],
      bbMiddle: bb.middle[i],
      bbLower: bb.lower[i],
    }));
  }, [pairChartData]);

  const pValueColor = (p: number) => {
    if (p < 0.01) return "text-emerald-400";
    if (p < 0.05) return "text-yellow-400";
    return "text-red-400";
  };

  const pValueBadge = (p: number) => {
    if (p < 0.01) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (p < 0.05) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  return (
    <div className="flex gap-4 h-full relative">
      {/* Toast notification */}
      {toastMessage && (
        <div className="absolute top-2 right-2 z-50 bg-cyan-600 text-white text-xs px-4 py-2 rounded-md shadow-lg animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Scan Parameters */}
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              Scan Parameters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Interval</label>
                <Select value={scanInterval} onValueChange={setScanInterval}>
                  <SelectTrigger className="w-28 h-8 text-xs">
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
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data Points</label>
                <Select
                  value={String(scanLimit)}
                  onValueChange={(v) => setScanLimit(Number(v))}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="1000">1000</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Significance</label>
                <Select
                  value={String(significanceLevel)}
                  onValueChange={(v) => setSignificanceLevel(Number(v))}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.01">1%</SelectItem>
                    <SelectItem value="0.05">5%</SelectItem>
                    <SelectItem value="0.1">10%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => setShowInstrumentSelector(!showInstrumentSelector)}
                variant="outline"
                size="sm"
                className="h-8 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
              >
                <Plus className="h-3 w-3 mr-1" />
                Select Instruments ({selectedSymbols.length})
              </Button>
              <Button
                onClick={handleRunScan}
                disabled={selectedSymbols.length < 2 || isScanning}
                size="sm"
                className="h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {isScanning ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                {isScanning ? "Scanning..." : "Run Scan"}
              </Button>
            </div>

            {/* Selected symbols tags */}
            {selectedSymbols.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {selectedSymbols.map((symbol) => (
                  <Badge
                    key={symbol}
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-destructive/20 border-cyan-500/30 text-cyan-300"
                    onClick={() => toggleSymbol(symbol)}
                  >
                    {symbol}
                    <X className="h-2.5 w-2.5 ml-1" />
                  </Badge>
                ))}
                <Badge
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-destructive/20 border-red-500/30 text-red-400"
                  onClick={() => setSelectedSymbols([])}
                >
                  Clear All
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instrument Selector Dropdown */}
        {showInstrumentSelector && (
          <Card className="bg-card/80 border-border/50">
            <CardContent className="pt-4">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search instruments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-xs pl-7 bg-background/50"
                />
              </div>
              <ScrollArea className="h-48">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
                  {filteredInstruments.map((inst) => {
                    const isSelected = selectedSymbols.includes(inst.symbol);
                    return (
                      <button
                        key={inst.symbol}
                        onClick={() => toggleSymbol(inst.symbol)}
                        className={`flex items-center justify-between px-2 py-1 rounded text-xs transition-colors ${
                          isSelected
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                            : "bg-background/30 text-muted-foreground hover:bg-background/50 border border-transparent"
                        }`}
                      >
                        <span className="font-medium">{inst.baseCoin}</span>
                        <span className="text-[10px] opacity-60">
                          ${(inst.volume24h / 1e6).toFixed(0)}M
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Results Table */}
        <Card className="bg-card/80 border-border/50 flex-1 min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Scan Results
              {scanResults.length > 0 && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {scanResults.length} pairs
                </Badge>
              )}
              <Info className="h-3 w-3 text-muted-foreground/50 ml-1" />
              <span className="text-[10px] text-muted-foreground/60 font-normal">
                Hedge Ratio = coefficient for Short leg (spread = Long - HR * Short)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[calc(100vh-420px)]">
              {scanResults.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  {isScanning
                    ? "Scanning for cointegrated pairs..."
                    : "Select instruments and run a scan to find cointegrated pairs"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs h-8">Pair</TableHead>
                      <TableHead className="text-xs h-8">P-Value</TableHead>
                      <TableHead className="text-xs h-8">ADF Stat</TableHead>
                      <TableHead className="text-xs h-8">
                        <div className="flex items-center gap-1">
                          Hedge Ratio
                          <Info className="h-2.5 w-2.5 text-muted-foreground/40" />
                        </div>
                      </TableHead>
                      <TableHead className="text-xs h-8">Direction</TableHead>
                      <TableHead className="text-xs h-8">Half-Life</TableHead>
                      <TableHead className="text-xs h-8">Corr</TableHead>
                      <TableHead className="text-xs h-8">Z-Score</TableHead>
                      <TableHead className="text-xs h-8">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanResults.map((result, idx) => (
                      <TableRow
                        key={`${result.symbol1}-${result.symbol2}-${idx}`}
                        className={`cursor-pointer hover:bg-muted/30 ${
                          selectedPair?.symbol1 === result.symbol1 &&
                          selectedPair?.symbol2 === result.symbol2
                            ? "bg-cyan-500/10"
                            : ""
                        }`}
                        onClick={() => setSelectedPair(result)}
                      >
                        <TableCell className="text-xs font-mono py-1.5">
                          <span className="text-cyan-300">{result.symbol1.replace("USDT", "")}</span>
                          <span className="text-muted-foreground mx-1">/</span>
                          <span className="text-teal-300">{result.symbol2.replace("USDT", "")}</span>
                        </TableCell>
                        <TableCell className="text-xs py-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${pValueBadge(result.pValue)}`}
                          >
                            {result.pValue.toFixed(4)}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-xs font-mono py-1.5 ${pValueColor(result.pValue)}`}>
                          {result.adfStatistic.toFixed(3)}
                        </TableCell>
                        <TableCell className="text-xs font-mono py-1.5">
                          <Badge
                            variant="outline"
                            className="text-[10px] border-cyan-500/30 text-cyan-300 bg-cyan-500/10"
                          >
                            {result.hedgeRatio.toFixed(4)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-1.5">
                          <div className="flex items-center gap-1">
                            <span className="text-emerald-400 text-[10px]">Long</span>
                            <span className="text-muted-foreground text-[10px]">{result.symbol1.replace("USDT", "")}</span>
                            <span className="text-muted-foreground text-[10px] mx-0.5">-</span>
                            <span className="text-red-400 text-[10px]">Short</span>
                            <span className="text-muted-foreground text-[10px]">{result.symbol2.replace("USDT", "")}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono py-1.5">
                          {result.halfLife === Infinity
                            ? "∞"
                            : `${result.halfLife.toFixed(1)}`}
                        </TableCell>
                        <TableCell className="text-xs font-mono py-1.5">
                          {result.correlation.toFixed(3)}
                        </TableCell>
                        <TableCell className="text-xs font-mono py-1.5">
                          {result.lastZScore !== undefined ? (
                            <span
                              className={
                                Math.abs(result.lastZScore) > 2
                                  ? "text-yellow-400"
                                  : "text-muted-foreground"
                              }
                            >
                              {result.lastZScore.toFixed(2)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-xs py-1.5">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[10px] text-cyan-400 hover:text-cyan-300"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewChart(result);
                              }}
                              title="View Chart"
                            >
                              <TrendingUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[10px] text-teal-400 hover:text-teal-300"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateSynthetic(result);
                              }}
                              title="Create Synthetic (auto-fill legs)"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Detail Panel */}
      {selectedPair && (
        <div className="w-[420px] flex-shrink-0 flex flex-col gap-4">
          <Card className="bg-card/80 border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  <span className="text-cyan-300">{selectedPair.symbol1.replace("USDT", "")}</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-teal-300">{selectedPair.symbol2.replace("USDT", "")}</span>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setSelectedPair(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-background/30 rounded p-2">
                  <div className="text-muted-foreground text-[10px]">P-Value</div>
                  <div className={`font-mono font-bold ${pValueColor(selectedPair.pValue)}`}>
                    {selectedPair.pValue.toFixed(6)}
                  </div>
                </div>
                <div className="bg-background/30 rounded p-2">
                  <div className="text-muted-foreground text-[10px]">ADF Statistic</div>
                  <div className="font-mono font-bold text-foreground">
                    {selectedPair.adfStatistic.toFixed(4)}
                  </div>
                </div>
                <div className="bg-background/30 rounded p-2">
                  <div className="text-muted-foreground text-[10px]">Hedge Ratio</div>
                  <div className="font-mono font-bold text-cyan-300">
                    {selectedPair.hedgeRatio.toFixed(4)}
                  </div>
                </div>
                <div className="bg-background/30 rounded p-2">
                  <div className="text-muted-foreground text-[10px]">Half-Life</div>
                  <div className="font-mono font-bold text-foreground">
                    {selectedPair.halfLife === Infinity
                      ? "∞"
                      : `${selectedPair.halfLife.toFixed(1)} bars`}
                  </div>
                </div>
                <div className="bg-background/30 rounded p-2">
                  <div className="text-muted-foreground text-[10px]">Correlation</div>
                  <div className="font-mono font-bold text-foreground">
                    {selectedPair.correlation.toFixed(4)}
                  </div>
                </div>
                <div className="bg-background/30 rounded p-2">
                  <div className="text-muted-foreground text-[10px]">Cointegrated</div>
                  <div
                    className={`font-bold ${
                      selectedPair.cointegrated ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {selectedPair.cointegrated ? "YES" : "NO"}
                  </div>
                </div>
              </div>

              {/* Relationship explanation */}
              <div className="mt-3 bg-background/20 rounded p-2 border border-border/20">
                <div className="text-[10px] text-muted-foreground mb-1">Synthetic Formula</div>
                <div className="text-xs font-mono text-cyan-300">
                  Spread = 1.0 * {selectedPair.symbol1.replace("USDT", "")}{" "}
                  {selectedPair.hedgeRatio >= 0 ? "-" : "+"}{" "}
                  {Math.abs(selectedPair.hedgeRatio).toFixed(4)} * {selectedPair.symbol2.replace("USDT", "")}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5">
                  <span className="text-emerald-400">Long</span>{" "}
                  {selectedPair.symbol1.replace("USDT", "")}
                  {" + "}
                  <span className="text-red-400">Short</span>{" "}
                  {selectedPair.symbol2.replace("USDT", "")}
                  {" x "}
                  {selectedPair.hedgeRatio.toFixed(4)}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-3 flex gap-2">
                <Button
                  onClick={() => handleCreateSynthetic(selectedPair)}
                  size="sm"
                  className="flex-1 h-7 text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create Synthetic
                </Button>
                <Button
                  onClick={() => handleViewChart(selectedPair)}
                  variant="outline"
                  size="sm"
                  className="flex-1 h-7 text-xs border-cyan-500/30 text-cyan-400"
                >
                  <ArrowRight className="h-3 w-3 mr-1" />
                  Open Chart
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Spread Chart */}
          <Card className="bg-card/80 border-border/50 flex-1 min-h-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-cyan-400" />
                Spread Chart
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {spreadChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={spreadChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="index"
                      tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                      width={60}
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
                    <Line
                      type="monotone"
                      dataKey="spread"
                      stroke="#06b6d4"
                      strokeWidth={1.5}
                      dot={false}
                      name="Spread"
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
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground text-xs">
                  Loading chart data...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Z-Score Chart */}
          <Card className="bg-card/80 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Z-Score
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {spreadChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={spreadChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="index"
                      tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
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
              ) : (
                <div className="flex items-center justify-center h-[120px] text-muted-foreground text-xs">
                  Loading...
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

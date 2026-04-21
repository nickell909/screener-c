"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSyntheticStore, type SavedSynthetic } from "@/store/synthetic-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Trash2,
  Save,
  ArrowRight,
  Layers,
  X,
} from "lucide-react";
import type { SyntheticLeg } from "@/lib/synthetic";
import { generateSyntheticName, formatSyntheticFormula, getSyntheticType } from "@/lib/synthetic";

interface Instrument {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  lastPrice: number;
  volume24h: number;
}

export default function SyntheticsPanel() {
  const {
    legs,
    addLeg,
    removeLeg,
    updateLeg,
    clearLegs,
    savedSynthetics,
    setSavedSynthetics,
    setActiveSyntheticId,
  } = useSyntheticStore();

  const queryClient = useQueryClient();
  const [syntheticName, setSyntheticName] = useState("");
  const [syntheticDescription, setSyntheticDescription] = useState("");

  // Fetch instruments for the leg builder
  const { data: instrumentsData } = useQuery({
    queryKey: ["instruments"],
    queryFn: async () => {
      const res = await fetch("/api/bybit/instruments");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const instruments: Instrument[] = instrumentsData?.instruments ?? [];

  // Fetch saved synthetics
  const { data: syntheticsData } = useQuery({
    queryKey: ["synthetics"],
    queryFn: async () => {
      const res = await fetch("/api/synthetics");
      return res.json();
    },
  });

  // Update saved synthetics when data changes
  useEffect(() => {
    if (syntheticsData?.synthetics) {
      setSavedSynthetics(syntheticsData.synthetics);
    }
  }, [syntheticsData, setSavedSynthetics]);

  // Create synthetic mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/synthetics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: syntheticName || generateSyntheticName(legs),
          description: syntheticDescription || undefined,
          type: getSyntheticType(legs),
          legs,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["synthetics"] });
      setSyntheticName("");
      setSyntheticDescription("");
      clearLegs();
    },
  });

  // Delete synthetic mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/synthetics/${id}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["synthetics"] });
    },
  });

  const handleAddLeg = useCallback(() => {
    const defaultSymbol = instruments.length > 0 ? instruments[0].symbol : "BTCUSDT";
    addLeg({
      symbol: defaultSymbol,
      coefficient: 1.0,
      side: "long",
    });
  }, [addLeg, instruments]);

  const handleSave = useCallback(() => {
    if (legs.length === 0) return;
    createMutation.mutate();
  }, [legs, createMutation]);

  const handleOpenChart = useCallback(
    (synthetic: SavedSynthetic) => {
      setActiveSyntheticId(synthetic.id);
    },
    [setActiveSyntheticId]
  );

  return (
    <div className="flex gap-4 h-full">
      {/* Synthetic Builder */}
      <div className="w-[440px] flex-shrink-0 flex flex-col gap-4">
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              Synthetic Builder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Name and description */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    placeholder={generateSyntheticName(legs)}
                    value={syntheticName}
                    onChange={(e) => setSyntheticName(e.target.value)}
                    className="h-8 text-xs bg-background/50"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <Input
                    placeholder="Optional description..."
                    value={syntheticDescription}
                    onChange={(e) => setSyntheticDescription(e.target.value)}
                    className="h-8 text-xs bg-background/50"
                  />
                </div>
              </div>

              {/* Formula preview */}
              {legs.length > 0 && (
                <div className="bg-background/30 rounded p-2.5 border border-border/30">
                  <div className="text-[10px] text-muted-foreground mb-1">Formula Preview</div>
                  <div className="text-xs font-mono text-cyan-300">
                    {formatSyntheticFormula(legs)}
                  </div>
                </div>
              )}

              {/* Legs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Legs</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px] border-cyan-500/30 text-cyan-400"
                    onClick={handleAddLeg}
                  >
                    <Plus className="h-3 w-3 mr-0.5" />
                    Add Leg
                  </Button>
                </div>

                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {legs.map((leg, index) => (
                      <div
                        key={index}
                        className="flex gap-1.5 items-end bg-background/30 rounded p-2 border border-border/20"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-muted-foreground mb-0.5">Symbol</div>
                          <Select
                            value={leg.symbol}
                            onValueChange={(v) =>
                              updateLeg(index, { symbol: v })
                            }
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <ScrollArea className="h-48">
                                {instruments.slice(0, 100).map((inst) => (
                                  <SelectItem
                                    key={inst.symbol}
                                    value={inst.symbol}
                                    className="text-xs"
                                  >
                                    {inst.baseCoin}
                                  </SelectItem>
                                ))}
                              </ScrollArea>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-20">
                          <div className="text-[10px] text-muted-foreground mb-0.5">Coeff</div>
                          <Input
                            type="number"
                            step="0.01"
                            value={leg.coefficient}
                            onChange={(e) =>
                              updateLeg(index, {
                                coefficient: parseFloat(e.target.value) || 1,
                              })
                            }
                            className="h-7 text-xs bg-background/50"
                          />
                        </div>
                        <div className="w-20">
                          <div className="text-[10px] text-muted-foreground mb-0.5">Side</div>
                          <Select
                            value={leg.side}
                            onValueChange={(v) =>
                              updateLeg(index, {
                                side: v as "long" | "short",
                              })
                            }
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="long">Long</SelectItem>
                              <SelectItem value="short">Short</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                          onClick={() => removeLeg(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}

                    {legs.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground text-xs">
                        Add legs to build a synthetic instrument
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={legs.length === 0 || createMutation.isPending}
                  className="flex-1 h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  {createMutation.isPending ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save className="h-3 w-3 mr-1" />
                      Save Synthetic
                    </>
                  )}
                </Button>
                {legs.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-red-500/30 text-red-400"
                    onClick={clearLegs}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Saved Synthetics List */}
      <div className="flex-1 min-w-0">
        <Card className="bg-card/80 border-border/50 h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saved Synthetics
              {savedSynthetics.length > 0 && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {savedSynthetics.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[calc(100vh-200px)]">
              {savedSynthetics.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  No saved synthetics yet. Build one above!
                </div>
              ) : (
                <div className="grid gap-3">
                  {savedSynthetics.map((synthetic) => (
                    <Card
                      key={synthetic.id}
                      className="bg-background/30 border-border/20 hover:border-cyan-500/30 transition-colors"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-medium text-foreground truncate">
                                {synthetic.name}
                              </h3>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  synthetic.type === "pair"
                                    ? "border-cyan-500/30 text-cyan-400"
                                    : "border-teal-500/30 text-teal-400"
                                }`}
                              >
                                {synthetic.type}
                              </Badge>
                            </div>
                            {synthetic.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {synthetic.description}
                              </p>
                            )}
                            <div className="mt-2 bg-background/40 rounded p-1.5">
                              <div className="text-xs font-mono text-cyan-300">
                                {formatSyntheticFormula(synthetic.legs)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] text-muted-foreground">
                                {synthetic.legs.length} leg{synthetic.legs.length !== 1 ? "s" : ""}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Created {new Date(synthetic.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-cyan-400 hover:text-cyan-300"
                              onClick={() => handleOpenChart(synthetic)}
                              title="Open in Chart"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                              onClick={() => deleteMutation.mutate(synthetic.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScreenerPanel from "@/components/screener/ScreenerPanel";
import SyntheticsPanel from "@/components/synthetics/SyntheticsPanel";
import ChartPanel from "@/components/chart/ChartPanel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Layers,
  CandlestickChart,
  Wifi,
  WifiOff,
  Menu,
  X,
} from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

type TabId = "screener" | "synthetics" | "chart";

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "screener", label: "Screener", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "synthetics", label: "Synthetics", icon: <Layers className="h-4 w-4" /> },
  { id: "chart", label: "Chart", icon: <CandlestickChart className="h-4 w-4" /> },
];

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>("screener");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isConnected, setIsConnected] = useState(true);

  // Check connection to Bybit API
  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch("/api/bybit/instruments");
        setIsConnected(res.ok);
      } catch {
        setIsConnected(false);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top bar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-border/50 bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
              <BarChart3 className="h-3.5 w-3.5 text-white" />
            </div>
            <h1 className="text-sm font-bold tracking-tight">
              <span className="text-cyan-400">Stat</span>
              <span className="text-foreground">Arb</span>
              <span className="text-muted-foreground font-normal ml-1 text-xs">Screener</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`text-[10px] ${
              isConnected
                ? "border-emerald-500/30 text-emerald-400"
                : "border-red-500/30 text-red-400"
            }`}
          >
            {isConnected ? (
              <Wifi className="h-2.5 w-2.5 mr-1" />
            ) : (
              <WifiOff className="h-2.5 w-2.5 mr-1" />
            )}
            {isConnected ? "Bybit Connected" : "Disconnected"}
          </Badge>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <nav
          className={`${
            sidebarOpen ? "w-48" : "w-0"
          } flex-shrink-0 border-r border-border/50 bg-card/30 transition-all duration-200 overflow-hidden md:w-48`}
        >
          <div className="w-48 h-full flex flex-col py-3 px-2">
            <div className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/20"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <Separator className="my-3 bg-border/30" />

            <div className="px-3 space-y-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Quick Info
              </div>
              <div className="text-[10px] text-muted-foreground space-y-1">
                <p>Bybit V5 API</p>
                <p>Linear Perpetuals</p>
                <p>USDT Settled</p>
              </div>
            </div>

            <div className="mt-auto px-3">
              <div className="text-[9px] text-muted-foreground/50">
                Statistical Arbitrage
                <br />
                Pairs & Basket Trading
              </div>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 overflow-auto">
          {activeTab === "screener" && <ScreenerPanel />}
          {activeTab === "synthetics" && <SyntheticsPanel />}
          {activeTab === "chart" && <ChartPanel />}
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

import { create } from "zustand";

export interface CointegrationResult {
  symbol1: string;
  symbol2: string;
  pValue: number;
  adfStatistic: number;
  hedgeRatio: number;
  intercept: number;
  halfLife: number;
  correlation: number;
  cointegrated: boolean;
  lastSpread?: number;
  lastZScore?: number;
}

interface ScreenerState {
  // Instrument selection
  selectedSymbols: string[];
  setSelectedSymbols: (symbols: string[]) => void;
  toggleSymbol: (symbol: string) => void;

  // Scan parameters
  scanInterval: string;
  setScanInterval: (interval: string) => void;
  scanLimit: number;
  setScanLimit: (limit: number) => void;
  significanceLevel: number;
  setSignificanceLevel: (level: number) => void;

  // Scan results
  scanResults: CointegrationResult[];
  setScanResults: (results: CointegrationResult[]) => void;
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;

  // Selected pair for detail view
  selectedPair: CointegrationResult | null;
  setSelectedPair: (pair: CointegrationResult | null) => void;
}

export const useScreenerStore = create<ScreenerState>((set) => ({
  // Instrument selection
  selectedSymbols: [],
  setSelectedSymbols: (symbols) => set({ selectedSymbols: symbols }),
  toggleSymbol: (symbol) =>
    set((state) => {
      if (state.selectedSymbols.includes(symbol)) {
        return {
          selectedSymbols: state.selectedSymbols.filter((s) => s !== symbol),
        };
      }
      return {
        selectedSymbols: [...state.selectedSymbols, symbol],
      };
    }),

  // Scan parameters
  scanInterval: "60",
  setScanInterval: (interval) => set({ scanInterval: interval }),
  scanLimit: 200,
  setScanLimit: (limit) => set({ scanLimit: limit }),
  significanceLevel: 0.05,
  setSignificanceLevel: (level) => set({ significanceLevel: level }),

  // Scan results
  scanResults: [],
  setScanResults: (results) => set({ scanResults: results }),
  isScanning: false,
  setIsScanning: (scanning) => set({ isScanning: scanning }),

  // Selected pair
  selectedPair: null,
  setSelectedPair: (pair) => set({ selectedPair: pair }),
}));

import { create } from "zustand";
import type { SyntheticLeg } from "@/lib/synthetic";

export interface SavedSynthetic {
  id: string;
  name: string;
  description: string | null;
  type: string;
  legs: SyntheticLeg[];
  createdAt: string;
  updatedAt: string;
}

interface SyntheticState {
  // Builder state
  legs: SyntheticLeg[];
  addLeg: (leg: SyntheticLeg) => void;
  removeLeg: (index: number) => void;
  updateLeg: (index: number, leg: Partial<SyntheticLeg>) => void;
  clearLegs: () => void;

  // Saved synthetics
  savedSynthetics: SavedSynthetic[];
  setSavedSynthetics: (synthetics: SavedSynthetic[]) => void;

  // Active synthetic for charting
  activeSyntheticId: string | null;
  setActiveSyntheticId: (id: string | null) => void;

  // Chart settings
  chartInterval: string;
  setChartInterval: (interval: string) => void;
}

export const useSyntheticStore = create<SyntheticState>((set) => ({
  // Builder state
  legs: [],
  addLeg: (leg) =>
    set((state) => ({
      legs: [...state.legs, leg],
    })),
  removeLeg: (index) =>
    set((state) => ({
      legs: state.legs.filter((_, i) => i !== index),
    })),
  updateLeg: (index, legUpdate) =>
    set((state) => ({
      legs: state.legs.map((leg, i) =>
        i === index ? { ...leg, ...legUpdate } : leg
      ),
    })),
  clearLegs: () => set({ legs: [] }),

  // Saved synthetics
  savedSynthetics: [],
  setSavedSynthetics: (synthetics) => set({ savedSynthetics: synthetics }),

  // Active synthetic
  activeSyntheticId: null,
  setActiveSyntheticId: (id) => set({ activeSyntheticId: id }),

  // Chart settings
  chartInterval: "60",
  setChartInterval: (interval) => set({ chartInterval: interval }),
}));

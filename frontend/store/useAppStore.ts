import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AppState {
  theme: "dark" | "light";
  activeTicker: string;
  sidebarOpen: boolean;
  summaryDays: number;
  universe: string;
  analysisDate: string;
  windowDays: number;
  horizon: number;
  minEvents: number;
  minNetBuy: number;
  localWatchlist: string[];

  setTheme: (theme: "dark" | "light") => void;
  toggleTheme: () => void;
  setActiveTicker: (ticker: string) => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setSummaryDays: (days: number) => void;
  setUniverse: (universe: string) => void;
  setAnalysisDate: (date: string) => void;
  setWindowDays: (days: number) => void;
  setHorizon: (horizon: number) => void;
  setMinEvents: (events: number) => void;
  setMinNetBuy: (buy: number) => void;
  setLocalWatchlist: (list: string[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: "dark",
      activeTicker: "BBCA",
      sidebarOpen: false,
      summaryDays: 30,
      universe: "watchlist",
      analysisDate: "",
      windowDays: 20,
      horizon: 10,
      minEvents: 5,
      minNetBuy: 0,
      localWatchlist: [],

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
      setActiveTicker: (ticker) => set({ activeTicker: ticker.toUpperCase() }),
      setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
      setSummaryDays: (days) => set({ summaryDays: days }),
      setUniverse: (universe) => set({ universe }),
      setAnalysisDate: (date) => set({ analysisDate: date }),
      setWindowDays: (days) => set({ windowDays: days }),
      setHorizon: (horizon) => set({ horizon }),
      setMinEvents: (events) => set({ minEvents: events }),
      setMinNetBuy: (buy) => set({ minNetBuy: buy }),
      setLocalWatchlist: (list) => set({ localWatchlist: list }),
    }),
    {
      name: "investowl-global-state",
      version: 1, // Memaksa browser mereset data nyangkut di local storage
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => {
        // Mengecualikan analysisDate dan sidebarOpen dari local storage persistence
        const { sidebarOpen: _sidebarOpen, analysisDate: _analysisDate, ...rest } = state;
        return rest;
      },
    }
  )
);

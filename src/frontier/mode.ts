/** 🧭 The Frontier Village preview build (VITE_FRONTIER=1): its own save, frontier rules on new games. */
export const FRONTIER = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_FRONTIER === '1';
/** the hand-picked island new frontier games start on (a new map later picks any seed) */
export const FRONTIER_SEED = 8;

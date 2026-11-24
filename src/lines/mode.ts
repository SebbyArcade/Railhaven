/** 🚉 The City Lines preview build (VITE_LINES=1): its own save, city-lines rules on new games. */
export const LINES = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_LINES === '1';

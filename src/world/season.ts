/** Seasons: an 8-minute year, as in the old game. They only change how the land looks, never the rules. */
export const YEAR = 480;
export const SEASONS = ['🌸 Spring', '☀️ Summer', '🍂 Autumn', '❄️ Winter'] as const;
export const seasonOf = (t: number) => Math.floor((((t % YEAR) + YEAR) % YEAR) / (YEAR / 4)) % 4;

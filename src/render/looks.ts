/**
 * Looks unlocked with achievement XP: train paints and town themes. Pure decoration: nothing in play changes.
 * The first of each is the game's normal look and is always available.
 */
export interface Paint { k: string; name: string; xp: number; body: string; roof: string; band: string; beam: string }
export const PAINTS: Paint[] = [
  { k: 'green', name: 'Forest green', xp: 0, body: '#2f5d3a', roof: '#24452c', band: '#d9b44a', beam: '#c0392b' },
  { k: 'crimson', name: 'Crimson and gold', xp: 150, body: '#8e2a22', roof: '#5e1c16', band: '#e8c25a', beam: '#1d1d1d' },
  { k: 'blue', name: 'Royal blue', xp: 300, body: '#2c4f8a', roof: '#1f3760', band: '#e8e0cc', beam: '#c0392b' },
  { k: 'black', name: 'Black and brass', xp: 500, body: '#262626', roof: '#141414', band: '#d9a43a', beam: '#c0392b' },
  { k: 'teal', name: 'Teal and cream', xp: 750, body: '#2a7a72', roof: '#e6dcc0', band: '#e6dcc0', beam: '#8e2a22' },
  { k: 'gold', name: 'Golden express', xp: 1000, body: '#b8862e', roof: '#5a3f1e', band: '#fff0b8', beam: '#5a3f1e' },
  { k: 'purple', name: 'Royal purple', xp: 1300, body: '#5a2e6e', roof: '#3a1e48', band: '#e8c25a', beam: '#c0392b' },
  { k: 'silver', name: 'Silver streak', xp: 1650, body: '#9aa4ae', roof: '#5a646e', band: '#2c4f8a', beam: '#c0392b' },
];

export interface Theme { k: string; name: string; xp: number; roofs: string[]; walls: string[] }
export const THEMES: Theme[] = [
  { k: 'classic', name: 'Red-roof village', xp: 0, roofs: ['#a8462f', '#8a3e2c', '#b8603a', '#6e4a36', '#5a5e66', '#9a5440'], walls: ['#efe4cc', '#f4efe2', '#e8d6a8', '#dcc8a8', '#c98a68', '#e4dccf'] },
  { k: 'seaside', name: 'Seaside town', xp: 200, roofs: ['#3f5a7a', '#4f6f8f', '#2f4a66', '#5a6e7a', '#6a8aa0', '#46607a'], walls: ['#f6f4ee', '#eef2f4', '#f2e8d8', '#dfe8ee', '#f4efe2', '#e8f0f0'] },
  { k: 'highland', name: 'Highland stone', xp: 450, roofs: ['#4c4844', '#3e3a38', '#5a5654', '#46423e', '#5e5a50', '#3a3a3e'], walls: ['#b8b0a0', '#a8a090', '#c4bca8', '#9c9484', '#b0a890', '#c8c0b0'] },
  { k: 'autumn', name: 'Autumn timber', xp: 700, roofs: ['#b8743a', '#a0602e', '#c88a40', '#8a5a2e', '#9a4a2a', '#b06a30'], walls: ['#d8b888', '#c9a272', '#e4c898', '#bf9a6a', '#d4ae7e', '#e8d0a8'] },
  { k: 'harbour', name: 'Painted harbour', xp: 950, roofs: ['#5a5e66', '#4c4844', '#6e4a36', '#5a5e66', '#3f5a7a', '#8a3e2c'], walls: ['#e8a8a0', '#a8d0e0', '#f0d890', '#b8dca8', '#e8c0e0', '#f4efe2'] },
  { k: 'alpine', name: 'Alpine chalets', xp: 1450, roofs: ['#3a2c22', '#4a3626', '#2e2620', '#56402c', '#3e3028', '#4c3a2a'], walls: ['#f4efe2', '#e8d6a8', '#f2e8d8', '#dcc8a8', '#efe4cc', '#e4dccf'] },
];

/** What the player picked (set from their profile by the screen side). */
export const looks = { paint: PAINTS[0]!, theme: THEMES[0]! };
export function setLooks(paint?: string, theme?: string) {
  looks.paint = PAINTS.find(p => p.k === paint) ?? PAINTS[0]!;
  looks.theme = THEMES.find(t => t.k === theme) ?? THEMES[0]!;
}

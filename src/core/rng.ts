/** Seeded hash and noise. Bit-for-bit the same as the old game's hash()/vn(), so a seed gives the same map. */
export function hash(seed: number, x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + (seed + s) * 1442695) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Smooth value noise in [0,1]. */
export function vnoise(seed: number, x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const f = (t: number) => t * t * (3 - 2 * t);
  const a = hash(seed, xi, yi, s), b = hash(seed, xi + 1, yi, s);
  const c = hash(seed, xi, yi + 1, s), d = hash(seed, xi + 1, yi + 1, s);
  return a + (b - a) * f(xf) + (c - a) * f(yf) + (a - b - c + d) * f(xf) * f(yf);
}

/** Small deterministic PRNG (mulberry32) for anything that needs a stream of random numbers. */
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0 || 1; }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n: number): number { return Math.floor(this.next() * n); }
  range(a: number, b: number): number { return a + this.next() * (b - a); }
  pick<T>(a: readonly T[]): T { return a[this.int(a.length)]!; }
  get state(): number { return this.s; }
  set state(v: number) { this.s = v >>> 0; }
}

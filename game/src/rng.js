// Seeded random numbers for Neon Tide.
// Every random choice in the game comes from one of these streams, so a
// fixed seed always builds the same city, traffic and pedestrians.
export function makeRng(seed) {
  let a = seed >>> 0;
  if (a === 0) a = 0x9e3779b9;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function pick(rng, list) { return list[Math.floor(rng() * list.length)]; }
export function int(rng, lo, hi) { return Math.floor(range(rng, lo, hi + 1)); }
export function chance(rng, p) { return rng() < p; }

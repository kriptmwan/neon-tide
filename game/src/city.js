// Neon Tide city map: Tidewater Bay, a sun-soaked coastal city.
// A road grid over a 2560x2560 world, with districts, a beach on the east,
// a working port on the south, a park, shops and mission landmarks.
// Everything is placed from the seeded RNG, so seed 1 always builds the
// same city.
import { makeRng, range, pick, int, chance } from './rng.js';

export const WORLD = 2560;
export const ROAD_STEP = 320;
export const ROAD_W = 72;

const DISTRICT_COLORS = {
  downtown: ['#3a4a6b', '#46587e', '#2f3d5c', '#54648c'],
  marina: ['#2e6f7e', '#3b8296', '#27617a'],
  oldtown: ['#7a5a3a', '#8a6a45', '#6b4f33'],
  suburbs: ['#5a6b4a', '#6b7d55', '#4e5f42'],
};

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const containers = [];
  const roadsH = [];
  const roadsV = [];
  for (let g = 0; g <= WORLD; g += ROAD_STEP) { roadsH.push(g); roadsV.push(g); }

  // District of a block, by its grid position.
  function districtOf(bx, by) {
    if (bx >= 6) return 'marina';
    if (bx <= 1 && by <= 2) return 'downtown';
    if (by >= 6) return 'oldtown';
    if (bx <= 2 && by >= 4) return 'suburbs';
    return 'downtown';
  }

  // One city block: bx, by are grid indices 0..6 (block between road bx and bx+1).
  for (let bx = 0; bx < 7; bx++) {
    for (let by = 0; by < 7; by++) {
      const x0 = bx * ROAD_STEP + ROAD_W / 2 + 14;
      const y0 = by * ROAD_STEP + ROAD_W / 2 + 14;
      const w = ROAD_STEP - ROAD_W - 28;
      const h = ROAD_STEP - ROAD_W - 28;
      // The east column is the beach, the south row is the port.
      if (bx === 6) continue; // beach strip, no buildings
      if (by === 6) continue; // port strip, containers instead
      // Central park block.
      if (bx === 3 && by === 3) {
        for (let i = 0; i < 14; i++) {
          trees.push({ x: x0 + rng() * w, y: y0 + rng() * h, r: range(rng, 10, 18) });
        }
        continue;
      }
      const district = districtOf(bx, by);
      const palette = DISTRICT_COLORS[district];
      const count = int(rng, 2, 4);
      for (let i = 0; i < count; i++) {
        const bw = range(rng, 55, 95);
        const bh = range(rng, 55, 95);
        const bx0 = x0 + rng() * (w - bw);
        const by0 = y0 + rng() * (h - bh);
        const color = pick(rng, palette);
        buildings.push({
          x: bx0, y: by0, w: bw, h: bh,
          color, floors: int(rng, 1, 6),
          roof: chance(rng, 0.3),
          district,
        });
      }
      if (chance(rng, 0.5)) {
        trees.push({ x: x0 + rng() * w, y: y0 + rng() * h, r: range(rng, 9, 15) });
      }
    }
  }

  // Port containers, south strip.
  const contColors = ['#b3543a', '#3a7ab3', '#c9a13a', '#4a9e6b', '#8a4a9e'];
  for (let i = 0; i < 26; i++) {
    containers.push({
      x: 120 + (i % 13) * 185 + range(rng, -8, 8),
      y: 2330 + Math.floor(i / 13) * 90 + range(rng, -6, 6),
      w: 120, h: 52, color: pick(rng, contColors),
    });
  }

  // Beach palm trees along the sand.
  for (let i = 0; i < 10; i++) {
    trees.push({ x: 2320 + range(rng, 0, 70), y: 140 + i * 240 + range(rng, -30, 30), r: 14 });
  }

  const shops = [
    { id: 'arms', name: 'TIDE ARMS', kind: 'arms', x: 420, y: 380, color: '#c94f4f', blurb: 'Ammo $30 · Pistol $150' },
    { id: 'clinic', name: 'NEON CLINIC', kind: 'clinic', x: 1380, y: 1060, color: '#4fc98a', blurb: 'Heal $50 · Full $90' },
    { id: 'auto', name: 'BAY AUTO', kind: 'auto', x: 1060, y: 2020, color: '#e0a53a', blurb: 'Repair $80 · Tune $120' },
    { id: 'diner', name: 'NEON DINER', kind: 'diner', x: 1700, y: 420, color: '#e07ab3', blurb: 'Snack $10 · +25 HP' },
  ];

  const landmarks = {
    marina: { x: 2280, y: 420, name: 'Marina Pier' },
    pier: { x: 2400, y: 900, name: 'Tide Pier' },
    plaza: { x: 1120, y: 1120, name: 'Neon Plaza' },
    docks: { x: 700, y: 2400, name: 'Harbor Docks' },
    garage: { x: 2020, y: 1700, name: 'Rook Garage' },
    hideout: { x: 500, y: 1700, name: 'Safehouse' },
  };

  return { buildings, trees, containers, roadsH, roadsV, shops, landmarks, seed };
}

// True when a circle of radius r at (x, y) overlaps a building or container.
export function hitsSolid(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  for (const c of city.containers) {
    if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return c;
  }
  return null;
}

// Push a circle out of whatever solid it overlaps. Returns true if pushed.
export function resolveSolid(city, e, r) {
  const b = hitsSolid(city, e.x, e.y, r);
  if (!b) return false;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const dx = e.x - cx, dy = e.y - cy;
  const px = b.w / 2 + r - Math.abs(dx);
  const py = b.h / 2 + r - Math.abs(dy);
  if (px < py) e.x += dx > 0 ? px : -px;
  else e.y += dy > 0 ? py : -py;
  return true;
}

// Nearest point on the road grid to (x, y), used to keep traffic on roads.
export function nearestRoadPoint(x, y) {
  const rx = Math.round(x / ROAD_STEP) * ROAD_STEP;
  const ry = Math.round(y / ROAD_STEP) * ROAD_STEP;
  return Math.abs(x - rx) < Math.abs(y - ry) ? { x: rx, y } : { x, y: ry };
}

export function onRoad(x, y) {
  const mx = x % ROAD_STEP, my = y % ROAD_STEP;
  return mx < ROAD_W / 2 + 8 || mx > ROAD_STEP - ROAD_W / 2 - 8 ||
         my < ROAD_W / 2 + 8 || my > ROAD_STEP - ROAD_W / 2 - 8;
}

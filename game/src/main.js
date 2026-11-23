// Neon Tide — main loop and game state.
// A top-down open-world crime game in Tidewater Bay: on foot and by car,
// traffic and pedestrians, a 5-star wanted level with police chases,
// six story missions, combat, shops, saving, HUD and minimap.
// Fixed 60 Hz timestep, seeded RNG, no network, no Date/Math.random in
// the simulation (wall time only drives the frame clock).
import { buildCity, WORLD } from './city.js';
import { makeRng } from './rng.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import {
  makePlayer, makeCar, spawnWorld, updatePlayer, updateBullets,
  updateParticles, updateTraffic, updatePeds, updatePolice,
  updateThugs, decayWanted, syncPolice, hurtPlayer, burst,
} from './entities.js';
import { startMission, updateMission, updateShark, MISSIONS } from './missions.js';
import { render, shopItems } from './render.js';
import { parseShot, stageShot } from './shots.js';

const SAVE_KEY = 'neon-tide-save-v1';
const STEP = 1 / 60;

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function makeGame(canvas) {
  const { shot, seed } = parseShot();
  const city = buildCity(seed);
  const plaza = city.landmarks.plaza;
  const game = {
    seed,
    city,
    canvas,
    ctx: canvas.getContext('2d'),
    input: makeInput(canvas),
    audio: makeAudio(),
    player: makePlayer(plaza.x, plaza.y + 60),
    camera: { x: plaza.x, y: plaza.y + 60 },
    cars: [], peds: [], police: [], thugs: [],
    bullets: [], particles: [], floaters: [], pickups: [],
    shark: null,
    state: 'title', // title | playing | paused | wasted | busted
    time: 0,
    missionIndex: 0, missionStep: 0, missionActive: false,
    missionsDone: [], pendingNext: false, storyDone: false,
    banner: null, shopOpen: null, logOpen: false, shopRepaired: false,
    tint: null,
    trafficRng: makeRng(seed + 7),
    fxRng: makeRng(seed + 13),
    hasSave: false,
    save() {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          money: this.player.money, health: this.player.health, ammo: this.player.ammo,
          missionsDone: this.missionsDone, missionIndex: this.missionIndex,
        }));
      } catch (e) { /* storage unavailable — the game still plays */ }
    },
  };
  game.player.shootCooldown = 0;
  spawnWorld(game);

  const saved = loadSave();
  if (saved) {
    game.hasSave = true;
    game.savedData = saved;
  }
  if (shot) stageShot(game, shot);
  return game;
}

function applySave(game) {
  const s = game.savedData;
  if (!s) return;
  game.player.money = s.money ?? 250;
  game.player.health = s.health ?? 100;
  game.player.ammo = s.ammo ?? 24;
  game.missionsDone = s.missionsDone || [];
  game.missionIndex = Math.min(s.missionIndex ?? 0, MISSIONS.length - 1);
}

function startPlaying(game) {
  if (game.hasSave && !game.saveApplied) {
    applySave(game);
    game.saveApplied = true;
  }
  game.state = 'playing';
  game.audio.unlock();
  if (!game.missionActive && game.missionIndex < MISSIONS.length && game.missionsDone.length === 0) {
    game.banner = { text: 'Press N to start your first job', sub: 'Marina is waiting at the pier. M opens the mission log.', t: 0 };
  }
}

function respawn(game) {
  const p = game.player;
  const h = game.city.landmarks.hideout;
  p.x = h.x; p.y = h.y;
  p.health = 100; p.wanted = 0; p.dead = false; p.bustedTimer = 0;
  if (p.inCar) p.inCar = null;
  game.police = [];
  game.audio.siren(false);
  game.state = 'playing';
  game.camera.x = p.x; game.camera.y = p.y;
  game.save();
}

// E: enter/exit a car, or open a shop when standing by one.
function interact(game) {
  const p = game.player;
  if (p.inCar) {
    const car = p.inCar;
    p.inCar = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    p.angle = car.angle;
    return;
  }
  for (const shop of game.city.shops) {
    if (Math.hypot(shop.x - p.x, shop.y - p.y) < 90) {
      game.shopOpen = shop;
      game.audio.unlock();
      return;
    }
  }
  let best = null, bestD = 70;
  for (const car of game.cars) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (best) {
    p.inCar = best;
    game.cars.splice(game.cars.indexOf(best), 1);
    p.x = best.x; p.y = best.y;
    game.audio.horn();
    game.floaters.push({ x: p.x, y: p.y - 30, text: `Stole the ${best.model}!`, t: 0, color: '#ffd76b' });
  }
}

function buyFromShop(game, n) {
  const shop = game.shopOpen;
  if (!shop) return;
  const items = shopItems(shop.kind);
  const item = items[n - 1];
  if (!item) return;
  const p = game.player;
  if (p.money < item.price) {
    game.floaters.push({ x: p.x, y: p.y - 30, text: 'Not enough cash!', t: 0, color: '#ff6b6b' });
    return;
  }
  p.money -= item.price;
  item.apply(game);
  game.audio.cash();
  game.floaters.push({ x: p.x, y: p.y - 30, text: `Bought: ${item.name}`, t: 0, color: '#7dff9a' });
  game.save();
}

function handleKeys(game) {
  const input = game.input;
  const p = game.player;
  if (input.pressed('enter') && game.state === 'title') { startPlaying(game); return; }
  if (game.state === 'title') return;
  if (input.pressed('p') && (game.state === 'playing' || game.state === 'paused')) {
    game.state = game.state === 'playing' ? 'paused' : 'playing';
    return;
  }
  if (game.state === 'paused') {
    if (input.pressed('r')) respawn(game);
    return;
  }
  if ((game.state === 'wasted' || game.state === 'busted') && input.pressed('r')) { respawn(game); return; }
  if (game.state !== 'playing') return;

  if (game.shopOpen) {
    if (input.pressed('e') || input.pressed('escape')) game.shopOpen = null;
    if (input.pressed('1')) buyFromShop(game, 1);
    if (input.pressed('2')) buyFromShop(game, 2);
    if (input.pressed('3')) buyFromShop(game, 3);
    return;
  }
  if (input.pressed('m') || input.pressed('escape')) { game.logOpen = !game.logOpen; return; }
  if (game.logOpen) return;
  if (input.pressed('e')) interact(game);
  if (input.pressed('n') && !game.missionActive && game.missionIndex < MISSIONS.length) {
    startMission(game, game.missionIndex);
  }
  if (input.pressed('n') && game.pendingNext) {
    game.pendingNext = false;
    startMission(game, game.missionIndex);
  }
  if (input.pressed('u')) game.audio.toggleMute();
}

function update(game, dt) {
  game.time += dt;
  const p = game.player;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (game.banner) {
    game.banner.t += dt;
    if (game.banner.t > 8) game.banner = null;
  }
  if (game.state !== 'playing') return;

  // Day cycle: slow drift, sunset tint late in the cycle.
  // A staged shot keeps its own fixed tint (game.shotTint).
  if (!game.shotTint) {
    const cycle = (game.time / 240) % 1;
    game.tint = cycle > 0.72 && cycle < 0.86 ? 'rgba(255,110,40,0.10)' : cycle >= 0.86 || cycle < 0.08 ? 'rgba(10,16,60,0.16)' : null;
  }

  updatePlayer(game, dt, game.input);
  updateTraffic(game, dt);
  updatePeds(game, dt);
  updatePolice(game, dt);
  updateThugs(game, dt);
  updateBullets(game, dt);
  updateParticles(game, dt);
  updateMission(game, dt);
  updateShark(game, dt);
  decayWanted(game, dt);
  syncPolice(game);

  // Camera follows the player, clamped to the world.
  const targetX = Math.max(640, Math.min(WORLD - 640, p.x));
  const targetY = Math.max(360, Math.min(WORLD - 360, p.y));
  game.camera.x += (targetX - game.camera.x) * Math.min(1, dt * 5);
  game.camera.y += (targetY - game.camera.y) * Math.min(1, dt * 5);
}

function frame(game, now) {
  const dt = STEP;
  // One bad tick must never freeze the game: log it and keep going.
  try {
    handleKeys(game);
    update(game, dt);
    render(game, game.ctx);
  } catch (err) {
    console.error('Neon Tide tick error:', err);
  }
  game.input.endFrame();
  requestAnimationFrame(() => frame(game, performance.now()));
}

export function boot() {
  const canvas = document.getElementById('game');
  if (!canvas || !canvas.getContext) {
    const fb = document.getElementById('fallback');
    if (fb) fb.hidden = false;
    return;
  }
  const game = makeGame(canvas);
  window.__neonTide = game;
  requestAnimationFrame(() => frame(game, performance.now()));
}

boot();

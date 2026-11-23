// Entities of Neon Tide: the player, drivable cars, traffic, pedestrians,
// police, bullets and particles. All movement uses the fixed timestep dt
// passed in from the main loop, and all randomness comes from the game's
// seeded streams so a staged scene is identical every time.
import { makeRng, range, pick, int, chance } from './rng.js';
import { WORLD, ROAD_STEP, resolveSolid, nearestRoadPoint, hitsSolid } from './city.js';

export const CAR_COLORS = ['#e04040', '#3a7bd5', '#e0a53a', '#7a4fd0', '#2fb573', '#e07ab3', '#c8c8c8', '#222831', '#e86a2a'];
export const CAR_MODELS = ['Hatch', 'Sedan', 'Coupe', 'Van', 'Pickup', 'Taxi', 'Sport'];
export const PED_SHIRTS = ['#e04040', '#3a7bd5', '#e0a53a', '#2fb573', '#e07ab3', '#f0f0f0', '#7a4fd0'];

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    health: 100, maxHealth: 100,
    money: 250, ammo: 24, hasPistol: true,
    inCar: null, wanted: 0, wantedTimer: 0, crimeTimer: 0,
    sprint: false, hurtTimer: 0, bustedTimer: 0, dead: false,
    walkPhase: 0,
  };
}

export function makeCar(x, y, angle, opts = {}) {
  return {
    x, y, angle, speed: 0,
    color: opts.color || pick(makeRng((x | 0) * 31 + (y | 0)), CAR_COLORS),
    model: opts.model || pick(makeRng((y | 0) * 17 + (x | 0)), CAR_MODELS),
    isPolice: !!opts.isPolice,
    isTaxi: opts.model === 'Taxi',
    driver: opts.driver !== false,
    health: 100,
    honkTimer: 0,
    // Traffic waypoint state.
    lane: opts.lane || 0,
    target: null,
    stuck: 0,
  };
}

export function makePed(x, y, rng) {
  return {
    x, y, angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 28, 55),
    shirt: pick(rng, PED_SHIRTS),
    walkPhase: range(rng, 0, 6),
    changeTimer: range(rng, 2, 6),
    flee: 0,
  };
}

// Spawn the opening cast around the player start, from the seeded stream.
export function spawnWorld(game) {
  const rng = makeRng(game.seed + 101);
  game.cars = [];
  game.peds = [];
  game.police = [];
  game.bullets = [];
  game.particles = [];
  game.pickups = [];
  // Parked + driving cars near the plaza and along roads.
  for (let i = 0; i < 16; i++) {
    const gx = int(rng, 1, 7) * ROAD_STEP;
    const gy = int(rng, 1, 7) * ROAD_STEP;
    const along = chance(rng, 0.5);
    game.cars.push(makeCar(
      along ? gx + range(rng, -120, 120) : gx + (chance(rng, 0.5) ? 22 : -22),
      along ? gy + (chance(rng, 0.5) ? 22 : -22) : gy + range(rng, -120, 120),
      along ? (chance(rng, 0.5) ? 0 : Math.PI) : (chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2),
      { color: pick(rng, CAR_COLORS), model: pick(rng, CAR_MODELS) },
    ));
  }
  // A taxi waiting by the diner, a sport car by the marina.
  game.cars.push(makeCar(1740, 470, Math.PI / 2, { color: '#e0c53a', model: 'Taxi' }));
  game.cars.push(makeCar(2260, 520, Math.PI, { color: '#e04040', model: 'Sport' }));
  // Pedestrians on sidewalks.
  for (let i = 0; i < 26; i++) {
    const gx = int(rng, 0, 7) * ROAD_STEP + range(rng, -140, 140);
    const gy = int(rng, 0, 7) * ROAD_STEP + range(rng, -140, 140);
    game.peds.push(makePed(gx, gy, rng));
  }
  // Cash pickups scattered in the city.
  for (let i = 0; i < 8; i++) {
    game.pickups.push({
      x: range(rng, 200, WORLD - 200), y: range(rng, 200, WORLD - 200),
      kind: 'cash', amount: int(rng, 20, 80), bob: range(rng, 0, 6),
    });
  }
  game.pickups.push({ x: 1120, y: 1180, kind: 'health', amount: 40, bob: 0 });
}

// --- wanted level -------------------------------------------------------

export function addWanted(game, stars) {
  const p = game.player;
  p.wanted = Math.min(5, p.wanted + stars);
  p.crimeTimer = 6;
  if (p.wanted > 0) game.audio.siren(true);
}

export function decayWanted(game, dt) {
  const p = game.player;
  if (p.crimeTimer > 0) { p.crimeTimer -= dt; return; }
  p.wantedTimer += dt;
  if (p.wanted > 0 && p.wantedTimer > 14) {
    p.wanted -= 1;
    p.wantedTimer = 0;
    if (p.wanted === 0) game.audio.siren(false);
  }
}

// Keep the police count matched to the wanted level.
export function syncPolice(game) {
  const want = game.player.wanted;
  const target = want === 0 ? 0 : want === 1 ? 1 : want === 2 ? 2 : want === 3 ? 3 : want === 4 ? 4 : 6;
  const p = game.player;
  while (game.police.length < target) {
    const a = game.police.length * 2.1 + 0.7;
    const car = makeCar(
      p.x + Math.cos(a) * 520, p.y + Math.sin(a) * 520,
      0, { color: '#1c2f5e', model: 'Sedan', isPolice: true },
    );
    car.speed = 120;
    game.police.push(car);
  }
  while (game.police.length > target) game.police.pop();
}

// --- per-frame updates --------------------------------------------------

export function updatePlayer(game, dt, input) {
  const p = game.player;
  if (p.dead) return;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
  const ax = input.axis();
  const sprint = input.down('shift');
  if (p.inCar) {
    updateDrivenCar(game, dt, input);
    return;
  }
  const sp = sprint ? 265 : 175;
  const len = Math.hypot(ax.x, ax.y);
  if (len > 0) {
    p.x += (ax.x / len) * sp * dt;
    p.y += (ax.y / len) * sp * dt;
    p.angle = Math.atan2(ax.y, ax.x);
    p.walkPhase += dt * (sprint ? 13 : 10);
  }
  p.x = Math.max(24, Math.min(WORLD - 24, p.x));
  p.y = Math.max(24, Math.min(WORLD - 24, p.y));
  resolveSolid(game.city, p, 14);
  // Aim with the mouse when shooting.
  const cam = game.camera;
  const wx = cam.x + input.mouse.x - 640;
  const wy = cam.y + input.mouse.y - 360;
  if (input.mouse.down || input.pressed(' ')) {
    p.aimAngle = Math.atan2(wy - p.y, wx - p.x);
    shoot(game);
  }
  // Pickups.
  for (const pk of game.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 26) {
      pk.taken = true;
      if (pk.kind === 'cash') { p.money += pk.amount; game.floaters.push({ x: p.x, y: p.y - 20, text: `+$${pk.amount}`, t: 0, color: '#7dff9a' }); }
      else { p.health = Math.min(p.maxHealth, p.health + pk.amount); game.floaters.push({ x: p.x, y: p.y - 20, text: `+${pk.amount} HP`, t: 0, color: '#7dff9a' }); }
      game.audio.pickup();
      burst(game, pk.x, pk.y, '#7dff9a', 10);
    }
  }
}

function updateDrivenCar(game, dt, input) {
  const p = game.player;
  const car = p.inCar;
  const ax = input.axis();
  const fwd = -ax.y;
  const steer = ax.x;
  const maxSp = 420;
  car.speed += fwd * 260 * dt;
  car.speed -= car.speed * 0.9 * dt;
  if (fwd === 0) car.speed -= Math.sign(car.speed) * 60 * dt;
  if (Math.abs(car.speed) < 4 && fwd === 0) car.speed = 0;
  car.speed = Math.max(-140, Math.min(maxSp, car.speed));
  car.angle += steer * 1.9 * dt * Math.sign(car.speed || 1) * Math.min(1, Math.abs(car.speed) / 90 + 0.25);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(30, Math.min(WORLD - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD - 30, car.y));
  if (resolveSolid(game.city, car, 22)) {
    if (Math.abs(car.speed) > 120) { game.audio.crash(); burst(game, car.x, car.y, '#ffb347', 12); car.health -= 8; }
    car.speed *= -0.25;
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  // Run over pedestrians (a crime).
  for (const ped of game.peds) {
    if (Math.abs(car.speed) > 60 && Math.hypot(ped.x - car.x, ped.y - car.y) < 30) {
      ped.flee = 5;
      ped.x += Math.cos(car.angle) * 60; ped.y += Math.sin(car.angle) * 60;
      burst(game, ped.x, ped.y, '#ff6b6b', 8);
      addWanted(game, 1);
    }
  }
  // Car vs car bumps.
  for (const other of game.cars) {
    if (other === car) continue;
    if (Math.hypot(other.x - car.x, other.y - car.y) < 42) {
      other.x += Math.cos(car.angle) * 12; other.y += Math.sin(car.angle) * 12;
      if (Math.abs(car.speed) > 150) { game.audio.crash(); addWanted(game, 0); }
      car.speed *= 0.6;
    }
  }
  for (const pc of game.police) {
    if (Math.hypot(pc.x - car.x, pc.y - car.y) < 44) {
      pc.x += Math.cos(car.angle) * 10; pc.y += Math.sin(car.angle) * 10;
      car.speed *= 0.7;
    }
  }
}

export function shoot(game) {
  const p = game.player;
  if (p.shootCooldown > 0) return;
  if (!p.hasPistol || p.ammo <= 0) { p.shootCooldown = 0.25; return; }
  p.shootCooldown = 0.22;
  p.ammo -= 1;
  const a = p.aimAngle ?? p.angle;
  game.bullets.push({
    x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
    vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, life: 0.7, fromPlayer: true,
  });
  game.audio.shoot();
  burst(game, p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26, '#ffd76b', 4);
  addWanted(game, 1);
  p.crimeTimer = 6;
}

export function updateBullets(game, dt) {
  const p = game.player;
  for (const b of game.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (hitsSolid(game.city, b.x, b.y, 2)) { b.life = 0; burst(game, b.x, b.y, '#cccccc', 4); continue; }
    if (b.fromPlayer) {
      for (const th of game.thugs) {
        if (!th.dead && Math.hypot(th.x - b.x, th.y - b.y) < 18) {
          th.hp -= 34; b.life = 0; burst(game, b.x, b.y, '#ff6b6b', 8);
          if (th.hp <= 0) { th.dead = true; burst(game, th.x, th.y, '#ff6b6b', 20); game.audio.cash(); }
        }
      }
      for (const pc of game.police) {
        if (Math.hypot(pc.x - b.x, pc.y - b.y) < 22) {
          b.life = 0; pc.health -= 20; burst(game, b.x, b.y, '#9db8ff', 6);
          if (pc.health <= 0) { burst(game, pc.x, pc.y, '#9db8ff', 24); game.police.splice(game.police.indexOf(pc), 1); addWanted(game, 1); }
        }
      }
      for (const ped of game.peds) {
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          b.life = 0; ped.flee = 6; burst(game, b.x, b.y, '#ff6b6b', 8); addWanted(game, 1);
        }
      }
    } else {
      if (Math.hypot(p.x - b.x, p.y - b.y) < 16 && !p.inCar) {
        b.life = 0; hurtPlayer(game, 12);
      }
    }
  }
  game.bullets = game.bullets.filter(b => b.life > 0);
}

export function hurtPlayer(game, dmg) {
  const p = game.player;
  if (p.dead || p.hurtTimer > 0) return;
  p.health -= dmg;
  p.hurtTimer = 0.5;
  burst(game, p.x, p.y, '#ff6b6b', 10);
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    game.state = 'wasted';
    game.audio.busted();
    game.audio.siren(false);
  }
}

export function burst(game, x, y, color, n) {
  const rng = game.fxRng;
  for (let i = 0; i < n; i++) {
    const a = range(rng, 0, Math.PI * 2);
    const sp = range(rng, 40, 180);
    game.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: range(rng, 0.3, 0.8), color, size: range(rng, 2, 5) });
  }
}

export function updateParticles(game, dt) {
  for (const pt of game.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
    pt.vx *= 0.94; pt.vy *= 0.94;
  }
  game.particles = game.particles.filter(pt => pt.life > 0);
  for (const f of game.floaters) { f.t += dt; f.y -= 30 * dt; }
  game.floaters = game.floaters.filter(f => f.t < 1.2);
}

// Traffic: cars cruise the road grid and only turn at intersections.
// Each car sticks to one road (its axis + line) until an intersection,
// so traffic never cuts across blocks or jams against buildings.
export function updateTraffic(game, dt) {
  const rng = game.trafficRng;
  for (const car of game.cars) {
    if (game.player.inCar === car) continue;
    if (!car.road) {
      // nearestRoadPoint returns a point on a real road: when it moved x
      // the road is vertical (line = that x), else horizontal (line = y).
      // Snap the car onto it, so traffic never cruises mid-block.
      const rp = nearestRoadPoint(car.x, car.y);
      if (rp.x !== car.x) { car.road = 'v'; car.line = rp.x; car.x = rp.x; }
      else { car.road = 'h'; car.line = rp.y; car.y = rp.y; }
      car.dir = chance(rng, 0.5) ? 1 : -1;
      car.turnedAt = null;
    }
    // Steer toward the road direction.
    const wantAngle = car.road === 'v'
      ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (car.dir > 0 ? 0 : Math.PI);
    let da = wantAngle - car.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, da));
    // Ease back onto the road's centre line.
    if (car.road === 'v') car.x += (car.line - car.x) * Math.min(1, dt * 3);
    else car.y += (car.line - car.y) * Math.min(1, dt * 3);
    car.speed += (95 - car.speed) * dt * 0.8;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // At an intersection, sometimes turn onto the crossing road.
    const along = car.road === 'v' ? car.y : car.x;
    const nearest = Math.round(along / ROAD_STEP) * ROAD_STEP;
    if (Math.abs(along - nearest) < 8 && car.turnedAt !== nearest) {
      car.turnedAt = nearest;
      if (chance(rng, 0.4)) {
        if (car.road === 'v') { car.road = 'h'; car.line = nearest; }
        else { car.road = 'v'; car.line = nearest; }
        car.dir = chance(rng, 0.5) ? 1 : -1;
      } else if (chance(rng, 0.08)) {
        car.dir *= -1; // rare U-turn
      }
    }
    if (Math.abs(along - nearest) > 40) car.turnedAt = null;
    car.x = Math.max(40, Math.min(WORLD - 40, car.x));
    car.y = Math.max(40, Math.min(WORLD - 40, car.y));
    // Keep a gap from the car ahead.
    for (const o of game.cars) {
      if (o !== car && Math.hypot(o.x - car.x, o.y - car.y) < 46) car.speed = Math.min(car.speed, 25);
    }
  }
}

export function updatePeds(game, dt) {
  const rng = game.trafficRng;
  for (const ped of game.peds) {
    ped.walkPhase += dt * 8;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const p = game.player;
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.x += Math.cos(a) * 130 * dt;
      ped.y += Math.sin(a) * 130 * dt;
    } else {
      ped.changeTimer -= dt;
      if (ped.changeTimer <= 0) {
        ped.changeTimer = range(rng, 2, 7);
        ped.angle = range(rng, 0, Math.PI * 2);
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    ped.x = Math.max(30, Math.min(WORLD - 30, ped.x));
    ped.y = Math.max(30, Math.min(WORLD - 30, ped.y));
    resolveSolid(game.city, ped, 10);
  }
}

// Police chase the player; on foot they close in and try to bust.
export function updatePolice(game, dt) {
  const p = game.player;
  for (const pc of game.police) {
    const dx = p.x - pc.x, dy = p.y - pc.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let da = wantAngle - pc.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    pc.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, da));
    const targetSpeed = p.inCar ? 430 : 240;
    pc.speed += (targetSpeed - pc.speed) * dt;
    pc.x += Math.cos(pc.angle) * pc.speed * dt;
    pc.y += Math.sin(pc.angle) * pc.speed * dt;
    if (resolveSolid(game.city, pc, 20)) pc.speed = 60;
    if (dist < 30 && !p.inCar) {
      p.bustedTimer += dt;
      if (p.bustedTimer > 1.2) {
        p.bustedTimer = 0;
        p.wanted = 0;
        p.money = Math.max(0, p.money - 150);
        p.x = game.city.landmarks.hideout.x; p.y = game.city.landmarks.hideout.y;
        if (p.inCar) { p.inCar = null; }
        game.state = 'busted';
        game.audio.busted();
        game.audio.siren(false);
      }
    } else {
      p.bustedTimer = Math.max(0, p.bustedTimer - dt * 2);
    }
    // Police ram the player's car.
    if (p.inCar && dist < 46) {
      p.inCar.speed *= 0.86;
      pc.speed *= 0.9;
      if (Math.abs(p.inCar.speed) > 100) game.audio.crash();
    }
  }
}

// Thugs (mission 4): stand at the docks and shoot at the player.
export function updateThugs(game, dt) {
  const p = game.player;
  for (const th of game.thugs) {
    if (th.dead) continue;
    th.shootTimer -= dt;
    const dist = Math.hypot(p.x - th.x, p.y - th.y);
    if (dist < 420 && th.shootTimer <= 0) {
      th.shootTimer = 1.4;
      const a = Math.atan2(p.y - th.y, p.x - th.x);
      game.bullets.push({
        x: th.x + Math.cos(a) * 20, y: th.y + Math.sin(a) * 20,
        vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, life: 0.9, fromPlayer: false,
      });
      game.audio.shoot();
    }
  }
}

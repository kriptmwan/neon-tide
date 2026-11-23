// Neon Tide story missions. Rook, a small-time driver in Tidewater Bay,
// takes jobs from Marina, a fixer on the pier. Six short jobs, each with a
// marker on the map and in the world, a log entry and a cash reward.
import { addWanted, burst } from './entities.js';

export const MISSIONS = [
  {
    id: 1, title: 'First Tide', reward: 200,
    brief: 'Marina needs a package picked up at the Marina Pier and dropped at the Neon Diner. Drive or walk — just don\'t draw heat.',
    steps: [
      { type: 'goto', label: 'Pick up the package at Marina Pier', at: 'marina' },
      { type: 'goto', label: 'Deliver it to the Neon Diner', at: 'diner' },
    ],
  },
  {
    id: 2, title: 'Courier Run', reward: 350,
    brief: 'Two drops, one night. Grab the parcel at Neon Plaza, drop it at the Safehouse, then finish at the Marina.',
    steps: [
      { type: 'goto', label: 'Collect the parcel at Neon Plaza', at: 'plaza' },
      { type: 'goto', label: 'Drop it at the Safehouse', at: 'hideout' },
      { type: 'goto', label: 'Final drop at the Marina Pier', at: 'marina' },
    ],
  },
  {
    id: 3, title: 'Getaway Driver', reward: 500,
    brief: 'A client is hot. Pick him up at the Diner, then lose the cops — stay out of their sight until the heat dies down.',
    steps: [
      { type: 'goto', label: 'Pick up the client at the Neon Diner', at: 'diner' },
      { type: 'escape', label: 'Lose the police (wanted level must hit 0)', at: 'hideout' },
    ],
    onStart(game) { addWanted(game, 3); },
  },
  {
    id: 4, title: 'Harbor Hit', reward: 650,
    brief: 'Three dock thugs skimmed Marina\'s cut. Take them out at the Harbor Docks. They shoot back — bring ammo.',
    steps: [
      { type: 'kill', label: 'Take out the dock thugs (0/3)', at: 'docks', count: 3 },
    ],
    onStart(game) {
      const d = game.city.landmarks.docks;
      game.thugs = [
        { x: d.x - 60, y: d.y - 40, hp: 100, dead: false, shootTimer: 1 },
        { x: d.x + 40, y: d.y + 20, hp: 100, dead: false, shootTimer: 2 },
        { x: d.x + 90, y: d.y - 70, hp: 100, dead: false, shootTimer: 1.5 },
      ];
    },
  },
  {
    id: 5, title: 'Tail the Shark', reward: 700,
    brief: 'A rival courier — "the Shark" — is running Marina\'s route. Chase his car down and ram it three times to make him quit.',
    steps: [
      { type: 'ram', label: 'Ram the Shark\'s car (0/3 hits)', at: 'plaza', count: 3 },
    ],
    onStart(game) {
      const p = game.city.landmarks.plaza;
      game.shark = { x: p.x + 120, y: p.y, angle: 0, speed: 0, hits: 0, fleeing: true };
    },
  },
  {
    id: 6, title: 'Full Service', reward: 800,
    brief: 'Last job: get your car repaired at Bay Auto, then deliver it to Rook\'s Garage. End the night rich and clean.',
    steps: [
      { type: 'shop', label: 'Get a repair at Bay Auto (press E at the shop)', at: 'auto' },
      { type: 'goto', label: 'Deliver the car to Rook\'s Garage', at: 'garage' },
    ],
  },
];

export function missionState(game) {
  return {
    index: game.missionIndex,
    step: game.missionStep,
    done: game.missionsDone,
    current: MISSIONS[game.missionIndex] || null,
  };
}

export function startMission(game, index) {
  const m = MISSIONS[index];
  if (!m) return;
  game.missionIndex = index;
  game.missionStep = 0;
  game.missionActive = true;
  game.banner = { text: `MISSION: ${m.title}`, sub: m.brief, t: 0 };
  if (m.onStart) m.onStart(game);
}

export function currentStep(game) {
  const m = MISSIONS[game.missionIndex];
  return m ? m.steps[game.missionStep] : null;
}

export function stepTarget(game) {
  const step = currentStep(game);
  if (!step) return null;
  const lm = game.city.landmarks[step.at];
  if (lm) return { x: lm.x, y: lm.y, name: lm.name };
  const shop = game.city.shops.find(s => s.id === step.at);
  if (shop) return { x: shop.x, y: shop.y, name: shop.name };
  return null;
}

export function completeStep(game) {
  const m = MISSIONS[game.missionIndex];
  game.missionStep += 1;
  game.audio.pickup();
  if (game.missionStep >= m.steps.length) completeMission(game);
  else {
    const next = m.steps[game.missionStep];
    game.banner = { text: next.label, sub: '', t: 0 };
  }
}

export function completeMission(game) {
  const m = MISSIONS[game.missionIndex];
  game.player.money += m.reward;
  game.missionsDone.push(m.id);
  game.missionActive = false;
  game.banner = { text: `MISSION COMPLETE: ${m.title}`, sub: `+$${m.reward} — Marina is pleased.`, t: 0 };
  game.audio.missionDone();
  burst(game, game.player.x, game.player.y, '#7dff9a', 24);
  game.save();
  if (game.missionIndex + 1 < MISSIONS.length) {
    game.missionIndex += 1;
    game.missionStep = 0;
    game.missionActive = false;
    game.pendingNext = true;
  } else {
    game.storyDone = true;
    game.banner = { text: 'NEON TIDE COMPLETE', sub: 'All six jobs done. Tidewater Bay is yours, Rook.', t: 0 };
  }
}

// Called every tick while a mission is active.
export function updateMission(game, dt) {
  if (!game.missionActive) return;
  const m = MISSIONS[game.missionIndex];
  const step = currentStep(game);
  if (!step) return;
  const p = game.player;
  const target = stepTarget(game);
  if (!target) return;
  const dist = Math.hypot(p.x - target.x, p.y - target.y);

  if (step.type === 'goto' && dist < 70) {
    completeStep(game);
    return;
  }
  if (step.type === 'escape') {
    if (p.wanted === 0) completeStep(game);
    return;
  }
  if (step.type === 'kill') {
    const left = game.thugs.filter(t => !t.dead).length;
    step.label = `Take out the dock thugs (${3 - left}/3)`;
    if (left === 0) completeStep(game);
    return;
  }
  if (step.type === 'ram' && game.shark) {
    step.label = `Ram the Shark's car (${game.shark.hits}/3 hits)`;
    if (game.shark.hits >= 3) { game.shark = null; completeStep(game); }
    return;
  }
  if (step.type === 'shop') {
    if (game.shopRepaired) { game.shopRepaired = false; completeStep(game); }
    return;
  }
}

// The Shark's getaway car: flees along roads, swerves when rammed.
export function updateShark(game, dt) {
  const s = game.shark;
  if (!s) return;
  const p = game.player;
  const dx = s.x - p.x, dy = s.y - p.y;
  const dist = Math.hypot(dx, dy);
  const fleeAngle = Math.atan2(dy, dx);
  let da = fleeAngle - s.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  s.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, da));
  s.speed += ((dist < 300 ? 380 : 300) - s.speed) * dt * 0.7;
  s.x += Math.cos(s.angle) * s.speed * dt;
  s.y += Math.sin(s.angle) * s.speed * dt;
  s.x = Math.max(60, Math.min(2500, s.x));
  s.y = Math.max(60, Math.min(2500, s.y));
  if (p.inCar && dist < 48 && Math.abs(p.inCar.speed) > 80) {
    s.hits += 1;
    s.speed = 120;
    s.x += Math.cos(s.angle) * 40; s.y += Math.sin(s.angle) * 40;
    burst(game, s.x, s.y, '#ffb347', 14);
    game.audio.crash();
    game.floaters.push({ x: s.x, y: s.y - 24, text: `HIT ${s.hits}/3`, t: 0, color: '#ffb347' });
  }
}

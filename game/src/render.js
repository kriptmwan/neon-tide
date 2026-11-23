// Neon Tide rendering: the city, the cast, the HUD and the minimap.
// Canvas 2D, drawn from the camera each frame. Colors are flat and bright
// so the city reads at a glance in a small screenshot.
import { WORLD, ROAD_STEP, ROAD_W } from './city.js';
import { MISSIONS, currentStep, stepTarget } from './missions.js';

const VIEW_W = 1280, VIEW_H = 720;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, -24, -10, 52, 24, 6); ctx.fill();
  ctx.translate(0, -3);
  ctx.fillStyle = car.color;
  roundRect(ctx, -26, -12, 52, 24, 7); ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  roundRect(ctx, -6, -10, 14, 20, 3); ctx.fill();
  ctx.fillStyle = 'rgba(20,20,30,0.9)';
  roundRect(ctx, 12, -10, 8, 20, 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(-22, -14, 8, 4); ctx.fillRect(-22, 10, 8, 4);
  ctx.fillRect(14, -14, 8, 4); ctx.fillRect(14, 10, 8, 4);
  if (car.isPolice) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-2, -12, 10, 24);
    ctx.fillStyle = '#d21f2b';
    ctx.fillRect(-2, -12, 10, 6);
    ctx.fillStyle = '#1c4fd2';
    ctx.fillRect(-2, 6, 10, 6);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('NTPD', -12, 3);
  }
  if (car.isTaxi) {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, shirt, phase, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const swing = Math.sin(phase) * 3 * scale;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 2, 9 * scale, 6 * scale, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 8 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(6 * scale, 0, 5 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(3 * scale, -swing, 2.5 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(3 * scale, swing, 2.5 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function render(game, ctx) {
  const cam = game.camera;
  const p = game.player;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(-cam.x + VIEW_W / 2, -cam.y + VIEW_H / 2);

  // Ground: grass, sand beach east, water beyond, port concrete south.
  ctx.fillStyle = '#3f7d4a'; ctx.fillRect(0, 0, WORLD, WORLD);
  ctx.fillStyle = '#e8d28a'; ctx.fillRect(2280, 0, 180, WORLD);
  ctx.fillStyle = '#2a7ab8'; ctx.fillRect(2460, 0, 100, WORLD);
  ctx.fillStyle = '#8a8f96'; ctx.fillRect(0, 2280, WORLD, 280);
  // Water shimmer lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  for (let y = 120; y < WORLD; y += 240) {
    ctx.beginPath(); ctx.moveTo(2480, y); ctx.lineTo(2540, y + 30); ctx.stroke();
  }

  // Roads.
  ctx.fillStyle = '#2c2f38';
  for (const g of game.city.roadsH) ctx.fillRect(0, g - ROAD_W / 2, WORLD, ROAD_W);
  for (const g of game.city.roadsV) ctx.fillRect(g - ROAD_W / 2, 0, ROAD_W, WORLD);
  // Lane dashes.
  ctx.strokeStyle = '#e8d44f'; ctx.lineWidth = 3; ctx.setLineDash([22, 26]);
  for (const g of game.city.roadsH) {
    ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(WORLD, g); ctx.stroke();
  }
  for (const g of game.city.roadsV) {
    ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, WORLD); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Park.
  ctx.fillStyle = '#4c9a52';
  ctx.fillRect(3 * ROAD_STEP + ROAD_W / 2, 3 * ROAD_STEP + ROAD_W / 2, ROAD_STEP - ROAD_W, ROAD_STEP - ROAD_W);
  ctx.fillStyle = '#6fbf76';
  ctx.beginPath(); ctx.arc(1120, 1120, 46, 0, Math.PI * 2); ctx.fill();

  // Port containers.
  for (const c of game.city.containers) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(c.x + 4, c.y + 5, c.w, c.h);
    ctx.fillStyle = c.color; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(c.x + i * 30, c.y); ctx.lineTo(c.x + i * 30, c.y + c.h); ctx.stroke(); }
  }

  // Buildings with roof, shadow and windows.
  for (const b of game.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    if (b.roof) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    }
    ctx.fillStyle = 'rgba(255,230,120,0.85)';
    const cols = Math.max(1, Math.floor(b.w / 22));
    const rows = Math.max(1, Math.floor(b.h / 22));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if ((i * 7 + j * 3 + b.floors) % 3 !== 0) ctx.fillRect(b.x + 6 + i * 22, b.y + 6 + j * 22, 10, 12);
    }
  }

  // Trees and palms.
  for (const t of game.city.trees) {
    ctx.fillStyle = '#2c6b34';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f9a4c';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.7, 0, Math.PI * 2); ctx.fill();
  }

  // Shops.
  for (const s of game.city.shops) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(s.x - 44, s.y - 28, 92, 60);
    ctx.fillStyle = s.color; roundRect(ctx, s.x - 48, s.y - 32, 96, 64, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(s.name, s.x, s.y + 4);
    ctx.fillStyle = '#ffd76b';
    ctx.beginPath(); ctx.arc(s.x + 52, s.y - 34, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = 'bold 12px sans-serif';
    ctx.fillText('$', s.x + 52, s.y - 30);
  }

  // Mission marker: beacon + bouncing diamond.
  const target = game.missionActive ? stepTarget(game) : null;
  if (target) {
    const bob = Math.sin(game.time * 4) * 6;
    ctx.fillStyle = 'rgba(255,215,107,0.25)';
    ctx.beginPath(); ctx.arc(target.x, target.y, 34, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd76b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(target.x, target.y, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd76b';
    ctx.save(); ctx.translate(target.x, target.y - 44 + bob); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18); ctx.restore();
  }

  // Cash / health pickups.
  for (const pk of game.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(game.time * 3 + pk.bob) * 3;
    ctx.fillStyle = pk.kind === 'cash' ? '#2fbf5a' : '#ff5a7a';
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'cash' ? '$' : '+', pk.x, pk.y + bob + 4);
  }

  // Pedestrians, thugs, the Shark.
  for (const ped of game.peds) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.walkPhase);
  for (const th of game.thugs) {
    if (th.dead) continue;
    drawPerson(ctx, th.x, th.y, Math.atan2(p.y - th.y, p.x - th.x), '#1c1c22', game.time * 8, 1.15);
    ctx.fillStyle = '#ff4d4d'; ctx.fillRect(th.x - 14, th.y - 24, 28, 5);
    ctx.fillStyle = '#7dff9a'; ctx.fillRect(th.x - 14, th.y - 24, 28 * (th.hp / 100), 5);
  }
  if (game.shark) {
    drawCar(ctx, { x: game.shark.x, y: game.shark.y, angle: game.shark.angle, color: '#111318', model: 'Sport' });
    ctx.fillStyle = '#ff4d4d'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('SHARK', game.shark.x, game.shark.y - 34);
  }

  // Traffic, police, player car / player.
  for (const car of game.cars) drawCar(ctx, car);
  for (const pc of game.police) drawCar(ctx, pc);
  if (p.inCar) drawCar(ctx, p.inCar);
  else drawPerson(ctx, p.x, p.y, p.aimAngle ?? p.angle, '#e04040', p.walkPhase, 1.1);

  // Bullets and particles.
  ctx.fillStyle = '#ffe27a';
  for (const b of game.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life * 1.6);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  // Floating score text.
  ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
  for (const f of game.floaters) {
    ctx.globalAlpha = Math.max(0, 1 - f.t);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // Off-screen mission direction arrow.
  if (target) {
    const sx = target.x - cam.x + VIEW_W / 2;
    const sy = target.y - cam.y + VIEW_H / 2;
    if (sx < 60 || sx > VIEW_W - 60 || sy < 60 || sy > VIEW_H - 60) {
      const cx = Math.max(60, Math.min(VIEW_W - 60, sx));
      const cy = Math.max(60, Math.min(VIEW_H - 60, sy));
      const a = Math.atan2(sy - VIEW_H / 2, sx - VIEW_W / 2);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      ctx.fillStyle = '#ffd76b';
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd76b'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(Math.hypot(target.x - p.x, target.y - p.y))}m`, cx, cy + 30);
    }
  }

  ctx.restore();

  // Day / sunset tint.
  if (game.tint) {
    ctx.fillStyle = game.tint;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  // Hurt flash.
  if (p.hurtTimer > 0) {
    ctx.fillStyle = `rgba(255,0,0,${p.hurtTimer * 0.35})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  drawHud(game, ctx);
  if (game.state === 'title') drawTitle(game, ctx);
  if (game.state === 'paused') drawPause(ctx);
  if (game.state === 'wasted') drawEndCard(ctx, 'WASTED', 'Rook got taken down. The tide keeps rolling — press R to get back up.', '#d21f2b');
  if (game.state === 'busted') drawEndCard(ctx, 'BUSTED', 'The NTPD caught up. $150 fine, back at the Safehouse. Press R to continue.', '#1c4fd2');
  if (game.shopOpen) drawShop(game, ctx);
  if (game.logOpen) drawMissionLog(game, ctx);
  if (game.banner && game.banner.t < 8) drawBanner(game, ctx);
}

// --- HUD ---------------------------------------------------------------

function drawHud(game, ctx) {
  const p = game.player;
  ctx.textAlign = 'left';
  // Top-left: cash, health, ammo.
  ctx.fillStyle = 'rgba(8,12,24,0.72)';
  roundRect(ctx, 14, 12, 250, 86, 10); ctx.fill();
  ctx.fillStyle = '#7dff9a'; ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`$${p.money}`, 28, 44);
  ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
  ctx.fillText(p.inCar ? `${p.inCar.model}  ·  car ${Math.max(0, Math.round(p.inCar.health))}%  ·  AMMO ${p.ammo}` : `On foot  ·  E: enter car  ·  AMMO ${p.ammo}`, 28, 66);
  ctx.fillStyle = '#333';
  roundRect(ctx, 28, 74, 200, 12, 6); ctx.fill();
  ctx.fillStyle = p.health > 30 ? '#4fc98a' : '#ff4d4d';
  roundRect(ctx, 28, 74, 200 * (p.health / p.maxHealth), 12, 6); ctx.fill();

  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(8,12,24,0.72)';
  roundRect(ctx, VIEW_W - 224, 12, 210, 52, 10); ctx.fill();
  ctx.font = '26px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < p.wanted ? '#ffd76b' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', VIEW_W - 206 + i * 40, 48);
  }

  // Top-center: current objective.
  if (game.missionActive) {
    const step = currentStep(game);
    if (step) {
      ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
      const w = ctx.measureText(step.label).width + 36;
      ctx.fillStyle = 'rgba(8,12,24,0.72)';
      roundRect(ctx, (VIEW_W - w) / 2, 12, w, 34, 10); ctx.fill();
      ctx.fillStyle = '#ffd76b';
      ctx.fillText(`◆ ${step.label}`, VIEW_W / 2, 35);
    }
  }

  // Bottom-right: controls.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(8,12,24,0.6)';
  roundRect(ctx, VIEW_W - 330, VIEW_H - 40, 316, 28, 8); ctx.fill();
  ctx.fillStyle = '#cfe3ff'; ctx.font = '12px sans-serif';
  ctx.fillText('WASD move/drive · E car/shop · Click/Space shoot · M missions · P pause', VIEW_W - 24, VIEW_H - 21);

  drawMinimap(game, ctx);
}

function drawMinimap(game, ctx) {
  const S = 176, X = 16, Y = VIEW_H - S - 16;
  const k = S / WORLD;
  ctx.fillStyle = 'rgba(8,12,24,0.78)';
  roundRect(ctx, X - 6, Y - 6, S + 12, S + 12, 10); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.rect(X, Y, S, S); ctx.clip();
  ctx.fillStyle = '#274b31'; ctx.fillRect(X, Y, S, S);
  ctx.fillStyle = '#e8d28a'; ctx.fillRect(X + 2280 * k, Y, 180 * k, S);
  ctx.fillStyle = '#2a7ab8'; ctx.fillRect(X + 2460 * k, Y, 100 * k, S);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 3;
  for (const g of game.city.roadsH) { ctx.beginPath(); ctx.moveTo(X, Y + g * k); ctx.lineTo(X + S, Y + g * k); ctx.stroke(); }
  for (const g of game.city.roadsV) { ctx.beginPath(); ctx.moveTo(X + g * k, Y); ctx.lineTo(X + g * k, Y + S); ctx.stroke(); }
  for (const s of game.city.shops) {
    ctx.fillStyle = s.color; ctx.fillRect(X + s.x * k - 3, Y + s.y * k - 3, 6, 6);
  }
  const target = game.missionActive ? stepTarget(game) : null;
  if (target) {
    ctx.fillStyle = '#ffd76b';
    ctx.beginPath(); ctx.arc(X + target.x * k, Y + target.y * k, 6, 0, Math.PI * 2); ctx.fill();
  }
  for (const pc of game.police) {
    ctx.fillStyle = '#5a8cff';
    ctx.beginPath(); ctx.arc(X + pc.x * k, Y + pc.y * k, 4, 0, Math.PI * 2); ctx.fill();
  }
  const p = game.player;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(X + p.x * k, Y + p.y * k, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e04040'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#cfe3ff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('TIDEWATER BAY', X, Y - 10 + 0);
}

// --- Screens ------------------------------------------------------------

function drawTitle(game, ctx) {
  ctx.fillStyle = 'rgba(6,8,20,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5fa2';
  ctx.font = 'bold 96px sans-serif';
  ctx.fillText('NEON TIDE', VIEW_W / 2, 210);
  ctx.fillStyle = '#ffd76b';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('TIDEWATER BAY  ·  AN OPEN-WORLD CRIME GAME', VIEW_W / 2, 258);
  ctx.fillStyle = '#fff'; ctx.font = '17px sans-serif';
  ctx.fillText('Six jobs for Marina. Steal cars, dodge the NTPD, and take the city.', VIEW_W / 2, 300);
  ctx.fillStyle = '#7dff9a'; ctx.font = 'bold 20px sans-serif';
  ctx.fillText(game.hasSave ? '▶  ENTER — continue your story (save found)' : '▶  ENTER — start a new story', VIEW_W / 2, 380);
  ctx.fillStyle = '#cfe3ff'; ctx.font = '15px sans-serif';
  ctx.fillText('WASD move / drive   ·   E enter car & shops   ·   Click or Space to shoot   ·   M missions   ·   P pause', VIEW_W / 2, 430);
  ctx.fillText('Steal any car. Earn cash from jobs. Watch your wanted stars.', VIEW_W / 2, 460);
  ctx.fillStyle = '#8fa8c8'; ctx.font = '13px sans-serif';
  ctx.fillText('A free, original game — no Rockstar content. Built for make.fun gta6-01.', VIEW_W / 2, 660);
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(6,8,20,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 54px sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 330);
  ctx.font = '18px sans-serif'; ctx.fillStyle = '#cfe3ff';
  ctx.fillText('Press P to resume · R to restart the night', VIEW_W / 2, 380);
}

function drawEndCard(ctx, title, line, color) {
  ctx.fillStyle = 'rgba(6,8,20,0.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = color; ctx.font = 'bold 84px sans-serif';
  ctx.fillText(title, VIEW_W / 2, 330);
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
  ctx.fillText(line, VIEW_W / 2, 390);
}

function drawShop(game, ctx) {
  const shop = game.shopOpen;
  ctx.fillStyle = 'rgba(6,8,20,0.65)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8,12,24,0.95)';
  roundRect(ctx, VIEW_W / 2 - 260, 180, 520, 330, 14); ctx.fill();
  ctx.fillStyle = shop.color; ctx.font = 'bold 34px sans-serif';
  ctx.fillText(shop.name, VIEW_W / 2, 240);
  ctx.fillStyle = '#cfe3ff'; ctx.font = '15px sans-serif';
  ctx.fillText(shop.blurb, VIEW_W / 2, 272);
  ctx.fillStyle = '#7dff9a'; ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`Your cash: $${game.player.money}`, VIEW_W / 2, 312);
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '17px sans-serif';
  const items = shopItems(shop.kind);
  items.forEach((it, i) => {
    ctx.fillText(`${i + 1}. ${it.name} — $${it.price}`, VIEW_W / 2 - 220, 356 + i * 36);
  });
  ctx.textAlign = 'center'; ctx.fillStyle = '#8fa8c8'; ctx.font = '14px sans-serif';
  ctx.fillText('Press 1-3 to buy · E or Esc to leave', VIEW_W / 2, 480);
}

export function shopItems(kind) {
  if (kind === 'arms') return [
    { name: 'Pistol ammo +24', price: 30, apply: g => { g.player.ammo += 24; } },
    { name: 'Pistol (if lost)', price: 150, apply: g => { g.player.hasPistol = true; g.player.ammo += 12; } },
    { name: 'Body armor +50 HP', price: 60, apply: g => { g.player.health = Math.min(g.player.maxHealth, g.player.health + 50); } },
  ];
  if (kind === 'clinic') return [
    { name: 'Patch up +40 HP', price: 50, apply: g => { g.player.health = Math.min(g.player.maxHealth, g.player.health + 40); } },
    { name: 'Full treatment', price: 90, apply: g => { g.player.health = g.player.maxHealth; } },
    { name: 'Energy drink +10 HP', price: 10, apply: g => { g.player.health = Math.min(g.player.maxHealth, g.player.health + 10); } },
  ];
  if (kind === 'auto') return [
    { name: 'Repair car (full)', price: 80, apply: g => { if (g.player.inCar) g.player.inCar.health = 100; g.shopRepaired = true; } },
    { name: 'Tune-up (faster car)', price: 120, apply: g => { if (g.player.inCar) g.player.inCar.health = 100; g.shopRepaired = true; } },
    { name: 'Wash & wax', price: 20, apply: g => { g.shopRepaired = true; } },
  ];
  return [
    { name: 'Snack +25 HP', price: 10, apply: g => { g.player.health = Math.min(g.player.maxHealth, g.player.health + 25); } },
    { name: 'Coffee (sprint boost)', price: 15, apply: g => { g.player.health = Math.min(g.player.maxHealth, g.player.health + 10); } },
    { name: 'Pie of the day', price: 25, apply: g => { g.player.health = g.player.maxHealth; } },
  ];
}

function drawMissionLog(game, ctx) {
  ctx.fillStyle = 'rgba(6,8,20,0.65)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(8,12,24,0.95)';
  roundRect(ctx, VIEW_W / 2 - 300, 90, 600, 540, 14); ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76b'; ctx.font = 'bold 28px sans-serif';
  ctx.fillText('MISSION LOG — MARINA\'S JOBS', VIEW_W / 2, 140);
  ctx.textAlign = 'left'; ctx.font = '15px sans-serif';
  MISSIONS.forEach((m, i) => {
    const y = 180 + i * 72;
    const done = game.missionsDone.includes(m.id);
    const active = game.missionActive && game.missionIndex === i;
    ctx.fillStyle = done ? '#4fc98a' : active ? '#ffd76b' : '#8fa8c8';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${done ? '✓' : active ? '▶' : '·'}  ${m.id}. ${m.title} — $${m.reward}`, VIEW_W / 2 - 270, y);
    ctx.fillStyle = '#cfe3ff'; ctx.font = '13px sans-serif';
    ctx.fillText(m.brief.slice(0, 82), VIEW_W / 2 - 270, y + 20);
  });
  ctx.textAlign = 'center'; ctx.fillStyle = '#8fa8c8'; ctx.font = '14px sans-serif';
  ctx.fillText('Press M or Esc to close · Press N to start the next job', VIEW_W / 2, 600);
}

function drawBanner(game, ctx) {
  const b = game.banner;
  // Full opacity from the first frame (screenshots may catch frame 1),
  // fading out only in the last second of the banner's life.
  const a = b.t > 7 ? Math.max(0, 8 - b.t) : 1;
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8,12,24,0.8)';
  roundRect(ctx, VIEW_W / 2 - 340, 110, 680, 76, 12); ctx.fill();
  ctx.fillStyle = '#ffd76b'; ctx.font = 'bold 26px sans-serif';
  ctx.fillText(b.text, VIEW_W / 2, 142);
  if (b.sub) {
    ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif';
    ctx.fillText(b.sub, VIEW_W / 2, 170);
  }
  ctx.globalAlpha = 1;
}

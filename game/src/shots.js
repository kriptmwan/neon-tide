// Staged screenshot scenes for Neon Tide.
// ?shot=start | play | end with ?seed=N stages a fixed, deterministic
// scene so each screenshot shows the game at its best. The scenes only
// arrange entities the game itself simulates — nothing is drawn by hand
// for the camera.
import { makeCar } from './entities.js';
import { startMission, MISSIONS } from './missions.js';

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || null,
    seed: parseInt(q.get('seed') || '1', 10) || 1,
  };
}

export function stageShot(game, kind) {
  const p = game.player;
  const plaza = game.city.landmarks.plaza;
  if (kind === 'start') {
    // Title screen over a living city: Rook on foot at Neon Plaza,
    // traffic cruising, the marina and shops in frame.
    game.state = 'title';
    p.x = plaza.x; p.y = plaza.y + 60;
    p.money = 250; p.health = 100; p.ammo = 24; p.wanted = 0;
    game.camera.x = p.x; game.camera.y = p.y;
    return;
  }
  if (kind === 'play') {
    // Mid-chase action: Rook driving, 3 wanted stars, NTPD on his tail,
    // mission 3 (Getaway Driver) live with its marker on the HUD.
    game.state = 'playing';
    // On the road by the Neon Diner (the mission marker), heading north,
    // with the NTPD already closing in behind.
    const car = makeCar(1600, 420, -Math.PI / 2, { color: '#e04040', model: 'Sport' });
    game.cars.push(car);
    p.inCar = car;
    p.x = car.x; p.y = car.y;
    p.money = 1250; p.health = 88; p.ammo = 18;
    startMission(game, 2); // onStart adds the 3 wanted stars for this job
    game.camera.x = p.x; game.camera.y = p.y;
    return;
  }
  if (kind === 'end') {
    // The night after the last job: sunset over the beach, Rook on foot
    // by his car, pockets full, heat gone, story complete.
    game.state = 'playing';
    game.missionsDone = MISSIONS.map(m => m.id);
    game.storyDone = true;
    const beach = { x: 2330, y: 900 };
    const car = makeCar(beach.x - 60, beach.y + 40, Math.PI / 2, { color: '#e0a53a', model: 'Coupe' });
    game.cars.push(car);
    p.x = beach.x; p.y = beach.y;
    p.money = 3200; p.health = 100; p.ammo = 30; p.wanted = 0;
    game.tint = 'rgba(255,110,40,0.18)';
    game.shotTint = true;
    game.banner = { text: 'NEON TIDE COMPLETE', sub: 'All six jobs done. Tidewater Bay is yours, Rook.', t: 0 };
    // Camera clamped to the world edge, so the beach fills the frame
    // and no void shows past the water.
    game.camera.x = Math.min(2560 - 640, p.x); game.camera.y = p.y;
  }
}

# neon-tide

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kriptmwan/neon-tide/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kriptmwan/neon-tide/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Tide** is a 2D top-down open-world crime game set in Tidewater Bay, a sun-soaked coastal city of neon plazas, a marina, a beach and a working harbor. You play Rook, a small-time driver taking jobs from Marina, a fixer on the pier.

Explore the city on foot or steal any car and drive it. Traffic cruises the road grid, pedestrians stroll the sidewalks, and the NTPD responds to your crimes with a 5-star wanted level and real police chases. Take on six story missions — pickups and deliveries, a getaway escape, a harbor hit, a car chase against a rival courier, and a final repair-and-deliver job — earn cash, buy ammo, health and repairs at the city's shops, and save your progress to keep building your story.

What is in the game:

- **Open world** — a 2560×2560 city: downtown, old town, suburbs, marina district, beach, port with shipping containers, a central park, and four shops (Tide Arms, Neon Clinic, Bay Auto, Neon Diner)
- **On foot + driving** — walk, sprint, steal and drive 7 car models (including taxis and police cruisers) with steering, speed and collisions
- **Traffic & pedestrians** — cars follow the road grid and turn at intersections; pedestrians walk the sidewalks and flee from gunfire and speeding cars
- **Wanted system** — 5 stars, earned by shooting, stealing and running people over; police cars chase and ram you, and on-foot cops can bust you
- **Combat** — pistol with mouse aim, ammo, thugs who shoot back, car damage
- **Six story missions** — markers, beacons, a mission log (M), cash rewards, and a story-complete ending
- **Economy & shops** — earn cash from jobs and street pickups; buy ammo, healing and car repairs
- **Save & continue** — progress (cash, health, ammo, completed missions) saves to localStorage
- **HUD & minimap** — cash, health, ammo, wanted stars, current objective, and a live minimap of Tidewater Bay
- **Polish** — particles, floating score text, day/sunset cycle, synth sound effects (WebAudio, no audio files), pause, wasted/busted screens

Everything is original: the city, characters, vehicles, names and story are invented for this game. No network requests, no build step — just static files.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser and press Enter to start.

**Controls:** WASD / arrows to move and drive · E to enter or exit a car, and to open shops · Click or Space to shoot (aim with the mouse) · Shift to sprint · N to start the next mission · M for the mission log · P to pause · R to recover after Wasted/Busted · U to mute.

**Screenshots:** the three shots in `screenshots/` are staged scenes of this game, captured in a browser with `?shot=start&seed=1`, `?shot=play&seed=1` and `?shot=end&seed=1`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=emz2619t&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

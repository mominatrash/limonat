# ليمونات — Endless Rail Runner (v2)

A 3D endless runner built with **Three.js** and plain JavaScript. No build
step, no image or audio files: every model, texture, sound and the music are
generated in code.

## What's new in v2

- **3D hero on a real skeleton**: the original character (round white head, black
  beanie, white tuft, big glancing eyes, V-neck shirt, shorts, mitten hands) rebuilt
  as a smooth cel-shaded model with ink outlines and 17 animated joints.
- **Biomechanical run cycle** (`js/anim.js`): hip / knee / ankle curves modelled on real
  running gait (stance, flight, swing), pelvis yaw and drop, thorax counter-rotation,
  opposite-arm swing with elbow drive, head stabilisation, speed-dependent stride and
  lean, and foot planting so soles never float or sink. Plus blended jump styles
  (stride leap, tuck front-flip, spin), baseball slide, landing absorption, lane-change
  lean, stumble, a backwards fall on death, idle with breathing and waving,
  spring-driven hair and a cloth scarf on some skins.
- **Rendering**: PBR materials, image-based lighting from the sky, real-time sun
  shadows, HDR bloom, ACES tone mapping, colour grading, vignette, radial speed blur.
- **World**: 7 biomes (Lemon Groves, Forest, Old Village with stone houses and water
  tanks, Desert sunset, Mountains, Snowfields, City Nights with lit windows and neon),
  gradient sky with sun and stars, clouds, far ridges, modern trains, steel truss
  bridges with animated water, lit tunnels, stations with Arabic signage.
- **Effects**: footstep dust, slide sparks, pickup sparkles, smash debris, confetti,
  ambient petals / leaves / snow / sand / fireflies, speed streaks.
- **Lemons → Lemonade**: every lemon fills one slot of the HUD lemon meter; 5 lemons
  start a 10 s *Lemonade* rush (score ×2, coins ×2, built-in magnet). Lemons picked up
  during a rush add 2 s. Tuning: `CONFIG.LEMONADE`, `CONFIG.LEMON_CHANCE`.
- **Hero colour**: the hero is shaded with its own neutral light and skips the scene's
  colour grading / tone mapping (alpha-0 mask, see `character.js` HERO COLOUR), so the
  original hero stays pure white in every biome and on the menu.
- **Jetpack**: fly above the trains for 8 s on a coin trail in the sky (flight pose,
  twin-flame jetpack model, exhaust, jet sound). Lands with a 1.6 s safety window.
  `CONFIG.POWERUPS.jetpack`, `Game.startJetpack()`, `A.fly()` in anim.js.
- **Super Sneakers**: jump 40% higher for 12 s (onto train roofs), springy FX.
- **Missions**: 3 active goals with coin rewards that level up; lifetime stats
  (end of `js/ui.js`). Shown in the menu and on the game-over card.
- **Characters**: 9 skins, each with a perk (longer power-ups, 4-lemon lemonade,
  +25% coins) and accessories (glasses, shades, neon goggles, headphones, crown,
  lemon leaf). Defined in `VR.CHARACTERS` (character.js).
- **Resume countdown** (3-2-1) and phone vibration on key moments.
- **Performance**: sky lighting baked per biome at load, every shader pre-compiled
  and textures uploaded during loading (no mid-run hitches), particle buffers only
  upload live particles, no per-frame allocations in the hot paths, no live blur
  behind the in-game HUD.
- **Gameplay extras**: close-call bonus, skins shop (buy with banked coins), first-run
  tutorial, slow-motion death camera, tap the hero in the menu to make him jump.
- **UI**: new Arabic-first interface (English toggle), glass panels, power-up ring timers.
- **Audio**: synthesised Hijaz / maqsum soundtrack (menu and game modes), stereo SFX, reverb.
- Secret-code continue kept exactly as before (`js/secrets.js`).

## Run

Any static server: `python3 -m http.server 8000` then open http://localhost:8000.
Double-clicking `index.html` also works (classic `<script>` tags).

Controls: **←/→ or A/D** lanes · **↑ / W / Space** jump · **↓ / S** slide (in air: fast-fall)
· **Esc / P** pause · **Enter** start from the menu · swipe on phones.

Settings → Graphics: **High** (shadows 2048, bloom, MSAA x4), **Medium** (default on
phones), **Low** (no post-processing, no shadows). The game drops a level automatically
if the frame rate stays under ~26 fps.

## Files

| File | What it does |
|---|---|
| `js/gfx.js` | textures, materials, `VR.MB` mesh builder, pooling, sky, post-processing |
| `js/character.js` | the hero model, skins (`VR.CHARACTERS`), scarf cloth |
| `js/heroes.js` | Scout / Sprinter / Ninja: skinned meshes on the hero skeleton, parametric surfaces, zoned PBR material, spring cloth |
| `js/anim.js` | poses, gait curves, blending, foot planting |
| `js/player.js` | movement + animation state machine, hair springs |
| `js/props.js` | trees, houses, lemons, crates, lamps, buildings… |
| `js/biomes.js` | biome looks (sky, fog, light, grading) and scenery |
| `js/prefabs.js` | track styles, ground, water, trains, obstacles |
| `js/patterns.js` | obstacle layouts + fairness check (unchanged) |
| `js/world.js` | chunk streaming, collisions, close calls |
| `js/collectibles.js` | coins, bonus lemons, power-ups |
| `js/fx.js` | particles, weather, speed streaks |
| `js/audio.js` | synth SFX and music |
| `js/ui.js` | screens, HUD, shop, tutorial, Arabic/English strings |
| `js/game.js` | states, loop, camera, scoring, environment transitions |
| `js/secrets.js` | secret continue codes (salted SHA-256 fingerprints) |
| `dev/char.html` | character/animation viewer (run cycle filmstrip, poses) |

## Adding things

- **Skin**: add an entry to `VR.CHARACTERS` in `character.js` (palette colours, `price`, optional `scarf`).
- **Detailed runner** (`heroes.js`): a `kid` definition with `face` (eyes, brows, lids, smile, jaw…), optional `chains`
  (spring bones for cloth / gear) and a `build(sb, gear)` that lays surfaces on the body: `torsoFn`/`pelvisFn`/`armFn`/`legFn`
  ring surfaces, `panel` (raised pockets, bibs, patches), `onLine` (seams, straps, piping), `sweep` (tubes: laces, wraps,
  hair clumps), `shoe`, `fist`, `hairCap`/`clump`. Each vertex carries a material zone from `M` (skin, cotton, denim,
  leather, rubber, metal, knit, hair, canvas, mesh, satin…): roughness, metalness and a micro-surface pattern.
- **Biome**: add to `VR.BIOMES` in `biomes.js` and to `VR.BIOME_ORDER`.
- **Obstacle**: `VR.OBSTACLE_TYPES` in `prefabs.js`, then use it in `patterns.js`.
- **Power-up**: `CONFIG.POWERUPS`, a 3D icon in `collectibles.js` (`PU_BUILD`), an SVG `p-<id>` symbol in `index.html`.
- **Secret code**: run `VR.SecretCodes.fingerprint('new code')` in the console and add it to `FINGERPRINTS`.
- **Real sound files**: `VR.Audio.useFile('coin', 'sounds/coin.mp3')`, `VR.Audio.useMusicFile('sounds/theme.mp3')`.

Debug URL options: `?biome=city` start in a biome, `?style=tunnel` force a track style, `?god` ignore collisions.

Saves (best, coins, skins, settings) use `localStorage` with the same keys as v1, so
existing progress carries over.

## Modes & features (v4)

| Feature | File | Notes |
|---|---|---|
| Junctions | `world.js` (`makeFork`, `checkFork`), `prefabs.js` (`buildForkGate`) | Pick the next biome by lane; left/right carry a route perk (treasure / easy) |
| Weather | `weather.js` | Rain (slippery lanes, lightning), sandstorm, fog; sky + fog + light blend |
| Lemon thief | `thief.js` | Goat with a lemon sack; catch it for coins + lemons |
| Vehicles | `vehicles.js` | Mine cart & cargo bike pickups; absorb one crash |
| Pets | `pets.js` | Cat (next lane) and canary (both lanes, lemons too) |
| Lemonade stand | `stand.js` | Lemons are banked; idle income, sell, 10 upgrade levels |
| Character creator | `creator.js` | Colours per part, accessory, scarf |
| Story mode | `story.js` | «سرّ البيّارة»: 4 chapters × 4 seeded levels, comic panels, radio calls, 16 hidden letters + true ending, bulldozer / drone bosses, goat ally, 3 stars |
| Seasonal events | `events.js` | Olive harvest (Oct–Nov), Ramadan, winter; Settings -> Season to preview |
| Daily challenge + ghost | `daily.js` | Same seed for everyone; share link `#c=seed.score.name.data` |
| Combat | `combat.js` | Lemons are ammo: the throw button + crosshair appear only when there is a target (drone, biker, Zahran's courier drone, mega-drone, a race friend ahead). A lemonade rush leaves a slippery trail (bulldozer slides back, bikers crash, a race friend behind slips). Downed drones give their lemon back; stomp a biker to take his scooter; the boss's bombs each leave a lemon. Magnet grabs drones, Mishmish bell 🔔 (power-up) clears your lane. Co-op boss has shared HP |

Every feature is a *system* (`VR.SYSTEMS`) with optional hooks:
`bind, runStart(opts), update(dt), chunk(chunk, plan), runEnd(summary), reset, leaveRun,
state(s), menuUpdate(dt), menuCam(state), powerUp(type), pickPowerUp(type, x, y, z), absorbCrash(obstacle), warm(on), shift(dz), combatNet(msg)`.
`game.start({ mode, seed, biomes, styles, forks, weather, thief, lemonMul })` starts any kind of run.

### Privacy
There is no leaderboard and no scores are uploaded anywhere; everything stays on your own phone. Online rooms are only reachable
with the room code / link you share.

/* =====================================================================
 * CONFIG — every gameplay tuning number lives here.
 * Change speeds, difficulty curve, scoring and power-up timings without
 * touching any system code.
 * ===================================================================== */
window.VR = window.VR || {};

VR.CONFIG = {
  // ---------- Lanes ----------
  LANE_WIDTH: 2.6,            // distance between lane centres (world units = metres)
  LANES: [-1, 0, 1],          // lane indices (left, centre, right)
  LANE_SWITCH_TIME: 0.14,     // seconds to slide from one lane to the next

  // ---------- Player physics ----------
  GRAVITY: 40,
  JUMP_VELOCITY: 13,          // apex ≈ v² / 2g ≈ 2.1 m
  FAST_FALL_VELOCITY: -24,    // swipe down while airborne
  SLIDE_TIME: 0.72,
  PLAYER_HALF_WIDTH: 0.38,
  PLAYER_HALF_DEPTH: 0.35,
  PLAYER_HEIGHT: 1.75,
  PLAYER_SLIDE_HEIGHT: 0.75,
  STUMBLE_WINDOW: 5,          // a second side-hit inside this many seconds = crash

  // ---------- Speed & difficulty ----------
  // speed = START + (MAX - START) * (1 - e^(-distance / RAMP))
  SPEED_START: 13,
  SPEED_MAX: 31,
  SPEED_RAMP: 1500,           // lower = faster ramp (was 3200)
  STORY_SPEED_RAMP: 3200,     // story levels keep the calmer ramp they were designed for
  // difficulty 0..1 used by the chunk generator
  DIFFICULTY_RAMP: 1800,      // (was 4200)

  // ---------- World generation ----------
  CHUNK_LENGTH: 40,
  CHUNKS_AHEAD: 6,            // draw distance, in chunks
  CHUNKS_BEHIND: 1,
  SAFE_START_CHUNKS: 2,       // first chunks have coins only
  BIOME_MIN_CHUNKS: 7,
  BIOME_MAX_CHUNKS: 12,
  RECENTER_DISTANCE: 600,     // world is shifted back to origin to keep float precision

  // ---------- Scoring ----------
  POINTS_PER_METRE: 1,
  COIN_POINTS: 10,
  GEM_POINTS: 50,
  POWERUP_POINTS: 100,
  // score multiplier rises with distance: x1, x2 at 500 m, x3 at 1500 m ...
  MULTIPLIER_STEPS: [0, 500, 1500, 3000, 5000, 8000],

  // ---------- Power-ups (seconds) ----------
  POWERUPS: {
    magnet:      { duration: 10, label: 'Magnet' },
    shield:      { duration: 25, label: 'Shield' },
    boost:       { duration: 5,  label: 'Boost', speedFactor: 1.55 },
    double:      { duration: 12, label: '2x Coins' },
    invincible:  { duration: 7,  label: 'Star' },
    jetpack:     { duration: 8,  label: 'Jetpack', height: 3.4, grace: 1.6 },
    sneakers:    { duration: 12, label: 'Super Sneakers', jumpFactor: 1.4 },
    minecart:    { duration: 14, label: 'Mine cart' },
    bike:        { duration: 14, label: 'Bicycle' },
  },
  // how often each power-up appears (relative)
  POWERUP_WEIGHTS: { magnet: 1, shield: 1, boost: 0.8, double: 1, invincible: 0.7, jetpack: 0.8, sneakers: 0.9, minecart: 0.6, bike: 0.6 },
  MAGNET_RADIUS: 6,

  // ---------- Lemons -> Lemonade ----------
  // every lemon fills one slot of the lemon meter; a full meter starts a
  // LEMONADE rush: score x2, coins x2 and a built-in magnet.
  // Lemons picked up during a rush add `extend` seconds to it.
  LEMONADE: { need: 5, duration: 10, extend: 2 },
  LEMON_CHANCE: 0.42,         // chance a (non-safe) chunk holds a lemon

  // ---------- Online leaderboard (optional) ----------
  // Create a free Supabase project, run the SQL from README.md, then paste
  // the project URL and the "anon public" key here.

  // ---------- Camera ----------
  CAMERA_HEIGHT: 4.3,
  CAMERA_DISTANCE: 7.6,
  CAMERA_LOOK_AHEAD: 9,
  CAMERA_FOV: 62,
};

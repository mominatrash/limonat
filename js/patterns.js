/* =====================================================================
 * PATTERNS — what goes on the track inside one 40 m chunk.
 * ---------------------------------------------------------------------
 * Each pattern writes obstacles into a lane grid (3 lanes x 40 cells).
 * Every generated chunk is then run through verify(), which simulates
 * a player moving between lanes at the current speed and rejects any
 * layout that can't be survived. Rejected chunks are regenerated, so
 * an impossible wall of obstacles can never reach the player.
 *
 * Cell codes: F free · J jump · S slide · B block · R ramp/ride on train
 *
 * HOW TO ADD A PATTERN: write a function (g) => {...} using g.place /
 * g.train / g.moving and add it to PATTERNS with a weight function.
 * ===================================================================== */
(function () {
  const L = VR.CONFIG.CHUNK_LENGTH;
  const ZMIN = 6, ZMAX = 34;          // obstacles stay inside this band -> fair chunk seams

  class Plan {
    constructor(rnd, diff, speed) {
      this.rnd = rnd; this.diff = diff; this.speed = speed;
      this.grid = [0, 1, 2].map(() => new Array(L).fill('F'));
      this.obstacles = [];  // {type, lane, z}
      this.trains = [];     // {lane, z, cars:[{kind,color}], ramp, moving}
      this.coins = []; this.gems = []; this.powerups = [];
      this.jumpZ = [[], [], []];
    }
    cell(lane, z) { z = Math.floor(z); return z < 0 || z >= L ? 'F' : this.grid[lane + 1][z]; }
    free(lane, z0, z1) {
      for (let z = Math.floor(z0); z <= Math.ceil(z1); z++) if (z >= 0 && z < L && this.grid[lane + 1][z] !== 'F') return false;
      return true;
    }
    mark(lane, z0, z1, code) { for (let z = Math.floor(z0); z < Math.ceil(z1); z++) if (z >= 0 && z < L) this.grid[lane + 1][z] = code; }
    pick(arr) { return arr[(this.rnd() * arr.length) | 0]; }

    place(type, lane, z) {
      const def = VR.OBSTACLE_TYPES[type];
      if (z < ZMIN || z + def.length > ZMAX + 1) return false;
      // keep a clear run-up before/after so actions never overlap
      if (!this.free(lane, z - 2, z + def.length + 2)) return false;
      this.mark(lane, z, z + Math.max(1, def.length), def.kind === 'jump' ? 'J' : def.kind === 'slide' ? 'S' : 'B');
      this.obstacles.push({ type, lane, z });
      if (def.kind === 'jump') this.jumpZ[lane + 1].push(z + def.length / 2);
      return true;
    }
    train(lane, z, nCars, ramp) {
      const len = nCars * VR.CAR_LEN + (ramp ? 7 : 0);
      if (z < ZMIN || z + len > ZMAX) return false;
      if (!this.free(lane, z - 1, z + len + 1)) return false;
      const colors = VR.TRAIN_COLORS;
      const col = (this.rnd() * colors.length) | 0;
      const cars = [];
      for (let i = 0; i < nCars; i++) {
        const r = this.rnd();
        const kind = i === 0 ? (r < 0.55 ? 'loco' : 'passenger') : r < 0.45 ? 'passenger' : r < 0.75 ? 'freight' : 'tanker';
        cars.push({ kind, color: kind === 'freight' ? (col + 2) % colors.length : col });
      }
      this.mark(lane, z, z + len, ramp ? 'R' : 'B');
      this.trains.push({ lane, z: z + (ramp ? 7 : 0), cars, ramp, rampZ: ramp ? z : null, moving: false });
      return true;
    }
    moving(lane, z, nCars) {
      this.mark(lane, 0, L, 'B');   // whole lane is dangerous
      const col = (this.rnd() * VR.TRAIN_COLORS.length) | 0;
      const cars = [{ kind: 'loco', color: col }];
      for (let i = 1; i < nCars; i++) cars.push({ kind: 'passenger', color: col });
      this.trains.push({ lane, z, cars, ramp: false, moving: true });
    }
  }

  // ------------------------------------------------------------------ fairness
  function verify(plan) {
    const step = Math.max(3.5, plan.speed * 0.2);   // metres needed per lane change
    const since = [-100, -100, -100];               // z since which each lane is reachable (null = no)
    for (let z = 0; z < L; z++) {
      for (let i = 0; i < 3; i++) if (since[i] !== null && plan.grid[i][z] === 'B') since[i] = null;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < 3; i++) {
          if (since[i] !== null) continue;
          for (const m of [i - 1, i + 1]) {
            if (m < 0 || m > 2 || since[m] === null || since[m] > z - step) continue;
            let ok = true;
            for (let k = Math.max(0, Math.floor(z - step)); k <= z; k++) {
              const c = plan.grid[i][k];
              if (c === 'B' || (c === 'R' && plan.grid[m][k] !== 'R')) { ok = false; break; }
            }
            if (ok) { since[i] = z; break; }
          }
        }
      }
      if (since.every(s => s === null)) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------ patterns
  const lanes = [-1, 0, 1];
  const PATTERNS = {
    // A: straight track, coins, maybe a gentle hurdle
    coins: {
      weight: d => 3 - d * 2,
      build(g) {
        if (g.rnd() < 0.5 + g.diff * 0.4) g.place(g.rnd() < 0.7 ? 'barrier_low' : 'hay', g.pick(lanes), 12 + g.rnd() * 14);
      },
    },
    // B: one parked train, often with a ramp to climb on
    train: {
      weight: d => 2.2,
      build(g) {
        const lane = g.pick(lanes);
        const ramp = g.rnd() < 0.5;
        const cars = 1 + ((g.rnd() * (ramp ? 2 : 3)) | 0);
        g.train(lane, ZMIN + g.rnd() * 4, cars, ramp);
        const other = g.pick(lanes.filter(l => l !== lane));
        if (g.rnd() < 0.3 + g.diff * 0.5) g.place(g.pick(['barrier_low', 'barrier_high', 'minecart']), other, 14 + g.rnd() * 14);
      },
    },
    // C: two or three trains, staggered
    multitrain: {
      weight: d => (d > 0.05 ? 1 + d * 2.5 : 0),
      build(g) {
        const order = lanes.slice().sort(() => g.rnd() - 0.5);
        const nTrains = g.diff > 0.35 && g.rnd() < 0.5 ? 3 : 2;
        const rampLane = order[(g.rnd() * nTrains) | 0];
        for (let i = 0; i < nTrains; i++) {
          const lane = order[i];
          const ramp = lane === rampLane;
          const cars = ramp ? 2 : 1 + ((g.rnd() * 2) | 0);
          g.train(lane, ZMIN + i * (3 + g.rnd() * 5), cars, ramp);
        }
      },
    },
    // G: rows of mixed barriers — the core "reaction" pattern
    mixed: {
      weight: d => 1.5 + d * 3,
      build(g) {
        const spacing = Math.max(8 + (1 - g.diff) * 8, g.speed * 0.48);
        if (g.rnd() < 0.35) g.train(g.pick(lanes), ZMIN, 1 + ((g.rnd() * 2) | 0), false);
        for (let z = ZMIN + g.rnd() * 3; z < ZMAX - 1; z += spacing * (0.85 + g.rnd() * 0.3)) {
          const hard = g.rnd() < 0.25 + g.diff * 0.45 ? (g.rnd() < 0.2 + g.diff * 0.4 ? 2 : 1) : 0;
          const order = lanes.slice().sort(() => g.rnd() - 0.5);
          order.forEach((lane, i) => {
            if (i < hard) g.place('wall', lane, z);
            else if (g.rnd() < 0.35 + g.diff * 0.4) g.place(g.pick(['barrier_low', 'barrier_high', 'minecart', 'hay', 'barrier_high']), lane, z);
          });
        }
      },
    },
    // Full-width hurdle: every lane blocked but one action clears it
    hurdles: {
      weight: d => (d > 0.1 ? 1 + d : 0.3),
      build(g) {
        const spacing = Math.max(12, g.speed * 0.6);
        let z = ZMIN + 2;
        while (z < ZMAX - 1) {
          const type = g.rnd() < 0.5 ? 'barrier_low' : 'barrier_high';
          lanes.forEach(l => g.place(g.rnd() < 0.8 ? type : (type === 'barrier_low' ? 'hay' : type), l, z));
          z += spacing;
        }
      },
    },
    // Oncoming train
    moving: {
      weight: d => (d > 0.12 ? 0.8 + d * 1.6 : 0),
      build(g) {
        const lane = g.pick(lanes);
        g.moving(lane, 16, g.rnd() < 0.5 ? 2 : 1);
        const others = lanes.filter(l => l !== lane);
        if (g.rnd() < 0.6) g.place(g.pick(['barrier_low', 'barrier_high']), g.pick(others), 12 + g.rnd() * 12);
      },
    },
  };

  // ------------------------------------------------------------------ coins
  function coinTrail(g, startLane, zFrom, zTo) {
    let lane = startLane;
    const ahead = (l, z) => { for (let k = 0; k <= 5; k++) if (g.cell(l, z + k) === 'B') return false; return true; };
    const surf = (l, z) => {
      const t = g.trains.find(t => t.lane === l && !t.moving && t.ramp && z >= t.rampZ && z < t.z + t.cars.length * VR.CAR_LEN);
      if (!t) return null;
      return z < t.z ? VR.TRAIN_HEIGHT * (z - t.rampZ) / 7 : VR.TRAIN_HEIGHT;
    };
    for (let z = zFrom; z < zTo; z += 2) {
      if (!ahead(lane, z)) {
        const alt = [lane - 1, lane + 1].filter(l => l >= -1 && l <= 1 && ahead(l, z) && g.cell(l, z) !== 'R');
        if (!alt.length) { z += 4; continue; }
        const nl = g.pick(alt);
        g.coins.push({ x: (lane + nl) / 2, y: 0.9, z: z - 1, lanes: true });
        lane = nl;
      }
      const c = g.cell(lane, z);
      let y = 0.9;
      const s = surf(lane, z);
      if (s !== null) y = s + 0.9;
      else if (c === 'S') y = 0.5;
      else {
        const jz = g.jumpZ[lane + 1].find(j => Math.abs(j - z) < 4.5);
        if (jz !== undefined) { const d = (z - jz) / 4.5; y = 0.9 + 1.5 * (1 - d * d); }
      }
      g.coins.push({ x: lane, y, z, lanes: true });
    }
  }

  function addCoins(g, safe) {
    const start = g.pick([-1, 0, 1].filter(l => g.cell(l, 2) === 'F'));
    coinTrail(g, start === undefined ? 0 : start, 2, L - 2);
    // risk / reward jump arc in a free lane
    if (g.rnd() < 0.4) {
      const l = g.pick([-1, 0, 1]);
      const z0 = 8 + g.rnd() * 20;
      if (g.free(l, z0, z0 + 8) && !g.coins.some(c => c.x === l && Math.abs(c.z - z0 - 4) < 6)) {
        for (let i = 0; i < 5; i++) { const d = (i - 2) / 2.2; g.coins.push({ x: l, y: 1.0 + 1.6 * (1 - d * d), z: z0 + i * 1.6, lanes: true }); }
      }
    }
    // bonus lemon (the "gem" pickup) replaces a coin
    if (!safe && g.rnd() < VR.CONFIG.LEMON_CHANCE && g.coins.length > 4) {
      const i = (g.rnd() * g.coins.length) | 0;
      g.gems.push(g.coins.splice(i, 1)[0]);
    }
  }

  const PU_TYPES = Object.keys(VR.CONFIG.POWERUPS);

  /**
   * Build the content plan for one chunk.
   * ctx: { rnd, difficulty (0..1), speed, safe, style, powerupChance }
   */
  VR.Patterns = {
    PATTERNS,
    verify,
    generate(ctx) {
      const { rnd, difficulty, speed, safe, style } = ctx;
      let plan = null;
      for (let attempt = 0; attempt < 10 && !plan; attempt++) {
        const g = new Plan(rnd, difficulty, speed);
        if (!safe) {
          let names = Object.keys(PATTERNS);
          if (style === 'tunnel_start' || style === 'tunnel_end') names = names.filter(n => n !== 'moving');
          if (style === 'station') names = ['train', 'multitrain', 'train', 'coins'];
          const weights = names.map(n => Math.max(0, PATTERNS[n].weight(difficulty)));
          let r = rnd() * weights.reduce((a, b) => a + b, 0);
          let chosen = names[0];
          for (let i = 0; i < names.length; i++) { r -= weights[i]; if (r <= 0) { chosen = names[i]; break; } }
          PATTERNS[chosen].build(g);
          g.patternName = chosen;
        } else g.patternName = 'safe';
        if (verify(g)) plan = g;
      }
      if (!plan) { plan = new Plan(rnd, difficulty, speed); plan.patternName = 'fallback'; }
      addCoins(plan, safe);
      if (!safe && rnd() < ctx.powerupChance && plan.coins.length > 6) {
        const i = 3 + ((rnd() * (plan.coins.length - 6)) | 0);
        const c = plan.coins.splice(i, 1)[0];
        plan.powerups.push({ type: PU_TYPES[(rnd() * PU_TYPES.length) | 0], x: c.x, y: Math.max(1.0, c.y), z: c.z });
      }
      return plan;
    },
  };
})();

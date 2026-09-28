/* =====================================================================
 * WORLD — endless procedural railway.
 * ---------------------------------------------------------------------
 * The world is a queue of 40 m chunks. Each chunk = track segment
 * (style: normal / station / bridge / tunnel), ground, two scenery
 * strips (biome) and the obstacles + collectibles from patterns.js.
 * Chunks are spawned ahead of the player and recycled behind them.
 * Every model comes from an object pool, so nothing is rebuilt at
 * runtime after the first few seconds.
 *
 *   spawnChunk()      -> decides biome + style, asks Patterns for content
 *   surfaceAt()       -> what the player can stand on (trains, ramps...)
 *   collide()         -> front / side hits for the game rules
 * ===================================================================== */
(function () {
  const C = VR.CONFIG;
  const L = C.CHUNK_LENGTH;
  const LW = C.LANE_WIDTH;
  const TRAIN_ACTIVATE = 72;      // moving trains start rolling when this close
  const TRAIN_SPEED_RATIO = 0.45; // relative to the player's speed

  class World {
    constructor(scene, collectibles) {
      this.scene = scene;
      this.collect = collectibles;
      this.pool = new VR.Pool(scene);
      this.chunks = [];
      this.obstacles = [];
      this.prefabs = {};
      this.definePools();
    }

    prefab(key, buildFn, opts) {
      if (!this.prefabs[key]) this.prefabs[key] = buildFn().build(opts);
      return this.prefabs[key];
    }
    lazyPool(key, buildFn, opts) {
      if (!this.pool.has(key)) this.pool.define(key, () => VR.clonePrefab(this.prefab(key, buildFn, opts)));
    }

    definePools() {
      for (const s in VR.TRACK_STYLES) this.lazyPool('track_' + s, VR.TRACK_STYLES[s]);
      for (const b in VR.BIOMES) {
        const biome = VR.BIOMES[b];
        this.lazyPool('ground_' + b, () => VR.buildGround(biome), { cast: false });
        this.lazyPool('water_' + b, () => VR.buildWater(biome));
        for (let v = 0; v < VR.BIOME_VARIANTS; v++) {
          this.lazyPool(`scen_${b}_${v}`, () => {
            let seed = (v + 1) * 7919 + b.length * 131;
            const mb = new VR.MB(seed);
            const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
            // lift the builder onto the rolling ground at (x, z)
            const place = (x, z) => mb.at(0, VR.groundH(x, z, biome) - 0.52, 0);
            place(-6, -20);
            biome.scenery(mb, rnd, v, place);
            mb.at(0, 0, 0);
            return mb;
          });
        }
      }
      for (const t in VR.OBSTACLE_TYPES) this.lazyPool('obs_' + t, () => VR.OBSTACLE_TYPES[t].build());
      VR.TRAIN_COLORS.forEach((col, ci) => {
        for (const kind in VR.CAR_BUILDERS) this.lazyPool(`car_${kind}_${ci}`, () => VR.CAR_BUILDERS[kind](col));
      });
    }

    // Build all prefabs up-front (called once behind the loading screen)
    warmup() {
      for (const key in this.pool.factories) { const o = this.pool.get(key); this.pool.release(o); }
    }

    reset() {
      while (this.chunks.length) this.releaseChunk(this.chunks[0]);
      this.collect.clear();
      this.nextZ = 60;                // one chunk behind the player (visible from the menu camera)
      this.chunkIndex = 0;
      this.biomeOrder = VR.BIOME_ORDER.slice();
      this.biomeIdx = (Math.random() * this.biomeOrder.length) | 0;
      const force = new URLSearchParams(location.search).get('biome');
      if (force && this.biomeOrder.includes(force)) this.biomeIdx = this.biomeOrder.indexOf(force);
      this.biomeLeft = C.BIOME_MIN_CHUNKS;
      this.styleQueue = [];
      this.sinceSpecial = 0;
    }

    currentBiomeKey() { return this.biomeOrder[this.biomeIdx % this.biomeOrder.length]; }

    nextStyle(biome, difficulty) {
      if (this.styleQueue.length) return this.styleQueue.shift();
      const force = new URLSearchParams(location.search).get('style');
      if (force && this.chunkIndex >= 3) { if (force === 'tunnel') { this.styleQueue.push('tunnel_end'); return 'tunnel_start'; } return force; }
      if (this.chunkIndex < 3 || this.sinceSpecial < 2) { this.sinceSpecial++; return 'normal'; }
      const w = Object.assign({}, biome.styleWeights);
      // "environmental complexity" rises with difficulty
      w.tunnel *= 0.6 + difficulty; w.bridge *= 0.6 + difficulty; w.station *= 0.8 + difficulty * 0.5;
      let r = Math.random() * (w.normal + w.tunnel + w.bridge + w.station);
      let s = 'normal';
      for (const k of ['normal', 'tunnel', 'bridge', 'station']) { r -= w[k]; if (r <= 0) { s = k; break; } }
      if (s === 'normal') { this.sinceSpecial++; return s; }
      this.sinceSpecial = 0;
      if (s === 'tunnel') { this.styleQueue.push('tunnel_end'); return 'tunnel_start'; }
      if (s === 'bridge' && Math.random() < 0.5) this.styleQueue.push('bridge');
      return s;
    }

    spawnChunk(difficulty, speed) {
      const idx = this.chunkIndex++;
      // biome rotation (never switch mid-tunnel / mid-bridge)
      if (this.biomeLeft <= 0 && !this.styleQueue.length) {
        this.biomeIdx++;
        this.biomeLeft = C.BIOME_MIN_CHUNKS + ((Math.random() * (C.BIOME_MAX_CHUNKS - C.BIOME_MIN_CHUNKS)) | 0);
      }
      this.biomeLeft--;
      const biomeKey = this.currentBiomeKey();
      const biome = VR.BIOMES[biomeKey];
      const style = this.nextStyle(biome, difficulty);
      const z0 = this.nextZ;
      this.nextZ -= L;

      const chunk = { id: idx, z0, style, biome: biomeKey, parts: [], obstacles: [] };
      const put = (key, x = 0, flip = false) => {
        const o = this.pool.get(key);
        o.position.set(x, 0, z0);
        if (flip) o.scale.x = -1;
        chunk.parts.push(o);
        return o;
      };

      put('track_' + style);
      const isTunnel = style.startsWith('tunnel');
      if (style === 'bridge') put('water_' + biomeKey);
      else if (!isTunnel) {
        put('ground_' + biomeKey);
        const off = style === 'station' ? -6 : 0;
        const v1 = (Math.random() * VR.BIOME_VARIANTS) | 0;
        let v2 = (Math.random() * VR.BIOME_VARIANTS) | 0; if (v2 === v1) v2 = (v2 + 1) % VR.BIOME_VARIANTS;
        put(`scen_${biomeKey}_${v1}`, off);
        put(`scen_${biomeKey}_${v2}`, -off, true);
      }

      // ---- content
      const safe = idx < C.SAFE_START_CHUNKS + 2;
      const plan = VR.Patterns.generate({
        rnd: Math.random, difficulty, speed, safe, style,
        powerupChance: 0.16 + difficulty * 0.08,
      });
      chunk.pattern = plan.patternName;

      for (const o of plan.obstacles) {
        const def = VR.OBSTACLE_TYPES[o.type];
        const obj = this.pool.get('obs_' + o.type);
        const x = o.lane * LW, z = z0 - o.z;
        obj.position.set(x, 0, z);
        this.addObstacle(chunk, { type: o.type, kind: def.kind, lane: o.lane, x, z, len: def.length, colliders: def.colliders, standable: def.standable, ramp: def.kind === 'ramp', parts: [obj] });
      }
      for (const t of plan.trains) this.spawnTrain(chunk, t, z0);

      for (const c of plan.coins) this.collect.spawnCoin(c.x * LW, c.y, z0 - c.z, idx);
      for (const c of plan.gems) this.collect.spawnGem(c.x * LW, c.y, z0 - c.z, idx);
      for (const p of plan.powerups) this.collect.spawnPowerUp(p.type, p.x * LW, p.y, z0 - p.z, idx);

      this.chunks.push(chunk);
      return chunk;
    }

    spawnTrain(chunk, t, z0) {
      const x = t.lane * LW;
      const front = z0 - t.z;
      const parts = [];
      t.cars.forEach((car, i) => {
        const o = this.pool.get(`car_${car.kind}_${car.color}`);
        o.position.set(x, 0, front - i * VR.CAR_LEN);
        parts.push(o);
      });
      const len = t.cars.length * VR.CAR_LEN;
      this.addObstacle(chunk, {
        type: 'train', kind: 'block', lane: t.lane, x, z: front, len,
        colliders: [{ x0: -1.12, x1: 1.12, y0: 0, y1: VR.TRAIN_HEIGHT, z0: -len + 0.15, z1: 0 }],
        standable: !t.moving, parts,
        moving: t.moving ? { active: false, v: 0 } : null,
      });
      if (t.ramp) {
        const ro = this.pool.get('obs_ramp');
        const rz = z0 - t.rampZ;
        ro.position.set(x, 0, rz);
        this.addObstacle(chunk, { type: 'ramp', kind: 'ramp', lane: t.lane, x, z: rz, len: 7, colliders: [], standable: true, ramp: true, parts: [ro] });
      }
    }

    addObstacle(chunk, o) { o.chunk = chunk.id; chunk.obstacles.push(o); this.obstacles.push(o); }

    releaseChunk(chunk) {
      for (const p of chunk.parts) this.pool.release(p);
      for (const o of chunk.obstacles) for (const p of o.parts) this.pool.release(p);
      const set = new Set(chunk.obstacles);
      this.obstacles = this.obstacles.filter(o => !set.has(o));
      this.collect.releaseChunk(chunk.id);
      this.chunks.splice(this.chunks.indexOf(chunk), 1);
    }

    update(dt, player, speed, difficulty, game, keepBehind = false) {
      // stream chunks
      while (this.nextZ > player.z - C.CHUNKS_AHEAD * L) this.spawnChunk(difficulty, speed);
      while (!keepBehind && this.chunks.length && this.chunks[0].z0 - L > player.z + 14) this.releaseChunk(this.chunks[0]);

      // moving trains
      for (const o of this.obstacles) {
        if (!o.moving) continue;
        if (!o.moving.active && o.z - player.z > -TRAIN_ACTIVATE && o.z < player.z + 4) {
          o.moving.active = true; o.moving.v = Math.max(speed * TRAIN_SPEED_RATIO, 7);
          game.onTrainApproach(o);
        }
        if (o.moving.active) {
          const dz = o.moving.v * dt;
          o.z += dz;
          for (const p of o.parts) p.position.z += dz;
        }
      }
    }

    // shift everything back toward the origin (float precision on long runs)
    shift(dz) {
      this.nextZ += dz;
      for (const c of this.chunks) { c.z0 += dz; for (const p of c.parts) p.position.z += dz; }
      for (const o of this.obstacles) { o.z += dz; for (const p of o.parts) p.position.z += dz; }
      this.collect.shift(dz);
    }

    chunkAt(z) { for (const c of this.chunks) if (z <= c.z0 && z > c.z0 - L) return c; return null; }

    /**
     * Highest walkable surface under the player.
     * Only surfaces at/below the feet (with a small tolerance) count, so
     * running into the side of a train is a collision, not a teleport up.
     */
    surfaceAt(x, z, y, hw) {
      let best = 0, obj = null;
      for (const o of this.obstacles) {
        if (z > o.z + 1 || z < o.z - o.len - 1) continue;
        if (o.ramp) {
          if (Math.abs(x - o.x) < 1.05 && z <= o.z && z >= o.z - o.len) {
            const h = VR.TRAIN_HEIGHT * (o.z - z) / o.len;
            if (h <= y + 0.9 && h > best) { best = h; obj = o; }
          }
          continue;
        }
        if (!o.standable) continue;
        for (const c of o.colliders) {
          if (x + hw <= o.x + c.x0 || x - hw >= o.x + c.x1) continue;
          if (z < o.z + c.z0 - 0.25 || z > o.z + c.z1 + 0.25) continue;
          if (c.y1 <= y + 0.3 && c.y1 > best) { best = c.y1; obj = o; }
        }
      }
      return { h: best, obj };
    }

    /**
     * Returns null, or {side: bool, obstacle} for the first hit.
     * side = the overlap was caused by a lane change (-> stumble + bounce).
     */
    collide(p) {
      const hw = C.PLAYER_HALF_WIDTH, hd = C.PLAYER_HALF_DEPTH;
      const px0 = p.x - hw, px1 = p.x + hw, py0 = p.y + 0.05, py1 = p.y + p.height, pz0 = p.z - hd, pz1 = p.z + hd;
      const prevX = p.prevX === undefined ? p.x : p.prevX;
      for (const o of this.obstacles) {
        if (p.z > o.z + 2 || p.z < o.z - o.len - 2) continue;
        if (o.ramp) {
          if (px1 > o.x - 1.05 && px0 < o.x + 1.05 && pz0 < o.z && pz1 > o.z - o.len) {
            const h = VR.TRAIN_HEIGHT * Math.min(1, Math.max(0, (o.z - p.z) / o.len));
            if (p.y < h - 0.9) return { side: true, obstacle: o };
          }
          continue;
        }
        for (const c of o.colliders) {
          const bx0 = o.x + c.x0, bx1 = o.x + c.x1, bz0 = o.z + c.z0, bz1 = o.z + c.z1;
          if (px1 <= bx0 || px0 >= bx1 || pz1 <= bz0 || pz0 >= bz1 || py1 <= c.y0 || py0 >= c.y1) continue;
          if (o.standable && c.y1 - p.y <= 0.3) continue;       // standing on it
          const wasOverlappingX = prevX + hw > bx0 && prevX - hw < bx1;
          const side = !wasOverlappingX || (Math.abs(p.lateralVel || 0) > 1 && p.z < bz1 - 0.6);
          return { side, obstacle: o };
        }
      }
      return null;
    }

    /**
     * Close call: a train or wall was right in front of the player in the
     * lane they just left.  Returns the obstacle (once per obstacle).
     */
    closeCall(lane, z, dist) {
      for (const o of this.obstacles) {
        if (o.closeCalled || o.lane !== lane || o.kind !== 'block' || o.ramp) continue;
        const ahead = z - o.z;
        if (ahead > 0.5 && ahead < dist) { o.closeCalled = true; return o; }
      }
      return null;
    }

    // obstacle destroyed by shield/star: remove it from play
    smash(o) {
      for (const p of o.parts) this.pool.release(p);
      o.parts.length = 0;
      o.colliders = []; o.standable = false; o.ramp = false; o.moving = null;
      const chunk = this.chunks.find(c => c.id === o.chunk);
      this.obstacles = this.obstacles.filter(x => x !== o);
      if (chunk) chunk.obstacles = chunk.obstacles.filter(x => x !== o);
    }
  }

  VR.World = World;
})();

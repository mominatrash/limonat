/* =====================================================================
 * COLLECTIBLES — gold coins, bonus lemons (the 'gems' set) and power-ups.
 * Coins and lemons are InstancedMesh (1 draw call each); records are
 * recycled through free-lists.  Pickup bursts go through VR.FX.
 * ===================================================================== */
(function () {
  const C = VR.CONFIG;
  const T = THREE;
  const HIDE = new T.Matrix4().makeScale(0, 0, 0);
  const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), s = new T.Vector3(1, 1, 1);

  class InstancedSet {
    constructor(scene, geometry, material, capacity) {
      this.mesh = new T.InstancedMesh(geometry, material, capacity);
      this.mesh.frustumCulled = false;
      this.mesh.castShadow = true;
      this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, HIDE);
      scene.add(this.mesh);
      this.items = [];
      this.free = [];
      for (let i = capacity - 1; i >= 0; i--) { this.free.push(i); this.items.push(null); }
      this.active = new Set();
    }
    spawn(x, y, z, chunk) {
      const i = this.free.pop();
      if (i === undefined) return -1;
      this.items[i] = { x, y, z, x0: x, y0: y, z0: z, chunk, magnet: false };
      this.active.add(i);
      return i;
    }
    kill(i) {
      if (!this.items[i]) return;
      this.items[i] = null; this.active.delete(i); this.free.push(i);
      this.mesh.setMatrixAt(i, HIDE);
    }
    clear() {
      for (const i of [...this.active]) this.kill(i);
      const im = this.mesh.instanceMatrix; im.updateRange.offset = 0; im.updateRange.count = -1; im.needsUpdate = true;
      this.mesh.count = 0;
    }
    // only draw (and upload) up to the highest live slot
    trim() {
      let m = -1; for (const i of this.active) if (i > m) m = i;
      this.mesh.count = m + 1;
      const im = this.mesh.instanceMatrix; im.updateRange.offset = 0; im.updateRange.count = Math.max(1, m + 1) * 16;
    }
  }

  // ---------------------------------------------------------------- models
  function coinGeometry() {
    const mb = new VR.MB(1);
    mb.cyl('std', 0xffc83a, 0, 0, 0, 0.36, 0.36, 0.07, { rx: Math.PI / 2, seg: 22 });
    mb.torus('std', 0xffb21a, 0, 0, 0, 0.345, 0.045, { seg: 22 });
    for (const zz of [0.04, -0.04]) {
      mb.sphere('std', 0xffe07a, 0, 0, zz, 0.16, { sx: 1.3, sy: 0.95, sz: 0.25, rz: -0.5, seg: 12, hseg: 6 });
    }
    return mb.geometries()[0].geometry;
  }
  function lemonGeometry() {
    const mb = new VR.MB(2);
    mb.sphere('std', 0xffd83a, 0, 0, 0, 0.3, { sx: 1, sy: 0.92, sz: 1.3, seg: 24 });
    mb.sphere('std', 0xf2c21a, 0, 0, 0.37, 0.09, { sz: 0.7, seg: 10 });
    mb.sphere('std', 0xf2c21a, 0, 0, -0.37, 0.09, { sz: 0.7, seg: 10 });
    mb.cyl('std', 0x5a3a1e, 0, 0.3, 0.05, 0.02, 0.025, 0.1, { seg: 6 });
    mb.sphere('std', 0x3f9a3a, 0.12, 0.33, 0.05, 0.12, { sx: 1.2, sy: 0.2, sz: 0.55, rz: -0.4, seg: 10 });
    return mb.geometries()[0].geometry;
  }

  VR.InstancedSet = InstancedSet;

  // power-up icons (3D)
  const PU_BUILD = {
    magnet(mb) {
      mb.torus('paint', 0xe5433a, 0, 0.08, 0, 0.26, 0.1, { arc: Math.PI, rz: Math.PI, seg: 16 });
      for (const sx of [-0.26, 0.26]) {
        mb.cyl('paint', 0xe5433a, sx, 0.2, 0, 0.1, 0.1, 0.24, { seg: 12 });
        mb.cyl('chrome', 0xe8edf2, sx, 0.38, 0, 0.1, 0.1, 0.13, { seg: 12 });
      }
    },
    shield(mb) {
      // a plain rounded shield: dark-blue rim + raised light-blue face (no emblem)
      const shape = (k) => {
        const sh = new T.Shape();
        sh.moveTo(0, 0.36 * k); sh.quadraticCurveTo(0.2 * k, 0.3 * k, 0.32 * k, 0.32 * k); sh.lineTo(0.3 * k, 0.02 * k);
        sh.quadraticCurveTo(0.26 * k, -0.24 * k, 0, -0.38 * k); sh.quadraticCurveTo(-0.26 * k, -0.24 * k, -0.3 * k, 0.02 * k);
        sh.lineTo(-0.32 * k, 0.32 * k); sh.quadraticCurveTo(-0.2 * k, 0.3 * k, 0, 0.36 * k);
        return sh;
      };
      const g = new T.ExtrudeGeometry(shape(1), { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
      g.translate(0, 0, -0.04);
      mb.geo('paint', 0x2f8fe0, g, 0, 0, 0);
      for (const zs of [1, -1]) {             // raised face on both sides (the pickup spins)
        const f = new T.ExtrudeGeometry(shape(0.72), { depth: 0.03, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
        f.translate(0, -0.01, zs > 0 ? 0.05 : -0.08);
        mb.geo('paint', 0x7cc8ff, f, 0, 0, 0);
      }
    },
    boost(mb) {
      mb.cyl('paint', 0xf4f2ec, 0, 0, 0, 0.13, 0.15, 0.46, { seg: 16 });
      mb.cone('paint', 0xe5433a, 0, 0.33, 0, 0.13, 0.22, { seg: 16 });
      mb.sphere('glass', 0x6fc3ff, 0, 0.08, 0.13, 0.06, { sz: 0.4, seg: 10 });
      for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; mb.box('paint', 0xe5433a, Math.sin(a) * 0.16, -0.18, Math.cos(a) * 0.16, 0.03, 0.16, 0.14, { ry: a }); }
      mb.cone('neon', 0xffb347, 0, -0.33, 0, 0.09, 0.2, { rx: Math.PI, seg: 10 });
    },
    double(mb) {
      for (const [x, y, z] of [[-0.12, -0.05, -0.04], [0.12, 0.08, 0.04]]) {
        mb.cyl('chrome', 0xffc83a, x, y, z, 0.24, 0.24, 0.06, { rx: Math.PI / 2, seg: 24 });
        mb.torus('chrome', 0xffb21a, x, y, z, 0.23, 0.03, { seg: 24 });
      }
      mb.box('paint', 0x2fa84f, 0.12, 0.08, 0.09, 0.2, 0.05, 0.02, { rz: 0.8 });
      mb.box('paint', 0x2fa84f, 0.12, 0.08, 0.09, 0.2, 0.05, 0.02, { rz: -0.8 });
    },
    jetpack(mb) {
      mb.box('paint', 0x2a2f3a, 0, 0, -0.06, 0.34, 0.34, 0.08, { r: 0.03 });
      for (const sx of [-1, 1]) {
        mb.cyl('paint', 0xff7a2f, sx * 0.11, 0.0, 0.03, 0.085, 0.085, 0.34, { seg: 16 });
        mb.sphere('paint', 0xff7a2f, sx * 0.11, 0.17, 0.03, 0.085, { sy: 0.6, seg: 14 });
        mb.cyl('chrome', 0xdfe5ec, sx * 0.11, 0.06, 0.03, 0.088, 0.088, 0.03, { seg: 16 });
        mb.cyl('metal', 0x3a3f48, sx * 0.11, -0.2, 0.03, 0.06, 0.045, 0.07, { seg: 12 });
        mb.cone('neon', 0xffb347, sx * 0.11, -0.32, 0.03, 0.05, 0.16, { rx: Math.PI, seg: 10 });
      }
    },
    sneakers(mb) {
      mb.box('paint', 0x9b7bff, 0, 0, 0, 0.2, 0.14, 0.42, { r: 0.07 });               // upper
      mb.box('paint', 0xffffff, 0, -0.09, -0.01, 0.22, 0.06, 0.46, { r: 0.025 });     // sole
      mb.box('paint', 0x6fe3ff, 0, 0.02, 0.12, 0.21, 0.05, 0.1, { r: 0.02 });         // heel stripe
      for (let i = 0; i < 3; i++) mb.box('paint', 0xffffff, 0, 0.075, -0.1 + i * 0.06, 0.12, 0.012, 0.018);  // laces
      mb.torus('neon', 0xb9a2ff, 0, -0.17, 0, 0.1, 0.018, { rx: Math.PI / 2, seg: 20 });   // spring coil
      mb.torus('neon', 0xb9a2ff, 0, -0.22, 0, 0.1, 0.018, { rx: Math.PI / 2, seg: 20 });
    },
    invincible(mb) {
      const sh = new T.Shape();
      for (let i = 0; i < 10; i++) {
        const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.17 : 0.4;
        if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      const g = new T.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.05, bevelSegments: 2 });
      g.translate(0, 0, -0.05);
      mb.geo('chrome', 0xffd23f, g, 0, 0, 0);
    },
  };  VR.PU_BUILD = PU_BUILD;


  const glowMat = new T.ShaderMaterial({
    uniforms: { uColor: { value: new T.Color() } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 1.6); gl_FragColor = vec4(uColor * (f * 1.4 + 0.08), 1.0); }`,
  });
  VR.keepAlpha(glowMat);

  // tell the game's systems which item was taken (online play mirrors it on the friend's phone)
  const picked = (game, kind, item) => { if (game && game.emit) game.emit('picked', kind, item); };

  class Collectibles {
    constructor(scene, fx) {
      this.scene = scene;
      this.fx = fx;
      const coinMat = new T.MeshStandardMaterial({ vertexColors: true, metalness: 1, roughness: 0.28, emissive: 0x7a4c00, emissiveIntensity: 0.8, envMapIntensity: 1.6 });
      this.coins = new InstancedSet(scene, coinGeometry(), coinMat, 700);
      this.coinMat = coinMat;
      const lemonMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, emissive: 0xffc400, emissiveIntensity: 0.55 });
      this.gems = new InstancedSet(scene, lemonGeometry(), lemonMat, 60);

      // power-ups (pooled groups: icon + neon ring + glow bubble)
      this.pool = new VR.Pool(scene);
      const bubble = new T.SphereGeometry(0.62, 24, 16);
      for (const type in C.POWERUPS) {
        const mb = new VR.MB(40);
        PU_BUILD[type](mb);
        const icon = mb.build();
        const col = new T.Color(VR.POWERUP_COLORS[type]);
        const ringMb = new VR.MB(41);
        ringMb.torus('neon', VR.POWERUP_COLORS[type], 0, 0, 0, 0.62, 0.03, { seg: 40 });
        const ring = ringMb.build({ cast: false });
        const gm = glowMat.clone(); gm.uniforms.uColor.value = col;
        this.pool.define('pu_' + type, () => {
          const g = new T.Group();
          const ic = VR.clonePrefab(icon); ic.name = 'icon'; g.add(ic);
          const rg = VR.clonePrefab(ring); rg.name = 'ring'; g.add(rg);
          g.add(new T.Mesh(bubble, gm));
          return g;
        });
      }
      this.powerups = [];
      this.time = 0;
    }

    spawnCoin(x, y, z, chunk) { return this.coins.spawn(x, y, z, chunk); }
    spawnGem(x, y, z, chunk) { return this.gems.spawn(x, y, z, chunk); }
    spawnPowerUp(type, x, y, z, chunk) {
      const o = this.pool.get('pu_' + type);
      o.position.set(x, y, z);
      this.powerups.push({ type, x, y, z, chunk, obj: o });
    }

    releaseChunk(chunk) {
      for (const set of [this.coins, this.gems]) for (const i of [...set.active]) if (set.items[i].chunk === chunk) set.kill(i);
      this.powerups = this.powerups.filter(p => { if (p.chunk === chunk) { this.pool.release(p.obj); return false; } return true; });
    }
    clear() {
      this.coins.clear(); this.gems.clear();
      for (const p of this.powerups) this.pool.release(p.obj);
      this.powerups.length = 0;
    }
    shift(dz) {
      for (const set of [this.coins, this.gems]) for (const i of set.active) { const it = set.items[i]; it.z += dz; it.z0 += dz; }
      for (const p of this.powerups) { p.z += dz; p.obj.position.z = p.z; }
    }
    // a helper (pet) picks up coins / lemons within r metres of (x, y, z)
    grabNear(x, y, z, r, game) {
      const r2 = r * r;
      for (const i of this.coins.active) {
        const c = this.coins.items[i];
        const dx = c.x - x, dy = c.y - y, dz = c.z - z;
        if (dx * dx + dy * dy + dz * dz < r2) { game.onCoin(1, c.x, c.y, c.z); picked(game, 'c', c); this.coins.kill(i); }
      }
      for (const i of this.gems.active) {
        const c = this.gems.items[i];
        const dx = c.x - x, dy = c.y - y, dz = c.z - z;
        if (dx * dx + dy * dy + dz * dz < r2) { game.onGem(c.x, c.y, c.z); picked(game, 'g', c); this.gems.kill(i); }
      }
    }
    // somebody else (a friend playing the same railway) took the item that was
    // spawned at (x0, y0, z0): remove it here too. Returns true when found.
    takeAt(kind, x, y, z, type) {
      if (kind === 'p') {
        for (let k = 0; k < this.powerups.length; k++) {
          const p = this.powerups[k];
          if (p.type === type && Math.abs(p.x - x) < 0.4 && Math.abs(p.y - y) < 0.5 && Math.abs(p.z - z) < 0.8) {
            this.burst(p.x, p.y, p.z, 0xffffff); this.pool.release(p.obj); this.powerups.splice(k, 1); return true;
          }
        }
        return false;
      }
      const set = kind === 'g' ? this.gems : this.coins;
      for (const i of set.active) {
        const c = set.items[i];
        if (Math.abs(c.x0 - x) < 0.3 && Math.abs(c.y0 - y) < 0.4 && Math.abs(c.z0 - z) < 0.6) {
          if (this.fx) this.fx.sparkle(c.x, c.y, c.z, kind === 'g' ? 0xfff07a : 0xffd84a, 3, 1.6);
          set.kill(i); return true;
        }
      }
      return false;
    }
    // remove the coin sitting at (x, y, z) (an event item takes its place)
    removeCoinAt(x, y, z) {
      for (const i of this.coins.active) { const c = this.coins.items[i]; if (Math.abs(c.x - x) < 0.05 && Math.abs(c.y - y) < 0.05 && Math.abs(c.z - z) < 0.05) { this.coins.kill(i); return true; } }
      return false;
    }
    // number of coins in a lane between z0 (near) and z1 (far)
    coinsInLane(x, z0, z1) {
      let n = 0;
      for (const i of this.coins.active) { const c = this.coins.items[i]; if (Math.abs(c.x - x) < 0.9 && c.z < z0 && c.z > z1) n++; }
      return n;
    }
    burst(x, y, z, color) { if (this.fx) this.fx.sparkle(x, y, z, color || 0xffe28a, 12, 4); }

    // spin & bob for the menu / idle frames too
    update(dt, player, game) {
      this.time += dt;
      const px = player.x, py = player.y + (player.sliding ? 0.4 : 0.9), pz = player.z;
      const magnet = game && (game.powerups.active('magnet') || game.powerups.active('lemonade'));
      const R2 = C.MAGNET_RADIUS * C.MAGNET_RADIUS;
      const live = !!game;

      // --- coins
      e.set(0, this.time * 3.2, 0); q.setFromEuler(e);
      const coins = this.coins;
      const reach = player.sliding ? 0.8 : 1.2;
      for (const i of coins.active) {
        const c = coins.items[i];
        const dz = c.z - pz;
        if (live && dz > 6) { coins.kill(i); continue; }
        if (magnet && !c.magnet && dz < 2 && dz > -C.MAGNET_RADIUS * 3) {
          const dx = c.x - px, dy = c.y - py;
          if (dx * dx + dy * dy + dz * dz * 0.25 < R2 * 1.2) c.magnet = true;
        }
        if (c.magnet) {
          const k = Math.min(1, dt * 14);
          c.x += (px - c.x) * k; c.y += (py - c.y) * k; c.z += (pz - c.z) * k;
        }
        if (live && Math.abs(c.z - pz) < 0.7 && Math.abs(c.x - px) < 0.75 && c.y > player.y - 0.3 && c.y < player.y + player.height + 0.3 * reach) {
          game.onCoin(1, c.x, c.y, c.z); picked(game, 'c', c);
          coins.kill(i);
          continue;
        }
        v.set(c.x, c.y + Math.sin(this.time * 4 + c.z) * 0.06, c.z);
        m4.compose(v, q, s); coins.mesh.setMatrixAt(i, m4);
      }
      coins.mesh.instanceMatrix.needsUpdate = true;
      coins.trim();

      // --- bonus lemons
      for (const i of this.gems.active) {
        const g = this.gems.items[i];
        if (live && g.z - pz > 6) { this.gems.kill(i); continue; }
        if (magnet && Math.abs(g.z - pz) < C.MAGNET_RADIUS) g.magnet = true;
        if (g.magnet) { const k = Math.min(1, dt * 12); g.x += (px - g.x) * k; g.y += (py - g.y) * k; g.z += (pz - g.z) * k; }
        if (live && Math.abs(g.z - pz) < 0.8 && Math.abs(g.x - px) < 0.85 && g.y > player.y - 0.3 && g.y < player.y + player.height + 0.4) {
          game.onGem(g.x, g.y, g.z); picked(game, 'g', g); this.gems.kill(i); continue;
        }
        e.set(Math.sin(this.time * 2 + g.z) * 0.3, -this.time * 2, 0.3); q.setFromEuler(e);
        const sc = 1 + Math.sin(this.time * 6) * 0.06; s.set(sc, sc, sc);
        v.set(g.x, g.y + Math.sin(this.time * 3) * 0.12, g.z);
        m4.compose(v, q, s); this.gems.mesh.setMatrixAt(i, m4);
      }
      s.set(1, 1, 1);
      this.gems.mesh.instanceMatrix.needsUpdate = true;
      this.gems.trim();

      // --- power-ups
      for (let k = this.powerups.length - 1; k >= 0; k--) {
        const p = this.powerups[k];
        const icon = p.obj.children[0], ring = p.obj.children[1];
        icon.rotation.y = this.time * 2.2;
        ring.rotation.x = this.time * 1.7; ring.rotation.y = this.time * 1.1;
        p.obj.position.y = p.y + Math.sin(this.time * 3 + p.z) * 0.15;
        if (live && Math.abs(p.z - pz) < 0.9 && Math.abs(p.x - px) < 0.95 && p.y > player.y - 0.5 && p.y < player.y + player.height + 0.5) {
          game.onPowerUp(p.type, p.x, p.y, p.z); picked(game, 'p', p);
          this.pool.release(p.obj); this.powerups.splice(k, 1);
        }
      }
    }
  }
  VR.Collectibles = Collectibles;

  /* ------------------------------------------------------------------
   * Power-up state (timers). Add a new power-up by:
   *   1. adding it to CONFIG.POWERUPS
   *   2. adding a 3D icon in PU_BUILD above and an SVG icon in ui.js
   *   3. reading `game.powerups.active('yourId')` wherever it matters
   * ------------------------------------------------------------------ */
  class PowerUpState {
    constructor() { this.timers = {}; }
    reset() { this.timers = {}; }
    // `mul` = per-character duration multipliers (perks), `full` = the timer's starting length (for the HUD ring)
    activate(type) {
      const d = C.POWERUPS[type].duration * ((this.mul && this.mul[type]) || 1);
      this.timers[type] = d; (this.full || (this.full = {}))[type] = d;
    }
    active(type) { return (this.timers[type] || 0) > 0; }
    remaining(type) { return Math.max(0, this.timers[type] || 0); }
    consume(type) { this.timers[type] = 0; }
    update(dt) { for (const k in this.timers) this.timers[k] -= dt; }
    list() { return Object.keys(this.timers).filter(k => this.timers[k] > 0); }
  }
  VR.PowerUpState = PowerUpState;
  VR.POWERUP_COLORS = { magnet: 0xff5a4f, shield: 0x4fb8ff, boost: 0xffb347, double: 0x6ee07a, invincible: 0xffd23f, lemonade: 0xffe14a, jetpack: 0xff8a3d, sneakers: 0x9b7bff, minecart: 0xc0703a, bike: 0x3ec1ff };
})();

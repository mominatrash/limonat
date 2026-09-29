/* =====================================================================
 * WEATHER — random weather spells during a run.
 *   rain       slanted rain around the camera, darker light, lightning +
 *              thunder, and a SLIPPERY track (lane changes take longer)
 *   sandstorm  (desert) warm dust wall: short visibility, blowing sand
 *   fog        (forest / mountains / snow) thick mist, short visibility
 * A spell starts a few seconds after entering a biome (by chance) and
 * lasts 22-38 s. Story levels can force one (opts.weather).
 * ===================================================================== */
(function () {
  const T = THREE, UI = VR.UI;
  const KINDS = {
    rain:      { fogColor: 0x7d8794, near: 26, far: 120, light: 0.62, exposure: 0.86, slip: 1.35 },
    sandstorm: { fogColor: 0xd9a066, near: 6,  far: 62,  light: 0.8,  exposure: 1.0,  slip: 1 },
    fog:       { fogColor: 0xdfe5ea, near: 4,  far: 52,  light: 0.85, exposure: 1.02, slip: 1 },
  };
  const BY_BIOME = {
    grove: [['rain', 0.28]], village: [['rain', 0.3]], forest: [['rain', 0.3], ['fog', 0.3]],
    desert: [['sandstorm', 0.55]], mountains: [['fog', 0.35], ['rain', 0.2]], snow: [['fog', 0.35]], city: [['rain', 0.4]],
  };
  const _c = new T.Color(), _m = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _p = new T.Vector3();

  class Weather {
    constructor(game) {
      this.name = 'weather'; this.g = game;
      this.kind = null; this.w = 0; this.timer = 0; this.nextBolt = 0; this.pending = null;
      // rain streaks: one instanced draw call around the camera
      const n = 320;
      const geo = new T.BoxGeometry(0.03, 1.15, 0.03);
      const mat = new T.MeshBasicMaterial({ color: new T.Color(0.62, 0.7, 0.84), transparent: true, opacity: 0, depthWrite: false, fog: false });
      this.rain = new T.InstancedMesh(geo, mat, n);
      this.rain.frustumCulled = false; this.rain.visible = false; this.rain.instanceMatrix.setUsage(T.DynamicDrawUsage);
      game.scene.add(this.rain);
      this.drops = [];
      for (let i = 0; i < n; i++) this.drops.push({ x: 0, y: -99, z: 0, v: 0 });
    }
    reset() { this.stop(true); this.pending = null; }
    runStart(opts) {
      this.forced = opts.weather || null;
      if (this.forced) this.pending = { kind: this.forced, at: 4 };
    }
    leaveRun() { this.stop(true); }
    runEnd() { this.sound(false); }
    state(s) { if (s !== 'playing') this.sound(false); else if (this.kind) this.sound(true); }

    // called by game.updateEnvironment when the biome changes
    biomeChanged(key) {
      if (this.forced || this.g.mode === 'story') return;
      if (this.kind) { this.timer = Math.min(this.timer, 3); return; }
      const opts = BY_BIOME[key] || [];
      for (const [k, p] of opts) if (this.g.evRnd() < p) { this.pending = { kind: k, at: 5 + this.g.evRnd() * 10 }; return; }
    }
    start(kind) {
      this.kind = kind; this.timer = this.forced ? 1e9 : 22 + this.g.evRnd() * 16; this.nextBolt = 3;
      this.rain.visible = kind === 'rain';
      UI.toast(UI.t('w_' + kind), 1800);
      this.sound(true);
      this.g.missions.bump('weather');
    }
    stop(instant) {
      if (instant) { this.w = 0; this.kind = null; this.rain.visible = false; }
      else this.timer = 0;
      this.sound(false);
    }
    get slip() { return this.kind ? 1 + (KINDS[this.kind].slip - 1) * this.w : 1; }

    update(dt) {
      const g = this.g;
      if (this.pending) { this.pending.at -= dt; if (this.pending.at <= 0) { this.start(this.pending.kind); this.pending = null; } }
      if (this.kind) {
        this.timer -= dt;
        const target = this.timer > 0 ? 1 : 0;
        this.w += (target - this.w) * Math.min(1, dt * 0.6);
        if (this.timer <= 0 && this.w < 0.02) { this.kind = null; this.w = 0; this.rain.visible = false; this.sound(false); }
      }
      g.player.laneTimeMul = this.slip;
      if (!this.kind) return;
      const inside = g.tunnelDark;
      if (this.kind === 'rain') {
        this.updateRain(dt, g.camera, (1 - inside) * this.w);
        this.nextBolt -= dt;
        if (this.nextBolt <= 0 && this.w > 0.7 && inside < 0.3) {
          this.nextBolt = 5 + g.evRnd() * 8;
          g.fxFlash = 0.9; VR.Audio.play('thunder');
        }
        if (g.player.grounded && Math.random() < dt * 14 * this.w) g.fx.dust(g.player.x, g.player.y, g.player.z, 1, 0xb8c6d6, 0.7);
      } else if (this.kind === 'sandstorm') {
        if (Math.random() < dt * 90 * this.w * (1 - inside)) {
          const cam = g.camera.position;
          g.fx.dust(cam.x - 8 + Math.random() * 3, 0.3 + Math.random() * 3.5, cam.z - 4 - Math.random() * 18, 1, 0xd9a066, 2.5);
        }
      }
    }
    updateRain(dt, cam, amt) {
      const r = this.rain;
      r.material.opacity = 0.7 * amt;
      if (amt < 0.02) return;
      _q.setFromAxisAngle(_p.set(0, 0, 1), 0.18);
      for (let i = 0; i < this.drops.length; i++) {
        const d = this.drops[i];
        if (d.y < cam.y - 5) {
          d.x = cam.x + (Math.random() - 0.5) * 16; d.z = cam.z - 1.5 - Math.random() * 18;
          d.y = cam.y + 2 + Math.random() * 7; d.v = 16 + Math.random() * 8;
        }
        d.y -= d.v * dt; d.x += d.v * 0.18 * dt;
        _m.compose(_p.set(d.x, d.y, d.z), _q, _s.set(1, 1, 1));
        r.setMatrixAt(i, _m);
      }
      r.instanceMatrix.needsUpdate = true;
    }
    // game.updateEnvironment hands us the scene fog/lights after its own easing
    applyEnv(fog, hemi, sun, post) {
      if (!this.kind || this.w <= 0.001) { this.g.envExposureMul = 1; return; }
      const K = KINDS[this.kind], w = this.w;
      _c.setHex(K.fogColor); fog.color.lerp(_c, w * 0.85);
      fog.near += (K.near - fog.near) * w; fog.far += (K.far - fog.far) * w;
      const l = 1 + (K.light - 1) * w;
      hemi.intensity *= l; sun.intensity *= l * l;
      this.g.envExposureMul = 1 + (K.exposure - 1) * w;
    }
    // the sky eases toward this instead of the biome look while weather is on
    skyLook(L) {
      if (!this.kind || this.w < 0.01) return L;
      const K = { rain: [0x6d7784, 0x9aa3ad, 0x8b939c, 0x9aa1aa], sandstorm: [0xc98c52, 0xe0b27a, 0xd49a5f, 0xe8c090], fog: [0xc9d1d8, 0xe4e9ed, 0xd9dfe4, 0xf2f4f6] }[this.kind];
      const o = this._look || (this._look = Object.assign({}, L, { top: new T.Color(), horizon: new T.Color(), bottom: new T.Color(), cloud: new T.Color(), sunColor: new T.Color() }));
      Object.assign(o, L, { top: o.top, horizon: o.horizon, bottom: o.bottom, cloud: o.cloud, sunColor: o.sunColor });
      const w = this.w * 0.9;
      o.top.copy(L.top).lerp(_c.setHex(K[0]), w); o.horizon.copy(L.horizon).lerp(_c.setHex(K[1]), w);
      o.bottom.copy(L.bottom).lerp(_c.setHex(K[2]), w); o.cloud.copy(L.cloud).lerp(_c.setHex(K[3]), w);
      o.sunColor.copy(L.sunColor).multiplyScalar(1 - w * 0.6);
      o.stars = L.stars * (1 - w);
      return o;
    }
    sound(on) {
      const k = on && this.kind;
      VR.Audio.ambience(k === 'rain' ? 'rain' : k === 'sandstorm' ? 'wind' : null);
    }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Weather);
})();

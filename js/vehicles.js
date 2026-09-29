/* =====================================================================
 * VEHICLES — ride-on pickups (like a hoverboard, but ours):
 *   minecart  rusty mine cart rolling on the rails, crouched inside,
 *             sparks from the wheels
 *   bike      a bicycle with real pedalling (legs follow the cranks)
 * While riding you still switch lanes, jump and duck. The vehicle takes
 * ONE crash for you (it breaks, you keep running). Lasts 14 s.
 * ===================================================================== */
(function () {
  const T = THREE, C = VR.CONFIG, UI = VR.UI, A = VR.Anim, D = Math.PI / 180;

  // ---------------------------------------------------------------- models
  function wheel(mb, mat, col, x, y, z, r, tube, spokes) {
    mb.torus(mat, col, x, y, z, r, tube, { ry: Math.PI / 2, seg: 22 });
    for (let i = 0; i < spokes; i++) mb.box('metal', 0xcfd6dd, x, y, z, 0.012, r * 1.9, 0.012, { rx: i * Math.PI / spokes });
  }
  function buildCart() {
    const g = new T.Group();
    const mb = new VR.MB(31);
    const rust = 0xa4552f;
    mb.box('paint', rust, 0, 0.62, 0, 1.05, 0.5, 1.25, { r: 0.05 });            // tub
    mb.box('paint', 0x5a2e18, 0, 0.88, 0, 1.12, 0.07, 1.32, { r: 0.03 });       // rim
    for (const z of [-0.4, 0.4]) mb.box('metal', 0x3a3f45, 0, 0.62, z, 1.08, 0.46, 0.06);   // bands
    mb.box('metal', 0x2b2f35, 0, 0.32, 0, 0.9, 0.1, 1.1);                        // chassis
    mb.box('paint', 0xffd23f, 0, 0.64, -0.635, 0.3, 0.14, 0.02, { r: 0.02 });   // lemon plate
    g.add(mb.build({ receive: false }));
    const wheels = [];
    for (const [x, z] of [[-0.48, -0.42], [0.48, -0.42], [-0.48, 0.42], [0.48, 0.42]]) {
      const w = new T.Group(); w.position.set(x, 0.19, z);
      const wb = new VR.MB(32);
      wb.cyl('metal', 0x2b2f35, 0, 0, 0, 0.19, 0.19, 0.08, { rz: Math.PI / 2, seg: 16 });
      wb.cyl('chrome', 0xdfe5ec, 0, 0, 0, 0.07, 0.07, 0.1, { rz: Math.PI / 2, seg: 10 });
      wb.box('metal', 0x5d646d, 0, 0, 0, 0.09, 0.3, 0.04);
      w.add(wb.build({ receive: false })); g.add(w); wheels.push(w);
    }
    g.userData = { wheels, spin: 0.19 };
    return g;
  }
  function buildBike() {
    const g = new T.Group();
    const mb = new VR.MB(33);
    const col = 0x3ec1ff, dark = 0x1e2430;
    const tube = (x0, y0, z0, x1, y1, z1, r = 0.028, c = col) => {
      const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dx, dy, dz);
      const e = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx, dy, dz).normalize()));
      mb.cyl('paint', c, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, r, r, len, { rx: e.x, ry: e.y, rz: e.z, seg: 8 });
    };
    const BB = [0, 0.34, 0.02], SEAT = [0, 0.86, 0.2], HEAD = [0, 0.92, -0.38];
    tube(...BB, ...SEAT); tube(...SEAT, ...HEAD); tube(...BB, ...HEAD);
    tube(0, 0.34, 0.52, ...BB, 0.022); tube(0, 0.34, 0.52, ...SEAT, 0.022);         // rear triangle
    tube(0, 0.34, -0.52, ...HEAD, 0.03);                                             // fork
    tube(-0.24, 1.04, -0.44, 0.24, 1.04, -0.44, 0.022, dark);                        // handlebar
    tube(0, 0.92, -0.38, 0, 1.04, -0.44, 0.025, dark);
    mb.box('paint', dark, 0, 0.9, 0.22, 0.12, 0.05, 0.26, { r: 0.03 });              // saddle
    // front basket and a big rear crate of lemons (reads well from the chase camera)
    mb.box('wood', 0xb07a45, 0, 0.74, -0.5, 0.3, 0.16, 0.22, { r: 0.02 });
    mb.box('metal', 0x2b2f35, 0, 0.62, 0.56, 0.5, 0.04, 0.44);                         // rear rack
    mb.box('wood', 0xb07a45, 0, 0.8, 0.56, 0.56, 0.3, 0.46, { r: 0.03 });             // crate
    mb.box('wood', 0x8a5a33, 0, 0.8, 0.795, 0.58, 0.05, 0.02);
    for (const [x, z] of [[-0.14, 0.5], [0.12, 0.62], [0.0, 0.52], [-0.05, 0.66], [0.16, 0.48], [-0.02, -0.5], [0.08, -0.46]]) mb.sphere('gloss', 0xffd23f, x, z > 0 ? 0.99 : 0.85, z, 0.08, { sx: 1.25, seg: 10 });
    mb.box('glow', 0xff3b30, 0, 0.72, 0.82, 0.16, 0.06, 0.02, { r: 0.01 });           // tail light
    for (const z of [-0.52, 0.52]) mb.torus('paint', col, 0, 0.34, z, 0.36, 0.03, { ry: Math.PI / 2, arc: Math.PI, rz: Math.PI / 2 - 0.2, seg: 16 });   // mudguards
    g.add(mb.build({ receive: false }));
    const wheels = [];
    for (const z of [-0.52, 0.52]) {
      const w = new T.Group(); w.position.set(0, 0.34, z);
      const wb = new VR.MB(34); wheel(wb, 'paint', dark, 0, 0, 0, 0.3, 0.065, 6);
      w.add(wb.build({ receive: false })); g.add(w); wheels.push(w);
    }
    const crank = new T.Group(); crank.position.set(0, 0.34, 0.02);
    const cb = new VR.MB(35);
    cb.box('metal', 0x5d646d, 0.07, 0, 0, 0.02, 0.32, 0.03); cb.box('metal', 0x5d646d, -0.07, 0, 0, 0.02, 0.32, 0.03);
    cb.box('paint', dark, 0.12, 0.16, 0, 0.09, 0.02, 0.05); cb.box('paint', dark, -0.12, -0.16, 0, 0.09, 0.02, 0.05);
    crank.add(cb.build({ receive: false })); g.add(crank);
    g.userData = { wheels, spin: 0.32, crank };
    return g;
  }

  // ---------------------------------------------------------------- poses
  function poseCart(p, t, duck) {
    A.zero(p);
    const b = Math.sin(t * 9) * 0.012;
    p[1] = 0.46 - 0.2 - duck * 0.18 + b;             // stand in the tub, knees soft
    A.set(p, 'spine', -18 - duck * 18); A.set(p, 'chest', -6); A.set(p, 'neck', 14 + duck * 10); A.set(p, 'head', 12);
    A.set(p, 'thighL', 42 + duck * 30, 0, -6); A.set(p, 'shinL', -70 - duck * 40); A.set(p, 'footL', 28);
    A.set(p, 'thighR', 38 + duck * 30, 0, 6); A.set(p, 'shinR', -66 - duck * 40); A.set(p, 'footR', 28);
    A.set(p, 'armL', 52, 0, -30); A.set(p, 'foreL', 34); A.set(p, 'handL', -10);
    A.set(p, 'armR', 52, 0, 30); A.set(p, 'foreR', 34); A.set(p, 'handR', -10);
  }
  function poseBike(p, crank, duck) {
    A.zero(p);
    p[1] = 0.93 - VR.CHAR_DIM.hipY + 0.03 - duck * 0.08;
    p[2] = 0.2;                                        // hips over the saddle
    A.set(p, 'hips', 8);
    A.set(p, 'spine', -36 - duck * 14); A.set(p, 'chest', -10); A.set(p, 'neck', 28 + duck * 8); A.set(p, 'head', 18);
    for (const [s, ph] of [['R', crank], ['L', crank + Math.PI]]) {
      A.set(p, 'thigh' + s, 62 + 24 * Math.sin(ph), 0, s === 'R' ? -3 : 3);
      A.set(p, 'shin' + s, -86 - 34 * Math.cos(ph));
      A.set(p, 'foot' + s, 12 + 10 * Math.sin(ph));
    }
    A.set(p, 'armL', 58, 0, -12); A.set(p, 'foreL', 22); A.set(p, 'handL', -14);
    A.set(p, 'armR', 58, 0, 12); A.set(p, 'foreR', 22); A.set(p, 'handR', -14);
  }

  class Vehicles {
    constructor(game) {
      this.name = 'vehicles'; this.g = game;
      this.models = { minecart: buildCart(), bike: buildBike() };
      for (const k in this.models) { this.models[k].visible = false; game.player.object.add(this.models[k]); }
      this.kind = null; this.t = 0; this.crank = 0;
    }
    warm(on) { for (const k in this.models) this.models[k].visible = on; }
    reset() { this.dismount('quiet'); this.g.player.ride = null; }
    leaveRun() { this.dismount('quiet'); }
    powerUp(type) {
      if (type !== 'minecart' && type !== 'bike') return;
      if (this.g.player.flying) return;
      if (this.kind && this.kind !== type) this.dismount('quiet');
      else if (this.kind) this.dismount('swap');
      this.kind = type; this.t = 0;
      this.models[type].visible = true;
      const p = this.g.player;
      p.ride = { w: 0, pose: (pose, dt, sliding) => this.pose(pose, dt, sliding) };
      VR.Audio.play(type === 'bike' ? 'ding' : 'land');
      this.g.fx.dust(p.x, p.y, p.z, 12, 0xc8b8a0, 1.4);
      this.g.missions.bump('rides');
    }
    pose(p, dt, sliding) {
      const duck = sliding ? 1 : 0;
      if (this.kind === 'minecart') poseCart(p, this.t, duck);
      else poseBike(p, this.crank, duck);
    }
    dismount(mode) {
      if (!this.kind) return;
      const p = this.g.player;
      this.models[this.kind].visible = false;
      const was = this.kind;
      if (mode === 'crash') { this.g.fx.smash(p.x, p.y + 0.4, p.z, 0xa4552f); VR.Audio.play('whoosh'); }
      else if (mode === 'end') { this.g.fx.dust(p.x, p.y, p.z, 12, 0xc8b8a0, 1.2); VR.Audio.play('whoosh'); }
      if (p.ride) p.ride.leaving = true;
      if (mode !== 'swap') this.g.powerups.consume(was);
      this.kind = null;
    }
    absorbCrash(o) {
      if (!this.kind) return false;
      const g = this.g;
      g.fx.smash(o.x, 0.5, g.player.z - 1.5, 0xd8d2c6);
      g.world.smash(o);
      this.dismount('crash');
      g.player.flash = 1.2; g.hitCooldown = 1.2; g.shake = 0.3; g.fxCA = 0.6;
      VR.Audio.play('shieldBreak'); UI.toast(UI.t('rideBroken'), 1200);
      return true;
    }
    update(dt) {
      const g = this.g, p = g.player;
      if (!this.kind) return;
      if (p.flying || !g.powerups.active(this.kind)) { this.dismount(p.flying ? 'quiet' : 'end'); return; }
      this.t += dt;
      const m = this.models[this.kind], U = m.userData;
      const roll = g.speed * dt / U.spin;
      for (const w of U.wheels) w.rotation.x -= roll;
      if (U.crank) { this.crank += g.speed * dt * 0.9; U.crank.rotation.x = -this.crank; }
      m.rotation.z = -p.laneW * 0.12; m.rotation.x = p.grounded ? 0 : Math.max(-0.25, Math.min(0.25, -p.vy * 0.02));
      if (this.kind === 'minecart' && p.grounded && Math.random() < dt * 30) g.fx.sparks(p.x + (Math.random() < 0.5 ? -0.5 : 0.5), p.y + 0.05, p.z + 0.4, 1);
    }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Vehicles);

  // pickup icons (added before Collectibles builds its pools)
  const PB = VR.PU_BUILD;
  PB.minecart = (mb) => {
    mb.box('paint', 0xa4552f, 0, 0.04, 0, 0.44, 0.24, 0.3, { r: 0.03 });
    mb.box('paint', 0x5a2e18, 0, 0.17, 0, 0.47, 0.04, 0.33, { r: 0.015 });
    for (const x of [-0.14, 0.14]) mb.cyl('metal', 0x2b2f35, x, -0.12, 0.0, 0.08, 0.08, 0.34, { rx: Math.PI / 2, seg: 12 });
    mb.sphere('gloss', 0xffd23f, 0, 0.2, 0, 0.07, { seg: 8 });
  };
  PB.bike = (mb) => {
    for (const x of [-0.2, 0.2]) mb.torus('paint', 0x1e2430, x, -0.08, 0, 0.14, 0.025, { seg: 18 });
    mb.box('paint', 0x3ec1ff, 0, 0.0, 0, 0.36, 0.035, 0.035, { rz: 0.35 });
    mb.box('paint', 0x3ec1ff, -0.02, 0.02, 0, 0.3, 0.035, 0.035, { rz: -0.5 });
    mb.box('paint', 0x1e2430, 0.2, 0.16, 0, 0.03, 0.18, 0.03);
    mb.box('paint', 0x1e2430, 0.2, 0.25, 0, 0.03, 0.03, 0.2);
  };
})();

/* =====================================================================
 * LEMON THIEF — a cheeky goat with a sack of stolen lemons.
 * Every so often it bolts onto the tracks a few metres ahead, switches
 * lanes, hops over obstacles and onto train roofs, and drops coins as it
 * goes. You close in a little every second: get into its lane and touch
 * it to catch it (big coin reward + the lemons back). It gives up and
 * escapes after ~22 s. Story levels can force it (opts.thief = metres).
 * ===================================================================== */
(function () {
  const T = THREE, C = VR.CONFIG, UI = VR.UI, LW = C.LANE_WIDTH;

  function buildGoat() {
    const root = new T.Group();
    const body = new T.Group(); root.add(body);
    const mb = new VR.MB(21);
    const W = 0xf1ede4, B = 0x6b4a32, H = 0xcdbb9a;
    mb.box('flat', W, 0, 0.62, 0, 0.42, 0.36, 0.78, { r: 0.14 });            // body
    mb.box('flat', B, 0, 0.66, 0.1, 0.43, 0.2, 0.3, { r: 0.08 });            // brown saddle patch
    mb.cyl('flat', W, 0, 0.6, 0.42, 0.04, 0.02, 0.18, { rx: 0.9, seg: 6 });  // tail
    // sack of stolen lemons
    mb.sphere('flat', 0xb98a55, 0.02, 0.92, 0.08, 0.2, { sy: 0.9, seg: 12 });
    mb.cyl('flat', 0x7a5a3a, 0.02, 1.08, 0.08, 0.07, 0.1, 0.08, { seg: 10 });
    for (const [x, y, z] of [[-0.09, 1.1, 0.02], [0.08, 1.12, 0.12], [0.02, 1.16, -0.02]]) mb.sphere('gloss', 0xffd23f, x, y, z, 0.065, { sx: 1.25, seg: 10 });
    body.add(mb.build({ receive: false }));
    const head = new T.Group(); head.position.set(0, 0.86, -0.42); body.add(head);
    const hb = new VR.MB(22);
    hb.box('flat', W, 0, 0.02, -0.08, 0.24, 0.22, 0.3, { r: 0.09, rx: 0.35 });   // head
    hb.box('flat', 0xe4dccc, 0, -0.06, -0.24, 0.17, 0.13, 0.12, { r: 0.05 });     // muzzle
    hb.cone('flat', 0xf1ede4, 0, -0.17, -0.2, 0.04, 0.14, { rx: Math.PI, seg: 6 }); // beard
    for (const s of [-1, 1]) {
      hb.cone('flat', H, s * 0.07, 0.16, 0.02, 0.035, 0.2, { rx: -0.7, rz: s * 0.25, seg: 6 });   // horns
      hb.box('flat', W, s * 0.15, 0.04, 0.0, 0.14, 0.05, 0.08, { rz: s * -0.5, r: 0.02 });       // ears
      hb.sphere('ink', 0x1a1a1a, s * 0.08, 0.06, -0.2, 0.03, { seg: 8 });                         // eyes
      hb.sphere('glow', 0xffffff, s * 0.08 + 0.01, 0.07, -0.225, 0.009, { seg: 6 });
    }
    // a little black bandit mask
    hb.box('ink', 0x1a1a1a, 0, 0.065, -0.19, 0.25, 0.05, 0.04, { r: 0.015 });
    head.add(hb.build({ receive: false }));
    const legs = [];
    for (const [x, z] of [[-0.13, -0.26], [0.13, -0.26], [-0.13, 0.26], [0.13, 0.26]]) {
      const leg = new T.Group(); leg.position.set(x, 0.5, z);
      const lb = new VR.MB(23);
      lb.cyl('flat', W, 0, -0.2, 0, 0.045, 0.04, 0.4, { seg: 8 });
      lb.box('flat', 0x2b2622, 0, -0.42, 0, 0.08, 0.06, 0.09, { r: 0.02 });       // hoof
      leg.add(lb.build({ receive: false }));
      body.add(leg); legs.push(leg);
    }
    // bouncing marker so the thief is easy to spot
    const mk = new T.Mesh(new T.ConeGeometry(0.12, 0.26, 4), new T.MeshBasicMaterial({ color: new T.Color(2.2, 1.7, 0.3), fog: false }));
    mk.rotation.x = Math.PI; mk.position.y = 1.55; root.add(mk);
    root.userData = { body, head, legs, mk };
    root.scale.setScalar(1.4);
    root.visible = false;
    return root;
  }

  // Zahran's courier drone (story): quad rotors, a claw holding a map scroll, red eye
  function buildDrone() {
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const mb = new VR.MB(24);
    mb.box('paint', 0x2b2f3a, 0, 0.9, 0, 0.5, 0.16, 0.5, { r: 0.07 });                        // hull
    mb.box('paint', 0xf2b705, 0, 0.99, 0, 0.36, 0.06, 0.36, { r: 0.03 });                     // yellow top plate (Zahran colours)
    mb.sphere('glow', 0xff3b30, 0, 0.9, -0.26, 0.045, { seg: 10 });                             // camera eye
    for (const [x, z] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) {
      mb.box('paint', 0x2b2f3a, x / 2, 0.92, z / 2, 0.06, 0.05, 0.36, { ry: Math.atan2(x, z), r: 0.02 });   // arms
      mb.cyl('metal', 0x5a606b, x, 0.97, z, 0.05, 0.06, 0.08, { seg: 12 });                                // motors
    }
    for (const s of [-1, 1]) mb.cyl('metal', 0x9aa2ad, s * 0.08, 0.72, 0, 0.012, 0.012, 0.26, { rz: s * 0.4, seg: 6 });   // claw
    mb.cyl('flat', 0xf1e3c2, 0, 0.6, 0, 0.05, 0.05, 0.34, { rz: Math.PI / 2, seg: 12 });   // the stolen map scroll
    mb.cyl('flat', 0xc0392b, 0, 0.6, 0, 0.055, 0.055, 0.04, { rz: Math.PI / 2, seg: 12 });
    body.add(mb.build({ receive: false }));
    const rotors = [];
    for (const [x, z] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) {
      const r = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.01, 18), new T.MeshBasicMaterial({ color: 0xcfd6e0, transparent: true, opacity: 0.35, depthWrite: false }));
      r.position.set(x, 1.02, z); body.add(r); rotors.push(r);
    }
    const mk = new T.Mesh(new T.ConeGeometry(0.12, 0.26, 4), new T.MeshBasicMaterial({ color: new T.Color(2.2, 0.5, 0.3), fog: false }));
    mk.rotation.x = Math.PI; mk.position.y = 1.45; root.add(mk);
    root.userData = { body, rotors, mk, drone: true };
    root.scale.setScalar(1.35); root.visible = false;
    return root;
  }

  VR.buildGoat = buildGoat;

  class Thief {
    constructor(game) {
      this.name = 'thief'; this.g = game;
      this.models = { goat: buildGoat(), drone: buildDrone() };
      game.scene.add(this.models.goat, this.models.drone);
      this.goat = this.models.goat;
      this.active = false;
      UI.addStrings({ droneAppears: 'الدرون خطف الخريطة! الحقه', droneCaught: 'وقّعت الدرون!', droneEscaped: 'الدرون هرب!', allyAppears: 'مِشمِش جاي يساعدك! 🐐' },
                    { droneAppears: 'The drone took the map! Chase it', droneCaught: 'Drone down!', droneEscaped: 'The drone got away!', allyAppears: 'Mishmish is here to help! 🐐' });
    }
    warm(on) { this.models.goat.visible = on; this.models.drone.visible = on; }
    reset() { this.active = false; this.models.goat.visible = false; this.models.drone.visible = false; this.nextAt = 450 + this.g.evRnd() * 450; }
    runStart(opts) {
      // story options: thiefSkin 'drone' (Zahran's drone) · thiefMode 'ally' (the goat runs with you and helps)
      this.models.goat.visible = this.models.drone.visible = false;
      this.skin = opts.thiefSkin === 'drone' ? 'drone' : 'goat';
      this.goat = this.models[this.skin];
      this.ally = opts.thiefMode === 'ally';
      this.goat.userData.mk.material.color.setRGB(...(this.ally ? [0.4, 2.2, 0.6] : this.skin === 'drone' ? [2.2, 0.5, 0.3] : [2.2, 1.7, 0.3]));
      this.forcedAt = opts.thief || null;
      this.nextAt = this.forcedAt || 450 + this.g.evRnd() * 450;
      this.caught = 0;
    }
    leaveRun() { this.reset(); }

    spawn() {
      const g = this.g, p = g.player;
      this.active = true; this.t = 0;
      this.gap = 20; this.lane = [-1, 0, 1].find(l => l !== p.lane) ?? 0;
      this.x = this.lane * LW; this.y = 0; this.vy = 0; this.hop = 0;
      this.nextLane = 1.6; this.dropAcc = 0; this.escaping = false; this.phase = 0;
      this.goat.visible = true;
      if (this.ally) this.gap = 9;
      UI.toast(UI.t(this.ally ? 'allyAppears' : this.skin === 'drone' ? 'droneAppears' : 'thiefAppears'), 1900, true);
      if (this.skin === 'drone') VR.Audio.play('whoosh', { pan: (this.x - p.x) / 5 }); else VR.Audio.play('baa', { pan: (this.x - p.x) / 5 });
    }
    blocked(lane, z0, z1) {
      for (const o of this.g.world.obstacles) {
        if (o.lane !== lane || o.ramp || o.kind !== 'block' || o.standable) continue;
        if (o.z - o.len < z0 && o.z > z1) return true;
      }
      return false;
    }
    update(dt) {
      const g = this.g, p = g.player;
      if (!this.active) {
        if (g.mode === 'story' && !this.forcedAt) return;
        if (g.distance > this.nextAt && !p.flying && g.tunnelDark < 0.2) this.spawn();
        return;
      }
      this.t += dt;
      // the runner gains ~1.4 m/s on the goat (faster while boosting)
      const base = g.speedAt(g.distance);
      if (this.ally) this.gap += (3.4 - this.gap) * Math.min(1, dt * 0.8);       // a friend keeps pace just ahead of you
      else {
        const goatV = this.escaping ? g.speed + 9 : base - 1.4;
        this.gap -= (g.speed - goatV) * dt;
        const limit = this.skin === 'drone' ? 30 : 22;
        if (this.t > limit && !this.escaping) { this.escaping = true; UI.toast(UI.t(this.skin === 'drone' ? 'droneEscaped' : 'thiefEscaped'), 1500); if (this.skin === 'goat') VR.Audio.play('baa'); }
      }
      if (this.gap > 60 && !this.ally) { this.active = false; this.goat.visible = false; this.nextAt = g.distance + 900 + g.evRnd() * 700; return; }
      const z = p.z - Math.max(0.6, this.gap);
      // lane changes: dodge blocked lanes ahead
      this.nextLane -= dt;
      if (this.nextLane <= 0 || this.blocked(this.lane, z, z - 9)) {
        let options = [-1, 0, 1].filter(l => Math.abs(l - this.lane) === 1 && !this.blocked(l, z + 2, z - 12));
        if (this.ally) options = options.filter(l => l !== p.lane);   // a friend stays out of your lane
        if (options.length) { this.lane = options[(g.evRnd() * options.length) | 0]; }
        this.nextLane = 1.8 + g.evRnd() * 1.8;
      }
      const tx = this.lane * LW;
      this.x += Math.sign(tx - this.x) * Math.min(Math.abs(tx - this.x), dt * 8);
      // run over whatever it meets (trains, ramps), with a springy hop
      const ground = g.world.surfaceAt(this.x, z, 99, 0.25).h;
      let low = false;
      for (const o of g.world.obstacles) if (!o.ramp && o.lane === this.lane && o.z > z - 2.5 && o.z - o.len < z + 0.3 && o.kind !== 'block') low = true;
      if (this.skin === 'drone') {                       // flies: hovers over whatever is below
        const tgt = Math.max(ground, low ? 2.6 : 0) + 1.0 + Math.sin(this.t * 3) * 0.12;
        this.y += (tgt - this.y) * Math.min(1, dt * 5); this.vy = (tgt - this.y) * 5;
      } else {
        if ((low || ground > this.y + 0.4) && this.y <= ground + 0.02) { this.vy = low ? 7 : 9; }
        this.vy -= 30 * dt; this.y += this.vy * dt;
        if (this.y < ground) { this.y = ground; this.vy = 0; }
      }
      // coins trail behind it
      this.dropAcc += g.speed * dt;
      if (this.dropAcc > (this.ally ? 2.2 : 3.2) && !this.escaping) { this.dropAcc = 0; g.collect.spawnCoin(this.x, (this.skin === 'drone' ? Math.max(0, this.y - 0.6) : this.y) + 0.9, z + 0.4, null); }
      if (this.ally && Math.random() < dt * 0.12) VR.Audio.play('baa', { pan: (this.x - p.x) / 5 });
      // animation: gallop
      this.phase += dt * (8 + g.speed * 0.25);
      const U = this.goat.userData, s = Math.sin(this.phase), c2 = Math.sin(this.phase * 2);
      if (U.drone) {
        for (const r of U.rotors) r.rotation.y += dt * 40;
        U.body.rotation.x = -0.25; U.body.rotation.z = (this.lane * LW - this.x) * 0.15;
        U.mk.position.y = 1.45 + Math.abs(Math.sin(this.t * 5)) * 0.15; U.mk.rotation.y += dt * 4;
        this.goat.position.set(this.x, this.y - 0.6, z);
        if (!this.escaping && Math.abs(p.x - this.x) < 1.0 && this.gap < 1.3 && p.y + 1.6 > this.y - 0.2) this.catch(z);
        return;
      }
      U.legs[0].rotation.x = s * 0.9; U.legs[3].rotation.x = s * 0.9;
      U.legs[1].rotation.x = -s * 0.9; U.legs[2].rotation.x = -s * 0.9;
      U.body.position.y = Math.abs(c2) * 0.06; U.body.rotation.x = s * 0.06;
      U.head.rotation.x = -0.1 + c2 * 0.08;
      U.mk.position.y = 1.55 + Math.abs(Math.sin(this.t * 5)) * 0.18; U.mk.rotation.y += dt * 4;
      this.goat.position.set(this.x, this.y, z);
      this.goat.rotation.y = (tx - this.x) * -0.12;
      this.goat.rotation.x = this.vy > 0.5 ? -0.25 : this.vy < -0.5 ? 0.15 : 0;
      // caught?
      if (!this.ally && !this.escaping && Math.abs(p.x - this.x) < 1.0 && this.gap < 1.3 && Math.abs(p.y - this.y) < 1.4) this.catch(z);
    }
    catch(z) {
      const g = this.g, reward = 80 + this.caught * 20;
      this.active = false; this.goat.visible = false; this.caught++;
      this.nextAt = g.distance + 900 + g.evRnd() * 700; this.forcedAt = null;
      g.coins += reward; g.score += 500 * g.multiplier;
      VR.Audio.play('catch'); VR.Audio.hush(700);
      const gx = this.x, pan = (gx - g.player.x) / 5;
      if (this.skin === 'drone') { g.fx.smash(this.x, this.y, z, 0x2b2f3a); VR.Audio.play('shieldBreak'); }
      else setTimeout(() => VR.Audio.play('baa', { pan }), 380);
      g.onGem(this.x, this.y + 1, z); g.onGem(this.x, this.y + 1.2, z);
      g.fx.confetti(this.x, this.y + 1.2, z, 60); g.fx.ring(this.x, this.y + 0.8, z, 0xffe14a, 24, 6);
      g.vibrate(40);
      UI.toast(UI.t(this.skin === 'drone' ? 'droneCaught' : 'thiefCaught') + '  +' + reward, 1900, true);
      g.missions.bump('thieves');
      g.emit('thiefCaught');
    }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Thief);
})();

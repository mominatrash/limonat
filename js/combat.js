/* =====================================================================
 * COMBAT — Zahran's gang on the railway, and the lemon as your weapon.
 *
 *  LEMONS ARE AMMO. Every lemon in your lemon meter can be thrown (round
 *  button / quick tap / E). The button and a crosshair only appear when
 *  there is something worth a lemon: a drone ahead, a biker in front of
 *  you, Zahran's courier drone (story), the mega-drone, or — in an online
 *  race — your friend running ahead of you. So the choice is always real:
 *  throw it now, or keep it for a lemonade rush.
 *
 *  LEMONADE IS DEFENCE. During a rush you leave a slippery trail: the
 *  bulldozer (story) slides back, bikers coming up behind crash, and in a
 *  race the friend behind you slips on it.
 *
 *  EVERY ENEMY HAS AN ANSWER AND A REWARD
 *    drone   locks onto your lane (beam + red ring) and dives: dodge, slide, or
 *            throw — a downed drone gives its lemon back plus coins
 *    biker   comes up behind, cuts into your lane and brakes: dodge, or jump on
 *            him — stomp him and his scooter is yours (protects you from one hit)
 *    boss    the mega-drone drops juice bombs on marked lanes; every bomb leaves
 *            a lemon behind: dodge, grab it, throw it back (shared HP in co-op)
 *  POWER-UPS JOIN IN: magnet pulls drones out of the sky, shield blocks a hit,
 *  boost / star ram through enemies, sneakers make stomps easy, and the new
 *  Mishmish bell 🔔 sends the goat charging down your lane for 7 s.
 * ===================================================================== */
(function () {
  const T = THREE, C = VR.CONFIG, UI = VR.UI, LW = C.LANE_WIDTH;

  // ------------------------------------------------------------ models
  function buildHornet() {
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const mb = new VR.MB(71);
    const D = 0x1f2330, Y = 0xf2b705;
    mb.box('paint', D, 0, 0, 0, 0.62, 0.22, 0.56, { r: 0.08 });
    mb.box('paint', Y, 0, 0.12, 0, 0.44, 0.04, 0.4, { r: 0.02 });
    mb.box('paint', Y, 0, 0, 0.29, 0.5, 0.06, 0.02);
    mb.sphere('glow', 0xff3b30, 0, 0, 0.3, 0.075, { seg: 12 });               // eye (faces the runner, +z)
    mb.cone('metal', 0x9aa2ad, 0, -0.02, 0.4, 0.05, 0.16, { rx: Math.PI / 2, seg: 8 });   // stinger
    mb.sphere('glow', 0xff5a36, 0, -0.13, 0, 0.1, { sy: 0.4, seg: 10 });        // belly light
    for (const [x, z] of [[-0.4, -0.36], [0.4, -0.36], [-0.4, 0.36], [0.4, 0.36]]) {
      mb.box('paint', D, x / 2, 0.03, z / 2, 0.06, 0.05, 0.42, { ry: Math.atan2(x, z), r: 0.02 });
      mb.cyl('metal', 0x5a606b, x, 0.08, z, 0.05, 0.06, 0.08, { seg: 12 });
    }
    body.add(mb.build({ receive: false }));
    const rotors = [];
    const rg = new T.CylinderGeometry(0.22, 0.22, 0.01, 18), rm = new T.MeshBasicMaterial({ color: 0xcfd6e0, transparent: true, opacity: 0.35, depthWrite: false });
    for (const [x, z] of [[-0.4, -0.36], [0.4, -0.36], [-0.4, 0.36], [0.4, 0.36]]) { const r = new T.Mesh(rg, rm); r.position.set(x, 0.13, z); body.add(r); rotors.push(r); }
    // targeting beam (shown while it locks onto your lane)
    const beam = new T.Mesh(new T.CylinderGeometry(0.02, 0.32, 5, 12, 1, true), new T.MeshBasicMaterial({ color: new T.Color(1, 0.12, 0.06), transparent: true, opacity: 0.35, depthWrite: false, blending: T.AdditiveBlending, fog: false, side: T.DoubleSide }));
    beam.rotation.x = Math.PI / 2; beam.position.set(0, 0, 2.8); root.add(beam);
    root.userData = { body, rotors, beam };
    root.scale.setScalar(2.0); root.visible = false;
    return root;
  }
  function buildBiker() {
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const mb = new VR.MB(72);
    const Y = 0xf2b705, K = 0x22252e;
    for (const z of [-0.58, 0.52]) {
      mb.cyl('matte', 0x1a1a1a, 0, 0.28, z, 0.28, 0.28, 0.13, { rz: Math.PI / 2, seg: 18 });
      mb.cyl('metal', 0x9aa2ad, 0, 0.28, z, 0.12, 0.12, 0.15, { rz: Math.PI / 2, seg: 12 });
    }
    mb.box('paint', Y, 0, 0.5, 0.05, 0.36, 0.3, 1.0, { r: 0.1 });              // scooter body
    mb.box('paint', K, 0, 0.72, 0.28, 0.32, 0.1, 0.5, { r: 0.05 });             // seat
    mb.cyl('metal', 0x5a606b, 0, 0.78, -0.56, 0.04, 0.04, 0.9, { rx: -0.25, seg: 8 });   // fork
    mb.box('metal', 0x3a3f48, 0, 1.2, -0.66, 0.66, 0.05, 0.05);                 // handlebar
    mb.sphere('glow', 0xfff2c0, 0, 0.95, -0.72, 0.08, { seg: 10 });             // headlight
    mb.sphere('glow', 0xff2a2a, 0, 0.62, 0.58, 0.06, { seg: 8 });               // tail light (you see it)
    // rider, from behind: black jacket with Zahran's yellow stripe, helmet
    mb.box('matte', 0x2c3140, 0, 0.95, 0.22, 0.34, 0.34, 0.4, { r: 0.1 });      // legs/hips
    mb.box('paint', K, 0, 1.42, 0.12, 0.46, 0.58, 0.3, { r: 0.12, rx: -0.35 }); // torso leaning forward
    mb.box('paint', Y, 0, 1.46, 0.28, 0.4, 0.08, 0.02, { rx: -0.35 });          // stripe
    mb.box('paint', Y, 0, 1.33, 0.29, 0.14, 0.14, 0.02, { rx: -0.35 });          // Z badge
    for (const s of [-1, 1]) mb.box('paint', K, s * 0.27, 1.34, -0.25, 0.1, 0.1, 0.5, { rx: 0.35, r: 0.04 });   // arms
    mb.sphere('paint', 0x111318, 0, 1.86, -0.02, 0.2, { sy: 1.05, seg: 16 });    // helmet
    mb.box('glass', 0x2a3a55, 0, 1.84, -0.19, 0.28, 0.12, 0.05, { r: 0.03 });   // visor
    body.add(mb.build({ receive: false }));
    root.userData = { body };
    root.visible = false;
    return root;
  }
  function buildBoss() {
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const mb = new VR.MB(73);
    const D = 0x1d2029, Y = 0xf2b705;
    mb.box('paint', D, 0, 0, 0, 2.4, 0.6, 1.7, { r: 0.22 });
    mb.box('paint', Y, 0, 0.32, 0, 1.9, 0.08, 1.3, { r: 0.05 });
    mb.box('hazard', 0xffffff, 0, -0.05, 0.86, 2.2, 0.26, 0.04);
    mb.sphere('glow', 0xff3b30, 0, 0.02, 0.88, 0.22, { sz: 0.5, seg: 16 });    // big eye
    mb.cyl('metal', 0x3a3f48, 0, -0.42, 0.2, 0.22, 0.28, 0.3, { seg: 14 });      // bomb hatch
    for (const s of [-1, 1]) mb.cyl('metal', 0x3a3f48, s * 0.7, -0.4, 0.5, 0.09, 0.09, 0.6, { rx: Math.PI / 2, seg: 10 });   // cannons
    const arms = [[-1.55, -0.85], [1.55, -0.85], [-1.8, 0], [1.8, 0], [-1.55, 0.85], [1.55, 0.85]];
    for (const [x, z] of arms) {
      mb.box('paint', D, x * 0.62, 0.12, z * 0.62, 0.12, 0.1, Math.hypot(x, z) * 0.8, { ry: Math.atan2(x, z), r: 0.03 });
      mb.cyl('metal', 0x5a606b, x, 0.2, z, 0.12, 0.14, 0.18, { seg: 14 });
    }
    body.add(mb.build({ receive: false }));
    const rotors = [], rg = new T.CylinderGeometry(0.62, 0.62, 0.01, 24), rm = new T.MeshBasicMaterial({ color: 0xcfd6e0, transparent: true, opacity: 0.3, depthWrite: false });
    for (const [x, z] of arms) { const r = new T.Mesh(rg, rm); r.position.set(x, 0.32, z); body.add(r); rotors.push(r); }
    root.userData = { body, rotors };
    root.scale.setScalar(2.6); root.visible = false;
    return root;
  }
  function buildLemonShot() {
    const mb = new VR.MB(74);
    mb.sphere('gloss', 0xffd23f, 0, 0, 0, 0.17, { sz: 1.3, seg: 14 });
    mb.sphere('gloss', 0x3f9a3a, 0.06, 0.13, 0.02, 0.07, { sx: 1.3, sy: 0.3, seg: 8 });
    const m = mb.build({ receive: false }); m.visible = false; return m;
  }
  function buildJuiceBomb() {
    const mb = new VR.MB(75);
    mb.sphere('gloss', 0xffc21a, 0, 0, 0, 0.34, { seg: 16 });
    mb.cyl('paint', 0x2f8a45, 0, 0.34, 0, 0.08, 0.1, 0.12, { seg: 10 });
    mb.sphere('glow', 0xff5a36, 0, 0.44, 0, 0.06, { seg: 8 });
    const m = mb.build({ receive: false }); m.visible = false; return m;
  }
  function buildPuddle() {
    const m = new T.Mesh(new T.CircleGeometry(1, 20), new T.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.45, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.scale.set(1.9, 1.5, 1); m.visible = false;
    return m;
  }
  const ringGeo = new T.RingGeometry(0.9, 1.25, 32);

  // ------------------------------------------------------------ system
  class Combat {
    constructor(game) {
      this.name = 'combat'; this.g = game;
      this.drones = [buildHornet(), buildHornet()];
      this.biker = buildBiker();
      this.boss = buildBoss();
      this.shots = Array.from({ length: 8 }, buildLemonShot);
      this.bombMeshes = Array.from({ length: 5 }, buildJuiceBomb);
      this.rings = Array.from({ length: 6 }, () => {
        const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: new T.Color(2.4, 0.3, 0.2), transparent: true, opacity: 0.8, depthWrite: false, fog: false, side: T.DoubleSide }));
        m.rotation.x = -Math.PI / 2; m.visible = false; return m;
      });
      this.puddles = Array.from({ length: 22 }, buildPuddle);
      this.goat = VR.buildGoat ? VR.buildGoat() : new T.Group();
      if (this.goat.userData.mk) this.goat.userData.mk.visible = false;
      this.goat.visible = false;
      game.scene.add(...this.drones, this.biker, this.boss, ...this.shots, ...this.bombMeshes, ...this.rings, ...this.puddles, this.goat);
      this.clearAll();
      UI.addStrings({
        cbThrow: 'ارمي ليمونة', cbTip: '🍋 اضغط الزر وارمي ليمونة!', cbNoLemon: 'ما معك ليمون! 🍋',
        cbDroneWarn: '🎯 درون! بدّل خطك أو ارميه', cbBikerWarn: '🏍️ موتوسيكل وراك!', cbDodge: 'تفادي!',
        cbKnockDrone: 'وقّعت الدرون!', cbKnockBiker: 'وقّعت الموتوسيكل!', cbSteal: 'أخدت موتوسيكله! 🛵', cbMagnet: '🧲 المغناطيس سحب الدرون!',
        cbBossIn: 'الدرون الكبير وصل! 🛸', cbBossName: 'درون زهران الكبير', cbBossDown: 'هزمت الدرون الكبير!', cbBossAway: 'الدرون الكبير هرب…',
        cbBossCoop: 'اضربوه مع بعض! 🤝', cbBossTip: 'كل قنبلة بتترك ليمونة 🍋',
        cbTrail: 'تزحلق ع الليموناضة! 🥤', cbDozerSlip: 'الجرّافة بتتزحلق! 🥤',
        cbHitFriend: 'صبته! 🎯', cbMissFriend: 'فلت منك!', cbGotHit: '🍋 {n} صابك!', cbIncoming: '🍋 ليمونة جاية!', cbSlipFriend: '🥤 تزحلقت ع ليموناضة {n}!',
      }, {
        cbThrow: 'Throw a lemon', cbTip: '🍋 Tap the button to throw a lemon!', cbNoLemon: 'No lemons! 🍋',
        cbDroneWarn: '🎯 Drone! Dodge or hit it', cbBikerWarn: '🏍️ Biker behind you!', cbDodge: 'Dodged!',
        cbKnockDrone: 'Drone down!', cbKnockBiker: 'Biker down!', cbSteal: 'You took his scooter! 🛵', cbMagnet: '🧲 Magnet grabbed the drone!',
        cbBossIn: 'The mega-drone is here! 🛸', cbBossName: 'Zahran’s mega-drone', cbBossDown: 'Mega-drone down!', cbBossAway: 'The mega-drone got away…',
        cbBossCoop: 'Hit it together! 🤝', cbBossTip: 'Every bomb leaves a lemon 🍋',
        cbTrail: 'Slipped on lemonade! 🥤', cbDozerSlip: 'The bulldozer is slipping! 🥤',
        cbHitFriend: 'Direct hit! 🎯', cbMissFriend: 'Missed!', cbGotHit: '🍋 {n} got you!', cbIncoming: '🍋 Lemon incoming!', cbSlipFriend: '🥤 Slipped on {n}’s lemonade!',
      });
      window.addEventListener('keydown', (e) => {
        const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
        if ((e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'Enter') && this.g.state === 'playing') { e.preventDefault(); this.throwLemon(); }
      });
    }

    bind() {
      const hud = document.getElementById('hud') || document.body;
      const add = (html, parent) => { const d = document.createElement('div'); d.innerHTML = html; const el = d.firstElementChild; parent.appendChild(el); return el; };
      this.btn = add(`<button id="cbBtn" class="cb-btn" hidden aria-label="Throw"><span class="cb-ic">🍋</span><b class="cb-n"></b></button>`, hud);
      this.aim = add(`<div id="cbAim" class="cb-aim" hidden></div>`, hud);
      this.warnEl = add(`<div id="cbWarn" class="cb-warn" hidden></div>`, hud);
      this.bossBar = add(`<div id="cbBoss" class="cb-boss" hidden><span></span><i><b></b></i></div>`, hud);
      this.splat = add(`<div id="cbSplat" class="cb-splat" hidden>${Array.from({ length: 6 }, () => '<i></i>').join('')}</div>`, document.body);
      const st = document.createElement('style');
      st.textContent = `
        .cb-btn{position:fixed;right:calc(14px + var(--safe-r, 0px));bottom:calc(22px + var(--safe-b, 0px));width:80px;height:80px;border-radius:50%;border:3px solid #ffd23f;
          background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.3),rgba(16,20,34,.82) 60%);box-shadow:0 6px 18px rgba(0,0,0,.35),0 0 0 5px rgba(255,210,63,.22);pointer-events:auto;
          display:grid;place-items:center;cursor:pointer;touch-action:none;z-index:6;padding:0;-webkit-tap-highlight-color:transparent;animation:cbPulse 1s ease-in-out infinite}
        .cb-btn[hidden]{display:none}.cb-btn .cb-ic{font-size:40px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}
        .cb-btn .cb-n{position:absolute;top:-4px;left:-4px;min-width:26px;height:26px;border-radius:13px;background:#2f8a45;color:#fff;font:800 15px/26px system-ui,sans-serif;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.4)}
        .cb-btn.empty{filter:grayscale(1) brightness(.7);animation:none}.cb-btn.empty .cb-n{background:#6b7280}.cb-btn:active{transform:scale(.9)}
        @keyframes cbPulse{50%{box-shadow:0 6px 18px rgba(0,0,0,.35),0 0 0 10px rgba(255,210,63,.1)}}
        .cb-aim{position:fixed;left:0;top:0;width:54px;height:54px;margin:-27px 0 0 -27px;border:3px solid #ffd23f;border-radius:50%;pointer-events:none;
          box-shadow:0 0 0 2px rgba(0,0,0,.35),inset 0 0 0 2px rgba(0,0,0,.25);animation:cbAim 0.8s ease-in-out infinite}
        .cb-aim:before,.cb-aim:after{content:"";position:absolute;background:#ffd23f;left:50%;top:-9px;width:3px;height:70px;margin-left:-1.5px;clip-path:polygon(0 0,100% 0,100% 18%,0 18%,0 82%,100% 82%,100% 100%,0 100%)}
        .cb-aim:after{transform:rotate(90deg)}.cb-aim[hidden]{display:none}.cb-aim.friend,.cb-aim.friend:before,.cb-aim.friend:after{border-color:#ff6fd8}.cb-aim.friend:before,.cb-aim.friend:after{background:#ff6fd8}
        @keyframes cbAim{50%{transform:scale(.85) rotate(45deg)}}
        .cb-warn{position:fixed;left:50%;bottom:calc(26px + var(--safe-b, 0px));transform:translateX(-50%);font-size:22px;font-weight:800;padding:4px 14px;border-radius:99px;background:rgba(232,67,58,.88);color:#fff;pointer-events:none;animation:cbBlink .5s steps(2) infinite;white-space:nowrap}
        .cb-warn[hidden]{display:none}@keyframes cbBlink{50%{opacity:.4}}
        .cb-boss{position:fixed;top:calc(150px + var(--safe-t, 0px));left:50%;transform:translateX(-50%);width:min(340px,72vw);display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none}
        .cb-boss[hidden]{display:none}.cb-boss span{font-weight:900;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.6);font-size:14px}
        .cb-boss i{display:block;width:100%;height:12px;border-radius:99px;background:rgba(0,0,0,.5);overflow:hidden;box-shadow:0 0 0 2px rgba(255,255,255,.25)}
        .cb-boss i b{display:block;height:100%;background:linear-gradient(90deg,#ff5a36,#ffd23f);transition:width .15s}
        @media (min-width:700px){.cb-boss{top:calc(70px + var(--safe-t, 0px))}}
        .cb-splat{position:fixed;inset:0;pointer-events:none;z-index:7}.cb-splat[hidden]{display:none}
        .cb-splat i{position:absolute;--j:rgba(255,198,28,.94);background:
          radial-gradient(circle at 44% 40%,rgba(255,244,170,.9) 0 9%,transparent 10%),
          radial-gradient(circle at 50% 50%,var(--j) 0 34%,transparent 35%),
          radial-gradient(circle at 22% 30%,var(--j) 0 13%,transparent 14%),
          radial-gradient(circle at 80% 66%,var(--j) 0 12%,transparent 13%),
          radial-gradient(circle at 72% 20%,var(--j) 0 8%,transparent 9%),
          radial-gradient(circle at 28% 78%,var(--j) 0 9%,transparent 10%),
          radial-gradient(circle at 92% 38%,var(--j) 0 4%,transparent 5%),
          radial-gradient(circle at 8% 60%,var(--j) 0 4%,transparent 5%),
          linear-gradient(var(--j),var(--j)) 49% 60%/7% 40% no-repeat}`;
      document.head.appendChild(st);
      const fire = (e) => { e.preventDefault(); e.stopPropagation(); this.throwLemon(); };
      this.btn.addEventListener('touchstart', fire, { passive: false });
      this.btn.addEventListener('mousedown', fire);
      // a quick tap on the game (not a swipe) also throws, but only when there is something to hit
      const el = document.getElementById('game');
      let t0 = 0, x0 = 0, y0 = 0;
      const down = (x, y) => { t0 = performance.now(); x0 = x; y0 = y; };
      const up = (x, y) => { if (performance.now() - t0 < 260 && Math.hypot(x - x0, y - y0) < 14 && this.g.state === 'playing' && this.target) this.throwLemon(); };
      if (el) {
        el.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; down(t.clientX, t.clientY); }, { passive: true });
        el.addEventListener('touchend', (e) => { const t = e.changedTouches[0]; up(t.clientX, t.clientY); });
        el.addEventListener('mousedown', (e) => down(e.clientX, e.clientY));
        el.addEventListener('mouseup', (e) => up(e.clientX, e.clientY));
      }
    }

    warm(on) { for (const m of [...this.drones, this.biker, this.boss, this.shots[0], this.bombMeshes[0], this.puddles[0], this.goat]) m.visible = on; }
    clearAll() {
      this.enemies = []; this.planned = []; this.projectiles = []; this.bombs = []; this.trail = []; this.frTrail = []; this.incoming = [];
      this.goatRun = null; this.slipT = 0; this.cool = 0; this.target = null; this.trailAcc = 0; this.trailSend = 0;
      this.bossS = null; this.pendingHits = 0;
      for (const m of [...this.drones, this.biker, this.boss, ...this.shots, ...this.bombMeshes, ...this.rings, ...this.puddles, this.goat]) if (m) m.visible = false;
      if (this.warnEl) this.warnEl.hidden = true;
      if (this.bossBar) this.bossBar.hidden = true;
      if (this.btn) this.btn.hidden = true;
      if (this.aim) this.aim.hidden = true;
      if (this.splat) { this.splat.hidden = true; this.splatLeft = 0; }
    }
    reset() { this.clearAll(); }

    // ------------------------------------------------------------ run lifecycle
    runStart(opts) {
      this.clearAll();
      const mode = opts.mode || 'endless';
      this.seed = opts.seed != null ? opts.seed : (Math.random() * 1e9) | 0;
      const coop = mode === 'party' && opts.party === 'coop';
      this.race = mode === 'party' && !coop;
      this.coop = coop;
      const lvl = mode === 'story' && VR.STORY ? VR.STORY.find(l => l.id === opts.level) : null;
      this.enemiesOn = mode !== 'story' || (lvl && lvl.id >= 5);
      this.enemyRate = mode === 'story' ? 0.45 : 1;
      this.bossOn = mode === 'endless' || mode === 'daily' || coop;
      this.nextBossAt = coop ? 900 : 1100;
      this.tipShown = UI.store.get('cbTip2', false);
      this.warnedDrone = this.warnedBiker = false;
      this.trailToast = false;
    }
    leaveRun() { this.clearAll(); }
    runEnd() { if (this.warnEl) this.warnEl.hidden = true; if (this.btn) this.btn.hidden = true; if (this.aim) this.aim.hidden = true; }
    state(s) {
      // spectating a friend moves the world around: drop my enemies (keep a co-op boss fight going)
      if (s === 'partyWait' || s === 'menu') { const B = this.bossS; this.clearAll(); if (s !== 'menu') this.bossS = B; }
      if (s !== 'playing') { if (this.btn) this.btn.hidden = true; if (this.aim) this.aim.hidden = true; if (this.warnEl) this.warnEl.hidden = true; }
    }
    shift(dz) {
      for (const e of this.enemies) e.z += dz;
      for (const e of this.planned) e.z += dz;
      for (const s of this.projectiles) { s.z += dz; s.m.position.z = s.z; }
      for (const b of this.bombs) { b.z += dz; b.sz += dz; }
      for (const t of this.trail) { t.z += dz; if (t.m) t.m.position.z = t.z; }
    }
    // power-ups with a combat job
    powerUp(type) {
      if (type === 'goat') this.whistle();
    }

    // ------------------------------------------------------------ enemies are seeded per chunk
    chunk(chunk, plan) {
      const g = this.g;
      if (!g.runOpts || g.state === 'menu') return;
      const rnd = VR.rng(((this.seed | 0) * 977 + chunk.id * 131 + 7) >>> 0);
      const r3 = rnd(), r4 = rnd(), r5 = rnd();
      if (!plan || plan.patternName === 'safe' || !this.enemiesOn || chunk.id < 9) return;
      const diff = g.difficultyAt(g.distance + (g.player.z - chunk.z0));
      if (r3 < (0.16 + diff * 0.2) * this.enemyRate) this.planned.push({ type: r4 < 0.56 ? 'drone' : 'biker', z: chunk.z0 - 10 - r5 * 20, lane: ((r5 * 3) | 0) - 1 });
    }

    // ------------------------------------------------------------ lemons = ammo
    ammo() {
      const g = this.g;
      if (g.powerups.active('lemonade')) return g.powerups.remaining('lemonade') > 1.6 ? Infinity : 0;
      return g.lemons;
    }
    spendLemon() {
      const g = this.g, pu = g.powerups;
      if (pu.active('lemonade')) { pu.timers.lemonade = Math.max(0.05, pu.remaining('lemonade') - 1.5); return; }  // a rush pays in seconds
      g.lemons = Math.max(0, g.lemons - 1);
      UI.lemons(g.lemons, g.lemonNeed, 0);
    }
    // what a thrown lemon would go for right now (null = nothing worth a lemon)
    findTarget() {
      const g = this.g, p = g.player;
      const B = this.bossS;
      if (B && B.hp > 0 && B.in) return { kind: 'boss' };
      let best = null, bestScore = 1e9;
      for (const e of this.enemies) {
        if (e.down) continue;
        const ahead = p.z - e.z;
        if (ahead < 2 || ahead > 55) continue;
        if (e.type === 'biker' && e.phase === 'approach') continue;
        const score = ahead + Math.abs(e.x - p.x) * 6;     // your lane first
        if (score < bestScore) { bestScore = score; best = { kind: 'enemy', e }; }
      }
      const th = g.S.thief;
      if (th && th.active && th.skin === 'drone' && !th.escaping && !th.ally && th.gap < 50) {
        const score = th.gap + Math.abs(th.x - p.x) * 6;
        if (score < bestScore) { bestScore = score; best = { kind: 'thief' }; }
      }
      if (!best && this.race) {
        const P = g.S.party, f = this.friendPos();
        if (f && f.ahead > 3 && f.ahead < 45 && P.av && P.av.rig && P.av.rig.root.visible) best = { kind: 'friend', f };
      }
      return best;
    }
    friendPos() {
      const g = this.g, P = g.S.party;
      if (!P || !P.inRun || !P.fr || P.fDead || P.frGone || P.dS == null || !P.av) return null;
      const r = P.av.rig && P.av.rig.root;
      return { ahead: P.dS - g.distance, x: r ? r.position.x : 0, z: g.player.z - (P.dS - g.distance), y: r ? r.position.y : 0 };
    }
    throwLemon() {
      const g = this.g, p = g.player;
      if (g.state !== 'playing' || this.cool > 0) return;
      const tg = this.target || this.findTarget();
      if (!tg) return;
      if (this.ammo() <= 0) { UI.toast(UI.t('cbNoLemon'), 800); VR.Audio.play('denied'); this.cool = 0.4; return; }
      const s = this.shots.find(m => !m.visible); if (!s) return;
      this.spendLemon();
      this.cool = 0.22;
      s.visible = true;
      const shot = { m: s, x: p.x, y: p.y + 1.25, z: p.z - 0.7, t: 0, tg };
      if (tg.kind === 'friend') {                 // a lob at the lane he is in now: he can still dodge it
        shot.fx = tg.f.x; shot.T = 0.9; shot.z0 = shot.z; shot.x0 = shot.x;
        this.send({ k: 'lm', x: Math.round(tg.f.x * 100) / 100, T: shot.T });
      }
      s.position.set(shot.x, shot.y, shot.z);
      this.projectiles.push(shot);
      VR.Audio.play('throw');
      g.cameraImpulse(0.03);
    }

    // ------------------------------------------------------------ lemonade trail: slippery for anyone behind you
    updateTrail(dt) {
      const g = this.g, p = g.player, rush = g.powerups.active('lemonade');
      if (rush && !p.flying) {
        this.trailAcc += g.speed * dt;
        if (this.trailAcc > 2.2) {
          this.trailAcc = 0;
          const m = this.puddles.find(q => !q.visible) || this.trail.length && this.trail[0].m;
          if (m) {
            this.trail = this.trail.filter(t => t.m !== m);
            m.visible = true; m.position.set(p.x, p.y + 0.03, p.z + 0.5); m.material.opacity = 0.45; m.rotation.z = Math.random() * 6;
            this.trail.push({ m, x: p.x, y: p.y, z: p.z + 0.5, t: 7 });
          }
        }
        // online race: tell the friend where my lemonade is
        if (this.race && (this.trailSend -= dt) <= 0) { this.trailSend = 0.25; this.send({ k: 'tr', d: Math.round(g.distance * 10) / 10, x: Math.round(p.x * 10) / 10 }); }
        // chasers slip on it
        const st = g.S.story, d = st && st.active && st.dz;
        if (d && d.on && !d.caught && d.gap < 13) {
          d.gap = Math.min(13, d.gap + dt * 6);
          if (!this.trailToast) { this.trailToast = true; UI.toast(UI.t('cbDozerSlip'), 1300, true); }
          if (Math.random() < dt * 12) g.fx.dust(p.x + (Math.random() - 0.5) * 3, 0.3, p.z + d.gap - 1, 2, 0xffe14a, 1.2);
        }
      } else this.trailToast = false;
      for (const t of this.trail) {
        t.t -= dt;
        t.m.material.opacity = 0.45 * Math.min(1, t.t / 2);
        if (t.t <= 0 || t.z - p.z > 45) { t.m.visible = false; t.dead = true; }
      }
      this.trail = this.trail.filter(t => !t.dead);
      // the friend's lemonade, placed on my copy of the railway
      for (const q of this.frTrail) {
        q.t -= dt;
        if (!q.m && q.d > g.distance + 2) {
          const m = this.puddles.find(x => !x.visible);
          if (m) { const z = p.z - (q.d - g.distance); m.visible = true; m.position.set(q.x, g.world.surfaceAt(q.x, z, 99, 0.3).h + 0.03, z); m.material.opacity = 0.6; q.m = m; q.z = z; }
        }
        if (q.m) {
          const z = p.z - (q.d - g.distance);
          if (!q.hit && Math.abs(z - p.z) < 0.9 && Math.abs(q.x - p.x) < 1.6 && !p.flying && p.y < q.m.position.y + 0.4) { q.hit = true; this.slip(UI.t('cbSlipFriend').replace('{n}', this.frName())); }
          if (p.z - z < -20) q.t = 0;
        }
        if (q.t <= 0) { if (q.m) q.m.visible = false; q.dead = true; }
      }
      this.frTrail = this.frTrail.filter(q => !q.dead);
    }
    slip(msg) {
      const g = this.g, p = g.player;
      if (g.powerups.active('invincible') || g.powerups.active('boost') || p.flying) return;
      this.slipT = 1.3; p.stumbleAnim = 0.5;
      UI.toast(msg, 1300, true); VR.Audio.play('slip'); g.shake = Math.max(g.shake, 0.2); g.vibrate(30);
    }
    frName() { const P = this.g.S.party; return (P && P.frName) || ''; }

    // ------------------------------------------------------------ party link
    send(m) { const P = this.g.S.party; if (P && P.inRun) P.send(Object.assign({ t: 'cb' }, m)); }
    combatNet(m) {
      const g = this.g, P = g.S.party;
      if (!P || !P.inRun) return;
      const playing = g.state === 'playing', nm = (k) => UI.t(k).replace('{n}', this.frName());
      switch (m.k) {
        case 'lm':        // a lemon lobbed at me: land check after its flight time, in whatever lane I am by then
          if (!playing) break;
          this.incoming.push({ x: +m.x || 0, t: Math.max(0.3, Math.min(1.5, (+m.T || 0.9) - Math.min(0.25, (P.rtt || 80) / 2000))) });
          if (this.warnEl) { this.warnEl.textContent = UI.t('cbIncoming'); this.warnEl.hidden = false; }
          VR.Audio.play('throw');
          break;
        case 'lmHit': UI.toast(UI.t('cbHitFriend'), 1000, true); VR.Audio.play('hit'); g.score += 200 * g.multiplier; break;
        case 'lmMiss': UI.toast(UI.t('cbMissFriend'), 800); break;
        case 'tr': if (playing && this.frTrail.length < 60) this.frTrail.push({ d: +m.d || 0, x: +m.x || 0, t: 14 }); break;
        case 'bh': if (this.coop) { if (this.bossS && this.bossS.hp > 0) this.hitBoss(m.n || 1, false); else this.pendingHits = Math.min(40, this.pendingHits + (m.n || 1)); } break;
        case 'bd': if (this.coop && this.bossS && this.bossS.hp > 0) { this.bossS.hp = 0; this.bossDefeated(); } break;
      }
      void nm;
    }
    updateIncoming(dt) {
      const g = this.g, p = g.player;
      for (const q of this.incoming) {
        q.t -= dt;
        if (q.t > 0) continue;
        q.done = true;
        const pu = g.powerups;
        const hit = Math.abs(p.x - q.x) < 1.1 && p.y < 1.6 && !p.flying;
        if (hit && !pu.active('invincible') && !pu.active('boost')) {
          if (pu.active('shield')) { pu.consume('shield'); VR.Audio.play('shieldBreak'); UI.toast(UI.t('shieldBroken')); this.send({ k: 'lmMiss' }); continue; }
          this.splash(); this.slip(UI.t('cbGotHit').replace('{n}', this.frName()));
          g.fx.sparkle(p.x, p.y + 1.4, p.z, 0xffe14a, 20, 4);
          this.send({ k: 'lmHit' });
        } else { this.send({ k: 'lmMiss' }); g.fx.sparkle(q.x, 0.4, p.z - 1, 0xffe14a, 10, 3); VR.Audio.play('splat'); }
      }
      this.incoming = this.incoming.filter(q => !q.done);
      if (this.warnEl && this.warnEl.textContent === UI.t('cbIncoming') && !this.incoming.length) this.warnEl.hidden = true;
    }
    splash() {
      const el = this.splat; if (!el) return;
      el.querySelectorAll('i').forEach((b) => {
        const s = 22 + Math.random() * 26;
        b.style.width = s + 'vmin'; b.style.height = s * (0.8 + Math.random() * 0.4) + 'vmin';
        b.style.left = (Math.random() * 90 - 10) + '%'; b.style.top = (Math.random() * 80 - 5) + '%';
        b.style.transform = `rotate(${Math.random() * 360}deg)`;
      });
      el.hidden = false; el.style.opacity = '0'; this.splatLeft = 2.8;
      VR.Audio.play('splat'); this.g.vibrate([30, 30, 30]);
    }

    // ------------------------------------------------------------ getting hit
    hurt(e) {
      const g = this.g, p = g.player, pu = g.powerups;
      if (g.state !== 'playing') return false;
      if (pu.active('invincible') || pu.active('boost') || p.flying || g.jetGrace > 0) { if (e) this.knock(e); return false; }
      if (VR.GOD || g.hitCooldown > 0) return false;
      if (e) this.knock(e, true);
      if (pu.active('shield')) { pu.consume('shield'); g.fx.smash(p.x, p.y + 1, p.z - 0.5, 0x9fdcff); VR.Audio.play('shieldBreak'); UI.toast(UI.t('shieldBroken')); g.hitCooldown = 0.6; return true; }
      const V = g.S.vehicles;
      if (V && V.kind) { V.dismount('crash'); p.flash = 1.2; g.hitCooldown = 1.2; g.shake = 0.3; return true; }
      const now = g.elapsed;
      if (now - p.lastStumble < C.STUMBLE_WINDOW) { g.gameOver(); return true; }
      p.lastStumble = now; g.stumbles++; p.stumbleAnim = 0.5;
      g.hitCooldown = 0.6; g.shake = 0.25; g.fxCA = 0.6;
      UI.hitFlash(); VR.Audio.play('stumble'); UI.toast(UI.t('stumble')); g.vibrate(40);
      return true;
    }
    // knocked out: a drone gives its lemon back (plus coins), a biker leaves coins
    knock(e, quiet, why) {
      if (e.down) return;
      const g = this.g, p = g.player;
      e.down = true; e.vy = e.type === 'drone' ? 2 : 5; e.spin = (Math.random() - 0.5) * 12; e.dt = 0;
      if (e.ring) { e.ring.visible = false; e.ring = null; }
      g.fx.smash(e.x, e.y + 0.4, e.z, e.type === 'drone' ? 0x2b2f3a : 0xf2b705);
      g.fx.ring(e.x, e.y + 0.6, e.z, 0xffd23f, 20, 6);
      VR.Audio.play('boom', { pan: (e.x - p.x) / 5 });
      if (quiet) return;
      g.score += 250 * g.multiplier;
      const zc = Math.min(e.z, p.z - 7);
      for (let i = 0; i < 5; i++) g.collect.spawnCoin(e.x, 1.0, zc - i * 1.5, null);
      if (e.type === 'drone') g.collect.spawnGem(p.lane * LW, 1.0, zc - 9, null);
      UI.toast(why || (UI.t(e.type === 'drone' ? 'cbKnockDrone' : 'cbKnockBiker') + ' +250'), 1000, true);
      g.missions.bump('enemies');
    }
    remove(e) { e.m.visible = false; e.gone = true; if (e.ring) { e.ring.visible = false; e.ring = null; } if (e.type === 'biker' && this.warnEl && this.warnEl.textContent.includes('🏍')) this.warnEl.hidden = true; }

    // ------------------------------------------------------------ per frame
    update(dt) {
      const g = this.g, p = g.player;
      if (this.cool > 0) this.cool -= dt;
      this.spawnPlanned();
      this.updateEnemies(dt);
      if (g.state !== 'playing') return;
      this.updateShots(dt);
      this.updateGoat(dt);
      this.updateBoss(dt);
      if (g.state !== 'playing') return;
      this.updateTrail(dt);
      this.updateIncoming(dt);
      if (this.slipT > 0) {
        this.slipT -= dt;
        g.speed *= Math.max(0.2, 1 - dt * 2.4);
        p.object.rotation.z = Math.sin(this.slipT * 18) * 0.25 * Math.min(1, this.slipT);
      }
      if (this.splatLeft > 0) {
        this.splatLeft -= dt;
        const t = 2.8 - this.splatLeft, el = this.splat;
        el.style.opacity = (t < 0.15 ? t / 0.15 : this.splatLeft < 1 ? Math.max(0, this.splatLeft) : 1).toFixed(3);
        el.style.transform = `translateY(${Math.max(0, t - 1.2) * 14}px) scale(${t < 0.15 ? 1.25 - t / 0.15 * 0.25 : 1})`;
        if (this.splatLeft <= 0) el.hidden = true;
      }
      this.updateAim();
    }
    // the throw button and the crosshair only show up when there is something to hit
    updateAim() {
      const g = this.g;
      this.target = this.findTarget();
      const tg = this.target, show = !!tg;
      if (this.btn.hidden === show) {
        this.btn.hidden = !show;
        if (show && !this.tipShown) { this.tipShown = true; UI.store.set('cbTip2', true); UI.toast(UI.t('cbTip'), 1800, true); }
      }
      if (!show) { this.aim.hidden = true; return; }
      const n = this.ammo();
      this.btn.classList.toggle('empty', n <= 0);
      const txt = n === Infinity ? '∞' : String(n);
      const nb = this.btn.querySelector('.cb-n'); if (nb.textContent !== txt) nb.textContent = txt;
      let x, y, z;
      if (tg.kind === 'boss') { const B = this.bossS; x = B.x; y = B.y; z = B.z; }
      else if (tg.kind === 'thief') { const th = g.S.thief; x = th.x; y = th.y + 0.4; z = g.player.z - Math.max(0.6, th.gap); }
      else if (tg.kind === 'friend') { x = tg.f.x; y = tg.f.y + 1; z = tg.f.z; }
      else { const e = tg.e; x = e.x; y = e.y + (e.type === 'biker' ? 1.2 : 0); z = e.z; }
      const [sx, sy] = g.screenPos(x, y, z);
      this.aim.hidden = false;
      this.aim.style.left = sx.toFixed(0) + 'px'; this.aim.style.top = sy.toFixed(0) + 'px';
      this.aim.classList.toggle('friend', tg.kind === 'friend');
    }

    spawnPlanned() {
      const g = this.g, p = g.player;
      if (!this.planned.length) return;
      for (let i = this.planned.length - 1; i >= 0; i--) {
        const q = this.planned[i];
        const ahead = p.z - q.z;
        if (q.type === 'drone' ? ahead > 52 : ahead > 10) continue;
        this.planned.splice(i, 1);
        if (ahead < -5 || p.flying || this.bossS || g.tunnelDark > 0.3) continue;
        if (q.type === 'drone') { if (this.enemies.filter(e => e.type === 'drone').length < 2) this.spawnDrone(q); }
        else if (!this.enemies.some(e => e.type === 'biker')) this.spawnBiker(q);
      }
    }
    spawnDrone(q) {
      const g = this.g, p = g.player, m = this.drones.find(d => !this.enemies.some(e => e.m === d));
      if (!m) return;
      const e = { type: 'drone', m, lane: q.lane, x: q.lane * LW, y: 1.5, z: p.z - 32, gap: 32, phase: 'track', t: 0, relock: 0 };
      m.visible = true; m.userData.beam.visible = false;
      this.enemies.push(e);
      VR.Audio.play('buzz', { pan: (e.x - p.x) / 5 });
      if (!this.warnedDrone) { this.warnedDrone = true; UI.toast(UI.t('cbDroneWarn'), 1800, true); }
    }
    spawnBiker() {
      const g = this.g, p = g.player;
      const lanes = [-1, 0, 1].filter(l => l !== p.lane);
      const lane = lanes[(Math.random() * lanes.length) | 0];
      const e = { type: 'biker', m: this.biker, lane, x: lane * LW, y: 0, vy: 0, z: p.z + 20, phase: 'approach', t: 0, dust: 0, cutAt: 0 };
      this.biker.visible = true;
      this.enemies.push(e);
      if (this.warnEl) { this.warnEl.textContent = '🏍️ ⚠️'; this.warnEl.hidden = false; }
      VR.Audio.play('engine', { pan: (e.x - p.x) / 5 });
      if (!this.warnedBiker) { this.warnedBiker = true; UI.toast(UI.t('cbBikerWarn'), 1600, true); }
    }
    laneBlocked(lane, z0, z1) {
      for (const o of this.g.world.obstacles) {
        if (o.lane !== lane || o.ramp) continue;
        if (o.kind === 'block' && o.z - o.len < z0 && o.z > z1) return true;
      }
      return false;
    }
    updateEnemies(dt) {
      const g = this.g, p = g.player, magnet = g.powerups.active('magnet');
      for (const e of this.enemies) {
        e.t += dt;
        const U = e.m.userData;
        if (e.down) {
          e.dt += dt; e.vy -= 22 * dt; e.y = Math.max(0, e.y + e.vy * dt);
          if (e.type === 'biker') e.z -= (g.speed - 6) * dt;
          e.m.rotation.z += e.spin * dt; e.m.rotation.x += e.spin * 0.4 * dt;
          if (Math.random() < dt * 20) g.fx.dust(e.x, e.y + 0.3, e.z, 1, 0x555555, 0.8);
          e.m.position.set(e.x, e.y, e.z);
          if (e.dt > 1.4 || e.z - p.z > 10) this.remove(e);
          continue;
        }
        // a magnet yanks drones out of the sky (they are all metal and electronics)
        if (magnet && e.type === 'drone' && Math.abs(p.z - e.z) < 20) {
          g.fx.sparkle(e.x, e.y, e.z, 0xff5a4f, 14, 4); this.knock(e, false, UI.t('cbMagnet')); continue;
        }
        if (e.type === 'drone') this.updateDrone(e, dt, U);
        else this.updateBiker(e, dt, U);
      }
      this.enemies = this.enemies.filter(e => !e.gone);
    }
    updateDrone(e, dt, U) {
      const g = this.g, p = g.player;
      for (const r of U.rotors) r.rotation.y += dt * 45;
      if (e.phase === 'track') {
        e.gap += (15 - e.gap) * Math.min(1, dt * 1.5);
        e.relock -= dt;
        if (e.relock <= 0) { e.lane = p.lane; e.relock = 0.9; }
        if (e.t > 2.3) { e.phase = 'lock'; e.t = 0; U.beam.visible = true; VR.Audio.play('tick'); e.ring = this.rings.find(r => !r.visible) || null; if (e.ring) e.ring.visible = true; }
        e.z = p.z - e.gap;
      } else if (e.phase === 'lock') {
        e.z = p.z - e.gap;
        U.beam.material.opacity = 0.18 + (Math.sin(e.t * 30) > 0 ? 0.2 : 0);
        if (e.t > 0.65) { e.phase = 'dive'; e.t = 0; VR.Audio.play('buzz'); }
      } else {
        e.z += 16 * dt;
        U.beam.visible = false;
        const gap = p.z - e.z;
        if (!e.passed && gap < 0.5) {
          e.passed = true;
          const top = p.y + p.height, hit = Math.abs(p.x - e.x) < 0.95 && top > e.y - 0.3 && p.y < e.y + 0.35;
          if (hit) this.hurt(e);
          else { g.score += 100 * g.multiplier; UI.toast(UI.t('cbDodge') + ' +100', 700); VR.Audio.play('closeCall'); }
        }
        if (gap < -12) { this.remove(e); return; }
        if (e.ring && gap < 1) { e.ring.visible = false; e.ring = null; }
      }
      const tx = e.lane * LW;
      e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), dt * 6);
      const ground = g.world.surfaceAt(e.x, e.z, 99, 0.3).h;
      const ty = Math.max(1.5, ground + 1.5) + Math.sin(e.t * 4) * 0.08;
      if (e.ring) { const pz = p.z - 2.5; e.ring.position.set(e.lane * LW, g.world.surfaceAt(e.lane * LW, pz, 99, 0.3).h + 0.06, pz); const k = 0.9 + Math.sin(e.t * 20) * 0.1; e.ring.scale.set(k, k, k); e.ring.material.opacity = 0.85; }
      e.y += (ty - e.y) * Math.min(1, dt * 4);
      U.body.rotation.z = (tx - e.x) * -0.2; U.body.rotation.x = e.phase === 'dive' ? 0.3 : 0;
      e.m.rotation.set(0, 0, 0);
      e.m.position.set(e.x, e.y, e.z);
    }
    updateBiker(e, dt, U) {
      const g = this.g, p = g.player;
      let v = g.speed;
      if (e.phase === 'approach') {
        v = g.speed + 8;
        // coming up behind you through your lemonade: down it goes
        if (this.trail.some(t => Math.abs(t.x - e.x) < LW * 1.15 && Math.abs(t.z - e.z) < 1.6)) { this.knock(e, false, UI.t('cbTrail')); return; }
        if (p.z - e.z > 9) { e.phase = 'cut'; e.t = 0; if (this.warnEl) this.warnEl.hidden = true; }
        if (this.laneBlocked(e.lane, e.z - 2, e.z - 16)) { const o = [-1, 0, 1].filter(l => Math.abs(l - e.lane) === 1 && !this.laneBlocked(l, e.z + 2, e.z - 16)); if (o.length) e.lane = o[0]; }
      } else if (e.phase === 'cut') {
        v = g.speed + 2;
        if (e.t > 0.15 && !e.cutAt) { e.cutAt = 1; if (!this.laneBlocked(p.lane, e.z + 2, e.z - 14)) e.lane = p.lane; VR.Audio.play('engine', { pan: (e.x - p.x) / 5 }); }
        if (e.t > 0.9) { e.phase = 'block'; e.t = 0; }
      } else if (e.phase === 'block') {
        v = Math.max(4, g.speed - 5.5);
        if (e.t > 1.6 && !e.retarget) { e.retarget = 1; if (!this.laneBlocked(p.lane, e.z + 2, e.z - 12)) e.lane = p.lane; }
        if (e.t > 6) e.phase = 'leave';
        if (this.laneBlocked(e.lane, e.z - 1, e.z - 8)) { const o = [-1, 0, 1].filter(l => Math.abs(l - e.lane) === 1 && !this.laneBlocked(l, e.z + 2, e.z - 10)); if (o.length) e.lane = o[(Math.random() * o.length) | 0]; }
      } else v = g.speed + 10;
      e.z -= v * dt;
      if (e.phase === 'leave' && p.z - e.z > 70) { this.remove(e); return; }
      if (e.phase !== 'approach' && e.z - p.z > 14) { this.remove(e); return; }
      const tx = e.lane * LW;
      e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), dt * 7);
      const ground = g.world.surfaceAt(e.x, e.z, e.y + 0.5, 0.3).h;
      let low = false;
      for (const o of g.world.obstacles) if (!o.ramp && o.lane === e.lane && o.kind !== 'block' && o.z > e.z - 2 && o.z - o.len < e.z + 0.3) low = true;
      if ((low || ground > e.y + 0.3) && e.y <= ground + 0.02) e.vy = low ? 7 : 9;
      e.vy -= 30 * dt; e.y += e.vy * dt; if (e.y < ground) { e.y = ground; e.vy = 0; }
      U.body.rotation.z = (tx - e.x) * 0.18; U.body.rotation.x = e.vy > 0.5 ? -0.15 : 0;
      e.m.rotation.set(0, 0, 0);
      e.m.position.set(e.x, e.y, e.z);
      e.dust -= dt; if (e.dust <= 0) { e.dust = 0.07; g.fx.dust(e.x, e.y + 0.3, e.z + 0.8, 1, 0x9a9a9a, 0.6); }
      const dz = e.z - p.z;
      if (Math.abs(dz) < 1.0 && Math.abs(e.x - p.x) < 0.9) {
        if (p.y > e.y + 0.8 && p.vy < 0) {             // landed on him: stomp, and his scooter is yours
          this.knock(e, false, UI.t('cbSteal')); p.vy = 11; p.grounded = false;
          VR.Audio.play('boing');
          if (!p.flying && !(g.S.vehicles && g.S.vehicles.kind)) g.onPowerUp('bike', p.x, p.y, p.z);
        } else if (p.y < e.y + 1.4) this.hurt(e);
      }
    }

    updateShots(dt) {
      const g = this.g, p = g.player;
      for (const s of this.projectiles) {
        const z0 = s.z, tg = s.tg;
        s.t += dt;
        if (tg.kind === 'friend') {                       // lob towards where he was
          const f = this.friendPos(), k = Math.min(1, s.t / s.T);
          const zT = f ? f.z : s.z0 - 20;
          s.x = s.x0 + (s.fx - s.x0) * k; s.z = s.z0 + (zT - s.z0) * k; s.y = 1.25 + p.y * 0.5 + Math.sin(k * Math.PI) * 2.2;
          s.m.position.set(s.x, s.y, s.z); s.m.rotation.x += dt * 16;
          if (k >= 1) { s.dead = true; s.m.visible = false; g.fx.sparkle(s.x, s.y, s.z, 0xffe14a, 12, 3); }
          continue;
        }
        s.z -= (g.speed + 48) * dt;
        let tx = s.x, ty = s.y;
        const B = this.bossS;
        if (tg.kind === 'boss' && B && B.hp > 0) { tx = B.x; ty = B.y; }
        else if (tg.kind === 'thief') { const th = g.S.thief; if (th && th.active) { tx = th.x; ty = th.y + 0.3; } }
        else if (tg.kind === 'enemy' && !tg.e.down && !tg.e.gone) { tx = tg.e.x; ty = tg.e.y + (tg.e.type === 'biker' ? 1.1 : 0); }
        const k = Math.min(1, dt * 12);
        s.x += (tx - s.x) * k; s.y += (ty - s.y) * k;
        s.m.position.set(s.x, s.y, s.z); s.m.rotation.x += dt * 20;
        if (Math.random() < dt * 40) g.fx.sparkle(s.x, s.y, s.z + 0.2, 0xffe14a, 1, 0.6, 0);
        let hit = false;
        for (const e of this.enemies) {
          if (e.down || Math.abs(e.x - s.x) > 1.1) continue;
          const ey = e.type === 'biker' ? e.y + 1.1 : e.y;
          if (Math.abs(ey - s.y) < 1.2 && z0 >= e.z - 0.6 && s.z <= e.z + 0.6) { this.knock(e); hit = true; break; }
        }
        const th = g.S.thief;
        if (!hit && th && th.active && th.skin === 'drone' && !th.escaping && !th.ally) {
          const tz = p.z - Math.max(0.6, th.gap);
          if (Math.abs(th.x - s.x) < 1.2 && z0 >= tz - 0.6 && s.z <= tz + 0.6) { th.catch(tz); hit = true; }
        }
        if (!hit && B && B.hp > 0 && B.in && Math.abs(B.x - s.x) < 2.8 && z0 >= B.z - 1.5 && s.z <= B.z + 1.5) { this.hitBoss(1, true); hit = true; }
        if (!hit) for (const o of g.world.obstacles) {       // a train in the way takes the lemon
          if (o.kind !== 'block' || Math.abs(o.x - s.x) > 1.0 || s.y > VR.TRAIN_HEIGHT + 0.2) continue;
          if (z0 >= o.z - o.len - 0.3 && s.z <= o.z + 0.3) { hit = true; VR.Audio.play('splat', { pan: (s.x - p.x) / 5 }); break; }
        }
        if (hit) { g.fx.sparkle(s.x, s.y, s.z, 0xffe14a, 14, 4); VR.Audio.play('hit', { pan: (s.x - p.x) / 5 }); }
        if (hit || p.z - s.z > 75) { s.m.visible = false; s.dead = true; }
      }
      this.projectiles = this.projectiles.filter(s => !s.dead);
    }

    // ------------------------------------------------------------ Mishmish's bell (a power-up): he charges ahead and clears your lane
    whistle() {
      const g = this.g, p = g.player;
      this.goatRun = { x: p.x + (p.lane === 1 ? -1.2 : 1.2), y: 0, vy: 0, z: p.z + 2, gap: -2, ph: 0, leave: 0 };
      this.goat.visible = true;
      VR.Audio.play('whistle'); setTimeout(() => VR.Audio.play('baa'), 250);
    }
    updateGoat(dt) {
      const R = this.goatRun; if (!R) return;
      const g = this.g, p = g.player, U = this.goat.userData;
      const on = g.powerups.active('goat');
      R.ph += dt * (10 + g.speed * 0.25);
      let tx = p.lane * LW;
      R.gap += (6.5 - R.gap) * Math.min(1, dt * 3);
      if (!on) { R.leave += dt; tx = (p.lane <= 0 ? 1 : -1) * LW * 2.2; R.gap += dt * 12; }
      R.z = p.z - R.gap;
      R.x += (tx - R.x) * Math.min(1, dt * 6);
      const lane = Math.round(R.x / LW);
      if (on) for (const o of [...g.world.obstacles]) {
        if (o.lane !== lane || o.ramp || (o.kind === 'block' && o.standable)) continue;
        if (o.z > R.z - 2.2 && o.z - o.len < R.z + 0.5) { g.fx.smash(o.x, 0.5, o.z, 0xd8d2c6); g.world.smash(o); VR.Audio.play('shieldBreak', { pan: (o.x - p.x) / 5 }); g.shake = Math.max(g.shake, 0.1); }
      }
      for (const e of this.enemies) if (!e.down && Math.abs(e.z - R.z) < 1.8 && Math.abs(e.x - R.x) < 1.3) this.knock(e);
      g.collect.grabNear(R.x, R.y + 0.9, R.z, 1.5, g);
      const ground = g.world.surfaceAt(R.x, R.z, 99, 0.3).h;
      if (ground > R.y + 0.3 && R.vy <= 0) R.vy = 9;
      R.vy -= 30 * dt; R.y += R.vy * dt; if (R.y < ground) { R.y = ground; R.vy = 0; }
      if (U.legs) {
        const s = Math.sin(R.ph);
        U.legs[0].rotation.x = U.legs[3].rotation.x = s * 0.9; U.legs[1].rotation.x = U.legs[2].rotation.x = -s * 0.9;
        U.body.position.y = Math.abs(Math.sin(R.ph * 2)) * 0.06; U.head.rotation.x = -0.25;
      }
      this.goat.position.set(R.x, R.y, R.z); this.goat.rotation.y = (tx - R.x) * -0.1;
      if (Math.random() < dt * 14) g.fx.dust(R.x, R.y, R.z + 0.4, 1, 0xcbb89a, 0.7);
      if (R.leave > 1.2) { this.goatRun = null; this.goat.visible = false; }
    }

    // ------------------------------------------------------------ boss: dodge its juice bombs, pick up the lemon each one leaves, throw it back
    updateBoss(dt) {
      const g = this.g, p = g.player;
      if (!this.bossS) {
        if (this.bossOn && g.distance >= this.nextBossAt && !p.flying && g.tunnelDark < 0.2) this.startBoss();
        return;
      }
      const B = this.bossS, U = this.boss.userData;
      B.t += dt;
      if (!this.boss.visible) { this.boss.visible = true; this.bossBar.hidden = false; }
      for (const r of U.rotors) r.rotation.y += dt * 30;
      if (B.hp > 0 && !B.leaving) {
        B.gap += (16 - B.gap) * Math.min(1, dt * (B.in ? 2 : 1.2));
        if (!B.in && B.t > 1.6) { B.in = true; if (this.pendingHits) { const n = this.pendingHits; this.pendingHits = 0; this.hitBoss(n, false); } }
        B.x = Math.sin(B.t * 0.6) * LW * 0.95; B.y = 5.8 + Math.sin(B.t * 1.7) * 0.25 + (B.in ? 0 : (1.6 - B.t) * 3);
        B.next -= dt;
        if (B.in && B.next <= 0) {
          const frac = B.hp / B.max;
          B.next = 1.3 + 0.9 * frac;
          const lane = Math.random() < 0.7 ? p.lane : [-1, 0, 1][(Math.random() * 3) | 0];
          this.dropBomb(lane);
          if (frac < 0.45 && Math.random() < 0.5) this.dropBomb([-1, 0, 1].filter(l => l !== lane)[(Math.random() * 2) | 0]);
        }
        if (B.t > 60) { B.leaving = true; UI.toast(UI.t('cbBossAway'), 1500); }
      } else {
        B.gap += dt * 25; B.y += dt * 4;
        if (B.gap > 90) { this.endBoss(); return; }
      }
      B.z = p.z - B.gap;
      this.boss.position.set(B.x, B.y, B.z);
      U.body.rotation.z = Math.cos(B.t * 0.6) * -0.15; U.body.rotation.x = 0.12;
      if (B.flash > 0) { B.flash -= dt; U.body.position.y = (Math.random() - 0.5) * 0.15; } else U.body.position.y = 0;
      this.bossBar.querySelector('b').style.width = (100 * Math.max(0, B.hp) / B.max).toFixed(1) + '%';
      for (const b of this.bombs) {
        b.t += dt;
        const k = Math.min(1, b.t / b.T);
        b.m.position.set(b.sx + (b.x - b.sx) * k, b.sy + (b.gy + 0.05 - b.sy) * k + Math.sin(k * Math.PI) * 1.2, b.sz + (b.z - b.sz) * k);
        b.m.rotation.x += dt * 6;
        b.ring.position.set(b.x, b.gy + 0.05, b.z);
        const pulse = 1 + Math.sin(b.t * 18) * 0.08;
        b.ring.scale.set(pulse, pulse, pulse); b.ring.material.opacity = 0.45 + k * 0.5;
        if (k >= 1) {
          b.done = true; b.m.visible = false; b.ring.visible = false;
          g.fx.smash(b.x, b.gy + 0.2, b.z, 0xffc21a); g.fx.ring(b.x, b.gy + 0.3, b.z, 0xffc21a, 22, 6);
          VR.Audio.play('splat', { pan: (b.x - p.x) / 5 });
          const inBlast = Math.abs(p.x - b.x) < 1.3 && Math.abs(p.z - b.z) < 1.9 && p.y < b.gy + 1.0;
          if (inBlast) this.hurt(null);
          // the bomb's lemon survives the splash: grab it and throw it back
          g.collect.spawnGem(b.x, b.gy + 1.0, b.z - 2.5, null);
        }
      }
      this.bombs = this.bombs.filter(b => !b.done);
    }
    startBoss() {
      const g = this.g, max = this.coop ? 16 : 10;
      this.bossS = { hp: max, max, t: 0, gap: -6, x: 0, y: 8, z: g.player.z + 6, next: 2.2, in: false, flash: 0 };
      for (const e of this.enemies) this.remove(e); this.enemies = []; this.planned = [];
      this.boss.visible = true;
      this.bossBar.hidden = false; this.bossBar.querySelector('span').textContent = '🛸 ' + UI.t('cbBossName');
      VR.Audio.play('thunder'); VR.Audio.play('buzz'); g.shake = 0.4;
      UI.toast(UI.t('cbBossIn'), 1800, true);
      setTimeout(() => { if (g.state === 'playing') UI.toast(UI.t(this.coop ? 'cbBossCoop' : 'cbBossTip'), 1600, true); }, 1900);
    }
    dropBomb(lane) {
      const g = this.g, p = g.player, B = this.bossS;
      const m = this.bombMeshes.find(x => !x.visible), ring = this.rings.find(x => !x.visible);
      if (!m || !ring) return;
      const T0 = 1.15, z = p.z - g.speed * T0 - 0.5, x = lane * LW;
      const gy = g.world.surfaceAt(x, z, 99, 0.3).h;
      m.visible = true; ring.visible = true;
      this.bombs.push({ m, ring, x, z, gy, sx: B.x, sy: B.y - 0.5, sz: B.z, t: 0, T: T0 });
      VR.Audio.play('whoosh', { pan: (x - p.x) / 5 });
    }
    hitBoss(n, mine) {
      const g = this.g, B = this.bossS; if (!B || B.hp <= 0) return;
      B.hp -= n; B.flash = 0.2;
      g.fx.sparkle(B.x, B.y, B.z + 1.6, 0xffe14a, 16, 5); VR.Audio.play('hit');
      if (mine) { g.score += 60 * n * g.multiplier; if (this.coop) this.send({ k: 'bh', n }); }
      if (B.hp <= 0) { if (mine && this.coop) this.send({ k: 'bd' }); this.bossDefeated(); }
    }
    bossDefeated() {
      const g = this.g, p = g.player, B = this.bossS;
      B.leaving = true; B.hp = 0;
      for (let i = 0; i < 4; i++) setTimeout(() => { if (g.state === 'playing') { g.fx.smash(B.x + (Math.random() - 0.5) * 2, B.y, B.z, [0x1d2029, 0xf2b705][i % 2]); VR.Audio.play('boom'); } }, i * 160);
      g.fx.confetti(p.x, p.y + 3, p.z - 6, 120);
      for (const l of [-1, 0, 1]) for (let i = 0; i < 14; i++) g.collect.spawnCoin(l * LW, 1.0, p.z - 10 - i * 1.6, null);
      g.coins += 100; g.score += 3000 * g.multiplier;
      g.fxFlash = 0.6; VR.Audio.play('fanfare'); g.vibrate([40, 40, 80]);
      UI.toast(UI.t('cbBossDown') + ' +100', 2200, true);
      g.missions.bump('bosses');
      for (const b of this.bombs) { b.m.visible = false; b.ring.visible = false; } this.bombs = [];
    }
    endBoss() {
      this.bossS = null; this.boss.visible = false; this.bossBar.hidden = true;
      this.nextBossAt = this.g.distance + 2600;
    }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Combat);
})();

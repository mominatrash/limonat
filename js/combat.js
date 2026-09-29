/* =====================================================================
 * COMBAT — item boxes, Zahran's enemies, the mega-drone boss and party
 * mischief.
 *
 *  ITEM BOX 🎁 (a pickup on the tracks) rolls ONE item into your slot.
 *  Use it with the round button (bottom corner), a tap on the screen, or E / F / Enter:
 *    sling   🍋  lemon slingshot, 6 shots: knocks enemies, breaks barriers
 *    slick   🥤  lemonade spill behind you: chasers (bulldozer, bikers) slip
 *    whistle 🐐  Mishmish charges ahead in your lane for 7 s, clearing it
 *    pulse   🧲  shock-wave: every enemy nearby drops, coins fly to you
 *    dash    ⚡  1.6 s unstoppable dash that rams through everything
 *  Party race only (sent to the friend's phone):
 *    bomb    💦  juice splatters over the friend's screen
 *    peel    🍌  a banana peel dropped where you are: the friend slips on it
 *    swap    🔄  (when behind) swap places with the friend
 *    reflect 🪞  mirror: the next attack bounces back to the sender
 *
 *  ENEMIES (seeded per chunk, so both party phones meet the same ones):
 *    drone   hovers ahead, locks onto your lane (red beam) and dives: dodge or shoot
 *    biker   comes up from behind, cuts into your lane and brakes: dodge, stomp or shoot
 *  BOSS: Zahran's mega-drone (endless / daily / co-op) drops juice bombs on
 *  marked lanes; free lemon ammo while it's up. Co-op: both of you hit the same HP.
 * ===================================================================== */
(function () {
  const T = THREE, C = VR.CONFIG, UI = VR.UI, LW = C.LANE_WIDTH;

  const ITEMS = {
    sling:   { e: '🍋', n: 6, ar: 'مقلاع الليمون', en: 'Lemon slingshot' },
    slick:   { e: '🥤', n: 1, ar: 'بقعة ليموناضة', en: 'Lemonade slick' },
    whistle: { e: '🐐', n: 1, ar: 'صفّارة مشمش', en: 'Mishmish whistle' },
    pulse:   { e: '🧲', n: 1, ar: 'نبضة مغناطيس', en: 'Magnet pulse' },
    dash:    { e: '⚡', n: 1, ar: 'اندفاعة', en: 'Dash strike' },
    bomb:    { e: '💦', n: 1, ar: 'قنبلة عصير', en: 'Juice bomb', pvp: 1 },
    peel:    { e: '🍌', n: 1, ar: 'قشرة موز', en: 'Banana peel', pvp: 1 },
    swap:    { e: '🔄', n: 1, ar: 'تبديل', en: 'Swap', pvp: 1 },
    reflect: { e: '🪞', n: 1, ar: 'مراية', en: 'Mirror', pvp: 1 },
  };
  VR.COMBAT_ITEMS = ITEMS;

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
  function buildPeel() {
    const g = new T.Group(), mb = new VR.MB(76);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.4;
      mb.box('gloss', 0xffd84a, Math.sin(a) * 0.22, 0.05, Math.cos(a) * 0.22, 0.16, 0.04, 0.42, { ry: a, rx: -0.25, r: 0.02 });
    }
    mb.sphere('gloss', 0xf2c21a, 0, 0.1, 0, 0.12, { sy: 0.8, seg: 10 });
    mb.cyl('flat', 0x5a3a1e, 0, 0.22, 0, 0.03, 0.04, 0.1, { seg: 6 });
    g.add(mb.build({ receive: false }));
    g.scale.setScalar(1.5); g.visible = false;
    return g;
  }
  const ringGeo = new T.RingGeometry(0.9, 1.25, 32);

  // ------------------------------------------------------------ system
  class Combat {
    constructor(game) {
      this.name = 'combat'; this.g = game;
      const S = game.scene;
      this.drones = [buildHornet(), buildHornet()];
      this.biker = buildBiker();
      this.boss = buildBoss();
      this.shots = Array.from({ length: 10 }, buildLemonShot);
      this.bombMeshes = Array.from({ length: 5 }, buildJuiceBomb);
      this.rings = Array.from({ length: 5 }, () => {
        const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: new T.Color(2.4, 0.3, 0.2), transparent: true, opacity: 0.8, depthWrite: false, fog: false, side: T.DoubleSide }));
        m.rotation.x = -Math.PI / 2; m.visible = false; return m;
      });
      this.peels = [buildPeel(), buildPeel(), buildPeel()];
      const slickMat = new T.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.55, depthWrite: false });
      this.slickMesh = new T.Mesh(new T.CircleGeometry(1, 32), slickMat);
      this.slickMesh.rotation.x = -Math.PI / 2; this.slickMesh.scale.set(VR.HALF_TRACK, 2.2, 1); this.slickMesh.visible = false;
      this.aura = new T.Group();
      for (let i = 0; i < 2; i++) {
        const t = new T.Mesh(new T.TorusGeometry(0.85, 0.035, 8, 40), new T.MeshBasicMaterial({ color: new T.Color(0.4, 2.2, 2.6), transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
        t.rotation.x = Math.PI / 2 + i * 0.9; this.aura.add(t);
      }
      this.aura.visible = false;
      this.goat = VR.buildGoat ? VR.buildGoat() : new T.Group();
      if (this.goat.userData.mk) this.goat.userData.mk.visible = false;
      this.goat.visible = false;
      S.add(...this.drones, this.biker, this.boss, ...this.shots, ...this.bombMeshes, ...this.rings, ...this.peels, this.slickMesh, this.aura, this.goat);
      this.item = null;
      this.clearAll();
      UI.addStrings({
        cbBox: 'صندوق مفاجآت', cbTip: 'اضغط الزر 👇 عشان تستخدمه', cbUse: 'استخدم',
        cbDroneWarn: '🎯 درون! بدّل خطك أو اضربه', cbBikerWarn: '🏍️ موتوسيكل وراك!', cbDodge: 'تفادي!',
        cbKnockDrone: 'وقّعت الدرون!', cbKnockBiker: 'وقّعت الموتوسيكل!', cbStomp: 'دعسة! 🦶',
        cbBossIn: 'الدرون الكبير وصل! 🛸', cbBossName: 'درون زهران الكبير', cbBossDown: 'هزمت الدرون الكبير!', cbBossAway: 'الدرون الكبير هرب…', cbBossCoop: 'اضربوه مع بعض! 🤝', cbAmmo: 'ذخيرة ليمون مجانية!',
        cbSlickDozer: 'الجرّافة تزحلقت! 🥤', cbSlipped: 'تزحلقت! 🍌',
        cbBombHit: '💦 {n} رشّك!', cbBombBack: '🪞 رجّعتله القنبلة!', cbBombBounced: '💦 قنبلتك رجعتلك!', cbBombThrow: '💦 رميت قنبلة!',
        cbPeelDrop: '🍌 رميت قشرة موز', cbPeelBlocked: '🪞 المراية كسرت القشرة',
        cbSwapDone: '🔄 بدّلت مع {n}!', cbSwapGot: '🔄 {n} بدّل معك!', cbSwapNo: '🪞 {n} صدّ التبديل',
        cbReflectOn: '🪞 المراية شغّالة', cbReflectUsed: '🪞 المراية صدّت!',
        cbGoat: 'مشمش جاي! 🐐', cbPulse: 'نبضة! 🧲', cbDash: 'اندفاعة! ⚡',
      }, {
        cbBox: 'Mystery box', cbTip: 'Tap the button 👇 to use it', cbUse: 'Use',
        cbDroneWarn: '🎯 Drone! Dodge or sling it', cbBikerWarn: '🏍️ Biker behind you!', cbDodge: 'Dodged!',
        cbKnockDrone: 'Drone down!', cbKnockBiker: 'Biker down!', cbStomp: 'Stomp! 🦶',
        cbBossIn: 'The mega-drone is here! 🛸', cbBossName: 'Zahran’s mega-drone', cbBossDown: 'Mega-drone defeated! 🎉', cbBossAway: 'The mega-drone got away…', cbBossCoop: 'Hit it together! 🤝', cbAmmo: 'Free lemon ammo!',
        cbSlickDozer: 'The bulldozer slipped! 🥤', cbSlipped: 'Slipped! 🍌',
        cbBombHit: '💦 {n} splashed you!', cbBombBack: '🪞 Bounced the bomb back!', cbBombBounced: '💦 Your bomb came back!', cbBombThrow: '💦 Juice bomb away!',
        cbPeelDrop: '🍌 Dropped a banana peel', cbPeelBlocked: '🪞 The mirror broke the peel',
        cbSwapDone: '🔄 Swapped with {n}!', cbSwapGot: '🔄 {n} swapped with you!', cbSwapNo: '🪞 {n} blocked the swap',
        cbReflectOn: '🪞 Mirror on', cbReflectUsed: '🪞 Blocked!',
        cbGoat: 'Go Mishmish! 🐐', cbPulse: 'Pulse! 🧲', cbDash: 'Dash! ⚡',
      });
      window.addEventListener('keydown', (e) => {
        const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
        if ((e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'Enter') && this.g.state === 'playing') { e.preventDefault(); this.use(); }
      });
    }

    bind() {
      const hud = document.getElementById('hud') || document.body;
      const add = (html, parent) => { const d = document.createElement('div'); d.innerHTML = html; const el = d.firstElementChild; parent.appendChild(el); return el; };
      this.btn = add(`<button id="cbBtn" class="cb-btn" hidden aria-label="Item"><span class="cb-ic"></span><b class="cb-n"></b></button>`, hud);
      this.warnEl = add(`<div id="cbWarn" class="cb-warn" hidden>🏍️ ⚠️</div>`, hud);
      this.bossBar = add(`<div id="cbBoss" class="cb-boss" hidden><span></span><i><b></b></i></div>`, hud);
      this.splat = add(`<div id="cbSplat" class="cb-splat" hidden>${Array.from({ length: 7 }, () => '<i></i>').join('')}</div>`, document.body);
      const st = document.createElement('style');
      st.textContent = `
        .cb-btn{position:fixed;right:calc(14px + var(--safe-r, 0px));bottom:calc(22px + var(--safe-b, 0px));width:78px;height:78px;border-radius:50%;border:3px solid #ffd23f;
          background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.28),rgba(16,20,34,.82) 60%);box-shadow:0 6px 18px rgba(0,0,0,.35),0 0 0 4px rgba(255,210,63,.18);pointer-events:auto;
          display:grid;place-items:center;cursor:pointer;touch-action:none;z-index:6;padding:0;-webkit-tap-highlight-color:transparent}
        .cb-btn[hidden]{display:none}.cb-btn .cb-ic{font-size:38px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}
        .cb-btn .cb-n{position:absolute;top:-4px;left:-4px;min-width:26px;height:26px;border-radius:13px;background:#e8433a;color:#fff;font:800 15px/26px system-ui,sans-serif;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.4)}
        .cb-btn .cb-n:empty{display:none}.cb-btn.new{animation:cbNew .6s cubic-bezier(.2,.9,.3,1.5)}.cb-btn.pvp{border-color:#ff6fd8}.cb-btn:active{transform:scale(.92)}
        @keyframes cbNew{from{transform:scale(0) rotate(-90deg)}}
        .cb-warn{position:fixed;left:50%;bottom:calc(26px + var(--safe-b, 0px));transform:translateX(-50%);font-size:26px;padding:4px 14px;border-radius:99px;background:rgba(232,67,58,.85);color:#fff;pointer-events:none;animation:cbBlink .5s steps(2) infinite}
        .cb-warn[hidden]{display:none}@keyframes cbBlink{50%{opacity:.35}}
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
          linear-gradient(var(--j),var(--j)) 49% 60%/7% 40% no-repeat}
`;
      document.head.appendChild(st);
      const fire = (e) => { e.preventDefault(); e.stopPropagation(); this.use(); };
      this.btn.addEventListener('touchstart', fire, { passive: false });
      this.btn.addEventListener('mousedown', fire);
      // a quick tap on the game (not a swipe) also uses the item
      const el = document.getElementById('game');
      let t0 = 0, x0 = 0, y0 = 0;
      const down = (x, y) => { t0 = performance.now(); x0 = x; y0 = y; };
      const up = (x, y) => { if (performance.now() - t0 < 260 && Math.hypot(x - x0, y - y0) < 14 && this.g.state === 'playing') this.use(); };
      if (el) {
        el.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; down(t.clientX, t.clientY); }, { passive: true });
        el.addEventListener('touchend', (e) => { const t = e.changedTouches[0]; up(t.clientX, t.clientY); });
        el.addEventListener('mousedown', (e) => down(e.clientX, e.clientY));
        el.addEventListener('mouseup', (e) => up(e.clientX, e.clientY));
      }
    }

    warm(on) { for (const m of [...this.drones, this.biker, this.boss, this.shots[0], this.bombMeshes[0], this.peels[0], this.goat]) m.visible = on; }
    clearAll() {
      this.enemies = []; this.planned = []; this.projectiles = []; this.bombs = []; this.peelList = [];
      this.slick = null; this.goatRun = null; this.reflectT = 0; this.slipT = 0; this.cool = 0;
      this.bossS = null; this.pendingHits = 0; this.swapWait = 0;
      if (this.splat) { this.splat.hidden = true; this.splatLeft = 0; }
      for (const m of [...this.drones, this.biker, this.boss, ...this.shots, ...this.bombMeshes, ...this.rings, ...this.peels, this.slickMesh, this.aura, this.goat]) if (m) m.visible = false;
      if (this.warnEl) this.warnEl.hidden = true;
      if (this.bossBar) this.bossBar.hidden = true;
    }
    reset() { this.clearAll(); this.setItem(null); }

    // ------------------------------------------------------------ run lifecycle
    runStart(opts) {
      this.clearAll(); this.setItem(null);
      const g = this.g, mode = opts.mode || 'endless';
      this.seed = opts.seed != null ? opts.seed : (Math.random() * 1e9) | 0;
      const P = g.S.party, coop = mode === 'party' && opts.party === 'coop';
      this.race = mode === 'party' && !coop;
      this.coop = coop;
      this.boxesOn = true;
      const lvl = mode === 'story' && VR.STORY ? VR.STORY.find(l => l.id === opts.level) : null;
      this.enemiesOn = mode !== 'story' || (lvl && lvl.id >= 5);
      this.enemyRate = mode === 'story' ? 0.45 : 1;
      this.bossOn = mode === 'endless' || mode === 'daily' || coop;
      this.nextBossAt = coop ? 900 : 1100;
      this.tipShown = UI.store.get('cbTip', false);
      this.warnedDrone = this.warnedBiker = false;
    }
    leaveRun() { this.clearAll(); this.setItem(null); }
    runEnd() { if (this.warnEl) this.warnEl.hidden = true; }
    state(s) {
      if (s === 'partyWait' || s === 'menu') { const it = this.item, B = this.bossS; this.clearAll(); if (s === 'menu') this.setItem(null); else { this.item = it; this.bossS = B; } }
      if (this.btn) this.btn.hidden = !(this.item && (s === 'playing' || s === 'paused' || s === 'resuming')); if (s !== 'playing' && this.warnEl) this.warnEl.hidden = true; }
    shift(dz) {
      for (const e of this.enemies) e.z += dz;
      for (const e of this.planned) e.z += dz;
      for (const s of this.projectiles) { s.z += dz; s.m.position.z = s.z; }
      for (const b of this.bombs) { b.z += dz; b.sz += dz; }
      for (const p of this.peelList) { p.z += dz; p.m.position.z = p.z; }
      if (this.slick) { this.slick.z += dz; this.slickMesh.position.z = this.slick.z; }
      if (this.goatRun) this.goatRun.z += dz;
    }

    // ------------------------------------------------------------ world content (seeded per chunk)
    chunk(chunk, plan) {
      const g = this.g;
      if (!g.runOpts || g.state === 'menu') return;
      const rnd = VR.rng(((this.seed | 0) * 977 + chunk.id * 131 + 7) >>> 0);
      const r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd(), r5 = rnd();
      if (!plan || chunk.id < 4 || plan.patternName === 'safe') return;
      // item box: takes the place of one of the chunk's coins (always on a reachable line)
      if (this.boxesOn && r1 < 0.3 && plan.coins.length > 5) {
        const c = plan.coins[2 + ((r2 * (plan.coins.length - 4)) | 0)];
        const x = c.x * LW, z = chunk.z0 - c.z;
        g.collect.removeCoinAt(x, c.y, z);
        g.collect.spawnPowerUp('box', x, Math.max(1.0, c.y), z, chunk.id);
        this.boxesSpawned = (this.boxesSpawned || 0) + 1;
      }
      if (this.enemiesOn && chunk.id >= 9) {
        const diff = g.difficultyAt(g.distance + (g.player.z - chunk.z0));
        if (r3 < (0.16 + diff * 0.2) * this.enemyRate) this.planned.push({ type: r4 < 0.56 ? 'drone' : 'biker', z: chunk.z0 - 10 - r5 * 20, lane: ((r5 * 3) | 0) - 1 });
      }
    }

    // ------------------------------------------------------------ pickups
    pickPowerUp(type, x, y, z) {
      if (type !== 'box') return false;
      const g = this.g;
      g.score += C.POWERUP_POINTS * g.multiplier;
      g.fx.sparkle(x, y, z, 0xff6fd8, 26, 6, -g.speed * 0.9);
      g.fx.ring(x, y, z, 0xff6fd8, 18, 5);
      g.fxFlash = 0.3; VR.Audio.play('powerup'); g.vibrate(20);
      if (this.bossS) { this.giveAmmo(6); return true; }
      const id = this.roll();
      this.setItem(id, ITEMS[id].n);
      const nm = UI.lang === 'ar' ? ITEMS[id].ar : ITEMS[id].en;
      UI.toast(`${ITEMS[id].e} ${nm}${ITEMS[id].n > 1 ? ' ×' + ITEMS[id].n : ''}`, 1200, true);
      if (!this.tipShown) { this.tipShown = true; UI.store.set('cbTip', true); setTimeout(() => { if (g.state === 'playing') UI.toast(UI.t('cbTip'), 1800, true); }, 1300); }
      return true;
    }
    friend() {
      const P = this.g.S.party;
      if (!P || !P.inRun || !P.fr || P.fDead || P.frGone) return null;
      return { d: P.dS != null ? P.dS : P.fDist, name: P.frName || '' };
    }
    chaser() {
      const d = this.g.S.story && this.g.S.story.active && this.g.S.story.dz;
      return (d && d.on && !d.caught) || this.enemies.some(e => e.type === 'biker' && !e.down && e.phase === 'approach');
    }
    roll() {
      const W = { sling: 3, whistle: 1.1, pulse: 1, dash: 1.1 };
      if (this.chaser()) W.slick = 2.6;
      const f = this.race && this.friend();
      if (f) {
        const lead = this.g.distance - f.d;
        W.bomb = 1.5; W.reflect = 0.9;
        if (lead > 5) W.peel = 1.5;
        if (lead < -30) W.swap = lead < -120 ? 2.4 : 1.2;
      }
      const tot = Object.values(W).reduce((a, b) => a + b, 0);
      let r = Math.random() * tot;
      for (const k in W) { r -= W[k]; if (r <= 0) return k; }
      return 'sling';
    }
    setItem(id, n) {
      this.item = id ? { id, n: n || 1 } : null;
      if (!this.btn) return;
      this.btn.hidden = !this.item || this.g.state !== 'playing';
      if (!this.item) return;
      this.btn.querySelector('.cb-ic').textContent = ITEMS[id].e;
      this.btn.querySelector('.cb-n').textContent = this.item.n > 1 ? this.item.n : '';
      this.btn.classList.toggle('pvp', !!ITEMS[id].pvp);
      this.btn.classList.remove('new'); void this.btn.offsetWidth; this.btn.classList.add('new');
    }
    giveAmmo(n) {
      const cur = this.item && this.item.id === 'sling' ? this.item.n : 0;
      if (!this.item || this.item.id === 'sling') { this.item = { id: 'sling', n: Math.min(9, cur + n) }; this.setItemQuiet(); }
    }
    setItemQuiet() {
      if (!this.btn || !this.item) return;
      this.btn.hidden = this.g.state !== 'playing';
      this.btn.querySelector('.cb-ic').textContent = ITEMS[this.item.id].e;
      this.btn.querySelector('.cb-n').textContent = this.item.n > 1 ? this.item.n : '';
      this.btn.classList.toggle('pvp', !!ITEMS[this.item.id].pvp);
    }

    // ------------------------------------------------------------ using items
    use() {
      const g = this.g;
      if (g.state !== 'playing' || !this.item || this.cool > 0) return;
      const it = this.item, id = it.id;
      let ok = true;
      switch (id) {
        case 'sling': this.fire(); this.cool = 0.2; break;
        case 'slick': this.dropSlick(); break;
        case 'whistle': this.whistle(); break;
        case 'pulse': this.pulse(); break;
        case 'dash': this.dash(); break;
        case 'bomb': ok = this.sendAttack('bomb'); break;
        case 'peel': this.dropPeel(); break;
        case 'swap': ok = this.askSwap(); break;
        case 'reflect': this.reflectT = 12; UI.toast(UI.t('cbReflectOn'), 1100, true); VR.Audio.play('ding'); break;
      }
      if (!ok) return;
      it.n--;
      if (it.n <= 0) { this.item = null; if (this.btn) this.btn.hidden = true; } else this.setItemQuiet();
    }
    fire() {
      const g = this.g, p = g.player;
      const s = this.shots.find(m => !m.visible); if (!s) return;
      s.visible = true;
      const shot = { m: s, x: p.x, y: p.y + 1.25, z: p.z - 0.7, lane: p.lane, t: 0, homing: null };
      // aim assist: the boss, or the nearest enemy ahead in your lane
      if (this.bossS && this.bossS.hp > 0) shot.homing = 'boss';
      else {
        let best = null;
        for (const e of this.enemies) if (!e.down && e.z < p.z && p.z - e.z < 60 && Math.abs(e.x - p.x) < LW * 0.6 && (!best || e.z > best.z)) best = e;
        const th = g.S.thief;
        if (th && th.active && th.skin === 'drone' && !th.escaping) { const tz = p.z - Math.max(0.6, th.gap); if (Math.abs(th.x - p.x) < LW * 0.6 && (!best || tz > best.z)) best = { thief: true }; }
        shot.homing = best;
      }
      s.position.set(shot.x, shot.y, shot.z);
      this.projectiles.push(shot);
      VR.Audio.play('throw', { pan: 0 });
      g.cameraImpulse(0.03);
    }
    dropSlick() {
      const g = this.g, p = g.player;
      this.slick = { z: p.z + 1.2, t: 10 };
      this.slickMesh.position.set(0, 0.04 + (p.onTopOf ? 0 : 0), this.slick.z); this.slickMesh.visible = true;
      g.fx.sparkle(p.x, 0.4, p.z + 1, 0xffe14a, 30, 4); VR.Audio.play('splat');
      const st = g.S.story, d = st && st.active && st.dz;
      if (d && d.on && !d.caught) { d.gap = 13; UI.toast(UI.t('cbSlickDozer'), 1500, true); g.fx.dust(p.x, 0.3, p.z + 5, 12, 0xffe14a, 1.6); }
    }
    whistle() {
      const g = this.g, p = g.player;
      this.goatRun = { t: 7, x: p.x + (p.lane === 1 ? -1.2 : 1.2), y: 0, vy: 0, z: p.z + 2, gap: -2, ph: 0, leave: 0 };
      this.goat.visible = true;
      VR.Audio.play('whistle'); setTimeout(() => VR.Audio.play('baa'), 250);
      UI.toast(UI.t('cbGoat'), 1300, true);
    }
    pulse() {
      const g = this.g, p = g.player;
      for (const e of this.enemies) if (!e.down && Math.abs(e.z - p.z) < 60) this.knock(e);
      if (this.bossS && this.bossS.hp > 0 && this.bossS.in) this.hitBoss(3, true);
      const th = g.S.thief;
      if (th && th.active && th.skin === 'drone' && th.gap < 40) th.catch(p.z - Math.max(0.6, th.gap));
      const coins = g.collect.coins;
      for (const i of coins.active) { const c = coins.items[i]; if (c.z < p.z + 2 && p.z - c.z < 20) c.magnet = true; }
      for (let k = 0; k < 3; k++) setTimeout(() => g.fx.ring(p.x, p.y + 1, p.z, k === 1 ? 0xffffff : 0x6fd8ff, 34, 9 + k * 3), k * 90);
      g.fxFlash = 0.6; g.fxCA = 0.8; g.shake = Math.max(g.shake, 0.2);
      VR.Audio.play('zap'); g.vibrate(40);
      UI.toast(UI.t('cbPulse'), 900, true);
    }
    dash() {
      const g = this.g, p = g.player, pu = g.powerups;
      pu.timers.boost = Math.max(pu.remaining('boost'), 1.6); (pu.full || (pu.full = {})).boost = 1.6;
      pu.timers.invincible = Math.max(pu.remaining('invincible'), 1.9); pu.full.invincible = 1.9;
      g.speed *= 1.25;
      g.cameraImpulse(-0.45); g.fxFlash = 0.35; g.fxCA = 0.8;
      g.fx.ring(p.x, p.y + 1, p.z, 0xffb347, 26, 7);
      VR.Audio.play('whoosh'); VR.Audio.play('zap');
      UI.toast(UI.t('cbDash'), 800, true);
    }

    // ------------------------------------------------------------ party mischief
    send(m) { const P = this.g.S.party; if (P && P.inRun) P.send(Object.assign({ t: 'cb' }, m)); }
    sendAttack(k) {
      if (!this.friend()) return false;
      this.send({ k });
      if (k === 'bomb') { UI.toast(UI.t('cbBombThrow'), 1000, true); VR.Audio.play('throw'); }
      return true;
    }
    dropPeel() {
      const g = this.g, p = g.player;
      this.placePeel(g.distance - 1.5, p.lane, true);
      this.send({ k: 'peel', d: Math.round((g.distance - 1.5) * 100) / 100, l: p.lane });
      UI.toast(UI.t('cbPeelDrop'), 900); VR.Audio.play('pop');
    }
    placePeel(d, lane, mine) {
      const g = this.g, m = this.peels.find(x => !x.visible) || this.peels[0];
      const z = g.player.z - (d - g.distance), x = lane * LW;
      const y = g.world.surfaceAt(x, z, 99, 0.3).h;
      m.position.set(x, y + 0.02, z); m.rotation.y = Math.random() * 6; m.visible = true;
      this.peelList = this.peelList.filter(q => q.m !== m);
      this.peelList.push({ m, z, lane, y, mine, t: 40 });
    }
    askSwap() {
      const f = this.friend(); if (!f || this.g.distance >= f.d) return false;
      this.send({ k: 'swap', d: Math.round(this.g.distance * 100) / 100 });
      this.swapWait = 2.5;
      return true;
    }
    doSwap(D) {
      const g = this.g, p = g.player, pu = g.powerups;
      if (g.state !== 'playing') return;
      for (const e of this.enemies) this.remove(e);
      this.enemies = []; this.planned = []; this.peelList.forEach(q => q.m.visible = false); this.peelList = [];
      this.bombs.forEach(b => { b.m.visible = false; b.ring.visible = false; }); this.bombs = [];
      g.jumpTo(Math.max(0, D));
      p.y = g.world.surfaceAt(p.x, p.z, 0.2, 0.3).h; p.vy = 0;
      pu.timers.invincible = Math.max(pu.remaining('invincible'), 2.5); (pu.full || (pu.full = {})).invincible = 2.5;
      g.hitCooldown = 0.6;
      g.snapCamera(); g.fxFlash = 0.8; g.fxCA = 1;
      g.fx.ring(p.x, p.y + 1, p.z, 0xff6fd8, 30, 8);
      VR.Audio.play('swap');
      const P = g.S.party; if (P) { P.buf = []; P.dS = null; }
    }
    // messages from the friend's phone (party.js forwards every {t:'cb'} here)
    combatNet(m) {
      const g = this.g, P = g.S.party, name = (P && P.frName) || '';
      const nm = (k) => UI.t(k).replace('{n}', name);
      if (!P || !P.inRun) return;
      const playing = g.state === 'playing';
      switch (m.k) {
        case 'bomb':
          if (!playing) break;
          if (this.reflectT > 0 && !m.r) { this.reflectT = 0; this.send({ k: 'bomb', r: 1 }); UI.toast(UI.t('cbBombBack'), 1300, true); VR.Audio.play('mirror'); break; }
          this.splash(); UI.toast(m.r ? UI.t('cbBombBounced') : nm('cbBombHit'), 1500, true);
          break;
        case 'peel':
          if (!playing) break;
          if (this.reflectT > 0) { this.reflectT = 0; UI.toast(UI.t('cbPeelBlocked'), 1300, true); VR.Audio.play('mirror'); break; }
          if (m.d > g.distance + 2) this.placePeel(m.d, Math.max(-1, Math.min(1, m.l | 0)), false);
          break;
        case 'swap':
          if (!playing) { this.send({ k: 'swapNo' }); break; }
          if (this.reflectT > 0) { this.reflectT = 0; this.send({ k: 'swapNo', m: 1 }); UI.toast(UI.t('cbReflectUsed'), 1300, true); VR.Audio.play('mirror'); break; }
          this.send({ k: 'swapOk', d: Math.round(g.distance * 100) / 100 });
          this.doSwap(m.d); UI.toast(nm('cbSwapGot'), 1600, true);
          break;
        case 'swapOk': if (this.swapWait > 0 && playing) { this.swapWait = 0; this.doSwap(m.d); UI.toast(nm('cbSwapDone'), 1600, true); } break;
        case 'swapNo': this.swapWait = 0; if (m.m) UI.toast(nm('cbSwapNo'), 1500, true); break;
        case 'bh': if (this.coop) { if (this.bossS && this.bossS.hp > 0) this.hitBoss(m.n || 1, false); else this.pendingHits = Math.min(40, this.pendingHits + (m.n || 1)); } break;
        case 'bd': if (this.coop && this.bossS && this.bossS.hp > 0) { this.bossS.hp = 0; this.bossDefeated(); } break;
      }
    }
    splash() {
      const el = this.splat; if (!el) return;
      el.querySelectorAll('i').forEach((b, i) => {
        const s = 22 + Math.random() * 26;
        b.style.width = s + 'vmin'; b.style.height = s * (0.8 + Math.random() * 0.4) + 'vmin';
        b.style.left = (Math.random() * 90 - 10) + '%'; b.style.top = (Math.random() * 80 - 5) + '%';
        b.style.transform = `rotate(${Math.random() * 360}deg)`;
      });
      el.hidden = false; el.style.opacity = '0'; this.splatLeft = 3.6;
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
    knock(e, quiet) {
      if (e.down) return;
      const g = this.g, p = g.player;
      e.down = true; e.vy = e.type === 'drone' ? 2 : 5; if (e.ring) { e.ring.visible = false; e.ring = null; } e.spin = (Math.random() - 0.5) * 12; e.dt = 0;
      g.fx.smash(e.x, e.y + 0.4, e.z, e.type === 'drone' ? 0x2b2f3a : 0xf2b705);
      g.fx.ring(e.x, e.y + 0.6, e.z, 0xffd23f, 20, 6);
      VR.Audio.play('boom', { pan: (e.x - p.x) / 5 });
      if (quiet) return;
      g.score += 250 * g.multiplier;
      for (let i = 0; i < 6; i++) g.collect.spawnCoin(e.x, 1.0, Math.min(e.z, p.z - 6) - i * 1.5, null);
      UI.toast(UI.t(e.type === 'drone' ? 'cbKnockDrone' : 'cbKnockBiker') + ' +250', 1000, true);
      g.missions.bump('enemies');
    }
    remove(e) { e.m.visible = false; e.gone = true; if (e.ring) { e.ring.visible = false; e.ring = null; } if (e.type === 'biker' && this.warnEl) this.warnEl.hidden = true; }

    // ------------------------------------------------------------ per frame
    update(dt) {
      const g = this.g, p = g.player;
      if (this.cool > 0) this.cool -= dt;
      if (this.swapWait > 0) this.swapWait -= dt;
      this.spawnPlanned();
      this.updateEnemies(dt);
      if (g.state !== 'playing') return;
      this.updateShots(dt);
      this.updateGoat(dt);
      this.updateBoss(dt);
      if (g.state !== 'playing') return;
      // lemonade slick behind you
      if (this.slick) {
        this.slick.t -= dt;
        this.slickMesh.material.opacity = 0.55 * Math.min(1, this.slick.t / 1.5);
        if (this.slick.t <= 0 || this.slick.z - p.z > 40) { this.slick = null; this.slickMesh.visible = false; }
      }
      // banana peels
      for (const q of this.peelList) {
        q.t -= dt;
        if (!q.mine && q.m.visible && Math.abs(q.z - p.z) < 0.8 && p.lane === q.lane && !p.flying && p.y < q.y + 0.35) {
          q.m.visible = false; this.slipT = 1.3; p.stumbleAnim = 0.5;
          UI.toast(UI.t('cbSlipped'), 1300, true); VR.Audio.play('slip'); g.shake = 0.2; g.vibrate(30);
        }
        if (q.t <= 0 || q.z - p.z > 30) q.m.visible = false;
      }
      this.peelList = this.peelList.filter(q => q.m.visible);
      if (this.slipT > 0) {
        this.slipT -= dt;
        g.speed *= Math.max(0.2, 1 - dt * 2.4);
        p.object.rotation.z = Math.sin(this.slipT * 18) * 0.25 * Math.min(1, this.slipT);
      }
      // juice on the screen: pops in, drips down and fades
      if (this.splatLeft > 0) {
        this.splatLeft -= dt;
        const t = 3.6 - this.splatLeft, el = this.splat;
        el.style.opacity = (t < 0.15 ? t / 0.15 : this.splatLeft < 1.2 ? Math.max(0, this.splatLeft / 1.2) : 1).toFixed(3);
        el.style.transform = `translateY(${Math.max(0, t - 1.5) * 14}px) scale(${t < 0.15 ? 1.25 - t / 0.15 * 0.25 : 1})`;
        if (this.splatLeft <= 0) el.hidden = true;
      }
      // mirror aura
      if (this.reflectT > 0) {
        this.reflectT -= dt;
        this.aura.visible = true; this.aura.position.set(p.x, p.y + 0.95, p.z);
        this.aura.rotation.y += dt * 3; this.aura.children[1].rotation.z += dt * 2;
        const k = this.reflectT < 2 ? (Math.sin(this.reflectT * 20) > 0 ? 1 : 0.2) : 1;
        this.aura.children.forEach(t => t.material.opacity = 0.85 * k);
      } else this.aura.visible = false;
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
      if (!this.warnedDrone) { this.warnedDrone = true; UI.toast(UI.t('cbDroneWarn'), 2000, true); }
    }
    spawnBiker(q) {
      const g = this.g, p = g.player;
      const lanes = [-1, 0, 1].filter(l => l !== p.lane);
      const lane = lanes[(Math.random() * lanes.length) | 0];
      const e = { type: 'biker', m: this.biker, lane, x: lane * LW, y: 0, vy: 0, z: p.z + 20, phase: 'approach', t: 0, dust: 0, cutAt: 0 };
      this.biker.visible = true;
      this.enemies.push(e);
      if (this.warnEl) this.warnEl.hidden = false;
      VR.Audio.play('engine', { pan: (e.x - p.x) / 5 });
      if (!this.warnedBiker) { this.warnedBiker = true; UI.toast(UI.t('cbBikerWarn'), 1800, true); }
    }
    laneBlocked(lane, z0, z1) {
      for (const o of this.g.world.obstacles) {
        if (o.lane !== lane || o.ramp) continue;
        if (o.kind === 'block' && o.z - o.len < z0 && o.z > z1) return true;
      }
      return false;
    }
    updateEnemies(dt) {
      const g = this.g, p = g.player;
      for (const e of this.enemies) {
        e.t += dt;
        const U = e.m.userData;
        if (e.down) {                                             // knocked out: tumble and drop
          e.dt += dt; e.vy -= 22 * dt; e.y = Math.max(0, e.y + e.vy * dt);
          if (e.type === 'biker') e.z -= (g.speed - 6) * dt;
          e.m.rotation.z += e.spin * dt; e.m.rotation.x += e.spin * 0.4 * dt;
          if (Math.random() < dt * 20) g.fx.dust(e.x, e.y + 0.3, e.z, 1, 0x555555, 0.8);
          e.m.position.set(e.x, e.y, e.z);
          if (e.dt > 1.4 || e.z - p.z > 10) this.remove(e);
          continue;
        }
        if (e.type === 'drone') this.updateDrone(e, dt, U);
        else this.updateBiker(e, dt, U);
      }
      this.enemies = this.enemies.filter(e => !e.gone);
    }
    updateDrone(e, dt, U) {
      const g = this.g, p = g.player;
      for (const r of U.rotors) r.rotation.y += dt * 45;
      if (e.phase === 'track') {                       // hover ahead, drift towards your lane
        e.gap += (15 - e.gap) * Math.min(1, dt * 1.5);
        e.relock -= dt;
        if (e.relock <= 0) { e.lane = p.lane; e.relock = 0.9; }
        if (e.t > 2.3) { e.phase = 'lock'; e.t = 0; U.beam.visible = true; VR.Audio.play('tick'); e.ring = this.rings.find(r => !r.visible) || null; if (e.ring) e.ring.visible = true; }
        e.z = p.z - e.gap;
      } else if (e.phase === 'lock') {                 // red beam on your lane: move!
        e.z = p.z - e.gap;
        U.beam.material.opacity = 0.18 + (Math.sin(e.t * 30) > 0 ? 0.2 : 0);
        if (e.t > 0.65) { e.phase = 'dive'; e.t = 0; VR.Audio.play('buzz'); }
      } else {                                          // dive along the lane
        e.z += 16 * dt;                                 // flies back at you (you close in at your own speed too)
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
      let v = g.speed;                                  // world speed of the bike
      if (e.phase === 'approach') {
        v = g.speed + 8;
        if (this.slick && e.z > this.slick.z - 0.5 && e.z - v * dt < this.slick.z) { this.knock(e); return; }
        if (p.z - e.z > 9) { e.phase = 'cut'; e.t = 0; if (this.warnEl) this.warnEl.hidden = true; }
        if (this.laneBlocked(e.lane, e.z - 2, e.z - 16)) { const o = [-1, 0, 1].filter(l => Math.abs(l - e.lane) === 1 && !this.laneBlocked(l, e.z + 2, e.z - 16)); if (o.length) e.lane = o[0]; }
      } else if (e.phase === 'cut') {                  // swerve into your lane ahead of you
        v = g.speed + 2;
        if (e.t > 0.15 && !e.cutAt) { e.cutAt = 1; if (!this.laneBlocked(p.lane, e.z + 2, e.z - 14)) e.lane = p.lane; VR.Audio.play('engine', { pan: (e.x - p.x) / 5 }); }
        if (e.t > 0.9) { e.phase = 'block'; e.t = 0; }
      } else if (e.phase === 'block') {                 // brake: you come at it
        v = Math.max(4, g.speed - 5.5);
        if (e.t > 1.6 && !e.retarget) { e.retarget = 1; if (!this.laneBlocked(p.lane, e.z + 2, e.z - 12)) e.lane = p.lane; }
        if (e.t > 6) { e.phase = 'leave'; }
        if (this.laneBlocked(e.lane, e.z - 1, e.z - 8)) { const o = [-1, 0, 1].filter(l => Math.abs(l - e.lane) === 1 && !this.laneBlocked(l, e.z + 2, e.z - 10)); if (o.length) e.lane = o[(Math.random() * o.length) | 0]; }
      } else v = g.speed + 10;
      e.z -= v * dt;
      if (e.phase === 'leave' && p.z - e.z > 70) { this.remove(e); return; }
      if (e.phase !== 'approach' && e.z - p.z > 14) { this.remove(e); return; }
      const tx = e.lane * LW;
      e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), dt * 7);
      // ride over whatever is there, hop small things
      const ground = g.world.surfaceAt(e.x, e.z, e.y + 0.5, 0.3).h;
      let low = false;
      for (const o of g.world.obstacles) if (!o.ramp && o.lane === e.lane && o.kind !== 'block' && o.z > e.z - 2 && o.z - o.len < e.z + 0.3) low = true;
      if ((low || ground > e.y + 0.3) && e.y <= ground + 0.02) e.vy = low ? 7 : 9;
      e.vy -= 30 * dt; e.y += e.vy * dt; if (e.y < ground) { e.y = ground; e.vy = 0; }
      U.body.rotation.z = (tx - e.x) * 0.18; U.body.rotation.x = e.vy > 0.5 ? -0.15 : 0;
      e.m.rotation.set(0, 0, 0);
      e.m.position.set(e.x, e.y, e.z);
      e.dust -= dt; if (e.dust <= 0) { e.dust = 0.07; g.fx.dust(e.x, e.y + 0.3, e.z + 0.8, 1, 0x9a9a9a, 0.6); }
      // contact with the runner
      const dz = e.z - p.z;
      if (Math.abs(dz) < 1.0 && Math.abs(e.x - p.x) < 0.9) {
        if (p.y > e.y + 0.9 && p.vy < 0) {             // landed on top: stomp!
          this.knock(e); p.vy = 11; p.grounded = false;
          UI.toast(UI.t('cbStomp'), 900, true); VR.Audio.play('boing');
        } else if (p.y < e.y + 1.4) this.hurt(e);
      }
    }

    updateShots(dt) {
      const g = this.g, p = g.player;
      for (const s of this.projectiles) {
        const z0 = s.z;
        s.t += dt;
        s.z -= (g.speed + 48) * dt;
        let tx = s.lane * LW, ty = 1.25 + p.y * 0;
        const B = this.bossS, h = s.homing;
        if (h === 'boss' && B && B.hp > 0) { tx = B.x; ty = B.y; }
        else if (h && h.thief) { const th = g.S.thief; if (th && th.active) { tx = th.x; ty = th.y + 0.3; } }
        else if (h && !h.down && !h.gone) { tx = h.x; ty = h.y + (h.type === 'biker' ? 1.1 : 0); }
        const k = Math.min(1, dt * 10);
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
        if (!hit && th && th.active && th.skin === 'drone' && !th.escaping) {
          const tz = p.z - Math.max(0.6, th.gap);
          if (Math.abs(th.x - s.x) < 1.2 && z0 >= tz - 0.6 && s.z <= tz + 0.6) { th.catch(tz); hit = true; }
        }
        if (!hit && B && B.hp > 0 && B.in && Math.abs(B.x - s.x) < 2.8 && z0 >= B.z - 1.5 && s.z <= B.z + 1.5) { this.hitBoss(1, true); hit = true; }
        if (!hit) for (const o of g.world.obstacles) {
          if (o.ramp || Math.abs(o.x - s.x) > 1.0) continue;
          if (!(z0 >= o.z - o.len - 0.3 && s.z <= o.z + 0.3)) continue;
          if (o.kind === 'block') { if (s.y < VR.TRAIN_HEIGHT + 0.2) { hit = true; g.fx.sparkle(s.x, s.y, o.z, 0xffe14a, 10, 3); VR.Audio.play('splat', { pan: (s.x - p.x) / 5 }); break; } continue; }
          if (o.moving) continue;
          g.fx.smash(o.x, 0.5, o.z, 0xd8d2c6); g.world.smash(o); g.score += 50 * g.multiplier; VR.Audio.play('shieldBreak', { pan: (o.x - p.x) / 5 }); hit = true; break;
        }
        if (hit) { g.fx.sparkle(s.x, s.y, s.z, 0xffe14a, 14, 4); VR.Audio.play('hit', { pan: (s.x - p.x) / 5 }); }
        if (hit || p.z - s.z > 75) { s.m.visible = false; s.dead = true; }
      }
      this.projectiles = this.projectiles.filter(s => !s.dead);
    }

    updateGoat(dt) {
      const R = this.goatRun; if (!R) return;
      const g = this.g, p = g.player, U = this.goat.userData;
      R.t -= dt; R.ph += dt * (10 + g.speed * 0.25);
      let tx = p.lane * LW;
      R.gap += (6.5 - R.gap) * Math.min(1, dt * 3);
      if (R.t <= 0) { R.leave += dt; tx = (p.lane <= 0 ? 1 : -1) * LW * 2.2; R.gap += dt * 12; }
      R.z = p.z - R.gap;
      R.x += (tx - R.x) * Math.min(1, dt * 6);
      const lane = Math.round(R.x / LW);
      // head-butt everything in the way except parked trains (it climbs those)
      if (R.t > 0) for (const o of [...g.world.obstacles]) {
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

    // ------------------------------------------------------------ boss
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
        // free ammo while it's up
        B.ammo -= dt; if (B.ammo <= 0) { B.ammo = 1.1; if (!this.item || this.item.id === 'sling') this.giveAmmo(1); }
        // juice bombs on marked lanes
        B.next -= dt;
        if (B.in && B.next <= 0) {
          const frac = B.hp / B.max;
          B.next = 1.35 + 1.0 * frac;
          const lane = Math.random() < 0.7 ? p.lane : [-1, 0, 1][(Math.random() * 3) | 0];
          this.dropBomb(lane);
          if (frac < 0.45 && Math.random() < 0.5) this.dropBomb([-1, 0, 1].filter(l => l !== lane)[(Math.random() * 2) | 0]);
        }
        if (B.t > 55) { B.leaving = true; UI.toast(UI.t('cbBossAway'), 1500); }
      } else {
        B.gap += dt * 25; B.y += dt * 4;
        if (B.gap > 90) { this.endBoss(); return; }
      }
      B.z = p.z - B.gap;
      this.boss.position.set(B.x, B.y, B.z);
      U.body.rotation.z = Math.cos(B.t * 0.6) * -0.15; U.body.rotation.x = 0.12;
      if (B.flash > 0) { B.flash -= dt; U.body.position.y = (Math.random() - 0.5) * 0.15; } else U.body.position.y = 0;
      this.bossBar.querySelector('b').style.width = (100 * Math.max(0, B.hp) / B.max).toFixed(1) + '%';
      // bombs in flight / on the ground
      for (const b of this.bombs) {
        b.t += dt;
        const k = Math.min(1, b.t / b.T);
        b.m.position.set(b.sx + (b.x - b.sx) * k, b.sy + (0.05 - b.sy) * k + Math.sin(k * Math.PI) * 1.2, b.sz + (b.z - b.sz) * k);
        b.m.rotation.x += dt * 6;
        b.ring.position.set(b.x, b.gy + 0.05, b.z);
        const pulse = 1 + Math.sin(b.t * 18) * 0.08;
        b.ring.scale.set(pulse, pulse, pulse); b.ring.material.opacity = 0.45 + k * 0.5;
        if (k >= 1) {
          b.done = true; b.m.visible = false; b.ring.visible = false;
          g.fx.smash(b.x, b.gy + 0.2, b.z, 0xffc21a); g.fx.ring(b.x, b.gy + 0.3, b.z, 0xffc21a, 22, 6);
          VR.Audio.play('splat', { pan: (b.x - p.x) / 5 });
          if (Math.abs(p.x - b.x) < 1.3 && Math.abs(p.z - b.z) < 1.9 && p.y < b.gy + 1.0) this.hurt(null);
        }
      }
      this.bombs = this.bombs.filter(b => !b.done);
    }
    startBoss() {
      const g = this.g, max = this.coop ? 28 : 18;
      this.bossS = { hp: max, max, t: 0, gap: -6, x: 0, y: 8, z: g.player.z + 6, next: 2.2, ammo: 0, in: false, flash: 0 };
      for (const e of this.enemies) this.remove(e); this.enemies = []; this.planned = [];
      this.boss.visible = true;
      this.bossBar.hidden = false; this.bossBar.querySelector('span').textContent = '🛸 ' + UI.t('cbBossName');
      VR.Audio.play('thunder'); VR.Audio.play('buzz'); g.shake = 0.4;
      UI.toast(UI.t('cbBossIn'), 1800, true);
      this.giveAmmo(4);
      setTimeout(() => { if (g.state === 'playing') UI.toast(UI.t(this.coop ? 'cbBossCoop' : 'cbAmmo'), 1300, true); }, 1900);
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

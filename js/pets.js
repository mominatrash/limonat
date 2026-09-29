/* =====================================================================
 * PETS — a companion that runs (or flies) next to you and grabs coins.
 *   cat   runs in the neighbouring lane with the most coins, hops trains
 *   bird  a canary that flies overhead and picks up coins AND lemons
 *         from the lanes on both sides
 * Bought with coins on the Pets screen; the chosen pet also keeps you
 * company on the main menu.
 * ===================================================================== */
(function () {
  const T = THREE, C = VR.CONFIG, UI = VR.UI, LW = C.LANE_WIDTH;

  const PETS = [
    { id: 'none', name: 'بدون', nameEn: 'None', price: 0, perk: { ar: 'اركض لحالك', en: 'Run solo' } },
    { id: 'cat', name: 'مشمش', nameEn: 'Mishmish', tag: 'قطة', tagEn: 'Cat', price: 600,
      perk: { ar: 'بتجمع العملات من المسار اللي جنبك', en: 'Grabs coins in the next lane' } },
    { id: 'bird', name: 'كناري', nameEn: 'Canary', tag: 'عصفور', tagEn: 'Bird', price: 1400,
      perk: { ar: 'بيطير فوقك وبيجمع عملات وليمون من المسارين', en: 'Flies overhead, grabs coins & lemons from both sides' } },
  ];
  VR.PETS = PETS;

  function buildCat() {
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const O = 0xf2a04a, S = 0xd67f2c, W = 0xfff4e6;
    const mb = new VR.MB(41);
    mb.box('flat', O, 0, 0.3, 0, 0.26, 0.24, 0.52, { r: 0.1 });
    for (let i = 0; i < 3; i++) mb.box('flat', S, 0, 0.42, -0.12 + i * 0.12, 0.27, 0.03, 0.05, { r: 0.01 });   // stripes
    mb.box('flat', W, 0, 0.23, -0.05, 0.2, 0.12, 0.32, { r: 0.05 });                                             // belly
    body.add(mb.build({ receive: false }));
    const head = new T.Group(); head.position.set(0, 0.46, -0.3); body.add(head);
    const hb = new VR.MB(42);
    hb.box('flat', O, 0, 0, 0, 0.26, 0.22, 0.22, { r: 0.09 });
    hb.box('flat', W, 0, -0.05, -0.1, 0.14, 0.09, 0.06, { r: 0.03 });
    for (const s of [-1, 1]) {
      hb.cone('flat', O, s * 0.08, 0.14, 0.02, 0.05, 0.1, { rz: s * -0.3, seg: 4 });
      hb.cone('flat', 0xffb3b3, s * 0.08, 0.13, -0.005, 0.028, 0.06, { rz: s * -0.3, seg: 4 });
      hb.sphere('ink', 0x1a2a1a, s * 0.06, 0.02, -0.11, 0.028, { sy: 1.2, seg: 8 });
      hb.sphere('glow', 0xffffff, s * 0.06 + 0.008, 0.035, -0.132, 0.008, { seg: 6 });
    }
    hb.sphere('ink', 0xe06a7a, 0, -0.03, -0.135, 0.016, { seg: 6 });
    head.add(hb.build({ receive: false }));
    const tail = new T.Group(); tail.position.set(0, 0.36, 0.26); body.add(tail);
    const tb = new VR.MB(43); tb.cyl('flat', O, 0, 0.16, 0.04, 0.03, 0.035, 0.34, { rx: -0.4, seg: 8 }); tb.sphere('flat', S, 0, 0.32, 0.1, 0.04, { seg: 8 });
    tail.add(tb.build({ receive: false }));
    const legs = [];
    for (const [x, z] of [[-0.08, -0.17], [0.08, -0.17], [-0.08, 0.17], [0.08, 0.17]]) {
      const l = new T.Group(); l.position.set(x, 0.22, z);
      const lb = new VR.MB(44); lb.cyl('flat', O, 0, -0.1, 0, 0.035, 0.03, 0.2, { seg: 6 }); lb.sphere('flat', W, 0, -0.2, -0.01, 0.038, { seg: 6 });
      l.add(lb.build({ receive: false })); body.add(l); legs.push(l);
    }
    root.userData = { body, head, tail, legs };
    return root;
  }
  function buildBird() {
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const Y = 0xffd23f, Yd = 0xe8a800;
    const mb = new VR.MB(45);
    mb.sphere('flat', Y, 0, 0, 0, 0.13, { sz: 1.25, seg: 12 });
    mb.sphere('flat', Y, 0, 0.1, -0.12, 0.09, { seg: 12 });
    mb.cone('flat', 0xff8a3d, 0, 0.09, -0.22, 0.03, 0.07, { rx: -Math.PI / 2, seg: 6 });
    for (const s of [-1, 1]) { mb.sphere('ink', 0x151515, s * 0.05, 0.12, -0.19, 0.018, { seg: 6 }); mb.sphere('glow', 0xffffff, s * 0.05 + 0.005, 0.13, -0.205, 0.005, { seg: 4 }); }
    mb.box('flat', Yd, 0, 0.02, 0.18, 0.12, 0.03, 0.14, { rx: 0.3 });                 // tail
    body.add(mb.build({ receive: false }));
    const wings = [];
    for (const s of [-1, 1]) {
      const w = new T.Group(); w.position.set(s * 0.1, 0.04, 0);
      const wb = new VR.MB(46); wb.box('flat', Yd, s * 0.12, 0, 0, 0.24, 0.025, 0.16, { r: 0.012 });
      w.add(wb.build({ receive: false })); body.add(w); wings.push(w);
    }
    root.userData = { body, wings };
    return root;
  }

  class Pets {
    constructor(game) {
      this.name = 'pets'; this.g = game;
      this.owned = new Set(UI.store.get('petsOwned', ['none']));
      this.sel = UI.store.get('pet', 'none');
      if (!this.owned.has(this.sel)) this.sel = 'none';
      this.models = { cat: buildCat(), bird: buildBird() };
      for (const k in this.models) { this.models[k].visible = false; game.scene.add(this.models[k]); }
      this.view = PETS.findIndex(p => p.id === this.sel);
      this.t = 0; this.x = LW; this.y = 0; this.lane = 1; this.laneT = 0; this.vy = 0;
      UI.addStrings({ pets: 'الحيوانات', petPick: 'اختيار', petPicked: 'معك', petBuy: 'شراء' },
                    { pets: 'Pets', petPick: 'Choose', petPicked: 'With you', petBuy: 'Buy' });
    }
    get pet() { return this.sel === 'none' ? null : this.sel; }
    warm(on) { for (const k in this.models) this.models[k].visible = on; if (!on) this.show(this.shownId()); }
    shownId() { return this.g.state === 'pets' ? PETS[this.view].id : this.sel; }
    show(id) { for (const k in this.models) this.models[k].visible = k === id; }

    bind() {
      UI.addScreen('pets');
      const sec = document.createElement('section');
      sec.id = 'pets'; sec.className = 'screen'; sec.hidden = true;
      sec.style.justifyContent = 'flex-end';
      sec.innerHTML = `<div class="char-panel glass rise">
          <div class="char-row">
            <button class="btn icon" id="petPrev" aria-label="Previous"><svg><use href="#i-right"/></svg></button>
            <div class="char-name"><b id="petName"></b><span id="petTag"></span><em class="perk" id="petPerk"></em></div>
            <button class="btn icon" id="petNext" aria-label="Next"><svg><use href="#i-left"/></svg></button>
          </div>
          <div class="char-actions">
            <button class="btn" id="petBack"><svg><use href="#i-home"/></svg></button>
            <button class="btn primary" id="petDo" style="font-size:22px;min-height:58px"></button>
          </div></div>`;
      document.body.appendChild(sec);
      UI.bind('petPrev', () => this.cycle(-1)); UI.bind('petNext', () => this.cycle(1));
      UI.bind('petBack', () => { this.view = PETS.findIndex(p => p.id === this.sel); this.show(this.sel); this.g.setState('menu'); });
      UI.bind('petDo', () => this.action());
    }
    open() { this.view = Math.max(0, PETS.findIndex(p => p.id === this.sel)); this.g.setState('pets'); this.refresh(); }
    cycle(d) { this.view = (this.view + d + PETS.length) % PETS.length; this.refresh(); VR.Audio.play('whoosh'); }
    refresh() {
      const P = PETS[this.view], ar = UI.lang === 'ar';
      document.getElementById('petName').textContent = ar ? P.name : P.nameEn;
      document.getElementById('petTag').textContent = P.tag ? (ar ? P.tag : P.tagEn) : '';
      document.getElementById('petPerk').innerHTML = `<svg><use href="#i-bolt"/></svg>${ar ? P.perk.ar : P.perk.en}`;
      const btn = document.getElementById('petDo');
      if (!this.owned.has(P.id)) { btn.innerHTML = `<span>${UI.t('petBuy')}</span><span class="price"><svg class="coin"><use href="#i-coin"/></svg>${UI.fmt(P.price)}</span>`; btn.style.filter = this.g.bank >= P.price ? '' : 'grayscale(.7) brightness(.85)'; }
      else if (P.id === this.sel) { btn.innerHTML = `<svg><use href="#i-check"/></svg><span>${UI.t('petPicked')}</span>`; btn.style.filter = ''; }
      else { btn.innerHTML = `<span>${UI.t('petPick')}</span>`; btn.style.filter = ''; }
      this.show(P.id);
      UI.menuStats(this.g.best, this.g.bank);
    }
    action() {
      const P = PETS[this.view], g = this.g;
      if (!this.owned.has(P.id)) {
        if (g.bank < P.price) { VR.Audio.play('denied'); UI.toast(UI.t('notEnough'), 1200); return; }
        g.bank -= P.price; UI.store.set('bank', g.bank);
        this.owned.add(P.id); UI.store.set('petsOwned', [...this.owned]);
        VR.Audio.play('buy'); g.fx.confetti(0.9, 1.2, 0, 50); UI.toast(UI.t('bought'), 1200, true);
      }
      this.sel = P.id; UI.store.set('pet', P.id);
      VR.Audio.play(P.id === 'cat' ? 'meow' : P.id === 'bird' ? 'chirp' : 'click');
      this.refresh();
    }
    menuCam(state) {
      if (state !== 'pets') return null;
      return { frac: 0.5, sx: 0, sy: 0.3, look: new T.Vector3(0.4, 0.95, 0), dir: new T.Vector3(0.22, 0.22, -1) };
    }

    // ------------------------------------------------------------ menu idle
    menuUpdate(dt) {
      this.t += dt;
      const id = this.shownId();
      this.show(id);
      if (id === 'cat') {
        const m = this.models.cat, U = m.userData;
        m.position.set(0.85, 0, -0.1); m.rotation.set(0, 0.6, 0);
        U.body.position.y = -0.06; U.body.rotation.x = 0;
        U.legs.forEach((l, i) => (l.rotation.x = i < 2 ? 0 : -1.0));       // sitting
        U.body.rotation.x = -0.35;
        U.tail.rotation.z = Math.sin(this.t * 2.2) * 0.5;
        U.head.rotation.y = Math.sin(this.t * 0.7) * 0.4;
      } else if (id === 'bird') {
        const m = this.models.bird, U = m.userData;
        m.position.set(0.4 + Math.sin(this.t * 0.9) * 0.08, 1.9 + Math.abs(Math.sin(this.t * 2.3)) * 0.06, -0.12);
        m.rotation.set(0, 0.5 + Math.sin(this.t * 0.6) * 0.3, 0);
        U.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * Math.sin(this.t * 22) * 0.9));
      }
    }
    reset() { this.x = LW; this.lane = 1; this.laneT = 0; this.y = 0; this.vy = 0; }
    runStart() { this.show(this.sel); this.reset(); }
    leaveRun() { this.show(this.sel); }

    // ------------------------------------------------------------ in the run
    update(dt) {
      const g = this.g, p = g.player, id = this.pet;
      if (!id) return;
      this.t += dt; this.laneT -= dt;
      // pick the neighbouring lane with the most coins ahead
      if (this.laneT <= 0) {
        this.laneT = 1.1;
        const cands = [p.lane - 1, p.lane + 1].filter(l => l >= -1 && l <= 1);
        let best = cands[0], bn = -1;
        for (const l of cands) { const n = g.collect.coinsInLane(l * LW, p.z, p.z - 16); if (n > bn) { bn = n; best = l; } }
        this.lane = best;
      }
      const tx = this.lane * LW;
      this.x += (tx - this.x) * Math.min(1, dt * 6);
      const z = p.z + 0.4;
      if (id === 'cat') {
        const ground = g.world.surfaceAt(this.x, z, 99, 0.15).h;
        if (ground > this.y + 0.3 && this.vy <= 0) this.vy = 9;
        this.vy -= 30 * dt; this.y += this.vy * dt; if (this.y < ground) { this.y = ground; this.vy = 0; }
        const m = this.models.cat, U = m.userData, ph = this.t * (10 + g.speed * 0.3), s = Math.sin(ph);
        m.position.set(this.x, this.y, z); m.rotation.set(this.vy > 1 ? -0.3 : 0, (this.x - tx) * 0.2, 0);
        U.body.position.y = Math.abs(Math.sin(ph)) * 0.05; U.body.rotation.x = 0;
        U.legs[0].rotation.x = s; U.legs[1].rotation.x = s; U.legs[2].rotation.x = -s; U.legs[3].rotation.x = -s;
        U.tail.rotation.z = 0; U.tail.rotation.x = -0.5 + Math.sin(ph * 0.5) * 0.2;
        U.head.rotation.y = 0;
        g.collect.grabNear(this.x, this.y + 0.8, z - 0.3, 1.25, g);
      } else {
        const m = this.models.bird, U = m.userData;
        this.y += (p.y + 2.35 - this.y) * Math.min(1, dt * 5);
        const bx = p.x + Math.sin(this.t * 1.3) * 1.4;
        m.position.set(bx, this.y + Math.sin(this.t * 4) * 0.12, z - 0.5);
        m.rotation.set(-0.15, 0, Math.sin(this.t * 1.3) * -0.3);
        U.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * Math.sin(this.t * 26) * 1.0));
        // swoops over the lanes on both sides of the runner
        for (const l of [p.lane - 1, p.lane + 1]) if (l >= -1 && l <= 1) g.collect.grabNear(l * LW, 1.0, z - 0.6, 1.3, g);
        g.collect.grabNear(l0(p), 3.0, z - 0.6, 1.2, g);
      }
    }
  }
  function l0(p) { return p.x; }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Pets);
})();

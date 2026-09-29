/* =====================================================================
 * LEMONADE STAND — your own stall by the tracks.
 * Every lemon you pick up in a run is kept in your lemon basket. At the
 * stand you can:
 *   • collect the coins it earned while you were away (it keeps selling:
 *     30 coins/hour per level, stores up to 6 + level/2 hours)
 *   • squeeze & sell lemons right now
 *   • upgrade it (lemons + coins): more income, more storage, and the
 *     stall itself grows — second jug, string lights, lemon tree, neon…
 * ===================================================================== */
(function () {
  const T = THREE, UI = VR.UI;
  const POS = new T.Vector3(-2.75, 0, -1.6);
  const MAX = 10;
  const rate = (l) => 30 * l;                         // coins per hour
  const capH = (l) => 6 + l * 0.5;                    // hours of storage
  const upCost = (l) => ({ coins: Math.round(160 * Math.pow(l, 1.45) / 10) * 10, lemons: 6 * l });
  const sellPrice = (l) => Math.round(8 * (1 + l * 0.12));

  function signTexture(level) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
    const c = cv.getContext('2d');
    c.fillStyle = '#2f8a45'; c.fillRect(0, 0, 512, 160);
    c.strokeStyle = '#ffd43b'; c.lineWidth = 10; c.strokeRect(6, 6, 500, 148);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '800 70px "Baloo Bhaijaan 2", Tahoma, sans-serif'; c.direction = 'rtl';
    c.fillText('ليموناضة', 256, 72);
    c.font = '700 34px Tahoma, sans-serif'; c.fillStyle = '#ffe680';
    c.fillText('★'.repeat(Math.min(5, Math.ceil(level / 2))), 256, 128);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
  }

  function buildStand(level) {
    const g = new T.Group();
    const mb = new VR.MB(51 + level);
    const wood = 0xb07a45, dark = 0x7a5230, Y = 0xffd23f, Wt = 0xfff6dc;
    // counter with painted boards
    mb.box('wood', wood, 0, 0.5, 0, 1.9, 1.0, 0.8, { r: 0.03 });
    for (let i = 0; i < 6; i++) mb.box('paint', i % 2 ? Y : Wt, -0.8 + i * 0.32, 0.5, -0.41, 0.3, 0.9, 0.02);
    mb.box('wood', dark, 0, 1.02, 0, 2.0, 0.06, 0.9, { r: 0.02 });
    // awning on four poles
    for (const [x, z] of [[-0.92, -0.38], [0.92, -0.38], [-0.92, 0.38], [0.92, 0.38]]) mb.box('wood', dark, x, 1.25, z, 0.07, 2.5, 0.07);
    for (let i = 0; i < 7; i++) mb.box('paint', i % 2 ? Wt : Y, -0.93 + i * 0.31, 2.48, -0.05, 0.31, 0.05, 1.25, { rx: 0.18 });
    for (let i = 0; i < 7; i++) mb.cone('paint', i % 2 ? Wt : Y, -0.93 + i * 0.31, 2.26, -0.66, 0.16, 0.2, { rx: Math.PI, seg: 3 });   // scalloped edge
    // jug(s) of lemonade + cups + lemons
    const jug = (x) => {
      mb.cyl('glass', 0xe8f4ff, x, 1.3, 0, 0.17, 0.15, 0.5, { seg: 18 });
      mb.cyl('gloss', 0xffe14a, x, 1.25, 0, 0.145, 0.13, 0.36, { seg: 16 });
      mb.cyl('paint', 0xfff3b0, x, 1.43, -0.1, 0.07, 0.07, 0.01, { rx: 1.2, seg: 12 });
      mb.cyl('metal', 0xcfd6dd, x, 1.08, 0, 0.012, 0.012, 0.12, { rz: Math.PI / 2, seg: 6 });
    };
    jug(-0.45);
    if (level >= 2) jug(0.05);
    for (let i = 0; i < 4 + Math.min(level, 6); i++) mb.cyl('paint', 0xffffff, 0.35 + (i % 4) * 0.13, 1.1 + Math.floor(i / 4) * 0.001, -0.2 + Math.floor(i / 4) * 0.18, 0.05, 0.04, 0.13, { seg: 10 });
    mb.box('wood', wood, 0.7, 1.15, 0.22, 0.4, 0.2, 0.3, { r: 0.02 });
    for (let i = 0; i < 6; i++) mb.sphere('gloss', Y, 0.58 + (i % 3) * 0.12, 1.3, 0.14 + Math.floor(i / 3) * 0.14, 0.07, { sx: 1.25, seg: 10 });
    // level decorations
    if (level >= 3) for (let i = 0; i < 9; i++) mb.sphere('glow', [0xffe28a, 0xff9a6b, 0x9fe0ff][i % 3], -0.92 + i * 0.23, 2.2 - Math.sin(i / 8 * Math.PI) * 0.12, -0.7, 0.04, { seg: 6 });
    if (level >= 4) { mb.cyl('paint', 0xc0703a, 1.35, 0.25, -0.1, 0.18, 0.14, 0.5, { seg: 12 }); mb.cyl('wood', dark, 1.35, 0.8, -0.1, 0.03, 0.04, 0.7, { seg: 6 }); mb.sphere('leaf', 0x3fae4f, 1.35, 1.3, -0.1, 0.36, { seg: 10 }); for (let i = 0; i < 5; i++) mb.sphere('gloss', Y, 1.35 + Math.cos(i * 1.3) * 0.28, 1.25 + Math.sin(i * 2.1) * 0.2, -0.1 + Math.sin(i * 1.3) * 0.28, 0.06, { seg: 8 }); }
    if (level >= 5) mb.torus('neon', 0xffe14a, 0, 3.0, -0.2, 0.22, 0.035, { seg: 24 });
    if (level >= 6) for (const s of [-1, 1]) { mb.box('wood', dark, s * 1.25, 1.6, 0.3, 0.05, 3.2, 0.05); mb.box('paint', s < 0 ? 0x2f8a45 : 0xe8433a, s * 1.25 + s * 0.16, 2.9, 0.3, 0.3, 0.4, 0.02); }
    if (level >= 8) mb.box('chrome', 0xffc93c, 0, 1.06, -0.46, 2.02, 0.04, 0.02);
    if (level >= 10) mb.sphere('neon', 0xffffff, 0, 3.0, -0.2, 0.12, { seg: 10 });
    g.add(mb.build({ receive: true }));
    const tex = signTexture(level), mat = new T.MeshBasicMaterial({ map: tex, color: new T.Color(1.15, 1.15, 1.15) });
    const sign = new T.Mesh(new T.PlaneGeometry(1.3, 0.4), mat);
    sign.position.set(0, 0.62, -0.425);
    g.add(sign);
    g.userData.dispose = () => { tex.dispose(); mat.dispose(); sign.geometry.dispose(); g.children[0].traverse(m => m.geometry && m.geometry.dispose()); };
    return g;
  }

  class Stand {
    constructor(game) {
      this.name = 'stand'; this.g = game;
      const s = UI.store.get('stand', null);
      this.level = (s && s.level) || 1;
      this.last = (s && s.last) || Date.now();
      this.lemons = UI.store.get('lemonBank', 0);
      this.model = null; this.build();
      UI.addStrings({
        stand: 'البسطة', standTitle: 'بسطة الليموناضة', standLvl: 'المستوى', standRate: 'بالساعة', standStored: 'جاهز للجمع', standLemons: 'ليموناتك',
        standCollect: 'اجمع', standSell: 'بيع 10 ليمونات', standUp: 'طوّر', standMax: 'أعلى مستوى!', standNoLemons: 'ما معك ليمون كافي', standEmpty: 'ما في شي للجمع لسا',
      }, {
        stand: 'Stand', standTitle: 'Lemonade stand', standLvl: 'Level', standRate: 'per hour', standStored: 'Ready to collect', standLemons: 'Your lemons',
        standCollect: 'Collect', standSell: 'Sell 10 lemons', standUp: 'Upgrade', standMax: 'Max level!', standNoLemons: 'Not enough lemons', standEmpty: 'Nothing to collect yet',
      });
    }
    build() {
      if (this.model) { this.g.scene.remove(this.model); this.model.userData.dispose(); }
      this.model = buildStand(this.level);
      this.model.position.copy(POS); this.model.rotation.y = 0.35;
      this.model.visible = false;
      this.g.scene.add(this.model);
    }
    save() { UI.store.set('stand', { level: this.level, last: this.last }); UI.store.set('lemonBank', this.lemons); }
    stored() {
      const h = (Date.now() - this.last) / 3.6e6;
      return Math.floor(Math.min(h, capH(this.level)) * rate(this.level));
    }
    lemon() { this.lemons++; UI.store.set('lemonBank', this.lemons); }
    warm(on) { this.model.visible = on; }

    bind() {
      UI.addScreen('stand');
      const sec = document.createElement('section');
      sec.id = 'stand'; sec.className = 'screen'; sec.hidden = true; sec.style.justifyContent = 'flex-end';
      sec.innerHTML = `<div class="char-panel glass rise stand-panel">
        <div class="stand-head"><button class="btn icon" id="stBack" style="width:40px;min-width:40px;height:40px;min-height:40px"><svg><use href="#i-home"/></svg></button><b data-i18n="standTitle"></b><span class="lvl" id="stLvl"></span></div>
        <div class="stand-stats">
          <div><b id="stLemons"></b><span data-i18n="standLemons"></span></div>
          <div><b id="stRate"></b><span data-i18n="standRate"></span></div>
          <div><b id="stStored"></b><span data-i18n="standStored"></span></div>
        </div>
        <div class="stand-bar"><i id="stFill"></i></div>
        <div class="stand-actions">
          <button class="btn green" id="stCollect"></button>
          <button class="btn lemon" id="stSell"></button>
          <button class="btn primary" id="stUp" style="font-size:18px;min-height:54px"></button>
        </div>
      </div>`;
      document.body.appendChild(sec);
      const st = document.createElement('style');
      st.textContent = `.stand-panel{gap:8px;padding:12px}.stand-head{display:flex;gap:10px;align-items:center;font-size:20px;font-weight:800}.stand-head b{flex:1}
        .stand-head .lvl{font-size:15px;color:#3a2a00;background:linear-gradient(180deg,var(--lemon-2),var(--lemon));padding:2px 10px;border-radius:999px}
        .stand-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.stand-stats div{background:var(--glass-2);border:1px solid var(--edge);border-radius:12px;padding:6px 8px;text-align:center}
        .stand-stats b{display:block;font-size:20px;direction:ltr;font-variant-numeric:tabular-nums}.stand-stats span{font-size:12px;color:var(--muted)}
        .stand-bar{height:8px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden}.stand-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--lemon-deep),var(--lemon))}
        .stand-actions{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:6px}.stand-actions .btn{font-size:14px;min-height:46px;padding:6px 8px;flex-direction:column;gap:2px;line-height:1.1}.stand-actions #stUp{font-size:14px!important;min-height:46px!important}
        @media (max-width:430px){.stand-actions{grid-template-columns:1fr 1fr}.stand-actions #stUp{grid-column:1/-1}}
        .stand-actions .price{direction:ltr;display:inline-flex;gap:4px;align-items:center}.stand-actions svg{width:18px;height:18px}`;
      document.head.appendChild(st);
      UI.bind('stCollect', () => this.collect());
      UI.bind('stSell', () => this.sell());
      UI.bind('stUp', () => this.upgrade());
      UI.bind('stBack', () => this.g.setState('menu'));
    }
    open() { this.g.setState('stand'); UI.setLang(UI.lang); this.refresh(); }
    refresh() {
      const $ = (id) => document.getElementById(id), L = this.level;
      $('stLvl').textContent = UI.t('standLvl') + ' ' + L;
      $('stLemons').textContent = UI.fmt(this.lemons);
      $('stRate').textContent = UI.fmt(rate(L));
      const s = this.stored();
      $('stStored').textContent = UI.fmt(s);
      $('stFill').style.width = (Math.min(1, s / (rate(L) * capH(L))) * 100).toFixed(1) + '%';
      const coin = '<svg class="coin"><use href="#i-coin"/></svg>';
      $('stCollect').innerHTML = `<span>${UI.t('standCollect')}</span><span class="price">${coin}+${UI.fmt(s)}</span>`;
      $('stSell').innerHTML = `<span>${UI.t('standSell')}</span><span class="price">${coin}+${UI.fmt(sellPrice(L) * 10)}</span>`;
      if (L >= MAX) $('stUp').innerHTML = `<span>${UI.t('standMax')}</span>`;
      else { const c = upCost(L); $('stUp').innerHTML = `<span>${UI.t('standUp')} → ${L + 1}</span><span class="price">${coin}${UI.fmt(c.coins)} · 🍋${c.lemons}</span>`; }
      UI.menuStats(this.g.best, this.g.bank);
    }
    collect() {
      const s = this.stored();
      if (s <= 0) { VR.Audio.play('denied'); UI.toast(UI.t('standEmpty'), 1100); return; }
      this.g.bank += s; UI.store.set('bank', this.g.bank);
      this.last = Date.now(); this.save();
      VR.Audio.play('buy'); this.g.fx.sparkle(POS.x, 1.4, POS.z, 0xffd84a, 30, 4);
      this.refresh();
    }
    sell() {
      if (this.lemons < 10) { VR.Audio.play('denied'); UI.toast(UI.t('standNoLemons'), 1100); return; }
      this.lemons -= 10; this.g.bank += sellPrice(this.level) * 10; UI.store.set('bank', this.g.bank); this.save();
      VR.Audio.play('coin'); VR.Audio.play('ding'); this.g.fx.sparkle(POS.x, 1.4, POS.z, 0xfff07a, 20, 3);
      this.g.missions.bump('lemonsSold', 10);
      this.refresh();
    }
    upgrade() {
      if (this.level >= MAX) return;
      const c = upCost(this.level), g = this.g;
      if (g.bank < c.coins) { VR.Audio.play('denied'); UI.toast(UI.t('notEnough'), 1100); return; }
      if (this.lemons < c.lemons) { VR.Audio.play('denied'); UI.toast(UI.t('standNoLemons'), 1100); return; }
      // bank what was earned at the old rate first
      const s = this.stored(); g.bank += s - c.coins; this.lemons -= c.lemons;
      this.level++; this.last = Date.now();
      UI.store.set('bank', g.bank); this.save();
      this.build(); this.model.visible = true;
      VR.Audio.play('fanfare'); g.fx.confetti(POS.x, 2.2, POS.z, 90);
      this.refresh();
    }
    menuCam(state) {
      if (state !== 'stand') return null;
      const portrait = this.g.portrait;
      return { frac: portrait ? 0.3 : 0.36, h: 3.1, sx: 0, sy: 0.4, look: new T.Vector3(POS.x + (portrait ? 0.35 : 1.1), 1.35, POS.z), dir: new T.Vector3(portrait ? 0.25 : 0.5, 0.28, -1) };
    }
    state(s) {
      this.model.visible = s === 'stand';
      const dot = document.getElementById('standDot');
      if (dot) dot.hidden = this.stored() < rate(this.level) * 1.5;
      clearInterval(this.tick);
      if (s === 'stand') this.tick = setInterval(() => this.refresh(), 1000);
    }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Stand);
})();

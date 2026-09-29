/* =====================================================================
 * CHARACTER CREATOR — design your own runner.
 * Pick a colour for the shirt, shorts, beanie, shoes and hair tuft, an
 * accessory and an optional scarf. The design is saved and shows up in
 * the character shop as "My runner" (free, no perk: pure style).
 * ===================================================================== */
(function () {
  const T = THREE, UI = VR.UI;
  const SW = [0xf4f3ef, 0x1b1b1d, 0xe8433a, 0xff7a45, 0xffd23f, 0x7bc86c, 0x2f8a45, 0x6fdcc0, 0x3ec1ff, 0x3d6fd9, 0x9b7bff, 0xe86fb3, 0x8a5a33, 0xc9b28f, 0x5a2d82, 0x262c3d];
  const PARTS = [['shirt', 'قميص', 'Shirt'], ['shorts', 'شورت', 'Shorts'], ['cap', 'طاقية', 'Beanie'], ['shoe', 'حذاء', 'Shoes'], ['hair', 'الخصلة', 'Tuft'], ['acc', 'إكسسوار', 'Extras'], ['scarf', 'شال', 'Scarf']];
  const ACC = [[null, 'بدون', 'None'], ['glasses', 'نظارة', 'Glasses'], ['shades', 'شمسية', 'Shades'], ['visor', 'نيون', 'Goggles'], ['headphones', 'سماعات', 'Headphones'], ['leaf', 'ورقة', 'Leaf'], ['crown', 'تاج', 'Crown'], ['tulips', 'توليب', 'Tulips']];
  const shade = (c, f) => VR.C.shade(c, f);
  const hex = (c) => '#' + c.toString(16).padStart(6, '0');

  function makeDef(d) {
    const base = VR.CHARACTERS[0].palette;
    const P = Object.assign({}, base, {
      shirt: d.shirt, shorts: d.shorts, cap: d.cap, shoe: d.shoe, sole: shade(d.shoe, 0.6), hair: d.hair,
      detail: shade(d.shirt, 0.7), acc1: d.acc === 'crown' ? 0xffc93c : shade(d.cap, 0.8), acc2: 0x2a2f3a,
    });
    return {
      id: 'custom', name: d.name || 'شخصيتي', nameEn: d.nameEn || 'My runner', tagline: 'من تصميمك', taglineEn: 'Designed by you', price: 0,
      palette: P, acc: d.acc ? [d.acc] : [], scarf: d.scarf ? [d.scarf, shade(d.scarf, 0.55)] : null,
      perk: { ar: 'ستايلك الخاص', en: 'Pure style' },
    };
  }
  VR.makeCustomDef = makeDef;
  // insert the saved design before the game reads the character list
  const saved = UI.store.get('customChar', null);
  if (saved) VR.CHARACTERS.splice(1, 0, makeDef(saved));

  class Creator {
    constructor(game) {
      this.name = 'creator'; this.g = game;
      if (saved) game.owned.add('custom');
      this.d = Object.assign({ shirt: 0x3ec1ff, shorts: 0x262c3d, cap: 0xe8433a, shoe: 0xf4f3ef, hair: 0xf4f3ef, acc: null, scarf: null }, saved || {});
      this.tab = 'shirt';
      UI.addStrings({ create: 'صمّم شخصيتك', createSave: 'احفظ', createEdit: 'عدّل تصميمك' }, { create: 'Design yours', createSave: 'Save', createEdit: 'Edit design' });
    }
    bind() {
      UI.addScreen('creator');
      // a "design your own" button inside the character shop panel
      const panel = document.querySelector('#character .char-panel');
      const b = document.createElement('button');
      b.className = 'btn small'; b.id = 'createBtn';
      b.innerHTML = '<svg><use href="#i-brush"/></svg><span data-i18n="create"></span>';
      panel.insertBefore(b, panel.querySelector('.char-actions'));
      UI.bind('createBtn', () => this.open());
      const sec = document.createElement('section');
      sec.id = 'creator'; sec.className = 'screen'; sec.hidden = true; sec.style.justifyContent = 'flex-end';
      sec.innerHTML = `<div class="char-panel glass rise cr-panel">
          <div class="cr-tabs" id="crTabs"></div>
          <div class="cr-sw" id="crSw"></div>
          <div class="char-actions">
            <button class="btn" id="crBack"><svg><use href="#i-home"/></svg></button>
            <button class="btn primary" id="crSave" style="font-size:22px;min-height:56px"><svg><use href="#i-check"/></svg><span data-i18n="createSave"></span></button>
          </div></div>`;
      document.body.appendChild(sec);
      const st = document.createElement('style');
      st.textContent = `.cr-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}.cr-tabs button{flex:none;border:1px solid var(--edge);background:var(--glass-2);color:var(--text);font:inherit;font-weight:700;font-size:15px;padding:6px 12px;border-radius:12px;cursor:pointer}
        .cr-tabs button[aria-pressed=true]{background:var(--lemon);color:#3a2a00}
        .cr-sw{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}.cr-sw button{aspect-ratio:1;border-radius:50%;border:3px solid rgba(255,255,255,.25);cursor:pointer;max-width:100%}
        .cr-sw button[aria-pressed=true]{border-color:#fff;box-shadow:0 0 0 3px var(--lemon)}
        .cr-sw.acc{grid-template-columns:repeat(4,1fr)}.cr-sw.acc button{aspect-ratio:auto;border-radius:12px;background:var(--glass-2);color:var(--text);font:inherit;font-weight:700;padding:8px 4px;font-size:14px}
        #createBtn{align-self:center}`;
      document.head.appendChild(st);
      UI.bind('crBack', () => { this.g.player.setCharacter(VR.CHARACTERS[this.g.charIndex]); this.g.setState('character'); });
      UI.bind('crSave', () => this.save());
    }
    open() {
      this.g.setState('creator'); UI.setLang(UI.lang);
      this.renderTabs(); this.preview();
    }
    renderTabs() {
      const ar = UI.lang === 'ar';
      document.getElementById('crTabs').innerHTML = PARTS.map(([k, a, e]) => `<button data-k="${k}" aria-pressed="${k === this.tab}">${ar ? a : e}</button>`).join('');
      document.querySelectorAll('#crTabs button').forEach(b => b.addEventListener('click', () => { VR.Audio.play('click'); this.tab = b.dataset.k; this.renderTabs(); }));
      const sw = document.getElementById('crSw');
      if (this.tab === 'acc') {
        sw.className = 'cr-sw acc';
        sw.innerHTML = ACC.map(([k, a, e], i) => `<button data-i="${i}" aria-pressed="${this.d.acc === k}">${ar ? a : e}</button>`).join('');
        sw.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { this.d.acc = ACC[+b.dataset.i][0]; this.changed(); }));
      } else {
        sw.className = 'cr-sw';
        const list = this.tab === 'scarf' ? [null, ...SW] : SW;
        sw.innerHTML = list.map((c, i) => `<button data-i="${i}" aria-pressed="${this.d[this.tab] === c}" style="background:${c === null ? 'repeating-linear-gradient(45deg,#555 0 4px,#333 4px 8px)' : hex(c)}" aria-label="${c === null ? 'none' : hex(c)}"></button>`).join('');
        sw.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { this.d[this.tab] = list[+b.dataset.i]; this.changed(); }));
      }
    }
    changed() { VR.Audio.play('click'); this.renderTabs(); this.preview(); this.g.fx.sparkle(0, 1.3, 0, 0xffe28a, 8, 2.5); }
    preview() { this.g.player.setCharacter(makeDef(this.d)); }
    save() {
      const g = this.g, def = makeDef(this.d);
      UI.store.set('customChar', this.d);
      const i = VR.CHARACTERS.findIndex(c => c.id === 'custom');
      if (i >= 0) VR.CHARACTERS[i] = def; else VR.CHARACTERS.splice(1, 0, def);
      g.owned.add('custom'); UI.store.set('owned', [...g.owned]);
      g.selectedId = 'custom'; UI.store.set('character', 'custom');
      g.charIndex = VR.CHARACTERS.findIndex(c => c.id === 'custom');
      g.player.setCharacter(def);
      VR.Audio.play('buy'); g.fx.confetti(0, 1.8, 0, 70);
      g.setState('character');
    }
    menuCam(state) { return state === 'creator' ? { frac: 0.44, sx: 0, sy: 0.3 } : null; }
    state(s) { if (s === 'character') { const b = document.getElementById('createBtn'); if (b) b.querySelector('span').textContent = UI.t(VR.CHARACTERS.some(c => c.id === 'custom') ? 'createEdit' : 'create'); } }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Creator);
})();

/* =====================================================================
 * SEASONAL EVENTS — the railway dresses up for the season.
 *   olive    موسم قطف الزيتون   1 Oct – 30 Nov   bunting + olives to collect
 *   ramadan  ليالي رمضان        (Ramadan 1448: ~8 Feb – 9 Mar 2027) lanterns + crescent
 *   winter   الشتوية            20 Dec – 20 Jan  coloured lights + snowflakes
 * During an event some coins on the track become the event item. Collect
 * them for rewards: the event character (150) and a coin prize (300).
 * Settings -> "Season" lets you preview any event (or switch it off).
 * ===================================================================== */
(function () {
  const T = THREE, UI = VR.UI, C = VR.CONFIG;
  const EVENTS = {
    olive:   { ar: 'موسم قطف الزيتون', en: 'Olive harvest', item: 'زيتونة', itemEn: 'olives', icon: '🫒', char: 'farmer', color: 0x7bc86c },
    ramadan: { ar: 'ليالي رمضان', en: 'Ramadan nights', item: 'فانوس', itemEn: 'lanterns', icon: '🏮', char: 'misaharati', color: 0xffc93c },
    winter:  { ar: 'الشتوية', en: 'Winter festival', item: 'ندفة', itemEn: 'snowflakes', icon: '❄️', char: 'snowy', color: 0x9fe0ff },
  };
  const GOALS = [150, 300];
  function byDate(d = new Date()) {
    const m = d.getMonth() + 1, day = d.getDate(), y = d.getFullYear();
    if (m === 10 || m === 11) return 'olive';
    if ((m === 12 && day >= 20) || (m === 1 && day <= 20)) return 'winter';
    const t = d.getTime();
    if (y === 2027 && t >= Date.UTC(2027, 1, 7) && t < Date.UTC(2027, 2, 10)) return 'ramadan';
    if (y === 2028 && t >= Date.UTC(2028, 0, 27) && t < Date.UTC(2028, 1, 27)) return 'ramadan';
    return null;
  }

  // ------------------------------------------------------------ item models
  function itemGeo(ev) {
    const mb = new VR.MB(71);
    if (ev === 'olive') {
      mb.sphere('gloss', 0x3d5a1e, 0, 0, 0, 0.17, { sy: 1.35, seg: 14 });
      mb.sphere('gloss', 0x2a2f1a, 0.2, 0.05, 0, 0.13, { sy: 1.35, seg: 12 });
      mb.box('flat', 0x6f9a3a, 0.08, 0.28, 0, 0.26, 0.03, 0.08, { rz: 0.4, r: 0.01 });
    } else if (ev === 'ramadan') {
      mb.cyl('gloss', 0xffc93c, 0, 0, 0, 0.14, 0.14, 0.26, { seg: 6 });
      mb.cone('gloss', 0xd6a22a, 0, 0.21, 0, 0.16, 0.16, { seg: 6 });
      mb.cone('gloss', 0xd6a22a, 0, -0.17, 0, 0.12, 0.08, { rx: Math.PI, seg: 6 });
      mb.torus('gloss', 0xd6a22a, 0, 0.33, 0, 0.05, 0.012, { seg: 10 });
    } else {
      for (let i = 0; i < 3; i++) mb.box('gloss', 0xe8f7ff, 0, 0, 0, 0.5, 0.06, 0.04, { rz: i * Math.PI / 3 });
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; mb.box('gloss', 0xe8f7ff, Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0, 0.14, 0.04, 0.04, { rz: a + Math.PI / 2 }); }
    }
    return mb.geometries()[0].geometry;
  }
  function decoMB(ev) {
    const mb = new VR.MB(72), X = VR.HALF_TRACK + 1.2, top = 7.3;
    const sag = (x) => top - 0.75 * (1 - (x / X) * (x / X));
    for (let x = -X; x < X; x += 0.35) mb.box('metal', 0x3a3530, x + 0.175, sag(x + 0.175), 0, 0.36, 0.02, 0.02, { rz: (sag(x + 0.35) - sag(x)) / 0.35 });
    for (const s of [-1, 1]) mb.box('metal', 0x39424d, s * X, top / 2, 0, 0.12, top, 0.12);
    if (ev === 'olive') {
      const cols = [0x2f8a45, 0xf4f3ef, 0x55632a, 0xe8433a];
      let i = 0;
      for (let x = -X + 0.3; x < X - 0.2; x += 0.62, i++) mb.cone('flat', cols[i % 4], x, sag(x) - 0.3, 0, 0.3, 0.56, { rx: Math.PI, seg: 3 });
    } else if (ev === 'ramadan') {
      let i = 0;
      for (let x = -X + 0.8; x < X - 0.5; x += 1.3, i++) {
        const y = sag(x) - 0.7 - (i % 2) * 0.3;
        mb.box('metal', 0x3a3530, x, y + 0.45, 0, 0.02, 0.5 + (i % 2) * 0.3, 0.02);
        mb.cyl('glow', i % 2 ? 0xffb347 : 0xffe28a, x, y, 0, 0.22, 0.22, 0.44, { seg: 6 });
        mb.cone('paint', 0xd6a22a, x, y + 0.34, 0, 0.27, 0.26, { seg: 6 });
        mb.cone('paint', 0xd6a22a, x, y - 0.29, 0, 0.17, 0.14, { rx: Math.PI, seg: 6 });
      }
      // crescent in the middle
      mb.torus('neon', 0xffe28a, 0, top + 0.65, 0, 0.42, 0.07, { arc: Math.PI * 1.25, rz: -Math.PI * 0.12, seg: 20 });
      mb.sphere('neon', 0xffe28a, 0.52, top + 0.95, 0, 0.07, { seg: 8 });
    } else {
      const cols = [0xff5a4f, 0x7bc86c, 0x3ec1ff, 0xffd23f];
      let i = 0;
      for (let x = -X + 0.25; x < X; x += 0.42, i++) mb.sphere('glow', cols[i % 4], x, sag(x) - 0.12, 0, 0.11, { sy: 1.3, seg: 8 });
      for (const x of [-X * 0.55, 0, X * 0.55]) for (let k = 0; k < 3; k++) mb.box('glow', 0xe8f7ff, x, sag(x) - 0.55, 0, 0.5, 0.05, 0.04, { rz: k * Math.PI / 3 });
    }
    return mb;
  }

  class Events {
    constructor(game) {
      this.name = 'events'; this.g = game;
      this.override = UI.store.get('eventOverride', 'auto');
      this.ev = this.override === 'auto' ? byDate() : this.override === 'none' ? null : this.override;
      this.counts = UI.store.get('eventCounts', {});
      this.claimed = UI.store.get('eventClaimed', {});
      this.sets = {};
      if (this.ev) {
        const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.1, emissive: new T.Color(EVENTS[this.ev].color), emissiveIntensity: 0.35 });
        this.set = new VR.InstancedSet(game.scene, itemGeo(this.ev), mat, 80);
        game.world.lazyPool('deco_' + this.ev, () => decoMB(this.ev));
      }
      UI.addStrings({ season: 'المناسبة', sAuto: 'تلقائي', sNone: 'بدون', eventOnly: 'من المناسبة', unlock: 'افتح', eventTitle: 'المناسبة', eventGoal1: 'شخصية المناسبة', eventGoal2: '1500 عملة', claim: 'استلم', claimed: 'استلمت' },
                    { season: 'Season', sAuto: 'Auto', sNone: 'Off', eventOnly: 'Event reward', unlock: 'Unlock', eventTitle: 'Event', eventGoal1: 'Event character', eventGoal2: '1500 coins', claim: 'Claim', claimed: 'Claimed' });
    }
    count(ev) { return this.counts[ev] || 0; }
    icon(ev) { return (EVENTS[ev] || {}).icon || ''; }
    bind() {
      // settings row: preview / switch off the season
      const card = document.querySelector('#settings .card');
      const row = document.createElement('div'); row.className = 'setting';
      row.innerHTML = `<span><svg><use href="#i-globe"/></svg><b data-i18n="season"></b></span><div class="seg" id="optSeason">
          <button data-e="auto" data-i18n="sAuto"></button><button data-e="olive">🫒</button><button data-e="ramadan">🏮</button><button data-e="winter">❄️</button><button data-e="none" data-i18n="sNone"></button></div>`;
      card.insertBefore(row, card.querySelector('#settingsDone'));
      row.querySelectorAll('button').forEach(b => {
        b.setAttribute('aria-pressed', b.dataset.e === this.override ? 'true' : 'false');
        b.addEventListener('click', () => { UI.store.set('eventOverride', b.dataset.e); location.reload(); });
      });
      // menu banner
      if (!this.ev) return;
      const E = EVENTS[this.ev];
      const top = document.querySelector('#menu .menu-top');
      const ban = document.createElement('button'); ban.id = 'eventBanner'; ban.className = 'ev-banner glass';
      top.appendChild(ban);
      const st = document.createElement('style');
      st.textContent = `.ev-banner{display:flex;align-items:center;gap:8px;border-radius:999px;padding:6px 14px;font:inherit;font-weight:800;font-size:15px;color:#fff;cursor:pointer;pointer-events:auto}
        .ev-banner .bar{width:70px;height:7px;border-radius:9px;background:rgba(255,255,255,.2);overflow:hidden}.ev-banner .bar i{display:block;height:100%;background:var(--lemon)}
        .ev-banner .n{direction:ltr;font-variant-numeric:tabular-nums;color:var(--lemon)}`;
      document.head.appendChild(st);
      ban.addEventListener('click', () => { VR.Audio.play('click'); this.claimRewards(true); });
      this.refreshBanner();
    }
    refreshBanner() {
      const b = document.getElementById('eventBanner'); if (!b) return;
      const E = EVENTS[this.ev], n = this.count(this.ev), goal = GOALS.find(x => n < x) || GOALS[GOALS.length - 1];
      b.innerHTML = `<span>${E.icon}</span><span>${UI.lang === 'ar' ? E.ar : E.en}</span><span class="bar"><i style="width:${Math.min(100, n / goal * 100)}%"></i></span><span class="n">${UI.fmt(n)}/${goal}</span>`;
    }
    // reaching 300 pays 1500 coins once; the 150 reward is the character (unlocked in the shop)
    claimRewards(tapped) {
      const n = this.count(this.ev), key = this.ev + ':300';
      if (n >= 300 && !this.claimed[key]) {
        this.claimed[key] = 1; UI.store.set('eventClaimed', this.claimed);
        this.g.bank += 1500; UI.store.set('bank', this.g.bank); UI.menuStats(this.g.best, this.g.bank);
        VR.Audio.play('fanfare'); UI.toast('+1,500', 1600, true); return;
      }
      if (tapped) {
        const E = EVENTS[this.ev];
        UI.toast(n >= 150 ? (UI.lang === 'ar' ? 'افتح ' : 'Unlock ') + (UI.lang === 'ar' ? VR.CHARACTERS.find(c => c.id === E.char).name : VR.CHARACTERS.find(c => c.id === E.char).nameEn) + ' ' + (UI.lang === 'ar' ? 'من الشخصيات' : 'in Characters')
          : (UI.lang === 'ar' ? `اجمع ${E.item} على السكة: 150 = شخصية، 300 = 1500 عملة` : `Collect ${E.itemEn} on the tracks: 150 = character, 300 = 1500 coins`), 2600, true);
      }
    }
    state(s) { if (s === 'menu') { this.refreshBanner(); if (this.ev) this.claimRewards(false); } }
    warm(on) { if (this.set) this.set.mesh.visible = true; }
    reset() { if (this.set) this.set.clear(); }
    shift(dz) { if (this.set) for (const i of this.set.active) this.set.items[i].z += dz; }

    chunk(chunk, plan) {
      if (!this.ev) return;
      const w = this.g.world;
      if (!chunk.style.startsWith('tunnel')) {
        for (const dz of [10, 30]) { const o = w.pool.get('deco_' + this.ev); o.position.set(0, 0, chunk.z0 - dz); chunk.parts.push(o); }
      }
      if (!plan || chunk.id < 3 || this.g.state !== 'playing') return;
      // turn a couple of this chunk's coins into event items
      const def = VR.CHARACTERS.find(c => c.id === this.g.selectedId);
      const n = Math.round(2 * ((def && def.eventBonus) || 1) * (0.6 + Math.random() * 0.8));
      const coins = plan.coins.slice();
      for (let k = 0; k < n && coins.length; k++) {
        const c = coins.splice((Math.random() * coins.length) | 0, 1)[0];
        const x = c.x * C.LANE_WIDTH, z = chunk.z0 - c.z;
        if (this.g.collect.removeCoinAt(x, c.y, z)) this.set.spawn(x, c.y, z, chunk.id);
      }
    }
    update(dt) {
      if (!this.set) return;
      const g = this.g, p = g.player, S = this.set;
      const m4 = this._m || (this._m = new T.Matrix4()), q = this._q || (this._q = new T.Quaternion()), v = this._p || (this._p = new T.Vector3()), s = this._s || (this._s = new T.Vector3(1, 1, 1));
      const e = this._e || (this._e = new T.Euler());
      this.t = (this.t || 0) + dt;
      const magnet = g.powerups.active('magnet') || g.powerups.active('lemonade');
      for (const i of S.active) {
        const it = S.items[i];
        if (it.z - p.z > 6) { S.kill(i); continue; }
        if (magnet && Math.abs(it.z - p.z) < C.MAGNET_RADIUS) it.magnet = true;
        if (it.magnet) { const k = Math.min(1, dt * 12); it.x += (p.x - it.x) * k; it.y += (p.y + 0.9 - it.y) * k; it.z += (p.z - it.z) * k; }
        if (Math.abs(it.z - p.z) < 0.8 && Math.abs(it.x - p.x) < 0.9 && it.y > p.y - 0.3 && it.y < p.y + p.height + 0.4) { this.collect(it); S.kill(i); continue; }
        e.set(0, this.t * 2.5 + it.z, Math.sin(this.t * 3 + it.z) * 0.2); q.setFromEuler(e);
        m4.compose(v.set(it.x, it.y + Math.sin(this.t * 3 + it.z) * 0.1, it.z), q, s);
        S.mesh.setMatrixAt(i, m4);
      }
      S.mesh.instanceMatrix.needsUpdate = true; S.trim();
    }
    collect(it) {
      const g = this.g, E = EVENTS[this.ev];
      this.counts[this.ev] = this.count(this.ev) + 1; UI.store.set('eventCounts', this.counts);
      g.score += 30 * g.multiplier;
      g.fx.sparkle(it.x, it.y, it.z, E.color, 12, 3.5, -g.speed * 0.9);
      VR.Audio.play('gem');
      const [sx, sy] = g.screenPos(it.x, it.y + 0.6, it.z);
      UI.popup(E.icon + ' +1', sx, sy);
      const n = this.count(this.ev);
      if (n === 150 || n === 300) UI.toast(E.icon + ' ' + n + '!', 1500, true);
    }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Events);
})();

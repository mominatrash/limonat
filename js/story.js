/* =====================================================================
 * STORY MODE — "رحلة ليمونات" (Limonat's journey)
 * Sitti (grandma) is making the biggest jug of lemonade in the village
 * for cousin's wedding, and the lemons are scattered along the railway.
 * 8 hand-tuned levels: fixed seed (same track every time), fixed biomes,
 * weather, a finish line, and 3 stars:
 *   ★ reach the finish   ★ the level's objective   ★ flawless (no stumble, no revive)
 * ===================================================================== */
(function () {
  const T = THREE, C = VR.CONFIG, UI = VR.UI;
  const L = (o) => o;
  const LEVELS = [
    L({ id: 1, ar: 'أول الطريق', en: 'First steps', goal: 500, seed: 1101, biomes: ['grove'], obj: { type: 'coins', n: 40 }, diff: [0.02, 3000], reward: 150,
      intro: [['sitti', 'يا حبيبي! عرس ابن عمك بعد أسبوع، وبدي أعمل أكبر إبريق ليموناضة شافته البلد.', 'My dear! Your cousin’s wedding is next week and I want to make the biggest jug of lemonade the village has ever seen.'],
              ['hero', 'على عيني يا ستّي! من وين بجيب الليمون؟', 'Anything for you, Sitti! Where do I get the lemons?'],
              ['sitti', 'اركض على السكة لبيّارة الليمون، وانتبه من القطارات!', 'Run along the railway to the lemon grove, and mind the trains!']],
      outro: ['sitti', 'شاطر! هاي أول الطريق بس.', 'Well done! That’s only the beginning.'] }),
    L({ id: 2, ar: 'سلة الليمون', en: 'A basket of lemons', goal: 800, seed: 1202, biomes: ['grove', 'village'], obj: { type: 'lemons', n: 4 }, lemonMul: 2.2, diff: [0.08, 2600], reward: 200,
      intro: [['sitti', 'الليمون الطيب بيلمع. جيبلي 4 ليمونات على الأقل.', 'Good lemons shine. Bring me at least 4.'],
              ['hero', 'بجيبلك سلة كاملة!', 'I’ll bring you a whole basket!']],
      outro: ['sitti', 'ريحتهم بتجنن! كمّل.', 'They smell amazing! Keep going.'] }),
    L({ id: 3, ar: 'الماعز الشقي', en: 'The cheeky goat', goal: 1000, seed: 1303, biomes: ['village'], obj: { type: 'thief' }, thief: 260, diff: [0.12, 2400], reward: 250,
      intro: [['sitti', 'يا ويلي! ماعز أبو سليم سرق كيس الليمون وهرب على السكة!', 'Oh no! Abu Salim’s goat stole the lemon sack and ran onto the tracks!'],
              ['hero', 'ما رح يفلت مني!', 'It won’t get away from me!']],
      outro: ['sitti', 'هههه مسكته! هاد الماعز ما بيتوب.', 'Haha, you caught it! That goat never learns.'] }),
    L({ id: 4, ar: 'جسر الوادي', en: 'Valley bridges', goal: 1300, seed: 1404, biomes: ['forest', 'mountains'], styles: { bridge: 4, tunnel: 0.5 }, obj: { type: 'coins', n: 150 }, diff: [0.18, 2200], reward: 300,
      intro: [['sitti', 'بدنا مصاري للسكر والنعنع. لمّ 150 عملة وإنت ع الجسور.', 'We need money for sugar and mint. Collect 150 coins on the bridges.']],
      outro: ['sitti', 'هيك صار عنا سكر لسنة!', 'Now we have sugar for a year!'] }),
    L({ id: 5, ar: 'العاصفة', en: 'The sandstorm', goal: 1500, seed: 1505, biomes: ['desert'], weather: 'sandstorm', obj: { type: 'lemons', n: 5 }, lemonMul: 2, diff: [0.24, 2000], reward: 350,
      intro: [['sitti', 'في ليمون صحراوي نادر ورا الكثبان، بس في عاصفة جاية!', 'There are rare desert lemons past the dunes, but a storm is coming!'],
              ['hero', 'بغمّض عيوني وبركض!', 'I’ll squint and run!']],
      outro: ['sitti', 'رجعت ومعك الليمون! الله يحميك.', 'You made it back with the lemons! Bless you.'] }),
    L({ id: 6, ar: 'النفق الطويل', en: 'The long tunnel', goal: 1700, seed: 1606, biomes: ['mountains', 'snow'], styles: { tunnel: 5, bridge: 0.5 }, weather: 'fog', obj: { type: 'coins', n: 250 }, diff: [0.3, 1900], reward: 400,
      intro: [['sitti', 'الطريق للجبل كله أنفاق وضباب. خليك صاحي!', 'The mountain road is all tunnels and fog. Stay sharp!']],
      outro: ['sitti', 'برد الجبل ما وقفك!', 'The mountain cold didn’t stop you!'] }),
    L({ id: 7, ar: 'ليل المدينة', en: 'City nights', goal: 2000, seed: 1707, biomes: ['city'], weather: 'rain', obj: { type: 'thief' }, thief: 700, diff: [0.36, 1800], reward: 500,
      intro: [['sitti', 'نفس الماعز! لحقك للمدينة والدنيا شتا.', 'The same goat! It followed you to the city, and it’s pouring.'],
              ['hero', 'المرة هاي بمسكه من قرونه!', 'This time I’m grabbing it by the horns!']],
      outro: ['sitti', 'بطل! هلأ ع العرس!', 'A hero! Now, to the wedding!'] }),
    L({ id: 8, ar: 'ليلة العرس', en: 'The wedding night', goal: 2500, seed: 1808, biomes: ['village', 'grove'], obj: { type: 'lemons', n: 8 }, lemonMul: 2, diff: [0.42, 1700], reward: 1200,
      intro: [['sitti', 'الضيوف وصلوا! بدي 8 ليمونات كمان وبنخلص.', 'The guests are here! Eight more lemons and we’re done.'],
              ['hero', 'آخر ركضة… يلا!', 'Last run… let’s go!']],
      outro: ['sitti', 'أطيب ليموناضة بالبلد! الله يرضى عليك يا حبيبي.', 'The best lemonade in the village! God bless you, my dear.'] }),
  ];
  VR.STORY = LEVELS;

  // ------------------------------------------------------------ portraits (inline SVG)
  const FACE = {
    sitti: `<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="38" fill="#ffe7c7"/><path d="M8 44c0-22 14-36 32-36s32 14 32 36c0 8-2 14-5 18-3-18-12-30-27-30S16 44 13 62c-3-4-5-10-5-18z" fill="#fbfbf7"/><path d="M13 62c3 8 13 14 27 14s24-6 27-14" fill="#e9e3d5"/><ellipse cx="40" cy="48" rx="19" ry="21" fill="#f3c9a2"/><circle cx="32" cy="46" r="6" fill="none" stroke="#6b4a32" stroke-width="2"/><circle cx="48" cy="46" r="6" fill="none" stroke="#6b4a32" stroke-width="2"/><path d="M38 46h4" stroke="#6b4a32" stroke-width="2"/><circle cx="32" cy="46" r="2" fill="#2a1d14"/><circle cx="48" cy="46" r="2" fill="#2a1d14"/><path d="M33 58c4 4 10 4 14 0" stroke="#b5533c" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="26" cy="54" r="3" fill="#f2a58c" opacity=".6"/><circle cx="54" cy="54" r="3" fill="#f2a58c" opacity=".6"/><path d="M20 30c8-8 32-8 40 0" stroke="#d6b35a" stroke-width="3" fill="none" stroke-dasharray="3 3"/></svg>`,
    hero: `<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="38" fill="#cfe9ff"/><circle cx="40" cy="44" r="24" fill="#f4f3ef" stroke="#161616" stroke-width="2.5"/><path d="M16 38c0-16 10-22 24-22s24 6 24 22z" fill="#1b1b1d"/><path d="M42 16c4-8 12-10 18-8-3 4-8 7-14 8" fill="#fafaf8" stroke="#161616" stroke-width="2"/><ellipse cx="44" cy="46" rx="7" ry="8" fill="#fff" stroke="#161616" stroke-width="2.5"/><ellipse cx="30" cy="46" rx="6.5" ry="7.5" fill="#fff" stroke="#161616" stroke-width="2.5"/><circle cx="42" cy="46" r="2.6" fill="#161616"/><circle cx="28" cy="46" r="2.4" fill="#161616"/><path d="M34 58h6" stroke="#161616" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  };

  function finishGate(ar) {
    const g = new T.Group(), mb = new VR.MB(61);
    const X = VR.HALF_TRACK + 0.9;
    for (const s of [-1, 1]) {
      mb.cyl('paint', 0xffffff, s * X, 3.2, 0, 0.16, 0.18, 6.4, { seg: 12 });
      for (let i = 0; i < 8; i++) mb.cyl('paint', i % 2 ? 0x2f8a45 : 0xe8433a, s * X, 0.5 + i * 0.75, 0, 0.19, 0.19, 0.25, { seg: 12 });
      for (let i = 0; i < 5; i++) mb.sphere('gloss', [0xffd23f, 0xe8433a, 0x3ec1ff, 0x7bc86c, 0xe86fb3][i], s * (X + 0.2) + Math.sin(i * 2) * 0.3, 7.0 + i * 0.25, Math.cos(i * 2) * 0.3, 0.32, { sy: 1.2, seg: 12 });
    }
    g.add(mb.build({ receive: false }));
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 192;
    const c = cv.getContext('2d');
    for (let x = 0; x < 1024; x += 32) for (let y = 0; y < 192; y += 32) { c.fillStyle = ((x + y) / 32) % 2 ? '#111' : '#fff'; c.fillRect(x, y, 32, 32); }
    c.fillStyle = 'rgba(20,110,60,.92)'; c.fillRect(120, 22, 784, 148);
    c.fillStyle = '#ffd43b'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '800 92px "Baloo Bhaijaan 2", Tahoma, sans-serif'; c.direction = ar ? 'rtl' : 'ltr';
    c.fillText(ar ? 'خط النهاية' : 'FINISH', 512, 100);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    const mat = new T.MeshBasicMaterial({ map: tex, color: new T.Color(1.2, 1.2, 1.2), side: T.DoubleSide });
    const banner = new T.Mesh(new T.PlaneGeometry(X * 2, X * 2 * 192 / 1024), mat);
    banner.position.set(0, 6.2, 0); g.add(banner);
    g.userData.dispose = () => { tex.dispose(); mat.dispose(); banner.geometry.dispose(); };
    return g;
  }

  class Story {
    constructor(game) {
      this.name = 'story'; this.g = game;
      this.stars = UI.store.get('storyStars', {});
      this.level = null;
      UI.addStrings({
        story: 'القصة', storyTitle: 'رحلة ليمونات', storyLocked: 'خلّص المرحلة اللي قبلها', next: 'التالي', start: 'يلا!', arrived: 'وصلت!',
        objLemons: 'اجمع {n} ليمونات', objCoins: 'اجمع {n} عملة', objThief: 'امسك الماعز', objFinish: 'وصلت لخط النهاية', objFlawless: 'بدون تعثّر ولا متابعة',
        nextLevel: 'المرحلة الجاية', retry: 'أعد المحاولة', sitti: 'ستّي', hero: 'إنت', storyDone: 'خلصت القصة كلها! 🎉', m2: 'م',
      }, {
        story: 'Story', storyTitle: 'Limonat’s journey', storyLocked: 'Finish the previous level', next: 'Next', start: 'Go!', arrived: 'You made it!',
        objLemons: 'Collect {n} lemons', objCoins: 'Collect {n} coins', objThief: 'Catch the goat', objFinish: 'Reach the finish line', objFlawless: 'No stumbles, no continues',
        nextLevel: 'Next level', retry: 'Try again', sitti: 'Sitti', hero: 'You', storyDone: 'Story complete! 🎉', m2: 'm',
      });
    }
    objText(o) {
      if (!o) return UI.t('objFinish');
      return UI.t(o.type === 'lemons' ? 'objLemons' : o.type === 'coins' ? 'objCoins' : 'objThief').replace('{n}', o.n);
    }
    unlocked(i) { return i === 0 || (this.stars[LEVELS[i - 1].id] || 0) > 0; }

    bind() {
      UI.addScreen('story'); UI.addScreen('dialog'); UI.addScreen('levelDone', 'levelDone', false);
      const add = (html) => { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d.firstElementChild); };
      add(`<section id="story" class="screen dim" hidden><div class="card glass rise story-card">
            <h2 data-i18n="storyTitle"></h2><div class="lv-list" id="lvList"></div>
            <button class="btn" id="storyBack"><svg><use href="#i-home"/></svg><span data-i18n="menu"></span></button></div></section>`);
      add(`<section id="dialog" class="screen" hidden style="justify-content:flex-end"><div class="dlg glass rise">
            <div class="dlg-face" id="dlgFace"></div><div class="dlg-body"><b id="dlgWho"></b><p id="dlgText"></p>
            <div class="dlg-goal" id="dlgGoal"></div></div>
            <button class="btn primary" id="dlgNext" style="font-size:20px;min-height:52px"></button></div></section>`);
      add(`<section id="levelDone" class="screen dim" hidden><div class="card glass rise">
            <h2 data-i18n="arrived"></h2><div class="lv-stars" id="ldStars"></div><div class="lv-objs" id="ldObjs"></div>
            <div class="lv-reward" id="ldReward"></div>
            <button class="btn primary" id="ldNext"></button>
            <div class="row2"><button class="btn" id="ldRetry"><svg><use href="#i-retry"/></svg><span data-i18n="retry"></span></button>
            <button class="btn" id="ldMenu"><svg><use href="#i-home"/></svg><span data-i18n="menu"></span></button></div></div></section>`);
      const st = document.createElement('style');
      st.textContent = `.lv-list{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
        .lv{position:relative;display:flex;flex-direction:column;gap:2px;align-items:flex-start;text-align:start;padding:10px 12px;border-radius:16px;border:1px solid var(--edge);background:var(--glass-2);color:var(--text);font:inherit;cursor:pointer}
        .lv .n{font-size:13px;color:var(--muted);font-weight:700}.lv b{font-size:17px;line-height:1.2}.lv .st{font-size:15px;letter-spacing:2px;color:#6b7280;direction:ltr}.lv .st i{font-style:normal;color:var(--lemon)}
        .lv.locked{opacity:.45;cursor:not-allowed}.lv.cur{border-color:var(--lemon);box-shadow:0 0 0 1px var(--lemon) inset}
        .dlg{width:min(620px,100%);display:grid;grid-template-columns:auto 1fr;gap:10px 14px;align-items:center;padding:14px;border-radius:24px}
        .dlg-face svg{width:78px;height:78px;display:block}.dlg-body b{color:var(--lemon);font-size:16px}.dlg-body p{margin:2px 0 0;font-size:18px;line-height:1.45;font-weight:600}
        .dlg-goal{margin-top:6px;font-size:14px;color:var(--muted)}.dlg-goal:empty{display:none}.dlg #dlgNext{grid-column:1/-1}
        .lv-stars{display:flex;justify-content:center;gap:10px;font-size:54px;direction:ltr}.lv-stars span{color:#3a3f52;filter:drop-shadow(0 4px 10px rgba(0,0,0,.3))}.lv-stars span.on{color:var(--lemon);animation:starPop .5s cubic-bezier(.2,.9,.3,1.5) both}
        @keyframes starPop{from{transform:scale(0) rotate(-40deg)}to{transform:none}}
        .lv-objs{display:flex;flex-direction:column;gap:6px}.lv-objs div{display:flex;gap:8px;align-items:center;font-weight:700;padding:6px 10px;border-radius:12px;background:var(--glass-2)}.lv-objs div.ok{color:#9ff0b8}.lv-objs div:not(.ok){color:var(--muted)}
        .lv-reward{text-align:center;font-weight:800;color:var(--lemon);font-size:20px;direction:ltr}.lv-reward:empty{display:none}`;
      document.head.appendChild(st);
      UI.bind('storyBack', () => this.g.setState('menu'));
      UI.bind('dlgNext', () => this.nextLine());
      UI.bind('ldNext', () => { const i = LEVELS.indexOf(this.level); if (i < LEVELS.length - 1) this.pick(i + 1); else { this.g.toMenu(); } });
      UI.bind('ldRetry', () => this.play(this.level));
      UI.bind('ldMenu', () => this.g.toMenu());
    }
    open() { this.g.setState('story'); UI.setLang(UI.lang); this.renderList(); }
    renderList() {
      const ar = UI.lang === 'ar';
      const firstOpen = LEVELS.findIndex((l, i) => this.unlocked(i) && !this.stars[l.id]);
      document.getElementById('lvList').innerHTML = LEVELS.map((l, i) => {
        const s = this.stars[l.id] || 0, lock = !this.unlocked(i);
        return `<button class="lv${lock ? ' locked' : ''}${i === firstOpen ? ' cur' : ''}" data-i="${i}"><span class="n">${ar ? 'المرحلة' : 'Level'} ${l.id} · ${UI.fmt(l.goal)} ${UI.t('m2')}</span><b>${ar ? l.ar : l.en}</b>`
          + `<span class="st">${[0, 1, 2].map(k => k < s ? '<i>★</i>' : '★').join('')}</span></button>`;
      }).join('');
      document.querySelectorAll('#lvList .lv').forEach(b => b.addEventListener('click', () => {
        const i = +b.dataset.i;
        if (!this.unlocked(i)) { VR.Audio.play('denied'); UI.toast(UI.t('storyLocked'), 1200); return; }
        VR.Audio.play('click'); this.pick(i);
      }));
    }
    // dialogue first, then the run
    pick(i) {
      this.level = LEVELS[i];
      this.lines = this.level.intro.slice(); this.afterDialog = () => this.play(this.level);
      this.g.setState('dialog'); this.showLine(true);
    }
    showLine(withGoal) {
      const [who, ar, en] = this.lines[0], isAr = UI.lang === 'ar';
      document.getElementById('dlgFace').innerHTML = FACE[who];
      document.getElementById('dlgWho').textContent = UI.t(who);
      document.getElementById('dlgText').textContent = isAr ? ar : en;
      const last = this.lines.length === 1;
      document.getElementById('dlgGoal').textContent = last && withGoal ? '🎯 ' + this.objText(this.level.obj) + ' · ' + UI.fmt(this.level.goal) + ' ' + UI.t('m2') : '';
      document.getElementById('dlgNext').textContent = last ? UI.t(withGoal ? 'start' : 'next') : UI.t('next');
      VR.Audio.play('click');
    }
    nextLine() {
      this.lines.shift();
      if (this.lines.length) this.showLine(true);
      else { const f = this.afterDialog; this.afterDialog = null; if (f) f(); }
    }
    play(lv) {
      this.level = lv;
      this.g.start({ mode: 'story', level: lv.id, seed: lv.seed, biomes: lv.biomes, styles: lv.styles, forks: false, weather: lv.weather, thief: lv.thief, lemonMul: lv.lemonMul });
    }

    // ------------------------------------------------------------ the run
    runStart(opts) {
      this.active = opts.mode === 'story';
      if (!this.active) return;
      this.level = LEVELS.find(l => l.id === opts.level);
      const [base, ramp] = this.level.diff;
      this.g.diffFn = (d) => Math.min(0.95, base + d / ramp * 0.5);
      this.caught = false; this.gatePlaced = false; this.done = false;
      UI.toast((UI.lang === 'ar' ? this.level.ar : this.level.en) + ' · ' + this.objText(this.level.obj), 2200, true);
    }
    leaveRun() { this.active = false; }
    thiefCaught() { this.caught = true; }
    chunk(chunk) {
      if (!this.active || this.gatePlaced) return;
      const g = this.g, zGoal = g.player.z - (this.level.goal - g.distance);
      if (zGoal <= chunk.z0 && zGoal > chunk.z0 - C.CHUNK_LENGTH) {
        const gate = finishGate(UI.lang === 'ar'); gate.position.set(0, 0, zGoal);
        g.scene.add(gate); (chunk.extras || (chunk.extras = [])).push(gate);
        this.gatePlaced = true;
      }
    }
    update() {
      if (!this.active || this.done) return;
      const g = this.g;
      if (g.distance >= this.level.goal) this.finish();
    }
    objDone() {
      const o = this.level.obj, g = this.g;
      if (!o) return true;
      if (o.type === 'lemons') return g.lemonsRun >= o.n;
      if (o.type === 'coins') return g.coins >= o.n;
      return this.caught;
    }
    finish() {
      const g = this.g, lv = this.level;
      this.done = true;
      const got = [true, this.objDone(), g.stumbles === 0 && !g.revived];
      const stars = got.filter(Boolean).length;
      const prev = this.stars[lv.id] || 0;
      const reward = stars > prev ? Math.round(lv.reward * (stars - prev) / 3) : 0;
      if (stars > prev) { this.stars[lv.id] = stars; UI.store.set('storyStars', this.stars); }
      g.bank += g.coins + reward; UI.store.set('bank', g.bank);
      g.missions.endRun({ dist: g.distance, coins: g.coins }); g.missions.bump('storyStars', Math.max(0, stars - prev));
      VR.Audio.jet(false); VR.Audio.play('fanfare'); VR.Audio.setMusicVolume(0.5);
      g.fx.confetti(g.player.x, g.player.y + 2, g.player.z, 140);
      this.finT = 0; this.fireT = 0;
      g.setState('levelDone');
      const ar = UI.lang === 'ar';
      document.getElementById('ldStars').innerHTML = [0, 1, 2].map(i => `<span class="${i < stars ? 'on' : ''}" style="animation-delay:${0.15 + i * 0.25}s">★</span>`).join('');
      const rows = [[got[0], UI.t('objFinish')], [got[1], this.objText(lv.obj)], [got[2], UI.t('objFlawless')]];
      document.getElementById('ldObjs').innerHTML = rows.map(([ok, t]) => `<div class="${ok ? 'ok' : ''}">${ok ? '✔' : '✖'} ${t}</div>`).join('');
      document.getElementById('ldReward').innerHTML = reward ? `+${UI.fmt(reward)} <svg class="coin" style="width:20px;height:20px;display:inline"><use href="#i-coin"/></svg>` : '';
      const last = LEVELS.indexOf(lv) === LEVELS.length - 1;
      document.getElementById('ldNext').innerHTML = last ? `<span>${UI.t('storyDone')}</span>` : `<svg><use href="#i-play"/></svg><span>${UI.t('nextLevel')}</span>`;
      // Sitti's line after a short celebration
      setTimeout(() => { if (g.state === 'levelDone') UI.toast((ar ? lv.outro[1] : lv.outro[2]), 2600, true); }, 900);
    }
    // victory lap: the hero slows down and cheers, the camera swings round to the front
    finishUpdate(dt) {
      const g = this.g, p = g.player;
      this.finT += dt; this.fireT -= dt;
      const t = this.finT;
      if (t < 1.2) { const v = g.speed * Math.max(0, 1 - t / 1.2); p.z -= v * dt; p.animate(dt, v, g); }
      else { if (!(p.cheer > 0) && (t % 2.4) < dt * 1.5) p.cheer = 1; p.animateIdle(dt, t, 0, 0); p.object.rotation.y = Math.PI; p.object.position.set(p.x, p.y, p.z); }
      if (this.fireT <= 0) { this.fireT = 0.5; g.fx.ring(p.x + (Math.random() - 0.5) * 8, 6 + Math.random() * 3, p.z - 8 - Math.random() * 6, [0xffd23f, 0xe8433a, 0x3ec1ff, 0x7bc86c][(Math.random() * 4) | 0], 28, 7); VR.Audio.play('tick'); }
      const e = Math.min(1, t / 2.2), k = e * e * (3 - 2 * e);
      const ang = k * Math.PI * 0.85;
      const cam = g.camera.position;
      cam.lerp(g._v.set(p.x + Math.sin(ang) * 5.5, p.y + 2.1 - k * 0.6, p.z + Math.cos(ang) * 5.5), 1 - Math.exp(-dt * 3));
      g.camLook.lerp(g._v2.set(p.x, p.y + 1.1, p.z), 1 - Math.exp(-dt * 4));
      g.camera.lookAt(g.camLook);
      g.fx.update(dt); g.collect.update(dt, p, null);
    }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Story);
})();

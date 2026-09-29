/* =====================================================================
 * DAILY CHALLENGE + GHOST
 * • One railway per day (seed = YYYYMMDD) — identical for everyone.
 * • Your daily run is recorded (10 samples/s: distance, lane position,
 *   height, slide/fly flags), packed to ~2-4 KB and put in a share link:
 *       …/limonat/#c=<seed>.<score>.<name>.<data>
 * • Whoever opens the link races your GHOST (a see-through copy of you
 *   with your name above it) on the same track, and sees who won.
 * • First daily run each day pays a bonus; playing on consecutive days
 *   builds a streak that raises it.
 * ===================================================================== */
(function () {
  const T = THREE, UI = VR.UI, A = VR.Anim, C = VR.CONFIG;
  const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  const b64u = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = (str) => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
  const utf8 = (s) => new TextEncoder().encode(s), unutf8 = (b) => new TextDecoder().decode(b);
  async function deflate(bytes) {
    if (!window.CompressionStream) return bytes;
    const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(bytes); w.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  }
  async function inflate(bytes) {
    if (!window.DecompressionStream) return bytes;
    try { const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(bytes); w.close(); return new Uint8Array(await new Response(ds.readable).arrayBuffer()); }
    catch (e) { return bytes; }
  }
  // sample = [dd (1/20 m), x (1/20 m, signed), y (1/20 m), flags]
  function pack(samples) {
    const out = new Uint8Array(samples.length * 4);
    samples.forEach((s, i) => { out[i * 4] = s[0]; out[i * 4 + 1] = s[1] & 255; out[i * 4 + 2] = s[2]; out[i * 4 + 3] = s[3]; });
    return out;
  }
  function unpack(bytes) {
    const n = bytes.length >> 2, d = new Float32Array(n + 1), x = new Float32Array(n + 1), y = new Float32Array(n + 1), f = new Uint8Array(n + 1);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      acc += bytes[i * 4] / 20; d[i + 1] = acc;
      x[i + 1] = ((bytes[i * 4 + 1] << 24) >> 24) / 20; y[i + 1] = bytes[i * 4 + 2] / 20; f[i + 1] = bytes[i * 4 + 3];
    }
    return { d, x, y, f, n: n + 1 };
  }

  function ghostRig() {
    const def = VR.CHARACTERS[0];
    const rig = VR.buildCharacter(def);
    const mat = new T.MeshBasicMaterial({ color: new T.Color(0.55, 0.85, 1.4), transparent: true, opacity: 0.42, depthWrite: false });
    rig.root.traverse(o => { if (o.isMesh) { if (o.material === VR.charMaterials.outlineMat) o.visible = false; else o.material = mat; o.castShadow = false; } });
    return { rig, mat };
  }
  function nameTag(text) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(16,20,34,.75)'; c.beginPath(); c.roundRect ? c.roundRect(8, 8, 240, 48, 24) : c.rect(8, 8, 240, 48); c.fill();
    c.fillStyle = '#9fdcff'; c.font = '800 30px "Baloo Bhaijaan 2", Tahoma, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('👻 ' + text.slice(0, 14), 128, 34);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthWrite: false, fog: false }));
    sp.scale.set(1.6, 0.4, 1); return sp;
  }

  class Daily {
    constructor(game) {
      this.name = 'daily'; this.g = game;
      this.data = Object.assign({ day: 0, best: 0, streak: 0, lastDay: 0, rec: null, played: 0 }, UI.store.get('daily', {}));
      this.friends = UI.store.get('friendScores', []);
      this.ghost = null; this.rec = null;
      this.pending = this.parseLink();
      UI.addStrings({
        daily: 'تحدّي اليوم', dailyBest: 'أفضل نتيجة اليوم', streak: 'أيام متتالية', dailyBonus: 'مكافأة أول جولة اليوم', share: 'تحدّى صاحبك', copied: 'انسخ الرابط وابعته!', linkCopied: 'تم نسخ الرابط!',
        yourName: 'اسمك', challenged: 'تحدّاك', theirScore: 'نتيجته', accept: 'اقبل التحدي', later: 'بعدين', beat: 'سبقت', lost: 'سبقك', vs: 'ضد', playFirst: 'العب تحدّي اليوم أول',
      }, {
        daily: 'Daily challenge', dailyBest: "Today's best", streak: 'Day streak', dailyBonus: 'First run of the day bonus', share: 'Challenge a friend', copied: 'Copy the link and send it!', linkCopied: 'Link copied!',
        yourName: 'Your name', challenged: 'challenged you', theirScore: 'Their score', accept: 'Accept', later: 'Later', beat: 'You beat', lost: 'You lost to', vs: 'vs', playFirst: 'Play today’s challenge first',
      });
    }
    get playerName() { return UI.store.get('playerName', ''); }
    set playerName(v) { UI.store.set('playerName', v); }
    dateText(seed) { const s = String(seed); return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`; }

    parseLink() {
      const m = /[#&]c=([^&]+)/.exec(location.hash);
      if (!m) return null;
      try {
        const [seed, score, name, data] = m[1].split('.');
        return { seed: +seed, score: +score, name: unutf8(unb64u(name)), data };
      } catch (e) { return null; }
    }
    bind() {
      UI.addScreen('daily'); UI.addScreen('challenge');
      const add = (html) => { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d.firstElementChild); };
      add(`<section id="daily" class="screen dim" hidden><div class="card glass rise">
          <h2 data-i18n="daily"></h2><div class="dy-date" id="dyDate"></div>
          <div class="stats"><div class="stat"><div class="lbl" data-i18n="dailyBest"></div><div class="val" id="dyBest">0</div></div>
            <div class="stat"><div class="lbl" data-i18n="streak"></div><div class="val" id="dyStreak">0</div></div>
            <div class="stat"><div class="lbl" data-i18n="dailyBonus"></div><div class="val" id="dyBonus"></div></div></div>
          <label class="dy-name"><span data-i18n="yourName"></span><input id="dyName" class="code-input" maxlength="16" autocomplete="off"></label>
          <button class="btn primary" id="dyPlay"><svg><use href="#i-play"/></svg><span data-i18n="play"></span></button>
          <button class="btn lemon" id="dyShare"><span data-i18n="share"></span></button>
          <input id="dyLink" class="code-input" readonly hidden>
          <button class="btn" id="dyBack"><svg><use href="#i-home"/></svg><span data-i18n="menu"></span></button></div></section>`);
      add(`<section id="challenge" class="screen dim" hidden><div class="card glass rise">
          <div class="ch-ghost">👻</div><h2 id="chTitle"></h2><div class="dy-date" id="chDate"></div>
          <div class="score-big"><div class="lbl" data-i18n="theirScore"></div><div class="val" id="chScore">0</div></div>
          <button class="btn primary" id="chGo"><svg><use href="#i-play"/></svg><span data-i18n="accept"></span></button>
          <button class="btn" id="chLater"><span data-i18n="later"></span></button></div></section>`);
      const st = document.createElement('style');
      st.textContent = `.dy-date{text-align:center;color:var(--muted);font-weight:700;direction:ltr;margin-top:-8px}.dy-name{display:flex;flex-direction:column;gap:4px;font-weight:700;color:var(--muted);font-size:14px}
        .ch-ghost{font-size:60px;text-align:center;line-height:1;animation:bob 2.4s ease-in-out infinite}#dyLink{font-size:13px;direction:ltr}`;
      document.head.appendChild(st);
      UI.bind('dyPlay', () => { this.saveName(); this.play(null); });
      UI.bind('dyShare', () => { this.saveName(); this.share(); });
      UI.bind('dyBack', () => { this.saveName(); this.g.setState('menu'); });
      UI.bind('chGo', () => { const c = this.pending; this.pending = null; history.replaceState(null, '', location.pathname + location.search); this.play(c); });
      UI.bind('chLater', () => { this.pending = null; history.replaceState(null, '', location.pathname + location.search); this.g.setState('menu'); });
    }
    saveName() { const v = document.getElementById('dyName').value.trim(); if (v) this.playerName = v; }
    // a friend's challenge link opens its screen right after loading
    state(s) {
      if (s === 'menu' && this.pending && !this.shown) {
        this.shown = true;
        const c = this.pending;
        document.getElementById('chTitle').textContent = `${c.name} ${UI.t('challenged')}!`;
        document.getElementById('chDate').textContent = this.dateText(c.seed);
        document.getElementById('chScore').textContent = UI.fmt(c.score);
        setTimeout(() => this.g.setState('challenge'), 50);
      }
    }
    open() {
      const d = this.data, t = today();
      this.g.setState('daily'); UI.setLang(UI.lang);
      document.getElementById('dyDate').textContent = this.dateText(t);
      document.getElementById('dyBest').textContent = UI.fmt(d.day === t ? d.best : 0);
      document.getElementById('dyStreak').textContent = (d.lastDay === t || d.lastDay === this.yesterday()) ? d.streak : 0;
      document.getElementById('dyBonus').innerHTML = d.played === t ? '✔' : '+' + UI.fmt(this.bonus());
      document.getElementById('dyName').value = this.playerName;
      document.getElementById('dyLink').hidden = true;
    }
    yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
    bonus() { const s = (this.data.lastDay === this.yesterday() ? this.data.streak : 0) + 1; return 100 + Math.min(s, 7) * 25; }

    play(challenge) {
      const seed = challenge ? challenge.seed : today();
      this.challenge = challenge;
      this.g.start({ mode: 'daily', seed, forks: true });
    }
    async share() {
      const d = this.data;
      if (!d.rec || d.day !== today()) { VR.Audio.play('denied'); UI.toast(UI.t('playFirst'), 1500); return; }
      const name = this.playerName || (UI.lang === 'ar' ? 'صاحبك' : 'A friend');
      const url = `${location.origin}${location.pathname}#c=${d.day}.${Math.floor(d.best)}.${b64u(utf8(name))}.${d.rec}`;
      const text = UI.lang === 'ar' ? `تحدّيتك بليمونات! ${UI.fmt(d.best)} نقطة — بتقدر تسبقني؟` : `I scored ${UI.fmt(d.best)} in Limonat — can you beat me?`;
      try { if (navigator.share) { await navigator.share({ title: 'ليمونات', text, url }); return; } } catch (e) { /* cancelled */ }
      try { await navigator.clipboard.writeText(url); UI.toast(UI.t('linkCopied'), 1500, true); }
      catch (e) { const inp = document.getElementById('dyLink'); inp.hidden = false; inp.value = url; inp.select(); UI.toast(UI.t('copied'), 1800, true); }
    }

    // ------------------------------------------------------------ recording + ghost
    runStart(opts) {
      this.active = opts.mode === 'daily';
      this.clearGhost();
      if (!this.active) return;
      this.rec = []; this.recT = 0; this.lastD = 0;
      if (this.challenge) this.loadGhost(this.challenge);
    }
    async loadGhost(c) {
      const bytes = await inflate(unb64u(c.data));
      const G = unpack(bytes);
      const { rig, mat } = ghostRig();
      const tag = nameTag(c.name); tag.position.y = 2.35; rig.root.add(tag);
      this.g.scene.add(rig.root);
      this.ghost = { G, rig, mat, tag, name: c.name, score: c.score, pose: A.pose(), phase: 0 };
    }
    clearGhost() {
      if (!this.ghost) return;
      this.g.scene.remove(this.ghost.rig.root);
      this.ghost.mat.dispose(); this.ghost.tag.material.map.dispose(); this.ghost.tag.material.dispose();
      this.ghost = null;
    }
    leaveRun() { this.clearGhost(); this.active = false; this.challenge = null; }
    update(dt) {
      if (!this.active) return;
      const g = this.g, p = g.player;
      // record at 10 Hz
      this.recT += dt;
      while (this.recT >= 0.1 && this.rec.length < 6000) {
        this.recT -= 0.1;
        const dd = Math.max(0, Math.min(255, Math.round((g.distance - this.lastD) * 20)));
        this.lastD += dd / 20;
        this.rec.push([dd, Math.round(p.x * 20), Math.max(0, Math.min(255, Math.round(p.y * 20))), (p.sliding ? 1 : 0) | (p.flying ? 2 : 0)]);
      }
      // ghost playback by run time
      const gh = this.ghost; if (!gh) return;
      const G = gh.G, f = Math.min(G.n - 1.001, g.runTime * 10), i = f | 0, u = f - i;
      const gd = G.d[i] + (G.d[i + 1] - G.d[i]) * u, gx = G.x[i] + (G.x[i + 1] - G.x[i]) * u, gy = G.y[i] + (G.y[i + 1] - G.y[i]) * u, fl = G.f[i + 1];
      const r = gh.rig;
      r.root.visible = g.runTime * 10 < G.n - 1;
      r.root.position.set(gx, gy, p.z - (gd - g.distance));
      gh.phase = (gh.phase + dt * (1.32 + g.speed * 0.036)) % 1;
      A.run(gh.pose, gh.phase, 0.5);
      if (fl & 1) A.lerp(gh.pose, gh.pose, A.P.slide, 1);
      else if (fl & 2) A.fly(gh.pose, g.runTime, 0);
      else if (gy > 0.25) A.lerp(gh.pose, gh.pose, A.P.jumpFall, 0.8);
      A.apply(r, gh.pose);
      if (!(fl & 1) && gy <= 0.25) A.plant(r, 1, 0);
    }
    async runEnd({ score }) {
      if (!this.active) return;
      const g = this.g, t = today(), d = this.data, seed = g.runOpts.seed;
      if (this.challenge) {
        const c = this.challenge, won = score > c.score;
        setTimeout(() => UI.toast(`${won ? UI.t('beat') : UI.t('lost')} ${c.name}! ${UI.fmt(score)} ${UI.t('vs')} ${UI.fmt(c.score)}`, 2600, true), 1700);
        this.friends = this.friends.filter(f => !(f.name === c.name && f.seed === c.seed)).concat([{ name: c.name, score: c.score, seed: c.seed }]).slice(-30);
        UI.store.set('friendScores', this.friends);
        if (won) g.missions.bump('ghostWins');
      }
      if (seed !== t) return;
      // daily bonus + streak (once per day)
      if (d.played !== t) {
        d.streak = d.lastDay === this.yesterday() ? d.streak + 1 : 1; d.lastDay = t; d.played = t;
        const b = 100 + Math.min(d.streak, 7) * 25;
        g.bank += b; UI.store.set('bank', g.bank);
        setTimeout(() => UI.toast(UI.t('dailyBonus') + ' +' + UI.fmt(b), 1800, true), 1600);
      }
      if (d.day !== t) { d.day = t; d.best = 0; d.rec = null; }
      if (score > d.best) {
        d.best = Math.floor(score);
        d.rec = b64u(await deflate(pack(this.rec)));
      }
      UI.store.set('daily', d);
      g.emit('dailyScore', { score, seed: t });
    }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Daily);
})();

/* =====================================================================
 * LEADERBOARD
 *   Friends  — always works: every friend challenge you played + you
 *   Everyone / Today — a real online board once a (free) Supabase project
 *              is connected: put its URL + anon key in CONFIG.LEADERBOARD
 *              (js/config.js). Table SQL is in README.md.
 * ===================================================================== */
(function () {
  const UI = VR.UI;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  class Board {
    constructor(game) {
      this.name = 'board'; this.g = game;
      this.tab = 'friends';
      UI.addStrings({ board: 'المتصدرين', bAll: 'الكل', bToday: 'اليوم', bFriends: 'أصحابي', bYou: 'إنت', bEmpty: 'لسا ما في نتائج', bOffline: 'اللوحة العالمية بدها ربط سيرفر (شوف README)', bLoading: 'جارٍ التحميل…', bError: 'ما قدرنا نوصل للسيرفر' },
                    { board: 'Leaderboard', bAll: 'Everyone', bToday: 'Today', bFriends: 'Friends', bYou: 'You', bEmpty: 'No scores yet', bOffline: 'The global board needs a server (see README)', bLoading: 'Loading…', bError: 'Could not reach the server' });
    }
    get cfg() { const c = VR.CONFIG.LEADERBOARD || {}; return c.url && c.key ? c : null; }
    bind() {
      UI.addScreen('board');
      const d = document.createElement('div');
      d.innerHTML = `<section id="board" class="screen dim" hidden><div class="card glass rise">
          <h2 data-i18n="board"></h2>
          <div class="seg bd-tabs" id="bdTabs"><button data-t="friends" data-i18n="bFriends"></button><button data-t="all" data-i18n="bAll"></button><button data-t="today" data-i18n="bToday"></button></div>
          <ol class="bd-list" id="bdList"></ol>
          <button class="btn" id="bdBack"><svg><use href="#i-home"/></svg><span data-i18n="menu"></span></button></div></section>`;
      document.body.appendChild(d.firstElementChild);
      const st = document.createElement('style');
      st.textContent = `.bd-tabs{align-self:center}.bd-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;min-height:120px}
        .bd-list li{display:grid;grid-template-columns:2em 1fr auto;gap:8px;align-items:center;padding:8px 12px;border-radius:12px;background:var(--glass-2);border:1px solid var(--edge);font-weight:700}
        .bd-list li .r{color:var(--muted);direction:ltr}.bd-list li .s{direction:ltr;font-variant-numeric:tabular-nums;color:var(--lemon)}.bd-list li.me{border-color:var(--lemon)}
        .bd-list li:nth-child(1) .r{color:#ffd43b}.bd-list li:nth-child(2) .r{color:#d8dde6}.bd-list li:nth-child(3) .r{color:#e0a36b}
        .bd-list .msg{display:block;text-align:center;color:var(--muted);background:none;border:0}`;
      document.head.appendChild(st);
      document.querySelectorAll('#bdTabs button').forEach(b => b.addEventListener('click', () => { VR.Audio.play('click'); this.tab = b.dataset.t; this.render(); }));
      UI.bind('bdBack', () => this.g.setState('menu'));
    }
    open() { this.g.setState('board'); UI.setLang(UI.lang); this.render(); }
    rows(list, meName) {
      const el = document.getElementById('bdList');
      if (!list.length) { el.innerHTML = `<li class="msg">${UI.t('bEmpty')}</li>`; return; }
      el.innerHTML = list.slice(0, 50).map((r, i) => `<li class="${r.me || (meName && r.name === meName) ? 'me' : ''}"><span class="r">${i + 1}</span><span>${esc(r.name)}</span><span class="s">${UI.fmt(r.score)}</span></li>`).join('');
    }
    async render() {
      document.querySelectorAll('#bdTabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === this.tab ? 'true' : 'false'));
      const el = document.getElementById('bdList'), me = UI.store.get('playerName', '') || UI.t('bYou');
      if (this.tab === 'friends') {
        const D = this.g.S.daily, fr = (D && D.friends) || [];
        const best = new Map();
        for (const f of fr) best.set(f.name, Math.max(best.get(f.name) || 0, f.score));
        const list = [...best].map(([name, score]) => ({ name, score }));
        list.push({ name: me, score: this.g.best, me: true });
        this.rows(list.sort((a, b) => b.score - a.score));
        return;
      }
      const c = this.cfg;
      if (!c) { el.innerHTML = `<li class="msg">${UI.t('bOffline')}</li>`; return; }
      el.innerHTML = `<li class="msg">${UI.t('bLoading')}</li>`;
      try {
        const day = new Date();
        const d = day.getFullYear() * 10000 + (day.getMonth() + 1) * 100 + day.getDate();
        const q = this.tab === 'today' ? `mode=eq.daily&day=eq.${d}` : 'mode=eq.endless';
        const r = await fetch(`${c.url}/rest/v1/scores?select=name,score&${q}&order=score.desc&limit=50`, { headers: { apikey: c.key, Authorization: 'Bearer ' + c.key } });
        if (!r.ok) throw new Error(r.status);
        this.rows(await r.json(), UI.store.get('playerName', ''));
      } catch (e) { el.innerHTML = `<li class="msg">${UI.t('bError')}</li>`; }
    }
    async submit(mode, score, dist, day) {
      const c = this.cfg, name = UI.store.get('playerName', '');
      if (!c || !name || score < 100) return;
      try {
        await fetch(`${c.url}/rest/v1/scores`, { method: 'POST', headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ name: name.slice(0, 16), score: Math.floor(score), dist: Math.floor(dist), mode, day: day || 0 }) });
      } catch (e) { /* offline: ignore */ }
    }
    runEnd({ score, dist }) { if (this.g.mode === 'endless' && score >= this.g.best) this.submit('endless', score, dist, 0); }
    dailyScore({ score, seed }) { this.submit('daily', score, this.g.distance, seed); }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Board);
})();

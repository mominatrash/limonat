/* =====================================================================
 * FRIENDS BOARD — private by design.
 * Only people you actually played with show up here: friends whose
 * challenge link you opened and friends you raced / teamed up with
 * online, plus you. Nothing is ever uploaded, and there is no public
 * list: strangers never see your name or score, and you never see theirs.
 * ===================================================================== */
(function () {
  const UI = VR.UI;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  class Board {
    constructor(game) {
      this.name = 'board'; this.g = game;
      UI.addStrings({ board: 'المتصدرين', bYou: 'إنت', bEmpty: 'لسا ما لعبت مع حدا', bPrivate: '🔒 بس إنت والأصحاب اللي لعبت معهم' },
                    { board: 'Leaderboard', bYou: 'You', bEmpty: "You haven't played with anyone yet", bPrivate: '🔒 Only you and friends you played with' });
    }
    bind() {
      UI.addScreen('board');
      const d = document.createElement('div');
      d.innerHTML = `<section id="board" class="screen dim" hidden><div class="card glass rise">
          <h2 data-i18n="board"></h2>
          <div class="bd-note" data-i18n="bPrivate"></div>
          <ol class="bd-list" id="bdList"></ol>
          <button class="btn" id="bdBack"><svg><use href="#i-home"/></svg><span data-i18n="menu"></span></button></div></section>`;
      document.body.appendChild(d.firstElementChild);
      const st = document.createElement('style');
      st.textContent = `.bd-note{text-align:center;color:var(--muted);font-weight:700;font-size:13px;margin-top:-6px}
        .bd-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;min-height:120px}
        .bd-list li{display:grid;grid-template-columns:2em 1fr auto;gap:8px;align-items:center;padding:8px 12px;border-radius:12px;background:var(--glass-2);border:1px solid var(--edge);font-weight:700}
        .bd-list li .r{color:var(--muted);direction:ltr}.bd-list li .s{direction:ltr;font-variant-numeric:tabular-nums;color:var(--lemon)}.bd-list li.me{border-color:var(--lemon)}
        .bd-list li:nth-child(1) .r{color:#ffd43b}.bd-list li:nth-child(2) .r{color:#d8dde6}.bd-list li:nth-child(3) .r{color:#e0a36b}
        .bd-list .msg{display:block;text-align:center;color:var(--muted);background:none;border:0}`;
      document.head.appendChild(st);
      UI.bind('bdBack', () => this.g.setState('menu'));
    }
    open() { this.g.setState('board'); UI.setLang(UI.lang); this.render(); }
    render() {
      const el = document.getElementById('bdList'), me = UI.store.get('playerName', '') || UI.t('bYou');
      const D = this.g.S.daily, fr = (D && D.friends) || [];
      const best = new Map();
      for (const f of fr) best.set(f.name, Math.max(best.get(f.name) || 0, f.score));
      const list = [...best].map(([name, score]) => ({ name, score }));
      list.push({ name: me, score: this.g.best, me: true });
      list.sort((a, b) => b.score - a.score);
      el.innerHTML = list.slice(0, 50).map((r, i) => `<li class="${r.me ? 'me' : ''}"><span class="r">${i + 1}</span><span>${esc(r.name)}</span><span class="s">${UI.fmt(r.score)}</span></li>`).join('')
        + (list.length < 2 ? `<li class="msg">${UI.t('bEmpty')}</li>` : '');
    }
    // a friend you just played with online joins your board (kept on this phone only)
    addFriend(name, score) {
      const D = this.g.S.daily; if (!D || !name || !(score > 0)) return;
      D.friends = D.friends.concat([{ name: String(name).slice(0, 16), score: Math.floor(score), seed: 0 }]).slice(-30);
      UI.store.set('friendScores', D.friends);
    }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Board);
})();

/* =====================================================================
 * PLAY WITH A FRIEND — two phones, one railway, at the same time.
 *
 * • Connection: direct phone-to-phone (WebRTC) through PeerJS. The free
 *   public PeerJS server only introduces the two devices; after that the
 *   game data goes straight between them. No account, no server of ours.
 *   (?net=local uses a BroadcastChannel instead: two tabs, for testing.)
 * • Both phones build the SAME world from a shared seed, and each one plays
 *   its own run locally (no lag). ~15 times a second each side sends where
 *   its runner is, and the friend is drawn as a real runner beside you.
 * • Race:  whoever scores more wins.
 * • Co-op: one shared lemon meter, a team score, and when one of you falls
 *   the other can bring them back by grabbing lemons in time.
 * ===================================================================== */
(function () {
  const T = THREE, UI = VR.UI, A = VR.Anim;
  const PEER_SRC = ['https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js'];
  // STUN finds a direct route; PeerJS's free TURN relays when phone networks block one
  const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }];
  const PREFIX = 'limonat-v1-';
  const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const SEND_DT = 1 / 15, DELAY = 0.12, RESCUE_TIME = 15;
  const EMO = ['😂', '🔥', '😱', '👋', '💪'];
  const LOCAL = /[?&]net=local/.test(location.search);

  function loadScript(srcs) {
    return new Promise((res, rej) => {
      const next = (i) => {
        if (i >= srcs.length) { rej({ type: 'load' }); return; }
        const s = document.createElement('script'); s.src = srcs[i]; s.async = true;
        s.onload = () => (window.Peer ? res() : next(i + 1)); s.onerror = () => { s.remove(); next(i + 1); };
        document.head.appendChild(s);
      };
      next(0);
    });
  }

  // ------------------------------------------------------------ transports
  class PeerNet {
    constructor(h) { this.h = h; }
    async ready() { if (!window.Peer) await loadScript(PEER_SRC); }
    async host(code) {
      await this.ready();
      return new Promise((res, rej) => {
        let opened = false;
        const peer = this.peer = new Peer(PREFIX + code, { config: { iceServers: ICE, sdpSemantics: 'unified-plan' }, debug: 0 });
        peer.on('open', () => { opened = true; res(code); });
        peer.on('error', (e) => { if (!opened) { try { peer.destroy(); } catch (x) { /* */ } rej(e); } else this.h.onError(e); });
        peer.on('connection', (c) => {
          if (this.conn && this.conn.open) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 400); }); return; }
          this.attach(c);
        });
        // lost the introduction server: the direct link keeps working, reconnect for new joins
        peer.on('disconnected', () => { setTimeout(() => { try { if (this.peer === peer && !peer.destroyed) peer.reconnect(); } catch (e) { /* */ } }, 1500); });
      });
    }
    async join(code) {
      await this.ready();
      return new Promise((res, rej) => {
        let done = false;
        const fail = (e) => { if (done) return; done = true; clearTimeout(to); rej(e); };
        const to = setTimeout(() => fail({ type: 'timeout' }), 16000);
        const peer = this.peer = new Peer({ config: { iceServers: ICE, sdpSemantics: 'unified-plan' }, debug: 0 });
        peer.on('open', () => {
          const c = peer.connect(PREFIX + code, { serialization: 'json', reliable: true });
          this.attach(c, () => { if (done) return; done = true; clearTimeout(to); res(); });
        });
        peer.on('error', (e) => { if (!done) fail(e); else this.h.onError(e); });
      });
    }
    attach(c, onOpen) {
      this.conn = c;
      c.on('open', () => { if (onOpen) onOpen(); this.h.onOpen(); });
      c.on('data', (d) => this.h.onData(d));
      c.on('close', () => { if (this.conn === c) { this.conn = null; this.h.onClose(); } });
      c.on('error', () => { /* close follows */ });
    }
    get linked() { return !!(this.conn && this.conn.open); }
    dropConn() { const c = this.conn; this.conn = null; try { if (c) c.close(); } catch (e) { /* */ } }
    send(m) { if (this.linked) { try { this.conn.send(m); } catch (e) { /* closing */ } } }
    close() {
      const c = this.conn; this.conn = null;
      try { if (c) c.close(); } catch (e) { /* */ }
      try { if (this.peer) this.peer.destroy(); } catch (e) { /* */ }
      this.peer = null;
    }
  }
  // same-browser test transport (two tabs): ?net=local
  class LocalNet {
    constructor(h) { this.h = h; this.id = Math.random().toString(36).slice(2); this.on = false; }
    open(code) {
      this.bc = new BroadcastChannel('limonat-party-' + code);
      this.bc.onmessage = (e) => {
        const m = e.data; if (!m || m.from === this.id) return;
        if (m.hi) { if (!this.on) { this.on = true; if (m.hi === 1) this.bc.postMessage({ from: this.id, hi: 2 }); this.h.onOpen(); if (this.wait) this.wait(); } return; }
        if (m.bye) { if (this.on) { this.on = false; this.h.onClose(); } return; }
        if (this.on) this.h.onData(m.d);
      };
    }
    async host(code) { this.open(code); return code; }
    join(code) {
      this.open(code);
      return new Promise((res, rej) => {
        const to = setTimeout(() => { this.wait = null; rej({ type: 'peer-unavailable' }); }, 2500);
        this.wait = () => { clearTimeout(to); this.wait = null; res(); };
        this.bc.postMessage({ from: this.id, hi: 1 });
      });
    }
    get linked() { return this.on; }
    dropConn() { this.on = false; }
    send(m) { if (this.on) this.bc.postMessage({ from: this.id, d: m }); }
    close() { if (this.bc) { if (this.on) this.bc.postMessage({ from: this.id, bye: 1 }); this.bc.close(); } this.bc = null; this.on = false; }
  }

  // ------------------------------------------------------------ 3D bits
  function tagSprite(text, color) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(16,20,34,.78)'; c.beginPath(); if (c.roundRect) c.roundRect(8, 8, 240, 48, 24); else c.rect(8, 8, 240, 48); c.fill();
    c.fillStyle = color; c.font = '800 30px "Baloo Bhaijaan 2", Tahoma, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text.slice(0, 16), 128, 34);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false, fog: false, transparent: true }));
    sp.renderOrder = 20; sp.scale.set(1.7, 0.42, 1); return sp;
  }
  const emoTex = {};
  function emoSprite(e) {
    if (!emoTex[e]) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const c = cv.getContext('2d'); c.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(e, 64, 72);
      emoTex[e] = new T.CanvasTexture(cv); emoTex[e].colorSpace = T.SRGBColorSpace;
    }
    const sp = new T.Sprite(new T.SpriteMaterial({ map: emoTex[e], depthWrite: false, depthTest: false, fog: false, transparent: true }));
    sp.renderOrder = 21; sp.scale.set(0.9, 0.9, 1); return sp;
  }

  class Party {
    constructor(game) {
      this.name = 'party'; this.g = game;
      this.net = null; this.role = null; this.code = ''; this.mode = 'race';
      this.meReady = false; this.fr = null; this.rtt = 0;
      this.inRun = false; this.av = null; this.buf = []; this.floats = []; this.taken = [];
      this.pendingCode = (/[#&]room=([A-Za-z0-9]{4,6})/.exec(location.hash) || [])[1] || null;
      UI.addStrings({
        party: 'مع صاحب', ptTitle: 'العب مع صاحبك', ptHost: 'اعمل غرفة', ptJoin: 'ادخل', ptCodePh: 'كود الغرفة', ptOr: 'أو عندك كود؟',
        ptRoomCode: 'كود الغرفة', ptShare: 'ابعت الرابط لصاحبك', ptRace: '🏁 سباق', ptCoop: '🤝 تعاوني',
        ptRaceDesc: 'نفس السكّة بنفس الوقت، واللي بيجمع نقاط أكثر بيفوز.', ptCoopDesc: 'عدّاد ليمونادة مشترك ونقاط فريق، ولما واحد يوقع الثاني بيرجّعه بالليمون.',
        ptWaiting: 'مستني صاحبك يدخل…', ptConnecting: 'عم نوصل…', ptReady: 'جاهز', ptNotReady: 'مش جاهز', ptBothReady: 'يلا!', ptPressReady: 'اضغطوا الثنين «جاهز» عشان نبدأ',
        ptLeave: 'اطلع', ptYou: 'إنت', ptFriend: 'صاحبك', ptJoined: 'دخل صاحبك', ptLeft: 'صاحبك طلع من الغرفة', ptLost: 'انقطع الاتصال مع صاحبك',
        ptErrRoom: 'ما لقينا غرفة بهالكود، تأكد منه', ptErrNet: 'ما قدرنا نوصل لصاحبك. جرّبوا واي فاي أو غيّروا الشبكة', ptErrSrv: 'في مشكلة بالإنترنت أو بسيرفر الربط، جرّب كمان شوي', ptErrOld: 'هالمتصفح ما بيدعم اللعب مع صاحب', ptFull: 'الغرفة مليانة',
        ptCopied: 'تم نسخ الرابط!', ptShareText: 'تعال العب معي ليمونات! كود الغرفة:',
        ptFell: 'وقعت!', ptWatching: 'عم تتفرج على {n}', ptBehind: 'وراك', ptAhead: 'قدامك', ptStillRun: 'وقعت… خلينا نشوف إذا بيسبقك', ptCanSave: 'صاحبك بيقدر يرجّعك!', ptSaveHow: 'لازم يجمع {n} ليمونات خلال {s} ثانية',
        ptNoSave: 'ما لحق يرجّعك… استنى لآخر الجولة', ptFriendFell: 'وقع صاحبك!', ptSaveHim: 'اجمع {n} 🍋 خلال {s} ث عشان ترجّعه', ptSaved: 'رجّعت صاحبك! 💪', ptSavedMe: 'صاحبك رجّعك! 💪', ptTooLate: 'ما لحقت ترجّعه 😢', ptBack: 'رجع صاحبك للجولة',
        ptWin: 'فزت! 🏆', ptLose: 'صاحبك فاز هالمرة', ptTie: 'تعادل!', ptTeam: 'نتيجة الفريق', ptTeamS: 'الفريق', ptAgain: 'جولة ثانية', ptReward: 'مكافأة', ptFrReady: 'صاحبك جاهز لجولة ثانية',
      }, {
        party: 'With a friend', ptTitle: 'Play with a friend', ptHost: 'Create a room', ptJoin: 'Join', ptCodePh: 'Room code', ptOr: 'Got a code?',
        ptRoomCode: 'Room code', ptShare: 'Send the link to your friend', ptRace: '🏁 Race', ptCoop: '🤝 Co-op',
        ptRaceDesc: 'Same railway at the same time — the higher score wins.', ptCoopDesc: 'Shared lemonade meter and team score; when one falls the other brings them back with lemons.',
        ptWaiting: 'Waiting for your friend to join…', ptConnecting: 'Connecting…', ptReady: 'Ready', ptNotReady: 'Not ready', ptBothReady: "Let's go!", ptPressReady: 'Both press “Ready” to start',
        ptLeave: 'Leave', ptYou: 'You', ptFriend: 'Friend', ptJoined: 'Your friend joined', ptLeft: 'Your friend left the room', ptLost: 'Lost the connection to your friend',
        ptErrRoom: 'No room with that code — check it', ptErrNet: "Couldn't reach your friend. Try Wi-Fi or another network", ptErrSrv: 'Internet or matchmaking server problem, try again soon', ptErrOld: "This browser can't play with a friend", ptFull: 'The room is full',
        ptCopied: 'Link copied!', ptShareText: 'Come play Limonat with me! Room code:',
        ptFell: 'You fell!', ptWatching: 'Watching {n}', ptBehind: 'behind you', ptAhead: 'ahead', ptStillRun: 'You fell… will they beat you?', ptCanSave: 'Your friend can bring you back!', ptSaveHow: 'They need {n} lemons within {s} seconds',
        ptNoSave: "They didn't make it… wait for the end of the round", ptFriendFell: 'Your friend fell!', ptSaveHim: 'Grab {n} 🍋 in {s}s to bring them back', ptSaved: 'You saved your friend! 💪', ptSavedMe: 'Your friend saved you! 💪', ptTooLate: 'Too late to save them 😢', ptBack: 'Your friend is back in the run',
        ptWin: 'You win! 🏆', ptLose: 'Your friend won this time', ptTie: "It's a tie!", ptTeam: 'Team score', ptTeamS: 'Team', ptAgain: 'Play again', ptReward: 'Reward', ptFrReady: 'Your friend is ready for another round',
      });
    }
    get myName() { return this._name || UI.store.get('playerName', '') || (UI.lang === 'ar' ? 'لاعب' : 'Player'); }
    get frName() { return (this.fr && this.fr.name) || UI.t('ptFriend'); }
    get linked() { return !!(this.net && this.net.linked); }

    // ------------------------------------------------------------ UI
    bind() {
      UI.addScreen('party');
      UI.addScreen('partyWait', 'partyWait', false);
      UI.addScreen('partyOver', 'partyOver', false);
      (VR.DEATH_STATES = VR.DEATH_STATES || []).push('partyOver');
      const add = (html, parent = document.body) => { const d = document.createElement('div'); d.innerHTML = html.trim(); const el = d.firstElementChild; parent.appendChild(el); return el; };
      add(`<section id="party" class="screen dim" hidden><div class="card glass rise pt-card">
          <h2 data-i18n="ptTitle"></h2>
          <div id="ptStart" class="pt-col">
            <label class="dy-name"><span data-i18n="yourName"></span><input id="ptName" class="code-input" maxlength="16" autocomplete="off"></label>
            <button class="btn primary" id="ptHost"><svg><use href="#i-users"/></svg><span data-i18n="ptHost"></span></button>
            <div class="pt-or" data-i18n="ptOr"></div>
            <div class="pt-join"><input id="ptCode" class="code-input" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="btn lemon" id="ptJoin"><span data-i18n="ptJoin"></span></button></div>
          </div>
          <div id="ptRoom" class="pt-col" hidden>
            <div class="pt-code-box"><div class="pt-code-lbl" data-i18n="ptRoomCode"></div><div class="pt-code" id="ptCodeShow"></div></div>
            <button class="btn small" id="ptShare"><span data-i18n="ptShare"></span></button>
            <div class="seg pt-mode" id="ptMode"><button data-m="race" data-i18n="ptRace"></button><button data-m="coop" data-i18n="ptCoop"></button></div>
            <div class="pt-desc" id="ptDesc"></div>
            <div class="pt-players"><div class="pt-p" id="ptMe"></div><div class="pt-vs">⚡</div><div class="pt-p" id="ptFr"></div></div>
            <button class="btn primary" id="ptReady"><svg><use href="#i-check"/></svg><span data-i18n="ptReady"></span></button>
          </div>
          <div class="pt-status" id="ptStatus"></div>
          <button class="btn" id="ptBack"><svg><use href="#i-home"/></svg><span data-i18n="ptLeave"></span></button>
        </div></section>`);
      // watching the friend after you fall: the game keeps running on their runner
      add(`<section id="partyWait" class="screen pt-spec" hidden>
          <div class="pt-spec-top glass"><span class="pt-spec-ic" id="pwIcon">👀</span><div class="pt-spec-tx"><b id="pwTitle"></b><small id="pwText"></small></div></div>
          <div class="pt-spec-bot"><div class="pt-res pt-res-mini" id="pwRows"></div>
            <button class="btn small" id="pwLeave"><svg><use href="#i-home"/></svg><span data-i18n="ptLeave"></span></button></div>
        </section>`);
      add(`<section id="partyOver" class="screen dim" hidden><div class="card glass rise pt-card">
          <div class="pt-big" id="poIcon">🏆</div><h2 id="poTitle"></h2><div class="pt-status" id="poText"></div>
          <div class="pt-res" id="poRows"></div>
          <button class="btn primary" id="poAgain"><svg><use href="#i-retry"/></svg><span data-i18n="ptAgain"></span></button>
          <button class="btn" id="poMenu"><svg><use href="#i-home"/></svg><span data-i18n="menu"></span></button>
        </div></section>`);
      // HUD: friend chip + emoji reactions
      const hud = document.getElementById('hud');
      this.hudEl = add(`<div id="ptHud" hidden><div class="pt-chip glass" id="ptChip"></div></div>`, hud);
      this.arrowEl = add(`<div id="ptArrow" class="glass" hidden></div>`, hud);
      const side = hud.querySelector('.hud-side');
      this.emoEl = add(`<div class="pt-emo" id="ptEmo" hidden><div class="pt-emo-row" id="ptEmoRow" hidden>${EMO.map(e => `<button data-e="${e}">${e}</button>`).join('')}</div><button class="btn icon pt-emo-btn" id="ptEmoBtn" aria-label="Emoji">😀</button></div>`, side);
      // menu button
      const modes = document.querySelector('#menu .menu-modes');
      add(`<button class="btn mode" id="partyBtn"><svg><use href="#i-users"/></svg><span data-i18n="party"></span></button>`, modes);
      // icon
      const sym = document.querySelector('svg symbol#i-home');
      if (sym && !document.getElementById('i-users')) {
        sym.insertAdjacentHTML('afterend', '<symbol id="i-users" viewBox="0 0 24 24"><circle cx="8.5" cy="8" r="3.6" fill="currentColor"/><path d="M1.5 20c.4-4 3.3-6.6 7-6.6s6.6 2.6 7 6.6z" fill="currentColor"/><circle cx="16.8" cy="9" r="3" fill="currentColor" opacity=".7"/><path d="M14.6 13.9c.7-.3 1.4-.4 2.2-.4 3.1 0 5.5 2.2 5.8 5.8h-5.3c-.3-2.2-1.2-4-2.7-5.4z" fill="currentColor" opacity=".7"/></symbol>');
      }
      const st = document.createElement('style');
      st.textContent = `
        .menu-modes:has(> :nth-child(3)){gap:8px}.menu-modes:has(> :nth-child(3)) .btn{font-size:15px;padding:10px 6px;gap:5px;white-space:nowrap;min-width:0}.menu-modes:has(> :nth-child(3)) .btn svg{width:20px;height:20px;flex:none}
        .pt-card{gap:12px}.pt-col{display:flex;flex-direction:column;gap:10px}
        .pt-or{text-align:center;color:var(--muted);font-weight:700;font-size:14px;margin-top:4px}
        .pt-join{display:flex;gap:8px}.pt-join input{flex:1;min-width:0;text-align:center;letter-spacing:.25em;font-weight:800;text-transform:uppercase;direction:ltr}
        .pt-join .btn{flex:0 0 auto;width:auto;min-width:100px;padding-inline:18px}@media (max-width:380px){.menu-modes:has(> :nth-child(3)) .btn{font-size:13.5px;padding:10px 4px}}
        .pt-code-box{text-align:center;padding:10px;border-radius:18px;background:var(--glass-2);border:1px dashed var(--lemon)}
        .pt-code-lbl{color:var(--muted);font-weight:700;font-size:13px}
        .pt-code{font-size:44px;font-weight:900;letter-spacing:.2em;direction:ltr;color:var(--lemon);line-height:1.1;padding-inline-start:.2em}
        .pt-mode{align-self:center}.pt-mode[data-guest] button{pointer-events:none}
        .pt-desc{text-align:center;color:var(--muted);font-size:14px;font-weight:600;min-height:2.4em}
        .pt-players{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center}
        .pt-vs{font-size:22px}
        .pt-p{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 6px;border-radius:16px;background:var(--glass-2);border:1px solid var(--edge);min-height:86px;justify-content:center;text-align:center}
        .pt-p .av{font-size:30px;line-height:1}.pt-p b{font-size:16px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .pt-p small{font-size:12px;font-weight:700;color:var(--muted)}.pt-p.ok{border-color:#58d27a}.pt-p.ok small{color:#58d27a}
        .pt-p.empty{opacity:.55;border-style:dashed}
        .pt-status{text-align:center;font-weight:700;color:var(--muted);min-height:1.3em;font-size:15px}
        .pt-status.err{color:#ff8b7d}
        .pt-big{font-size:58px;text-align:center;line-height:1;animation:bob 2.4s ease-in-out infinite}
        .pt-res{display:flex;flex-direction:column;gap:6px}
        .pt-res div{display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px 14px;border-radius:14px;background:var(--glass-2);border:1px solid var(--edge);font-weight:800}
        .pt-res div.win{border-color:var(--lemon)}.pt-res div.team{background:rgba(255,212,59,.14);border-color:var(--lemon)}
        .pt-res span.s{direction:ltr;color:var(--lemon);font-variant-numeric:tabular-nums}.pt-res small{display:block;color:var(--muted);font-weight:600;font-size:12px}
        #ptHud{position:absolute;top:calc(10px + var(--safe-t));left:50%;transform:translateX(-50%);pointer-events:none;display:flex;justify-content:center;max-width:46vw}
        #ptHud[hidden]{display:none}
        #ptArrow{position:absolute;bottom:calc(22px + var(--safe-b, 0px));left:50%;transform:translateX(-50%);padding:6px 14px;border-radius:999px;font-weight:800;font-size:14px;white-space:nowrap;direction:rtl;color:#fff;pointer-events:none;animation:pulse 1.4s ease-in-out infinite}
        #ptArrow[hidden]{display:none}
        .pt-chip{padding:6px 12px;border-radius:999px;font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;direction:rtl;color:#fff}
        .pt-chip.up{box-shadow:inset 0 0 0 2px #ff8b7d}.pt-chip.down{box-shadow:inset 0 0 0 2px #58d27a}.pt-chip.sos{box-shadow:inset 0 0 0 2px var(--lemon);animation:pulse 1s ease-in-out infinite}
        .pt-emo{display:flex;align-items:center;gap:6px;pointer-events:auto}.pt-emo[hidden]{display:none}
        .pt-emo-btn{font-size:22px}
        .pt-emo-row{display:flex;gap:4px;background:rgba(16,20,34,.8);padding:4px;border-radius:999px}.pt-emo-row[hidden]{display:none}
        .pt-emo-row button{border:0;background:none;font-size:24px;padding:4px 6px;cursor:pointer;line-height:1}
        #partyWait.pt-spec{justify-content:space-between;align-items:center;padding:calc(12px + var(--safe-t)) 12px calc(14px + var(--safe-b, 0px));pointer-events:none;background:none}
        .pt-spec-top{display:flex;align-items:center;gap:10px;padding:8px 16px;border-radius:999px;max-width:min(94vw,520px);background:rgba(16,20,34,.78)}
        .pt-spec-ic{font-size:26px;line-height:1}.pt-spec-tx{display:flex;flex-direction:column;line-height:1.2}.pt-spec-tx b{font-size:16px}.pt-spec-tx small{font-size:13px;color:var(--muted);font-weight:700}
        .pt-spec-bot{display:flex;flex-direction:column;align-items:center;gap:8px;width:min(94vw,420px);pointer-events:auto}
        .pt-res-mini{width:100%}.pt-res-mini div{padding:6px 12px;background:rgba(16,20,34,.72)}
        @media (max-width:520px){#ptHud{top:calc(96px + var(--safe-t));max-width:70vw}}`;
      document.head.appendChild(st);

      UI.bind('partyBtn', () => this.open());
      UI.bind('ptHost', () => this.host());
      UI.bind('ptJoin', () => this.join(document.getElementById('ptCode').value));
      document.getElementById('ptCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.join(e.target.value); } });
      UI.bind('ptShare', () => this.share());
      UI.bind('ptReady', () => this.setReady(!this.meReady));
      UI.bind('ptBack', () => this.leave());
      UI.bind('pwLeave', () => this.leave());
      UI.bind('poMenu', () => this.leave());
      UI.bind('poAgain', () => this.again());
      document.querySelectorAll('#ptMode button').forEach(b => b.addEventListener('click', () => {
        if (this.role !== 'host') return;
        VR.Audio.play('click'); this.mode = b.dataset.m; this.meReady = false; this.fr && (this.fr.ready = false);
        this.send({ t: 'mode', m: this.mode }); this.render();
      }));
      document.getElementById('ptEmoBtn').addEventListener('click', (e) => { e.stopPropagation(); const r = document.getElementById('ptEmoRow'); r.hidden = !r.hidden; });
      document.querySelectorAll('#ptEmoRow button').forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation(); document.getElementById('ptEmoRow').hidden = true;
        this.send({ t: 'emo', e: b.dataset.e }); this.floatEmo(b.dataset.e, true);
      }));
    }

    open() {
      this.g.setState('party'); UI.setLang(UI.lang);
      document.getElementById('ptName').value = UI.store.get('playerName', '');
      document.getElementById('ptCode').placeholder = UI.t('ptCodePh');
      this.status('');
      this.render();
    }
    status(text, err) { const el = document.getElementById('ptStatus'); el.textContent = text; el.classList.toggle('err', !!err); }
    saveName() { const v = document.getElementById('ptName').value.trim().slice(0, 16); if (v) { UI.store.set('playerName', v); this._name = v; } }
    render() {
      const inRoom = !!this.role;
      document.getElementById('ptStart').hidden = inRoom;
      document.getElementById('ptRoom').hidden = !inRoom;
      if (!inRoom) return;
      document.getElementById('ptCodeShow').textContent = this.code;
      const seg = document.getElementById('ptMode');
      seg.toggleAttribute('data-guest', this.role !== 'host');
      seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === this.mode ? 'true' : 'false'));
      document.getElementById('ptDesc').textContent = UI.t(this.mode === 'race' ? 'ptRaceDesc' : 'ptCoopDesc');
      const card = (el, name, ready, extra, empty) => {
        el.className = 'pt-p' + (ready ? ' ok' : '') + (empty ? ' empty' : '');
        el.innerHTML = empty ? `<span class="av">⏳</span><small>${UI.t('ptWaiting')}</small>`
          : `<span class="av">🏃</span><b></b><small>${UI.t(ready ? 'ptReady' : 'ptNotReady')}${extra}</small>`;
        const b = el.querySelector('b'); if (b) b.textContent = name;
      };
      card(document.getElementById('ptMe'), this.myName + ' (' + UI.t('ptYou') + ')', this.meReady, '');
      const f = this.linked ? this.fr : null;
      card(document.getElementById('ptFr'), f ? this.frName : '', f && f.ready, f && this.rtt ? ` · ${Math.round(this.rtt)}ms` : '', !f);
      const rb = document.getElementById('ptReady');
      rb.disabled = !f;
      rb.classList.toggle('green', this.meReady);
      if (f) this.status(this.meReady && f.ready ? UI.t('ptBothReady') : UI.t('ptPressReady'));
      else this.status(UI.t('ptWaiting'));
    }

    // ------------------------------------------------------------ connection
    handlers() {
      return {
        onOpen: () => this.onOpen(),
        onData: (m) => this.onData(m),
        onClose: () => this.onClose(),
        onError: (e) => { if (!this.linked && this.role === 'host' && e && (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error')) this.status(UI.t('ptErrSrv'), true); },
      };
    }
    errText(e) {
      const t = e && e.type;
      if (t === 'peer-unavailable') return UI.t('ptErrRoom');
      if (t === 'browser-incompatible') return UI.t('ptErrOld');
      if (t === 'timeout' || t === 'webrtc' || t === 'negotiation-failed') return UI.t('ptErrNet');
      return UI.t('ptErrSrv');
    }
    async host() {
      this.saveName(); this.close();
      this.status(UI.t('ptConnecting'));
      for (let tries = 0; tries < 4; tries++) {
        const code = Array.from({ length: 5 }, () => ABC[(Math.random() * ABC.length) | 0]).join('');
        const net = LOCAL ? new LocalNet(this.handlers()) : new PeerNet(this.handlers());
        try {
          await net.host(code);
          this.net = net; this.role = 'host'; this.code = code; this.meReady = false; this.fr = null;
          this.render();
          return;
        } catch (e) {
          if (e && e.type === 'unavailable-id') continue;
          this.status(this.errText(e), true); return;
        }
      }
      this.status(UI.t('ptErrSrv'), true);
    }
    async join(raw) {
      const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      if (code.length < 4) { VR.Audio.play('denied'); document.getElementById('ptCode').focus(); return; }
      this.saveName(); this.close();
      this.status(UI.t('ptConnecting'));
      const net = LOCAL ? new LocalNet(this.handlers()) : new PeerNet(this.handlers());
      this.joining = net; this.net = net;           // set before the link opens: the hello goes out right away
      try {
        await net.join(code);
        if (this.joining !== net) { net.close(); return; }
        this.role = 'guest'; this.code = code; this.meReady = false;
        this.render();
      } catch (e) {
        net.close();
        if (this.net === net) this.net = null;
        if (this.joining === net) { this.status(this.errText(e), true); VR.Audio.play('denied'); }
      }
      this.joining = null;
    }
    onOpen() {
      this.fr = this.fr || { name: '', ready: false };
      const def = this.g.selectedId;
      this.send({ t: 'hi', v: 1, name: this.myName, char: def, custom: def === 'custom' ? UI.store.get('customChar', null) : null });
      if (this.role === 'host') this.send({ t: 'mode', m: this.mode });
      clearInterval(this.pingT);
      this.pingT = setInterval(() => this.send({ t: 'ping', k: performance.now() }), 2000);
      this.send({ t: 'ping', k: performance.now() });
      if (this.g.state === 'party') this.render();
    }
    onClose() {
      clearInterval(this.pingT);
      const wasFriend = this.fr && this.fr.name;
      this.fr = null; this.meReady = false;
      if (this.inRun) {
        UI.toast(UI.t('ptLost'), 1800);
        this.frGone = true; this.fDead = true; this.rescue = null;
        if (this.av) this.av.rig.root.visible = false;
        if (this.meDead && (this.g.state === 'partyWait')) this.finish();
      } else if (this.g.state === 'partyOver') {
        document.getElementById('poAgain').disabled = true;
        UI.toast(UI.t('ptLeft'), 1600);
      }
      if (this.role === 'guest') {           // the room was the host's: back to the start
        this.close(); this.role = null;
        if (this.g.state === 'party') { this.render(); this.status(UI.t('ptLeft'), true); }
      } else if (this.g.state === 'party') { this.render(); if (wasFriend) this.status(UI.t('ptLeft'), true); }
    }
    send(m) { if (this.net) this.net.send(m); }
    close() { clearInterval(this.pingT); if (this.net) { this.send({ t: 'bye' }); this.net.close(); } this.net = null; this.fr = null; this.rtt = 0; }
    leave() {
      this.close(); this.role = null; this.code = ''; this.meReady = false;
      const inGame = this.inRun || this.g.state === 'partyWait' || this.g.state === 'partyOver';
      if (inGame) this.g.toMenu(); else this.g.setState('menu');
    }
    async share() {
      const url = `${location.origin}${location.pathname}#room=${this.code}`;
      const text = `${UI.t('ptShareText')} ${this.code}`;
      try { if (navigator.share) { await navigator.share({ title: 'ليمونات', text, url }); return; } } catch (e) { /* cancelled */ }
      try { await navigator.clipboard.writeText(url); UI.toast(UI.t('ptCopied'), 1500, true); } catch (e) { UI.toast(url, 4000); }
    }
    setReady(r) {
      if (!this.linked) return;
      this.meReady = r; this.send({ t: 'ready', r });
      VR.Audio.play(r ? 'ding' : 'click');
      this.render(); this.tryGo();
    }
    tryGo() {
      if (this.role !== 'host' || !this.meReady || !this.fr || !this.fr.ready || this.counting) return;
      const seed = 1 + ((Math.random() * 2147480000) | 0);
      this.send({ t: 'go', seed, mode: this.mode });
      setTimeout(() => this.countdown(seed, this.mode), Math.min(250, this.rtt / 2));
    }
    countdown(seed, mode) {
      if (this.counting) return;
      this.counting = true; this.mode = mode;
      let n = 3;
      const tick = () => {
        // leaving, a lost link or a mode change (which clears "ready") calls it off
        if (this.g.state !== 'party' || !this.linked || !this.meReady) { this.counting = false; UI.countdown(0); if (this.g.state === 'party') this.render(); return; }
        if (n > 0) { UI.countdown(n); VR.Audio.play('tick'); n--; setTimeout(tick, 800); return; }
        UI.countdown(0); this.counting = false;
        this.meReady = false; if (this.fr) this.fr.ready = false;
        this.g.start({ mode: 'party', party: mode, seed, forks: false });
      };
      tick();
    }

    onData(m) {
      if (!m || !m.t) return;
      const g = this.g;
      switch (m.t) {
        case 'hi': {
          const first = !this.fr || !this.fr.name;
          this.fr = Object.assign(this.fr || {}, { name: String(m.name || '').slice(0, 16), char: m.char, custom: m.custom, ready: false });
          if (first) { VR.Audio.play('ding'); if (g.state === 'party') UI.toast(`${UI.t('ptJoined')}: ${this.frName}`, 1500, true); }
          if (g.state === 'party') this.render();
          break;
        }
        case 'full': this.status(UI.t('ptFull'), true); break;
        case 'mode': {
          const mm = m.m === 'coop' ? 'coop' : 'race';
          if (mm !== this.mode) { this.mode = mm; this.meReady = false; if (this.fr) this.fr.ready = false; }
          if (g.state === 'party') this.render(); break;
        }
        case 'ready':
          if (this.fr) this.fr.ready = !!m.r;
          if (g.state === 'party') this.render();
          else if (m.r && g.state === 'partyOver') UI.toast(UI.t('ptFrReady'), 1600, true);
          this.tryGo();
          break;
        case 'go': if (g.state === 'party') this.countdown(m.seed, m.mode === 'coop' ? 'coop' : 'race'); break;
        case 'ping': this.send({ t: 'pong', k: m.k }); break;
        case 'pong': this.rtt = this.rtt ? this.rtt * 0.7 + (performance.now() - m.k) * 0.3 : performance.now() - m.k; break;
        case 's':
          if (!this.inRun) break;
          {
            // put the friend's own send times on my clock (smallest seen delay; creeps up slowly for drift)
            const now = performance.now() / 1000, off = now - (m.ts || now);
            this.off = this.off == null ? off : Math.min(off, this.off + 0.002);
            this.buf.push({ t: (m.ts || now) + this.off, d: m.d, x: m.x, y: m.y, f: m.f });
          }
          if (this.buf.length > 30) this.buf.splice(0, this.buf.length - 30);
          this.fScore = m.sc || 0; this.fDist = m.d;
          if (g.state === 'partyWait') this.renderWait();
          break;
        case 'emo': if (EMO.includes(m.e)) this.floatEmo(m.e, false); break;
        case 'pk':           // the friend took a coin / lemon / power-up: it disappears here too
          if (this.inRun && this.taken.length < 600) { this.taken.push({ k: m.k, x: m.x, y: m.y, d: m.d, ty: m.ty }); this.takeT = 0; }
          break;
        case 'lemon': if (this.inRun && this.mode === 'coop' && !this.meDead && g.state === 'playing') g.meterLemon(); break;
        case 'dead': this.onFriendDead(m); break;
        case 'resc': this.saveInfo = { got: m.got, need: m.need, left: m.left }; if (g.state === 'partyWait') this.renderWait(); break;
        case 'noSave': this.saveInfo = null; this.noSave = true; if (g.state === 'partyWait') this.renderWait(); break;
        case 'revive': this.revived(); break;
        case 'alive':
          this.fDead = false; this.buf = []; this.dS = null;
          UI.toast(UI.t('ptBack'), 1300, true);
          break;
        case 'bye':
          if (this.net) { if (this.role === 'host') this.net.dropConn(); else this.net.close(); }
          this.onClose(); break;
      }
    }

    // ------------------------------------------------------------ run
    runStart(opts) {
      this.clearAvatar();
      this.inRun = opts.mode === 'party' && !!this.fr;
      this.hudEl.hidden = !this.inRun; this.emoEl.hidden = !this.inRun; this.arrowEl.hidden = true;
      if (!this.inRun) return;
      this.mode = opts.party === 'coop' ? 'coop' : 'race';
      this.meDead = false; this.fDead = false; this.frGone = false;
      this.fScore = 0; this.fDist = 0; this.myScore = 0; this.myDist = 0;
      this.buf = []; this.off = null; this.dS = null; this.taken = []; this.takeT = 0; this.sendT = 0; this.chipT = 0; this.rescue = null; this.rescues = 0; this.myRescued = 0; this.saveInfo = null; this.noSave = false;
      this.g.canContinue = false;
      this.buildAvatar();
    }
    buildAvatar() {
      const f = this.fr || {};
      let def = VR.CHARACTERS.find(c => c.id === f.char) || VR.CHARACTERS[0];
      if (f.char === 'custom' && f.custom && VR.makeCustomDef) { try { def = VR.makeCustomDef(f.custom); } catch (e) { def = VR.CHARACTERS[0]; } }
      const rig = VR.buildCharacter(def);
      rig.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
      const tag = tagSprite((this.mode === 'coop' ? '🤝 ' : '🏁 ') + this.frName, this.mode === 'coop' ? '#8ff0a8' : '#ffd84a');
      tag.position.y = 2.4; rig.root.add(tag);
      rig.root.visible = false;
      this.g.scene.add(rig.root);
      const meshes = [];
      rig.root.traverse(o => { if (o.isMesh) meshes.push({ m: o, mat: o.material, outline: o.material === VR.charMaterials.outlineMat }); });
      const ghostMat = new T.MeshBasicMaterial({ color: this.mode === 'coop' ? 0xa8ffc0 : 0xffe89a, transparent: true, opacity: 0.45, depthWrite: false, fog: false });
      this.av = { rig, tag, meshes, ghostMat, ghost: false, pose: A.pose(), phase: 0 };
    }
    setGhost(av, on) {
      av.ghost = on;
      for (const e of av.meshes) { if (e.outline) e.m.visible = !on; else e.m.material = on ? av.ghostMat : e.mat; }
    }
    clearAvatar() {
      if (this.av) {
        this.av.ghostMat.dispose();
        this.g.scene.remove(this.av.rig.root);
        this.av.tag.material.map.dispose(); this.av.tag.material.dispose();
        this.av = null;
      }
      for (const e of this.floats) { e.sp.parent && e.sp.parent.remove(e.sp); e.sp.material.dispose(); }
      this.floats = [];
    }
    leaveRun() {
      this.setMeHidden(false); this.spec = false;
      if (this.inRun && !this.meDead) this.send({ t: 'dead', score: Math.floor(this.g.score), dist: Math.floor(this.g.distance), quit: 1 });
      this.inRun = false; this.clearAvatar();
      this.hudEl.hidden = true; this.emoEl.hidden = true; this.arrowEl.hidden = true;
    }
    // where the friend is right now (buffered a little so the motion is smooth)
    sample() {
      const B = this.buf; if (!B.length) return null;
      const t = performance.now() / 1000 - DELAY;
      let i = B.length - 1;
      while (i > 0 && B[i - 1].t > t) i--;
      const b = B[i], a = B[i - 1];
      if (a && t >= a.t && t <= b.t) {
        const u = (t - a.t) / Math.max(1e-3, b.t - a.t);
        return { d: a.d + (b.d - a.d) * u, x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, f: b.f };
      }
      // past the newest sample: keep moving at the last known speed (briefly)
      const last = B[B.length - 1], prev = B[B.length - 2];
      if (t > last.t && prev) {
        const k = Math.min(0.35, t - last.t), v = Math.max(0, Math.min(40, (last.d - prev.d) / Math.max(0.03, last.t - prev.t)));
        return { d: last.d + v * k, x: last.x, y: last.y, f: last.f };
      }
      return { d: b.d, x: b.x, y: b.y, f: b.f };
    }
    // Where the friend is NOW. Samples arrive a little late (network + the small
    // buffer that keeps the motion smooth); at 13-31 m/s that is 2-4 m, so the
    // distance is pushed forward by his measured speed × that delay. Sideways
    // position and pose stay on the smooth buffered sample.
    friendNow(dt) {
      const s = !this.fDead && this.sample(); if (!s) { this.dS = null; return null; }
      const B = this.buf, last = B[B.length - 1], now = performance.now() / 1000;
      let j = B.length - 1; while (j > 0 && last.t - B[j - 1].t < 0.3) j--;
      const o = B[Math.max(0, j - 1)];
      const v = last.t - o.t > 0.05 ? Math.max(0, Math.min(45, (last.d - o.d) / (last.t - o.t))) : this.g.speedAt(last.d);
      const oneWay = Math.min(0.25, (this.rtt || 80) / 2000);
      const dNow = last.d + v * Math.max(0, Math.min(0.5, now - last.t + oneWay));   // no guessing past half a second of silence
      if (this.dS == null || Math.abs(dNow - this.dS) > 6) { this.dS = dNow; this.lastNow = now; }
      else {
        const rdt = Math.min(0.25, Math.max(0, now - (this.lastNow || now)));   // real time: slow frames don't make him lag
        this.dS += v * rdt; this.dS += (dNow - this.dS) * Math.min(1, rdt * 6);
      }
      this.lastNow = now;
      return { d: this.dS, x: s.x, y: s.y, f: s.f };
    }
    update(dt) {
      if (!this.inRun) return;
      const g = this.g, p = g.player;
      // send my runner ~15x a second
      this.sendT += dt;
      if (this.sendT >= SEND_DT) {
        this.sendT %= SEND_DT;
        const f = (p.sliding ? 1 : 0) | (p.flying ? 2 : 0) | (p.ride ? 4 : 0);
        this.send({ t: 's', ts: Math.round(performance.now()) / 1000, d: Math.round(g.distance * 100) / 100, x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, f, sc: Math.floor(g.score) });
      }
      // co-op rescue window
      if (this.rescue) {
        this.rescue.t -= dt;
        if (this.rescue.t <= 0) { this.rescue = null; this.send({ t: 'noSave' }); UI.toast(UI.t('ptTooLate'), 1500); }
        else if ((this.rescue.sent -= dt) <= 0) { this.rescue.sent = 1; this.send({ t: 'resc', got: this.rescue.got, need: this.rescue.need, left: Math.ceil(this.rescue.t) }); }
      }
      // the friend's runner
      const s = this.friendNow(dt);
      this.drawFriend(dt, s);
      this.takeItems(dt);
      this.updateFloats(dt);
      // HUD chip (5x a second)
      if ((this.chipT -= dt) <= 0) { this.chipT = 0.2; this.renderChip(s); this.renderArrow(s); }
    }
    // friend out of sight (behind the camera, or far ahead): a small pointer at the screen edge
    renderArrow(s) {
      const el = this.arrowEl; if (!el) return;
      const rel = s ? s.d - this.g.distance : 0, m = UI.t('m') || 'm';
      const off = !!s && (rel <= -7.2 || rel >= 140);
      el.hidden = !off;
      if (off) el.textContent = rel < 0 ? `⬇ ${this.frName} ${UI.t('ptBehind')} ${Math.round(-rel)}${m}` : `⬆ ${this.frName} ${UI.t('ptAhead')} ${Math.round(rel)}${m}`;
    }
    drawFriend(dt, s) {
      const g = this.g, p = g.player, av = this.av;
      if (av) {
        const rel = s ? s.d - g.distance : 0;
        // visible as long as the camera can see him (it sits ~7.6 m behind you)
        const show = !!s && rel > -7.2 && rel < 140;
        av.rig.root.visible = show;
        if (show) {
          // between the camera and you: a see-through silhouette so he never blocks the road
          const ghost = rel < -1;
          if (ghost !== av.ghost) this.setGhost(av, ghost);
          if (ghost) av.ghostMat.opacity = 0.42 - Math.min(1, (-1 - rel) / 5.5) * 0.22;
          av.rig.root.position.set(s.x, s.y, p.z - rel);
          av.phase = (av.phase + dt * (1.32 + g.speed * 0.036)) % 1;
          const pose = av.pose;
          A.run(pose, av.phase, 0.5);
          if (s.f & 1) A.lerp(pose, pose, A.P.slide, 1);
          else if (s.f & 2) A.fly(pose, g.runTime, 0);
          else if (s.y > 0.25) A.lerp(pose, pose, A.P.jumpFall, 0.8);
          A.apply(av.rig, pose);
          if (!(s.f & 1) && s.y <= 0.25) A.plant(av.rig, 1, 0);
          av.tag.material.opacity = ghost ? 0.45 : 0.95;
        }
      }
    }
    // items the friend took: remove them once they exist in my world, forget them once passed
    takeItems(dt) {
      const g = this.g, p = g.player;
      if (this.taken.length && (this.takeT -= dt) <= 0) {
        this.takeT = 0.15;
        const col = g.collect;
        this.taken = this.taken.filter(it => {
          if (it.d < g.distance - 4) return false;
          return !col.takeAt(it.k, it.x, it.y, p.z - (it.d - g.distance), it.ty);
        });
      }
    }
    updateFloats(dt) {
      for (let i = this.floats.length - 1; i >= 0; i--) {
        const e = this.floats[i]; e.t += dt;
        e.sp.position.y = e.y0 + e.t * 0.9;
        e.sp.material.opacity = Math.max(0, 1 - Math.max(0, e.t - 1.2) / 0.6);
        const k = Math.min(1, e.t * 6); e.sp.scale.set(0.9 * k, 0.9 * k, 1);
        if (e.t > 1.8) { e.sp.parent && e.sp.parent.remove(e.sp); e.sp.material.dispose(); this.floats.splice(i, 1); }
      }
    }

    // ------------------------------------------------------------ spectating
    // After you fall your own runner is hidden and the camera rides along with
    // the friend: the railway, trains and coins keep moving exactly as they do
    // on their phone (same seed, same railway distance).
    setMeHidden(h) {
      const p = this.g.player;
      p.object.visible = !h; if (p.shadow) p.shadow.visible = !h;
    }
    spectate(dt) {
      const g = this.g, p = g.player;
      if (!this.inRun) return;
      const s = this.friendNow(dt);
      g.fxDesat += (0 - g.fxDesat) * Math.min(1, dt * 2);
      if (s) {
        const dm = s.d - g.distance;
        let snap = false;
        if (!this.spec || dm < -6 || dm > 80) { this.spec = true; g.jumpTo(s.d); snap = true; }
        else { p.z -= dm; g.distance = s.d; g.camera.position.z -= dm; g.camLook.z -= dm; }   // the camera rides along
        p.x = s.x; p.y = s.y; p.object.position.set(p.x, p.y, p.z);
        const fl = (s.f & 2) ? 1 : 0, sl = (s.f & 1) ? 1 : 0, k = Math.min(1, dt * 5);
        p.flyW += (fl - p.flyW) * k; p.slideW += (sl - p.slideW) * k; p.laneW = 0;
        g.speed = g.speedAt(g.distance);
        g.world.update(dt, p, g.speed, g.difficultyAt(g.distance), g);
        g.collect.update(dt, p, null);
        if (p.z < -VR.CONFIG.RECENTER_DISTANCE) {
          const dz = -p.z;
          p.z += dz; g.world.shift(dz); g.fx.shift(dz); g.camera.position.z += dz; g.camLook.z += dz;
          p.object.position.z = p.z; g.emit('shift', dz);
        }
        this.drawFriend(dt, s);
        this.takeItems(dt);
        g.updateEnvironment(dt);
        if (snap) g.snapCamera(); else { g.shake = 0; g.updateCamera(dt); }
      }
      this.updateFloats(dt);
      if ((this.waitT = (this.waitT || 0) - dt) <= 0) { this.waitT = 0.25; this.renderWait(); }
    }
    renderChip(s) {
      const el = document.getElementById('ptChip'), g = this.g, m = UI.t('m') || 'm';
      el.className = 'pt-chip glass';
      if (this.frGone) { el.textContent = '📡 ' + UI.t('ptLost'); return; }
      if (this.rescue) {
        el.classList.add('sos');
        el.textContent = `🆘 ${this.frName}: 🍋 ${this.rescue.got}/${this.rescue.need} · ${Math.ceil(this.rescue.t)}`;
        return;
      }
      if (this.mode === 'coop') { el.textContent = `🤝 ${UI.t('ptTeamS')} ${UI.fmt(g.score + this.fScore)}${this.fDead ? ' · 💥' : ''}`; return; }
      if (this.fDead) { el.textContent = `💥 ${this.frName} ${UI.fmt(this.fScore)}`; return; }
      const rel = s ? s.d - g.distance : 0;
      const ahead = g.score >= this.fScore;
      el.classList.add(ahead ? 'down' : 'up');
      el.textContent = `🏁 ${this.frName} ${UI.fmt(this.fScore)} · ${rel >= 0 ? '▲' : '▼'}${Math.abs(Math.round(rel))}${m}`;
    }
    floatEmo(e, mine) {
      if (!this.inRun || this.g.state !== 'playing') { if (!mine) UI.toast(`${this.frName}: ${e}`, 1200); return; }
      const holder = mine ? this.g.player.object : (this.av && this.av.rig.root.visible ? this.av.rig.root : null);
      if (!holder) { UI.toast(`${this.frName}: ${e}`, 1200); return; }
      const sp = emoSprite(e); const y0 = mine ? 2.3 : 2.85;
      sp.position.set(0, y0, 0); holder.add(sp);
      this.floats.push({ sp, t: 0, y0 });
      VR.Audio.play('pop');
    }
    // I took an item: tell the friend where it was spawned (in railway distance, same on both phones)
    picked(kind, item) {
      if (!this.inRun || this.meDead || !this.linked) return;
      const g = this.g, z = item.z0 != null ? item.z0 : item.z;
      const r = (v) => Math.round(v * 100) / 100;
      this.send({ t: 'pk', k: kind, x: r(item.x0 != null ? item.x0 : item.x), y: r(item.y0 != null ? item.y0 : item.y), d: r(g.distance + (g.player.z - z)), ty: item.type });
    }
    lemon() {
      if (!this.inRun || this.meDead) return;
      if (this.mode === 'coop') this.send({ t: 'lemon' });
      const r = this.rescue;
      if (r) {
        r.got++;
        this.send({ t: 'resc', got: r.got, need: r.need, left: Math.ceil(r.t) });
        if (r.got >= r.need) {
          this.rescue = null; this.rescues++;
          this.send({ t: 'revive' });
          UI.toast(UI.t('ptSaved'), 1500, true); VR.Audio.play('catch');
          const p = this.g.player; this.g.fx.ring(p.x, p.y + 1, p.z, 0x8ff0a8, 24, 6);
        }
      }
    }
    onFriendDead(m) {
      this.fDead = true; this.fScore = m.score || this.fScore; this.fDist = m.dist || this.fDist;
      if (m.quit) this.frGone = true;
      if (!this.inRun) return;
      if (this.meDead) { if (this.g.state === 'partyWait') this.finish(); return; }
      if (this.mode === 'coop' && !m.quit) {
        const need = 3 + this.rescues * 2;
        this.rescue = { got: 0, need, t: RESCUE_TIME, sent: 0 };
        UI.toast(`${UI.t('ptFriendFell')} ${UI.t('ptSaveHim').replace('{n}', need).replace('{s}', RESCUE_TIME)}`, 2200, true);
      } else UI.toast(`💥 ${UI.t('ptFriendFell')}`, 1400);
      VR.Audio.play('stumble');
    }
    // my own death (the game emits this right when you crash)
    runEnd({ score, dist }) {
      if (!this.inRun) return;
      this.meDead = true; this.myScore = score; this.myDist = dist;
      this.rescue = null; this.saveInfo = null; this.noSave = false;
      this.send({ t: 'dead', score: Math.floor(score), dist: Math.floor(dist) });
      this.emoEl.hidden = true; document.getElementById('ptEmoRow').hidden = true;
    }
    gameOverScreen() {
      if (!this.inRun) return false;
      if (this.fDead || !this.linked) this.finish();
      else {
        this.spec = false; this.setMeHidden(true);
        const g = this.g; g.deathCam = null; g.timeScale = 1; g.tunnelDark = 0;
        g.setState('partyWait'); this.renderWait();
      }
      return true;
    }
    renderWait() {
      const coop = this.mode === 'coop', si = this.saveInfo;
      document.getElementById('pwIcon').textContent = coop && !this.noSave ? '🆘' : '👀';
      document.getElementById('pwTitle').textContent = coop && !this.noSave ? UI.t('ptCanSave') : UI.t('ptWatching').replace('{n}', this.frName);
      let txt;
      if (!coop) txt = UI.t('ptStillRun');
      else if (this.noSave) txt = UI.t('ptNoSave');
      else if (si) txt = `🍋 ${si.got}/${si.need} · ⏱ ${si.left}`;
      else txt = UI.t('ptSaveHow').replace('{n}', 3 + this.rescuesOfMe()).replace('{s}', RESCUE_TIME);
      document.getElementById('pwText').textContent = txt;
      this.rows('pwRows', false);
    }
    rescuesOfMe() { return (this.myRescued || 0) * 2; }
    revived() {
      const g = this.g;
      if (!this.inRun || !this.meDead || !(g.state === 'partyWait' || g.state === 'dying') || !g.deathState) return;
      this.meDead = false; this.myRescued = (this.myRescued || 0) + 1;
      this.emoEl.hidden = false;
      if (this.spec) {            // I was watching the friend: come back right next to them
        const p = g.player, LW = VR.CONFIG.LANE_WIDTH, lane = Math.max(-1, Math.min(1, Math.round(p.x / LW)));
        Object.assign(g.deathState, { x: lane * LW, y: p.y, z: p.z, lane });
        p.flyW = 0; p.slideW = 0;
      }
      this.spec = false; this.setMeHidden(false);
      g.revive();
      this.send({ t: 'alive' });
      setTimeout(() => UI.toast(UI.t('ptSavedMe'), 1500, true), 300);
    }
    rows(id, final) {
      const coop = this.mode === 'coop';
      const me = { name: this.myName, score: this.meDead ? this.myScore : this.g.score, dist: this.meDead ? this.myDist : this.g.distance, me: true };
      const fr = { name: this.frName, score: this.fScore, dist: this.fDist };
      const list = [me, fr];
      if (final && !coop) list.sort((a, b) => b.score - a.score);
      const m = UI.t('m') || 'm';
      const el = document.getElementById(id); el.innerHTML = '';
      const row = (cls, name, score, sub) => {
        const d = document.createElement('div'); d.className = cls;
        d.innerHTML = `<span><b></b><small></small></span><span class="s"></span>`;
        d.querySelector('b').textContent = name; d.querySelector('small').textContent = sub; d.querySelector('.s').textContent = UI.fmt(score);
        el.appendChild(d);
      };
      list.forEach((r, i) => row(final && !coop && i === 0 && list[0].score !== list[1].score ? 'win' : '', (r.me ? '⭐ ' : '') + r.name, r.score, UI.fmt(r.dist) + ' ' + m));
      if (coop) row('team', '🤝 ' + UI.t('ptTeam'), me.score + fr.score, '');
    }
    finish() {
      const g = this.g, coop = this.mode === 'coop';
      this.rescue = null; this.inRun = false;
      this.hudEl.hidden = true; this.emoEl.hidden = true; this.arrowEl.hidden = true;
      const my = Math.floor(this.myScore), fr = Math.floor(this.fScore);
      if (g.S.board && this.fr && this.fr.name) g.S.board.addFriend(this.fr.name, fr);   // your private friends board
      let icon, title, reward;
      if (coop) { icon = '🤝'; title = UI.t('ptTeam'); reward = 60; }
      else if (my > fr || this.frGone) { icon = '🏆'; title = UI.t('ptWin'); reward = 120; }
      else if (my === fr) { icon = '🤝'; title = UI.t('ptTie'); reward = 60; }
      else { icon = '🥈'; title = UI.t('ptLose'); reward = 30; }
      g.bank += reward; UI.store.set('bank', g.bank);
      document.getElementById('poIcon').textContent = icon;
      document.getElementById('poTitle').textContent = title;
      document.getElementById('poText').textContent = `${UI.t('ptReward')} +${reward} 🪙`;
      this.rows('poRows', true);
      document.getElementById('poAgain').disabled = !this.linked;
      g.setState('partyOver');
      VR.Audio.play(icon === '🏆' || coop ? 'fanfare' : 'ding');
      if (icon === '🏆') { const p = g.player; g.fx.confetti(p.x, p.y + 2, p.z, 100); }
    }
    again() {
      if (!this.linked) { VR.Audio.play('denied'); return; }
      this.g.toMenu();
      this.open();
      this.setReady(true);
    }
    // a "#room=CODE" link joins that room right after loading
    state(s) {
      if (s === 'menu' && this.pendingCode && !this.linkUsed) {
        this.linkUsed = true;
        const code = this.pendingCode; this.pendingCode = null;
        history.replaceState(null, '', location.pathname + location.search);
        setTimeout(() => { this.open(); document.getElementById('ptCode').value = code; this.join(code); }, 60);
      }
    }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Party);
})();

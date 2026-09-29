/* =====================================================================
 * UI — screens, HUD, toasts, shop, tutorial, i18n (Arabic / English)
 * and settings persistence.  All DOM lives in index.html; this module
 * only toggles and fills it.
 * ===================================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const SCREENS = ['loading', 'menu', 'character', 'settings', 'pause', 'gameover', 'missions'];

  const store = {
    get(k, d) { try { const v = localStorage.getItem('cubeexpress.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cubeexpress.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  // ------------------------------------------------------------ strings
  const STR = {
    ar: {
      loading: 'جارٍ تجهيز السكة…', tagline: 'عدّاء السكّة اللانهائي', play: 'العب', characters: 'الشخصيات',
      controls: '<kbd>←</kbd><kbd>→</kbd> للتنقل · <kbd>↑</kbd> أو <kbd>مسافة</kbd> للقفز · <kbd>↓</kbd> للانزلاق · على الجوال: اسحب بإصبعك',
      settings: 'الإعدادات', sfx: 'المؤثرات الصوتية', music: 'الموسيقى', graphics: 'الرسوميات', qHigh: 'عالية', qMed: 'متوسطة', qLow: 'منخفضة',
      fps: 'عرض FPS', drs: 'ثبات 60 فريم', drsHint: 'يخفّف الدقة شوي وقت الضغط', language: 'اللغة', done: 'تم', paused: 'استراحة', resume: 'متابعة', menu: 'القائمة',
      gameOver: 'انتهت الجولة', newBest: 'رقم قياسي جديد!', score: 'النتيجة', distance: 'المسافة', coins: 'العملات', best: 'الأفضل', again: 'العب مجدداً',
      select: 'اختيار', selected: 'مختار', buy: 'شراء', locked: 'مقفل',
      multiplier: 'المضاعف', stumble: 'تعثّر!', shieldBroken: 'انكسر الدرع!', lemonTip: 'جمّع ٥ ليمونات = ليموناضة!', closeCall: 'نجاة بأعجوبة!', continue: 'تابع الركض!',
      controlsTouch: 'اسحب يمين ويسار للتنقّل · لفوق للقفز · لتحت للانزلاق',
      tutLane: 'اسحب يميناً ويساراً لتغيير المسار', tutJump: 'اسحب للأعلى للقفز', tutSlide: 'اسحب للأسفل للانزلاق',
      tutLaneK: '← →', tutJumpK: '↑ / Space', tutSlideK: '↓',
      notEnough: 'ما معك عملات كافية', bought: 'صارت لك!',
      missions: 'المهام', lifetime: 'إحصائياتك', missionDone: 'مهمة منجزة!',
      forkAhead: 'مفترق طرق! اختار مسارك', routeRich: 'طريق الكنوز', routeEasy: 'طريق أسهل',
      w_rain: 'مطر! السكة زلقة', w_sandstorm: 'عاصفة رملية!', w_fog: 'ضباب كثيف!',
      thiefAppears: 'حرامي الليمون! الحقه', thiefCaught: 'مسكت الماعز!', thiefEscaped: 'هرب الماعز!', rideBroken: 'انكسرت المركبة!',
      lRuns: 'جولات', lDist: 'مجموع المسافة', lCoins: 'مجموع العملات', lBest: 'أبعد مسافة', lJumps: 'قفزات', lLemons: 'ليمونات', lJet: 'طيران', lClose: 'نجاة بأعجوبة',
      pu: { magnet: 'مغناطيس!', shield: 'درع!', boost: 'انطلاق!', double: 'عملات مضاعفة!', invincible: 'نجمة!', jetpack: 'جيت باك! طِر!', sneakers: 'حذاء النطّ!', minecart: 'عربة المنجم!', bike: 'بسكليت!', lemonade: 'ليموناضة! نقاط وعملات مضاعفة' },
      m: 'م',
    },
    en: {
      loading: 'Laying the tracks…', tagline: 'The endless rail runner', play: 'PLAY', characters: 'Characters',
      controls: '<kbd>←</kbd><kbd>→</kbd> switch lanes · <kbd>↑</kbd>/<kbd>Space</kbd> jump · <kbd>↓</kbd> slide · swipe on mobile',
      settings: 'Settings', sfx: 'Sound effects', music: 'Music', graphics: 'Graphics', qHigh: 'High', qMed: 'Medium', qLow: 'Low',
      fps: 'Show FPS', drs: 'Steady 60 fps', drsHint: 'Lowers resolution a little under load', language: 'Language', done: 'Done', paused: 'Paused', resume: 'Resume', menu: 'Menu',
      gameOver: 'Game Over', newBest: 'NEW BEST!', score: 'Score', distance: 'Distance', coins: 'Coins', best: 'Best', again: 'Play again',
      select: 'Select', selected: 'Selected', buy: 'Buy', locked: 'Locked',
      multiplier: 'Multiplier', stumble: 'Stumble!', shieldBroken: 'Shield broken!', lemonTip: 'Collect 5 lemons = Lemonade!', closeCall: 'Close call!', continue: 'Keep running!',
      controlsTouch: 'Swipe left / right to switch lanes · up to jump · down to slide',
      tutLane: 'Swipe left / right to change lanes', tutJump: 'Swipe up to jump', tutSlide: 'Swipe down to slide',
      tutLaneK: '← →', tutJumpK: '↑ / Space', tutSlideK: '↓',
      notEnough: 'Not enough coins', bought: 'Unlocked!',
      missions: 'Missions', lifetime: 'Your stats', missionDone: 'Mission complete!',
      forkAhead: 'Junction ahead! Pick a track', routeRich: 'Treasure route', routeEasy: 'Easy route',
      w_rain: 'Rain! Slippery tracks', w_sandstorm: 'Sandstorm!', w_fog: 'Thick fog!',
      thiefAppears: 'Lemon thief! Catch it', thiefCaught: 'Goat caught!', thiefEscaped: 'The goat got away!', rideBroken: 'Your ride broke!',
      lRuns: 'Runs', lDist: 'Total distance', lCoins: 'Total coins', lBest: 'Longest run', lJumps: 'Jumps', lLemons: 'Lemons', lJet: 'Flights', lClose: 'Close calls',
      pu: { magnet: 'Magnet!', shield: 'Shield!', boost: 'Boost!', double: '2x Coins!', invincible: 'Star!', jetpack: 'Jetpack! Fly!', sneakers: 'Super Sneakers!', minecart: 'Mine cart!', bike: 'Bicycle!', lemonade: 'Lemonade! 2x score & coins' },
      m: 'm',
    },
  };
  let lang = store.get('lang', 'ar');
  const t = (k) => STR[lang][k] ?? STR.ar[k] ?? k;

  const fmt = (n) => Math.floor(n).toLocaleString('en-US');
  let toastTimer = 0, biomeTimer = 0;
  const hudEls = {};
  const bars = {};

  const UI = {
    store, fmt, t,
    // feature modules register their own screens: UI.addScreen('pets', 'pets', true)
    addScreen(id, state = id, menuCam = true) {
      if (!SCREENS.includes(id)) SCREENS.push(id);
      (VR.SCREEN_MAP = VR.SCREEN_MAP || {})[state] = id;
      if (menuCam) (VR.MENU_STATES = VR.MENU_STATES || []).push(state);
    },
    // add strings for both languages from a module
    addStrings(ar, en) { Object.assign(STR.ar, ar); Object.assign(STR.en, en); },
    get lang() { return lang; },
    setLang(l) {
      lang = l; store.set('lang', l);
      document.documentElement.lang = l;
      document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
      document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
      const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const k = el.dataset.i18nHtml;
        el.innerHTML = touch && STR[lang][k + 'Touch'] ? t(k + 'Touch') : t(k);
      });
      $('langLbl').textContent = l === 'ar' ? 'EN' : 'ع';
      document.querySelectorAll('#optLang button').forEach(b => b.setAttribute('aria-pressed', b.dataset.l === l ? 'true' : 'false'));
    },
    show(name) {
      for (const s of SCREENS) {
        const el = $(s), on = s === name;
        if (on && el.hidden) { el.hidden = false; el.classList.remove('fade-in'); void el.offsetWidth; el.classList.add('fade-in'); }
        else if (!on) el.hidden = true;
      }
    },
    hud(on) { $('hud').hidden = !on; },
    loadProgress(p) { $('loadFill').style.width = Math.round(p * 100) + '%'; },

    setHUD(score, dist, coins, mult) {
      const set = (id, v) => { const el = hudEls[id] || (hudEls[id] = $(id)); if (el.__v !== v) { el.__v = v; el.textContent = v; } };
      set('hudScore', fmt(score));
      set('hudDist', fmt(dist) + ' ' + t('m'));
      set('hudCoins', fmt(coins));
      const m = 'x' + mult;
      if ($('hudMult').textContent !== m) {
        $('hudMult').textContent = m;
        $('hudMult').animate([{ transform: 'scale(1.8) rotate(-8deg)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'cubic-bezier(.2,.9,.3,1.4)' });
      }
    },
    bumpCoins() { $('hudCoins').parentElement.animate([{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 160 }); },

    setPowerups(state) {
      const holder = $('powerbars');
      const active = new Set(state.list());
      for (const k in bars) if (!active.has(k)) { bars[k].remove(); delete bars[k]; }
      for (const k of active) {
        if (!bars[k]) {
          const el = document.createElement('div');
          el.className = 'pring';
          el.style.setProperty('--c', '#' + VR.POWERUP_COLORS[k].toString(16).padStart(6, '0'));
          el.innerHTML = `<svg viewBox="0 0 24 24"><use href="#p-${k}"/></svg>`;
          holder.appendChild(el);
          bars[k] = el;
        }
        const frac = Math.max(0, Math.min(1, state.remaining(k) / ((state.full && state.full[k]) || (VR.CONFIG.POWERUPS[k] || VR.CONFIG[k.toUpperCase()]).duration)));
        bars[k].style.setProperty('--p', frac.toFixed(3));
        bars[k].classList.toggle('low', state.remaining(k) < 2);
      }
    },
    clearPowerups() { for (const k in bars) { bars[k].remove(); delete bars[k]; } },

    toast(text, ms = 900, gold = false) {
      const el = $('toast');
      el.textContent = text; el.classList.toggle('gold', gold);
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.classList.remove('show'), ms);
    },
    // floating "+50" at a screen position
    popup(text, x, y, color) {
      const el = document.createElement('div');
      el.className = 'popup'; el.textContent = text;
      el.style.left = x + 'px'; el.style.top = y + 'px';
      if (color) el.style.color = color;
      $('popups').appendChild(el);
      setTimeout(() => el.remove(), 950);
    },
    // lemon floating "+1" with a lemon icon
    popupLemon(x, y) {
      const el = document.createElement('div');
      el.className = 'popup lemon';
      el.innerHTML = '<svg viewBox="0 0 64 64"><use href="#i-lemon"/></svg><span>+1</span>';
      el.style.left = x + 'px'; el.style.top = y + 'px';
      $('popups').appendChild(el);
      setTimeout(() => el.remove(), 950);
    },
    // lemon meter: n of need slots filled; rush = 0..1 remaining lemonade time (or 0)
    lemons(n, need, rush) {
      const m = $('lemonMeter');
      if (!m) return;
      const slots = m.querySelector('.slots');
      if (slots.children.length !== need) slots.innerHTML = '<i></i>'.repeat(need);
      const lit = rush > 0 ? Math.ceil(rush * need) : n;
      const key = lit + '|' + (rush > 0);
      if (m.dataset.k === key) return;
      const prev = +(m.dataset.lit || 0);
      m.dataset.k = key; m.dataset.lit = lit;
      [...slots.children].forEach((el, i) => el.classList.toggle('on', i < lit));
      m.classList.toggle('rush', rush > 0);
      if (!rush && lit > prev) m.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1.4)' });
    },
    biome(def) {
      const b = $('biomeName');
      b.textContent = lang === 'ar' ? def.name : def.nameEn;
      b.classList.add('show');
      clearTimeout(biomeTimer);
      biomeTimer = setTimeout(() => b.classList.remove('show'), 2400);
    },
    hitFlash() { const f = $('flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 90); },

    tutorial(step) {
      const el = $('tutorial');
      if (!step) { el.hidden = true; return; }
      const icon = { lane: 'swipe-hand', jump: 'swipe-up', slide: 'swipe-down' }[step];
      const key = { lane: 'tutLane', jump: 'tutJump', slide: 'tutSlide' }[step];
      el.innerHTML = `<svg class="${icon}" viewBox="0 0 48 48"><use href="#i-hand"/></svg><div><div>${t(key)}</div><div class="keys">${t(key + 'K')}</div></div>`;
      el.hidden = false;
      el.animate([{ opacity: 0, transform: 'translate(-50%, 20px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 350, easing: 'ease-out' });
    },

    // missions list (full on the missions screen, compact on game over)
    missions(M, el = 'missionList') {
      const coin = '<svg class="coin"><use href="#i-coin"/></svg>';
      $(el).innerHTML = M.active.map(m => {
        const tg = M.target(m), pr = Math.min(tg, Math.floor(m.progress)), f = Math.min(1, pr / tg);
        return `<div class="mission${f >= 1 ? ' done' : ''}"><div class="txt">${M.text(m)}</div><div class="rw">${coin}+${fmt(M.reward(m))}</div>`
          + `<div class="bar"><i style="width:${(f * 100).toFixed(1)}%"></i></div><div class="num">${fmt(pr)} / ${fmt(tg)}</div></div>`;
      }).join('');
      if (el !== 'missionList') return;
      const L = M.life, m = t('m');
      const cells = [['lRuns', fmt(L.runs)], ['lDist', fmt(L.dist) + ' ' + m], ['lBest', fmt(L.bestDist) + ' ' + m], ['lCoins', fmt(L.coins)],
        ['lJumps', fmt(L.jumps)], ['lLemons', fmt(L.lemons)], ['lJet', fmt(L.jetpacks)], ['lClose', fmt(L.closeCalls)]];
      $('lifeStats').innerHTML = cells.map(([k, v]) => `<div><b>${v}</b><span>${t(k)}</span></div>`).join('');
    },
    countdown(n) {
      const el = $('countdown');
      if (!n) { el.hidden = true; el.className = ''; return; }
      el.hidden = false; el.className = '';
      el.innerHTML = `<span>${n}</span>`; void el.offsetWidth; el.className = 'tick';
    },

    menuStats(best, bank) { $('menuBest').textContent = fmt(best); $('menuBank').textContent = fmt(bank); $('shopBank').textContent = fmt(bank); },

    character(def, index, owned, selectedId, bank) {
      $('charName').textContent = lang === 'ar' ? def.name : def.nameEn;
      $('charTag').textContent = lang === 'ar' ? def.tagline : def.taglineEn;
      $('charPerk').innerHTML = def.perk ? `<svg><use href="#i-bolt"/></svg>${lang === 'ar' ? def.perk.ar : def.perk.en}` : '';
      const dots = $('charDots');
      dots.innerHTML = VR.CHARACTERS.map((c, i) => `<i class="${i === index ? 'on' : ''} ${owned.has(c.id) ? 'owned' : ''}"></i>`).join('');
      const btn = $('charDone');
      $('shopBank').textContent = fmt(bank);
      if (!owned.has(def.id) && def.event) {
        const E = VR.game && VR.game.S.events, have = E ? E.count(def.event) : 0, ico = E ? E.icon(def.event) : '';
        btn.innerHTML = `<span>${have >= def.need ? t('unlock') : t('eventOnly')}</span><span class="price">${ico} ${fmt(Math.min(have, def.need))}/${fmt(def.need)}</span>`;
        btn.dataset.mode = 'event'; btn.style.filter = have >= def.need ? '' : 'grayscale(.5) brightness(.9)';
      } else if (!owned.has(def.id)) {
        btn.innerHTML = `<span>${t('buy')}</span><span class="price"><svg class="coin"><use href="#i-coin"/></svg>${fmt(def.price)}</span>`;
        btn.dataset.mode = 'buy';
        btn.style.filter = bank >= def.price ? '' : 'grayscale(.7) brightness(.85)';
      } else if (def.id === selectedId) {
        btn.innerHTML = `<svg><use href="#i-check"/></svg><span>${t('selected')}</span>`; btn.dataset.mode = 'selected'; btn.style.filter = '';
      } else {
        btn.innerHTML = `<span>${t('select')}</span>`; btn.dataset.mode = 'select'; btn.style.filter = '';
      }
    },

    openCodeForm() {
      $('codeBtn').hidden = true;
      $('codeForm').hidden = false;
      $('codeMsg').textContent = ''; $('codeMsg').className = 'code-msg';
      $('codeInput').focus();
    },
    codeResult(result) {
      const msg = $('codeMsg');
      const text = {
        ok: 'تم! تابع الجولة',
        wrong: 'الكود غير صحيح',
        used: 'هذا الكود استُخدم في هذه الجولة',
        unavailable: 'لا يمكن استخدام الكود الآن',
      }[result];
      msg.textContent = text;
      msg.className = 'code-msg ' + (result === 'ok' ? 'good' : 'bad');
      if (result !== 'ok') {
        const f = $('codeForm'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
        VR.Audio.play('stumble');
        $('codeInput').select();
      } else $('codeInput').blur();
    },
    resetCodeForm() {
      $('codeBtn').hidden = false;
      $('codeForm').hidden = true;
      $('codeInput').value = '';
      $('codeMsg').textContent = ''; $('codeMsg').className = 'code-msg';
    },

    gameOver({ score, dist, coins, best, isBest }) {
      this.resetCodeForm();
      $('goDist').textContent = fmt(dist) + ' ' + t('m');
      $('goCoins').textContent = fmt(coins);
      $('goBest').textContent = fmt(best);
      $('newBest').hidden = !isBest;
      // count the score up
      const el = $('goScore'), t0 = performance.now(), dur = 900;
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(score * e);
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },

    setSwitch(id, on) { $(id).setAttribute('aria-pressed', on ? 'true' : 'false'); },
    setQuality(q) { document.querySelectorAll('#optQuality button').forEach(b => b.setAttribute('aria-pressed', b.dataset.q === q ? 'true' : 'false')); },
    fps(on, value) { $('fps').hidden = !on; if (on && value !== undefined) $('fps').textContent = value + ' FPS'; },

    bind(id, fn) {
      $(id).addEventListener('click', (e) => { VR.Audio.unlock(); VR.Audio.play('click'); fn(e); });
    },
  };
  VR.UI = UI;
  UI.setLang(lang);
})();

/* =====================================================================
 * MISSIONS — three active goals at a time, each with a coin reward.
 * Finishing one pays out immediately and replaces it with the next,
 * harder tier (or a different mission). Progress and lifetime stats are
 * saved in localStorage (keys: missions, lifetime).
 *
 *   kind 'run'  -> reach N inside ONE run (distance, coins, score)
 *   kind 'sum'  -> add up N over any number of runs (jumps, lemons ...)
 *
 * Hooks (called from game.js): bump(stat, n), runValue(stat, value),
 * startRun(), endRun(summary).
 * ===================================================================== */
(function () {
  const UI = VR.UI;
  const DEFS = [
    { id: 'dist',     kind: 'run', stat: 'distRun',    ar: 'اركض {n} م بجولة وحدة',        en: 'Run {n} m in one run',        tiers: [400, 1000, 2000, 3500, 6000] },
    { id: 'coins',    kind: 'run', stat: 'coinsRun',   ar: 'اجمع {n} عملة بجولة وحدة',      en: 'Collect {n} coins in one run', tiers: [80, 200, 400, 700, 1100] },
    { id: 'score',    kind: 'run', stat: 'scoreRun',   ar: 'سجّل {n} نقطة بجولة وحدة',       en: 'Score {n} in one run',        tiers: [2500, 8000, 20000, 45000, 90000] },
    { id: 'jumps',    kind: 'sum', stat: 'jumps',      ar: 'اقفز {n} مرة',                  en: 'Jump {n} times',              tiers: [25, 80, 180, 400] },
    { id: 'slides',   kind: 'sum', stat: 'slides',     ar: 'انزلق {n} مرة',                 en: 'Slide {n} times',             tiers: [15, 50, 120, 300] },
    { id: 'lemons',   kind: 'sum', stat: 'lemons',     ar: 'اجمع {n} ليمونة',               en: 'Collect {n} lemons',          tiers: [5, 15, 40, 90] },
    { id: 'lemonade', kind: 'sum', stat: 'lemonade',   ar: 'اعمل {n} ليموناضة',             en: 'Make {n} lemonades',          tiers: [1, 3, 8, 16] },
    { id: 'powerups', kind: 'sum', stat: 'powerups',   ar: 'التقط {n} قدرة',                en: 'Pick up {n} power-ups',       tiers: [3, 10, 25, 60] },
    { id: 'jetpack',  kind: 'sum', stat: 'jetpacks',   ar: 'طِر بالجيت باك {n} مرات',        en: 'Fly the jetpack {n} times',   tiers: [1, 3, 8, 15] },
    { id: 'close',    kind: 'sum', stat: 'closeCalls', ar: 'انجُ بأعجوبة {n} مرات',          en: 'Get {n} close calls',         tiers: [3, 10, 25, 60] },
    { id: 'runs',     kind: 'sum', stat: 'runs',       ar: 'العب {n} جولات',                en: 'Play {n} runs',               tiers: [3, 10, 25, 60] },
    { id: 'thief',    kind: 'sum', stat: 'thieves',    ar: 'امسك حرامي الليمون {n} مرات',    en: 'Catch the lemon thief {n} times', tiers: [1, 3, 8, 15] },
    { id: 'forks',    kind: 'sum', stat: 'forks',      ar: 'اختار طريقك بـ {n} مفترقات',      en: 'Take {n} junctions',          tiers: [2, 6, 15, 30] },
    { id: 'rides',    kind: 'sum', stat: 'rides',      ar: 'اركب مركبة {n} مرات',            en: 'Ride a vehicle {n} times',    tiers: [1, 4, 10, 20] },
  ];
  const BY_ID = Object.fromEntries(DEFS.map(d => [d.id, d]));
  const reward = (d, tier) => Math.round((60 + tier * 90) * (d.kind === 'run' ? 1.2 : 1) / 10) * 10;

  class Missions {
    constructor() {
      const saved = UI.store.get('missions', null);
      this.tiers = (saved && saved.tiers) || {};         // id -> next tier index
      this.active = ((saved && saved.active) || []).filter(m => BY_ID[m.id] && BY_ID[m.id].tiers[m.tier] !== undefined);
      this.life = Object.assign({ runs: 0, dist: 0, coins: 0, jumps: 0, slides: 0, lemons: 0, lemonade: 0, powerups: 0, jetpacks: 0, closeCalls: 0, bestDist: 0, thieves: 0, forks: 0, rides: 0, weather: 0 },
        UI.store.get('lifetime', {}));
      while (this.active.length < 3) this.active.push(this.pick());
      this.onComplete = null;        // (mission, reward) => void
      this.save();
    }
    pick() {
      const taken = new Set(this.active.filter(Boolean).map(m => m.id));
      const pool = DEFS.filter(d => !taken.has(d.id) && (this.tiers[d.id] || 0) < d.tiers.length);
      const list = pool.length ? pool : DEFS.filter(d => !taken.has(d.id));
      const d = list[(Math.random() * list.length) | 0];
      const tier = Math.min(this.tiers[d.id] || 0, d.tiers.length - 1);
      return { id: d.id, tier, progress: 0 };
    }
    save() { UI.store.set('missions', { tiers: this.tiers, active: this.active }); UI.store.set('lifetime', this.life); }

    target(m) { return BY_ID[m.id].tiers[m.tier]; }
    reward(m) { return reward(BY_ID[m.id], m.tier); }
    text(m) {
      const d = BY_ID[m.id], n = this.target(m).toLocaleString('en-US');
      return (UI.lang === 'ar' ? d.ar : d.en).replace('{n}', n);
    }

    startRun() {
      for (const m of this.active) if (BY_ID[m.id].kind === 'run') m.progress = 0;
      this.bump('runs', 1);
    }
    // cumulative counters (jumps, lemons ...)
    bump(stat, n = 1) {
      if (stat in this.life) this.life[stat] += n;
      let changed = false;
      for (const m of this.active) {
        const d = BY_ID[m.id];
        if (d.kind === 'sum' && d.stat === stat) { m.progress += n; changed = true; }
      }
      if (changed) this.check();
    }
    // best-in-one-run values (distance, coins, score); cheap to call every frame
    runValue(stat, v) {
      for (const m of this.active) {
        const d = BY_ID[m.id];
        if (d.kind === 'run' && d.stat === stat && v > m.progress) {
          m.progress = v;
          if (v >= this.target(m)) this.check();
        }
      }
    }
    check() {
      for (let i = 0; i < this.active.length; i++) {
        const m = this.active[i];
        if (m.progress >= this.target(m)) {
          const r = this.reward(m);
          this.tiers[m.id] = m.tier + 1;
          this.active[i] = null;
          const next = this.pick();
          this.active[i] = next;
          if (this.onComplete) this.onComplete(m, r);
        }
      }
      this.save();
    }
    endRun({ dist, coins }) {
      this.life.dist += Math.floor(dist); this.life.coins += coins;
      this.life.bestDist = Math.max(this.life.bestDist, Math.floor(dist));
      this.save();
    }
  }
  VR.Missions = Missions;
})();

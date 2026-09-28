/* =====================================================================
 * UI — screens, HUD, toasts, shop, tutorial, i18n (Arabic / English)
 * and settings persistence.  All DOM lives in index.html; this module
 * only toggles and fills it.
 * ===================================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const SCREENS = ['loading', 'menu', 'character', 'settings', 'pause', 'gameover'];

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
      fps: 'عرض FPS', language: 'اللغة', done: 'تم', paused: 'استراحة', resume: 'متابعة', menu: 'القائمة',
      gameOver: 'انتهت الجولة', newBest: 'رقم قياسي جديد!', score: 'النتيجة', distance: 'المسافة', coins: 'العملات', best: 'الأفضل', again: 'العب مجدداً',
      select: 'اختيار', selected: 'مختار', buy: 'شراء', locked: 'مقفل',
      multiplier: 'المضاعف', stumble: 'تعثّر!', shieldBroken: 'انكسر الدرع!', lemonTip: 'جمّع ٥ ليمونات = ليموناضة!', closeCall: 'نجاة بأعجوبة!', continue: 'تابع الركض!',
      controlsTouch: 'اسحب يمين ويسار للتنقّل · لفوق للقفز · لتحت للانزلاق',
      tutLane: 'اسحب يميناً ويساراً لتغيير المسار', tutJump: 'اسحب للأعلى للقفز', tutSlide: 'اسحب للأسفل للانزلاق',
      tutLaneK: '← →', tutJumpK: '↑ / Space', tutSlideK: '↓',
      notEnough: 'ما معك عملات كافية', bought: 'صارت لك!',
      pu: { magnet: 'مغناطيس!', shield: 'درع!', boost: 'انطلاق!', double: 'عملات مضاعفة!', invincible: 'نجمة!', lemonade: 'ليموناضة! نقاط وعملات مضاعفة' },
      m: 'م',
    },
    en: {
      loading: 'Laying the tracks…', tagline: 'The endless rail runner', play: 'PLAY', characters: 'Characters',
      controls: '<kbd>←</kbd><kbd>→</kbd> switch lanes · <kbd>↑</kbd>/<kbd>Space</kbd> jump · <kbd>↓</kbd> slide · swipe on mobile',
      settings: 'Settings', sfx: 'Sound effects', music: 'Music', graphics: 'Graphics', qHigh: 'High', qMed: 'Medium', qLow: 'Low',
      fps: 'Show FPS', language: 'Language', done: 'Done', paused: 'Paused', resume: 'Resume', menu: 'Menu',
      gameOver: 'Game Over', newBest: 'NEW BEST!', score: 'Score', distance: 'Distance', coins: 'Coins', best: 'Best', again: 'Play again',
      select: 'Select', selected: 'Selected', buy: 'Buy', locked: 'Locked',
      multiplier: 'Multiplier', stumble: 'Stumble!', shieldBroken: 'Shield broken!', lemonTip: 'Collect 5 lemons = Lemonade!', closeCall: 'Close call!', continue: 'Keep running!',
      controlsTouch: 'Swipe left / right to switch lanes · up to jump · down to slide',
      tutLane: 'Swipe left / right to change lanes', tutJump: 'Swipe up to jump', tutSlide: 'Swipe down to slide',
      tutLaneK: '← →', tutJumpK: '↑ / Space', tutSlideK: '↓',
      notEnough: 'Not enough coins', bought: 'Unlocked!',
      pu: { magnet: 'Magnet!', shield: 'Shield!', boost: 'Boost!', double: '2x Coins!', invincible: 'Star!', lemonade: 'Lemonade! 2x score & coins' },
      m: 'm',
    },
  };
  let lang = store.get('lang', 'ar');
  const t = (k) => STR[lang][k] ?? STR.ar[k] ?? k;

  const fmt = (n) => Math.floor(n).toLocaleString('en-US');
  let toastTimer = 0, biomeTimer = 0;
  const bars = {};

  const UI = {
    store, fmt, t,
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
      $('hudScore').textContent = fmt(score);
      $('hudDist').textContent = fmt(dist) + ' ' + t('m');
      $('hudCoins').textContent = fmt(coins);
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
        const frac = Math.max(0, Math.min(1, state.remaining(k) / (VR.CONFIG.POWERUPS[k] || VR.CONFIG[k.toUpperCase()]).duration));
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

    menuStats(best, bank) { $('menuBest').textContent = fmt(best); $('menuBank').textContent = fmt(bank); $('shopBank').textContent = fmt(bank); },

    character(def, index, owned, selectedId, bank) {
      $('charName').textContent = lang === 'ar' ? def.name : def.nameEn;
      $('charTag').textContent = lang === 'ar' ? def.tagline : def.taglineEn;
      const dots = $('charDots');
      dots.innerHTML = VR.CHARACTERS.map((c, i) => `<i class="${i === index ? 'on' : ''} ${owned.has(c.id) ? 'owned' : ''}"></i>`).join('');
      const btn = $('charDone');
      $('shopBank').textContent = fmt(bank);
      if (!owned.has(def.id)) {
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

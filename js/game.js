/* =====================================================================
 * GAME — state machine, main loop, rendering pipeline, camera,
 * scoring, rules, shop and environment transitions.
 * States: loading -> menu <-> character/settings -> playing <-> paused
 *         -> dying -> gameover -> (playing | menu)
 *
 * SCORE is computed in Game.updateScore() and Game.onCoin().
 * SPEED / DIFFICULTY are computed in Game.speedAt() / Game.difficultyAt()
 * from the numbers in config.js.
 * ===================================================================== */
(function () {
  const C = VR.CONFIG;
  const UI = VR.UI;
  const T = THREE;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const QUALITY = {
    high:   { post: true,  shadows: 2048, pr: 2,   chunks: 6, fog: 1,    msaa: 4 },
    medium: { post: true,  shadows: 1024, pr: 1.5, chunks: 5, fog: 0.92, msaa: 2 },
    low:    { post: false, shadows: 0,    pr: 1,   chunks: 4, fog: 0.8,  msaa: 0 },
  };
  const TUNNEL_COLOR = new T.Color(0x14120f);
  const DRS_MIN = 0.62;

  class Game {
    constructor() {
      this.state = 'loading';
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      this.settings = Object.assign({ sfx: true, music: true, quality: coarse ? 'medium' : 'high', fps: false }, UI.store.get('settings', {}));
      if (!QUALITY[this.settings.quality]) this.settings.quality = 'medium';
      this.best = UI.store.get('best', 0);
      this.bank = UI.store.get('bank', 0);
      this.owned = new Set(UI.store.get('owned', ['hero']));
      this.owned.add('hero');
      this.selectedId = UI.store.get('character', 'hero');
      if (!VR.CHARACTERS.some(c => c.id === this.selectedId) || !this.owned.has(this.selectedId)) this.selectedId = 'hero';
      this.charIndex = Math.max(0, VR.CHARACTERS.findIndex(c => c.id === this.selectedId));

      this.missions = new VR.Missions();
      this.missions.onComplete = (m, reward) => this.onMissionDone(m, reward);
      this.lemonNeed = C.LEMONADE.need; this.coinBonus = 0; this.coinFrac = 0;

      this.initRenderer();
      this.fx = new VR.FX(this.scene);
      this.powerups = new VR.PowerUpState();
      this.collect = new VR.Collectibles(this.scene, this.fx);
      this.world = new VR.World(this.scene, this.collect);
      this.player = new VR.Player(this.scene);
      this.player.setCharacter(VR.CHARACTERS[this.charIndex]);
      this.player.events.onStep = (side, x, y, z) => this.onStep(side, x, y, z);
      // feature systems (weather, thief, vehicles, pets, stand, story, daily ...)
      this.sys = (VR.SYSTEMS || []).map(S => new S(this));
      this.S = {}; for (const s of this.sys) if (s.name) this.S[s.name] = s;
      this.mode = 'endless'; this.evRnd = Math.random;
      this.bindUI();
      for (const s of this.sys) if (s.bind) s.bind();
      UI.setLang(UI.lang);          // modules added strings + screens: translate them too
      this.applySettings();

      this.clock = new T.Clock();
      this.fpsAcc = 0; this.fpsFrames = 0; this.perfAcc = 0; this.perfFrames = 0; this.autoDowngraded = false;
      this.shake = 0; this.camBump = 0; this.camBumpV = 0;
      this.menuTime = 0; this.timeScale = 1;
      this.fxRadial = 0; this.fxCA = 0; this.fxFlash = 0; this.fxDesat = 0;
      this.look = null; this.envTimer = 0; this.envDirty = 3;
      this._v = new T.Vector3(); this._v2 = new T.Vector3();
    }

    // ------------------------------------------------------------ setup
    initRenderer() {
      const holder = document.getElementById('game');
      this.renderer = new T.WebGLRenderer({ antialias: this.settings.quality === 'low', powerPreference: 'high-performance', stencil: false });
      this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      holder.appendChild(this.renderer.domElement);

      this.scene = new T.Scene();
      this.scene.fog = new T.Fog(0xc9e4f6, 55, 230);
      this.hemi = new T.HemisphereLight(0xdff0ff, 0x6b8a4a, 1.35);
      this.sun = new T.DirectionalLight(0xfff1d0, 2.7);
      this.sun.castShadow = true;
      const sc = this.sun.shadow.camera;
      sc.left = -24; sc.right = 24; sc.top = 34; sc.bottom = -26; sc.near = 1; sc.far = 140;
      this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03;
      this.scene.add(this.hemi, this.sun, this.sun.target);

      this.sky = new VR.Sky(this.scene);
      this.post = new VR.Post(this.renderer);
      this.pmrem = new T.PMREMGenerator(this.renderer);
      this.envScene = new T.Scene();
      const envDome = new T.Mesh(new T.SphereGeometry(50, 32, 16), this.sky.material);
      this.envScene.add(envDome);

      this.camera = new T.PerspectiveCamera(C.CAMERA_FOV, 1, 0.3, 1200);
      this.camLook = new T.Vector3();
      // keep the canvas exactly the size of the screen on phones too: the
      // mobile address bar / rotation change the viewport without always firing
      // 'resize', so also watch the element itself and the visual viewport.
      const onResize = () => { cancelAnimationFrame(this._rzf); this._rzf = requestAnimationFrame(() => this.resize()); };
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
      if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
      if (window.ResizeObserver) new ResizeObserver(onResize).observe(holder);
      this.viewOff = { x: 0, y: 0 };
      this.resize();
    }

    get Q() { return QUALITY[this.settings.quality]; }

    // broadcast an event to every feature system that implements it
    emit(ev, a, b, c) { if (!this.sys) return; for (const s of this.sys) if (s[ev]) s[ev](a, b, c); }
    // first system that answers wins (e.g. a vehicle absorbing a crash)
    ask(ev, a, b) { if (!this.sys) return false; for (const s of this.sys) if (s[ev] && s[ev](a, b)) return true; return false; }

    // shifts the picture on screen without moving the camera (menu framing)
    applyViewOffset() {
      const o = this.viewOff, w = this.W || 1, h = this.H || 1;
      if (Math.abs(o.x) < 0.5 && Math.abs(o.y) < 0.5) this.camera.clearViewOffset();
      else this.camera.setViewOffset(w, h, o.x, o.y, w, h);
      this.camera.updateProjectionMatrix();
    }

    resize() {
      const holder = document.getElementById('game');
      const w = Math.max(1, holder.clientWidth || window.innerWidth), h = Math.max(1, holder.clientHeight || window.innerHeight);
      const pr = Math.min(window.devicePixelRatio || 1, this.Q.pr) * (this.drsScale || 1);
      if (this._size === w + 'x' + h + '@' + pr) return;
      this._size = w + 'x' + h + '@' + pr;
      this.W = w; this.H = h;
      this.renderer.setPixelRatio(pr);
      this.renderer.setSize(w, h, false);          // CSS keeps the canvas at 100% x 100%
      this.post.setSize(w, h, pr);
      this.camera.aspect = w / h;
      this.portrait = w / h < 0.8;
      // portrait: widen the vertical FOV so the three lanes still fit across
      // the narrow screen (keeps ~46 deg horizontal), instead of lifting the camera
      const aspect = w / h;
      this.baseFov = aspect < 1
        ? clamp(2 * Math.atan(Math.tan(T.MathUtils.degToRad(23)) / aspect) * 180 / Math.PI, C.CAMERA_FOV, 84)
        : C.CAMERA_FOV;
      this.camera.fov = this.baseFov;
      this.applyViewOffset();
      if (this.fx) this.fx.setScale(h * pr, this.camera.fov);
    }

    applySettings() {
      const s = this.settings, Q = this.Q;
      VR.Audio.setEnabled('sfx', s.sfx);
      VR.Audio.setEnabled('music', s.music);
      C.CHUNKS_AHEAD = Q.chunks;
      this.post.setSamples(Q.msaa);
      this.renderer.shadowMap.enabled = Q.shadows > 0;
      this.sun.castShadow = Q.shadows > 0;
      if (Q.shadows && this.sun.shadow.mapSize.x !== Q.shadows) {
        this.sun.shadow.mapSize.set(Q.shadows, Q.shadows);
        if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      }
      // materials must recompile when shadows toggle
      this.scene.traverse(o => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(mm => (mm.needsUpdate = true)); } });
      UI.setSwitch('optSfx', s.sfx);
      UI.setSwitch('optMusic', s.music);
      UI.setSwitch('optFps', s.fps);
      UI.setQuality(s.quality);
      UI.fps(s.fps);
      this.resize();
      UI.store.set('settings', s);
      if (this.envCache) requestAnimationFrame(() => this.warmup());
    }

    bindUI() {
      const $ = (id) => document.getElementById(id);
      UI.bind('playBtn', () => this.start({ mode: 'endless' }));
      // full screen (hides the phone's browser bars); not every phone browser supports it
      const fsOK = document.fullscreenEnabled || document.webkitFullscreenEnabled;
      const fsBtn = $('fsBtn');
      fsBtn.hidden = !fsOK;
      const fsIcon = () => { fsBtn.querySelector('use').setAttribute('href', (document.fullscreenElement || document.webkitFullscreenElement) ? '#i-shrink' : '#i-expand'); };
      document.addEventListener('fullscreenchange', fsIcon); document.addEventListener('webkitfullscreenchange', fsIcon);
      UI.bind('fsBtn', () => { if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else this.enterFullscreen(); });
      UI.bind('againBtn', () => this.start(this.lastRunOpts || { mode: 'endless' }));
      UI.bind('missionsBtn', () => { UI.missions(this.missions); this.setState('missions'); });
      UI.bind('dailyBtn', () => this.S.daily.open());
      UI.bind('storyBtn', () => this.S.story.open());
      UI.bind('petsBtn', () => this.S.pets.open());
      UI.bind('standBtn', () => this.S.stand.open());
      UI.bind('boardBtn', () => this.S.board.open());
      UI.bind('missionsDone', () => this.setState('menu'));
      UI.bind('charBtn', () => { this.charIndex = VR.CHARACTERS.findIndex(c => c.id === this.selectedId); this.setState('character'); });
      UI.bind('charPrev', () => this.cycleChar(-1));
      UI.bind('charNext', () => this.cycleChar(1));
      UI.bind('charBack', () => this.leaveShop());
      UI.bind('charDone', () => this.shopAction());
      UI.bind('settingsBtn', () => { this.settingsReturn = 'menu'; this.setState('settings'); });
      UI.bind('pauseSettings', () => { this.settingsReturn = 'paused'; this.setState('settings'); });
      UI.bind('settingsDone', () => this.setState(this.settingsReturn || 'menu'));
      UI.bind('pauseBtn', () => this.pause());
      UI.bind('resumeBtn', () => this.resume());
      UI.bind('pauseMenu', () => this.toMenu());
      UI.bind('goMenu', () => this.toMenu());
      UI.bind('langBtn', () => { UI.setLang(UI.lang === 'ar' ? 'en' : 'ar'); });
      // secret-code continue
      UI.bind('codeBtn', () => UI.openCodeForm());
      $('codeInput').addEventListener('input', () => { const m = $('codeMsg'); m.textContent = ''; m.className = 'code-msg'; });
      $('codeForm').addEventListener('submit', (e) => {
        e.preventDefault();
        VR.Audio.unlock();
        const result = this.tryContinue($('codeInput').value);
        UI.codeResult(result);
      });
      UI.bind('optSfx', () => { this.settings.sfx = !this.settings.sfx; this.applySettings(); });
      UI.bind('optMusic', () => {
        this.settings.music = !this.settings.music; this.applySettings();
        if (this.settings.music) VR.Audio.startMusic(); else VR.Audio.stopMusic();
      });
      document.querySelectorAll('#optQuality button').forEach(b => b.addEventListener('click', () => { VR.Audio.play('click'); this.settings.quality = b.dataset.q; this.applySettings(); }));
      document.querySelectorAll('#optLang button').forEach(b => b.addEventListener('click', () => { VR.Audio.play('click'); UI.setLang(b.dataset.l); }));
      UI.bind('optFps', () => { this.settings.fps = !this.settings.fps; this.applySettings(); });
      VR.Input.onPause(() => { if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resume(); });
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
      // menu: Enter / Space starts a run
      window.addEventListener('keydown', (e) => {
        if (e.target && e.target.tagName === 'INPUT') return;
        if ((e.code === 'Enter' || e.code === 'Space') && this.state === 'menu') { e.preventDefault(); VR.Audio.unlock(); this.start({ mode: 'endless' }); }
        if (this.state === 'character') { if (e.code === 'ArrowLeft') this.cycleChar(UI.lang === 'ar' ? 1 : -1); if (e.code === 'ArrowRight') this.cycleChar(UI.lang === 'ar' ? -1 : 1); }
      });
      // drag to spin the character on the character screen
      const el = $('game');
      let dragX = null;
      let downX = 0, downT = 0;
      el.addEventListener('pointerdown', (e) => {
        VR.Audio.unlock();
        if (this.settings.music && (this.state === 'menu' || this.state === 'character')) VR.Audio.startMusic();
        if (this.state === 'character' || this.state === 'menu') { dragX = downX = e.clientX; downT = performance.now(); }
      });
      window.addEventListener('pointermove', (e) => { if (dragX !== null) { this.spinVel = (e.clientX - dragX) * 0.012; this.charSpin = (this.charSpin || 0) + this.spinVel; dragX = e.clientX; } });
      window.addEventListener('pointerup', (e) => {
        // a tap on the scene makes the hero jump for joy
        if (dragX !== null && Math.abs(e.clientX - downX) < 8 && performance.now() - downT < 400 && !(this.player.cheer > 0)) {
          this.player.cheer = 1; VR.Audio.play('jump');
          setTimeout(() => { if (this.state === 'menu' || this.state === 'character') { VR.Audio.play('land'); this.fx.dust(0, 0, 0.1, 8, 0xc8b8a0, 1); } }, 780);
        }
        dragX = null;
      });
    }

    // ------------------------------------------------------------ shop
    cycleChar(d) {
      const n = VR.CHARACTERS.length;
      this.charIndex = (this.charIndex + d + n) % n;
      const def = VR.CHARACTERS[this.charIndex];
      this.player.setCharacter(def);
      this.refreshShop();
      VR.Audio.play('whoosh');
      this.fx.sparkle(0, 1.2, 0, 0xffe28a, 14, 3);
    }
    refreshShop() { UI.character(VR.CHARACTERS[this.charIndex], this.charIndex, this.owned, this.selectedId, this.bank); }
    shopAction() {
      const def = VR.CHARACTERS[this.charIndex];
      if (!this.owned.has(def.id) && def.event) {
        const E = this.S.events;
        if (!E || E.count(def.event) < def.need) { VR.Audio.play('denied'); UI.toast(UI.t('eventOnly'), 1400); return; }
      } else if (!this.owned.has(def.id)) {
        if (this.bank < def.price) { VR.Audio.play('denied'); UI.toast(UI.t('notEnough'), 1200); return; }
        this.bank -= def.price; UI.store.set('bank', this.bank);
      }
      if (!this.owned.has(def.id)) {
        this.owned.add(def.id); UI.store.set('owned', [...this.owned]);
        this.selectedId = def.id; UI.store.set('character', def.id);
        VR.Audio.play('buy');
        this.fx.confetti(0, 1.8, 0, 70);
        UI.toast(UI.t('bought'), 1200, true);
        this.refreshShop();
        return;
      }
      this.selectedId = def.id; UI.store.set('character', def.id);
      this.refreshShop();
      this.leaveShop();
    }
    leaveShop() {
      // show the selected character again if the player browsed away
      const idx = VR.CHARACTERS.findIndex(c => c.id === this.selectedId);
      if (idx !== this.charIndex) { this.charIndex = idx; this.player.setCharacter(VR.CHARACTERS[idx]); }
      this.setState('menu');
    }

    // ------------------------------------------------------------ states
    setState(s) {
      this.state = s;
      const map = { menu: 'menu', character: 'character', settings: 'settings', paused: 'pause', gameover: 'gameover', playing: null, dying: null, loading: 'loading', missions: 'missions', resuming: null, ...(VR.SCREEN_MAP || {}) };
      UI.show(map[s]);
      UI.hud(s === 'playing' || s === 'paused' || s === 'dying' || s === 'resuming');
      VR.Input.setEnabled(s === 'playing');
      if (s !== 'playing') UI.tutorial(null);
      if (s === 'menu') { UI.menuStats(this.best, this.bank); VR.Audio.setMode('menu'); }
      if (s === 'character') this.refreshShop();
      // full resolution on the menus; a run resumes at the level the last run settled on
      if (s === 'menu' && (this.drsScale || 1) < 1) { this.drsRun = this.drsScale; this.drsScale = 1; this.resize(); }
      this.emit('state', s);
    }

    boot() {
      this.resetRun();
      const keys = Object.keys(this.world.pool.factories);
      let i = 0;
      const stepBuild = () => {
        const t0 = performance.now();
        while (i < keys.length && performance.now() - t0 < 40) {
          const o = this.world.pool.get(keys[i]); this.world.pool.release(o); i++;
        }
        UI.loadProgress(0.1 + 0.8 * (i / keys.length));
        if (i < keys.length) { setTimeout(stepBuild, 0); return; }
        this.world.update(0, this.player, C.SPEED_START, 0, this, true);
        this.buildEnvCache();
        this.updateEnvironment(1, true);
        this.regenEnv();
        this.warmup();
        UI.loadProgress(1);
        setTimeout(() => { this.setState('menu'); this.loop(); }, 120);
      };
      UI.loadProgress(0.05);
      setTimeout(stepBuild, 0);
    }

    resetRun() {
      this.usedCodes = new Set();                  // each secret code works once per run
      this.canContinue = false;
      this.deathState = null;
      this.player.reset();
      this.powerups.reset();
      this.world.reset(this.runOpts || {});
      this.emit('reset');
      this.fx.clear();
      this.distance = 0; this.score = 0; this.coins = 0;
      this.lemons = 0; this.lemonsRun = 0;           // lemon meter (resets each run)
      this.stumbles = 0; this.revived = false; this.diffFn = null;
      this.jetGrace = 0; VR.Audio.jet(false);
      this.multiplier = 1;
      this.speed = C.SPEED_START;
      this.lastBiome = null;
      this.hitCooldown = 0;
      this.tunnelDark = 0;
      this.runTime = 0;
      this.timeScale = 1;
      this.fxDesat = 0;
      this.camera.position.set(0, C.CAMERA_HEIGHT, C.CAMERA_DISTANCE);
      this.camLook.set(0, 1.4, -C.CAMERA_LOOK_AHEAD);
      UI.clearPowerups();
      UI.setHUD(0, 0, 0, 1);
      UI.lemons(0, this.lemonNeed, 0);
    }

    enterFullscreen() {
      const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!req || document.fullscreenElement || document.webkitFullscreenElement) return;
      try { const r = req.call(el, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not allowed */ }
    }

    /**
     * opts.mode  'endless' (default) | 'daily' | 'story'
     * opts.seed  seeded railway; opts.biomes / styles / forks -> world.reset
     */
    start(opts = {}) {
      if (opts instanceof Event) opts = {};
      VR.Audio.unlock();
      this.mode = opts.mode || 'endless';
      this.runOpts = opts;
      if (this.drsRun && this.drsRun < 1) { this.drsScale = Math.min(1, this.drsRun + 0.08); this.resize(); }
      this.evRnd = opts.seed != null ? VR.rng(opts.seed * 7 + 13) : Math.random;
      // on phones, go full screen when a run starts (tap = user gesture)
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) this.enterFullscreen();
      // the menu may have been showing a character you haven't bought
      if (VR.CHARACTERS[this.charIndex].id !== this.selectedId) this.leaveShop();
      this.resetRun();
      this.player.startW = 0;
      this.camera.position.copy(this.menuCamPos || this.camera.position);
      this.camLook.copy(this.menuLook || this.camLook);
      this.swoop = 0;
      this.showPickups(true);
      const mc = this.camera.position;
      this.swoopFrom = { a: Math.atan2(mc.x, mc.z), r: Math.hypot(mc.x, mc.z), y: mc.y };
      this.setState('playing');
      VR.Audio.setMode('game');
      if (this.settings.music) VR.Audio.startMusic();
      VR.Audio.setMusicVolume(1);
      this.tutorialOn = !UI.store.get('tutorialDone', false);
      // character perks
      const def = VR.CHARACTERS.find(c => c.id === this.selectedId) || VR.CHARACTERS[0];
      this.powerups.mul = def.perkMul || {};
      this.lemonNeed = def.lemonNeed || C.LEMONADE.need;
      this.coinBonus = def.coinBonus || 0; this.coinFrac = 0;
      UI.lemons(0, this.lemonNeed, 0);
      this.missions.startRun();
      this.lifeAcc = { dist: 0, coins: 0 };
      this.emit('runStart', opts);
    }
    pause() {
      if (this.state === 'resuming') { clearTimeout(this.cdTimer); UI.countdown(0); this.setState('paused'); return; }
      if (this.state !== 'playing') return; this.setState('paused'); VR.Audio.setMusicVolume(0.3); VR.Audio.jet(false); }
    // 3-2-1 before the run continues, so you're not thrown straight into a train
    resume() {
      this.setState('resuming');
      let n = 3;
      const tick = () => {
        if (this.state !== 'resuming') return;
        if (n > 0) { UI.countdown(n); VR.Audio.play('tick'); n--; this.cdTimer = setTimeout(tick, 600); return; }
        UI.countdown(0);
        this.setState('playing'); this.clock.getDelta(); VR.Audio.setMusicVolume(1);
        if (this.player.flying) VR.Audio.jet(true);
      };
      tick();
    }
    toMenu() {
      this.runOpts = {}; this.mode = 'endless';
      this.emit('leaveRun');
      this.resetRun();
      this.world.update(0, this.player, C.SPEED_START, 0, this, true);
      this.setState('menu');
      VR.Audio.setMusicVolume(0.7);
    }

    gameOver() {
      this.setState('dying');
      VR.Input.setEnabled(false);
      const p = this.player;
      this.deathState = { x: p.x, y: p.y, z: p.z, lane: p.lane, coinsBanked: this.coins };
      this.canContinue = true;                     // one continue per death
      this.player.groundAtDeath = this.world.surfaceAt(p.x, p.z, p.y + 0.01, 0.3).h;
      this.player.die();
      VR.Audio.jet(false); this.vibrate([60, 40, 90]);
      this.deathCam = { t: 0, from: this.camera.position.clone() };
      VR.Audio.play('crash');
      VR.Audio.setMusicVolume(0.25);
      this.shake = 0.6; this.fxCA = 1; this.timeScale = 0.3;
      UI.hitFlash();
      this.fx.smash(p.x, p.y + 0.5, p.z - 0.8);
      const isBest = this.score > this.best;
      if (isBest) { this.best = Math.floor(this.score); UI.store.set('best', this.best); }
      this.bank += this.coins; UI.store.set('bank', this.bank);
      const acc = this.lifeAcc || (this.lifeAcc = { dist: 0, coins: 0 });
      this.missions.endRun({ dist: this.distance - acc.dist, coins: this.coins - acc.coins });
      acc.dist = this.distance; acc.coins = this.coins;
      UI.missions(this.missions, 'goMissions');
      this.lastRunOpts = this.runOpts;
      this.emit('runEnd', { score: this.score, dist: this.distance, coins: this.coins, isBest });
      clearTimeout(this.goTimer);
      this.goTimer = setTimeout(() => {
        UI.gameOver({ score: this.score, dist: this.distance, coins: this.coins, best: this.best, isBest });
        this.setState('gameover');
        if (isBest) { VR.Audio.play('newBest'); this.fx.confetti(p.x, p.y + 2, p.z, 120); }
      }, 1500);
    }

    /**
     * Secret-code continue. Only valid on the Game Over screen, once per
     * death, and each code only once per run.
     * Returns 'ok' | 'wrong' | 'used' | 'unavailable'.
     */
    tryContinue(text) {
      if (this.state !== 'gameover' || !this.canContinue || !this.deathState) return 'unavailable';
      const code = VR.SecretCodes.check(text);
      if (!code) return 'wrong';
      if (this.usedCodes.has(code)) return 'used';
      this.usedCodes.add(code);
      this.canContinue = false;
      this.revive();
      return 'ok';
    }

    revive() {
      const d = this.deathState;
      this.revived = true;
      this.bank -= d.coinsBanked; UI.store.set('bank', this.bank);
      this.player.revive(d);
      this.powerups.timers.invincible = Math.max(this.powerups.remaining('invincible'), 3);
      this.hitCooldown = 0.3;
      this.shake = 0; this.timeScale = 1; this.fxDesat = 0; this.fxFlash = 0.8;
      this.deathCam = null;
      this.clock.getDelta();
      this.setState('playing');
      VR.Audio.play('powerup');
      VR.Audio.setMusicVolume(1);
      this.fx.ring(d.x, d.y + 1, d.z, 0xffe28a, 24, 7);
      UI.toast(UI.t('continue'), 1200, true);
    }

    // ------------------------------------------------------------ rules
    speedAt(d) { return C.SPEED_START + (C.SPEED_MAX - C.SPEED_START) * (1 - Math.exp(-d / C.SPEED_RAMP)); }
    difficultyAt(d) { return this.diffFn ? this.diffFn(d) : 1 - Math.exp(-d / C.DIFFICULTY_RAMP); }
    multiplierAt(d) { let m = 0; for (const s of C.MULTIPLIER_STEPS) if (d >= s) m++; return m; }

    updateScore(dm) {
      const m = this.multiplierAt(this.distance);
      if (m !== this.multiplier) { this.multiplier = m; if (m > 1) { UI.toast(UI.t('multiplier') + ' x' + m, 1100, true); VR.Audio.play('gem'); } }
      const boost = (this.powerups.active('boost') ? 2 : 1) * (this.powerups.active('lemonade') ? 2 : 1);
      this.score += dm * C.POINTS_PER_METRE * this.multiplier * boost;
    }

    screenPos(x, y, z) {
      const v = this._v.set(x, y, z).project(this.camera);
      return [(v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight];
    }
    onCoin(n, x, y, z) {
      const dbl = (this.powerups.active('double') ? 2 : 1) * (this.powerups.active('lemonade') ? 2 : 1);
      this.coins += n * dbl;
      if (this.coinBonus) { this.coinFrac += n * dbl * this.coinBonus; const x = Math.floor(this.coinFrac); this.coins += x; this.coinFrac -= x; }
      this.score += C.COIN_POINTS * n * dbl * this.multiplier;
      VR.Audio.play('coin');
      this.fx.sparkle(x, y, z, 0xffd84a, 4, 2.2, -this.speed * 0.95);
      UI.bumpCoins();
    }
    // ------------------------------------------------------------ jetpack
    // Lift off to cruising height (above the trains, under the wires and the
    // tunnel vault), lay a trail of coins in the air, and fly over everything.
    startJetpack() {
      const p = this.player, J = C.POWERUPS.jetpack, LW = C.LANE_WIDTH;
      p.flying = true; p.flyH = J.height; p.slideTimer = 0;
      this.missions.bump('jetpacks');
      const flight = this.powerups.remaining('jetpack') || J.duration;
      this.jetGrace = 0;
      VR.Audio.play('jetStart'); VR.Audio.jet(true);
      this.cameraImpulse(-0.25); this.fxFlash = 0.25;
      this.vibrate(35);
      // coin trail in the sky: follows a lane, then glides to a neighbour
      const H = J.height + 0.95;
      let lane = p.lane, x = lane * LW, z = p.z - 9;
      const zEnd = p.z - Math.max(this.speed, 12) * (flight - 0.9) * 1.05;
      let nextSwitch = z - 22 - Math.random() * 18, from = x, to = x, blend = 1;
      while (z > zEnd) {
        if (z < nextSwitch && blend >= 1) {
          const opts = [lane - 1, lane + 1].filter(l => l >= -1 && l <= 1);
          lane = opts[(Math.random() * opts.length) | 0];
          from = x; to = lane * LW; blend = 0;
          nextSwitch = z - 24 - Math.random() * 20;
        }
        if (blend < 1) { blend = Math.min(1, blend + 0.2); const e = blend * blend * (3 - 2 * blend); x = from + (to - from) * e; }
        this.collect.spawnCoin(x, H + Math.sin(z * 0.18) * 0.22, z, null);
        z -= 2.1;
      }
    }
    updateJetpack(dt) {
      const p = this.player, pu = this.powerups;
      if (p.flying) {
        // land a little before the fuel runs out, with a short safety window
        if (pu.remaining('jetpack') < 0.45) {
          p.flying = false; p.vy = 0;
          this.jetGrace = C.POWERUPS.jetpack.grace; p.flash = this.jetGrace;
          VR.Audio.jet(false); VR.Audio.play('whoosh');
        } else {
          // exhaust: sparks + smoke from both nozzles
          for (const n of p.jetpack.userData.nozzles) {
            n.getWorldPosition(this._v);
            if (Math.random() < dt * 50) this.fx.sparkle(this._v.x, this._v.y, this._v.z, Math.random() < 0.5 ? 0xffb347 : 0xffe28a, 1, 1.5, this.speed * 0.25);
            if (Math.random() < dt * 22) this.fx.dust(this._v.x, this._v.y - 0.1, this._v.z, 1, 0xd8d2cc, 0.6);
          }
        }
      }
      if (this.jetGrace > 0) this.jetGrace -= dt;
    }
    warmExtras(on) { this.player.jetpack.visible = on; this.emit('warm', on); }
    vibrate(ms) { try { if (navigator.vibrate && this.settings.sfx) navigator.vibrate(ms); } catch (e) { /* not supported */ } }

    // lemon: fills the lemon meter; a full meter = LEMONADE rush
    onGem(x, y, z) {
      const L = C.LEMONADE, pu = this.powerups;
      this.lemonsRun++; this.missions.bump('lemons'); this.emit('lemon');
      this.score += C.GEM_POINTS * this.multiplier;
      this.fx.sparkle(x, y, z, 0xfff07a, 18, 4.5, -this.speed * 0.9);
      VR.Audio.play('gem');
      const [sx, sy] = this.screenPos(x, y + 0.6, z);
      UI.popupLemon(sx, sy);
      if (pu.active('lemonade')) {               // during a rush: stretch it
        pu.timers.lemonade = Math.min(L.duration, pu.remaining('lemonade') + L.extend);
        return;
      }
      this.lemons++;
      if (this.lemons >= this.lemonNeed) { this.startLemonade(); return; }
      UI.lemons(this.lemons, this.lemonNeed, 0);
      if (!UI.store.get('lemonTip', false)) { UI.store.set('lemonTip', true); UI.toast(UI.t('lemonTip'), 2200, true); }
    }
    startLemonade() {
      const p = this.player;
      this.missions.bump('lemonade');
      this.lemons = 0;
      this.powerups.timers.lemonade = C.LEMONADE.duration;
      this.fx.ring(p.x, p.y + 1, p.z, 0xffe14a, 28, 7);
      this.fx.sparkle(p.x, p.y + 1.2, p.z, 0xffe14a, 30, 5, -this.speed * 0.8);
      this.fxFlash = 0.4;
      VR.Audio.play('powerup'); VR.Audio.play('gem');
      UI.toast(UI.t('pu').lemonade, 1500, true);
    }
    onPowerUp(type, x, y, z) {
      this.powerups.activate(type);
      this.missions.bump('powerups');
      if (type === 'jetpack') { if (this.S.vehicles) this.S.vehicles.dismount('quiet'); this.startJetpack(); }
      this.emit('powerUp', type);
      if (type === 'sneakers') { VR.Audio.play('boing'); this.vibrate(20); }
      this.score += C.POWERUP_POINTS * this.multiplier;
      this.fx.sparkle(x, y, z, VR.POWERUP_COLORS[type], 24, 6, -this.speed * 0.9);
      this.fxFlash = 0.35;
      VR.Audio.play('powerup');
      UI.toast(UI.t('pu')[type], 1100, true);
    }
    onTrainApproach() { VR.Audio.play('trainHorn'); }
    onWallBump() { this.cameraImpulse(0.05); this.shake = Math.max(this.shake, 0.08); }
    cameraImpulse(v) { this.camBumpV += v * 6; }
    onStep(side, x, y, z) {
      VR.Audio.play('step');
      const b = VR.BIOMES[this.lastBiome || 'grove'];
      const col = b && b.ground.mat === 'snow' ? 0xf4f8ff : b && b.ground.mat === 'sand' ? 0xe8c890 : 0xb9ab97;
      if (this.Q.post || Math.random() < 0.5) this.fx.dust(x, y, z, 2, col, 0.6);
      if (this.powerups.active('sneakers')) this.fx.sparkle(x, y + 0.05, z, 0xb9a2ff, 2, 1.2, -this.speed * 0.6);
    }
    onJump(p) {
      this.missions.bump('jumps');
      if (p.bigJump) {                       // super sneakers: springy launch
        VR.Audio.play('boing');
        this.fx.ring(p.x, p.y + 0.1, p.z, 0xb9a2ff, 16, 4);
        this.fx.sparkle(p.x, p.y + 0.2, p.z, 0xb9a2ff, 10, 3, -this.speed * 0.5);
      }
    }
    onSlide(p) { if (!p._slideCounted) this.missions.bump('slides'); }
    onMissionDone(m, reward) {
      this.bank += reward; UI.store.set('bank', this.bank);
      VR.Audio.play('buy'); this.vibrate(30);
      const txt = UI.t('missionDone') + '  +' + UI.fmt(reward);
      if (this.state === 'playing') UI.toast(txt, 1800, true);
      else UI.menuStats(this.best, this.bank);
    }
    onLand(p, impact) { this.fx.dust(p.x, p.y, p.z, 10, 0xc8b8a0, 1.4); }
    onSlideTick(p, dt) { if (Math.random() < dt * 40) this.fx.sparks(p.x + 0.1, p.y, p.z - 0.4, 1); if (Math.random() < dt * 20) this.fx.dust(p.x, p.y, p.z, 1, 0xc8b8a0, 0.8); }

    resolveCollisions() {
      if (this.hitCooldown > 0 || VR.GOD || this.player.flying || this.jetGrace > 0) return;
      const hit = this.world.collide(this.player);
      if (!hit) return;
      const pu = this.powerups;
      const o = hit.obstacle;
      if (pu.active('invincible') || pu.active('boost')) {
        this.fx.smash(o.x, 0.5, this.player.z - 1.5, 0xd8d2c6);
        this.world.smash(o); VR.Audio.play('shieldBreak'); this.shake = 0.15;
        return;
      }
      if (hit.side) {
        const now = this.elapsed;
        if (now - this.player.lastStumble < C.STUMBLE_WINDOW) {
          if (pu.active('shield')) { pu.consume('shield'); this.shieldHit(o); return; }
          if (this.ask('absorbCrash', o)) return;
          this.gameOver(); return;
        }
        this.player.lastStumble = now;
        this.stumbles++;
        this.player.bounceBack();
        this.hitCooldown = 0.35;
        this.shake = 0.2; this.fxCA = 0.6;
        UI.hitFlash();
        VR.Audio.play('stumble');
        UI.toast(UI.t('stumble'));
        return;
      }
      if (pu.active('shield')) { pu.consume('shield'); this.shieldHit(o); return; }
      if (this.ask('absorbCrash', o)) return;
      this.gameOver();
    }
    shieldHit(o) {
      this.fx.smash(o.x, 0.5, this.player.z - 1.5, 0x9fdcff);
      this.world.smash(o);
      this.player.flash = 1.2; this.hitCooldown = 1.2;
      this.shake = 0.25; this.fxCA = 0.5; VR.Audio.play('shieldBreak'); UI.toast(UI.t('shieldBroken'));
    }

    // ------------------------------------------------------------ loop
    // ------------------------------------------------------------ dynamic resolution
    // Holds 60 fps on phones: measures real frame times and, only when a
    // device falls behind, renders at a slightly lower internal resolution
    // (never below 62%). As soon as there is headroom again it climbs back to
    // full resolution. Nothing else about the picture changes.
    updateDRS(ms) {
      if (this.state !== 'playing' || document.hidden || ms > 250) { this.drsAcc = 0; this.drsN = 0; return; }
      this.drsAcc = (this.drsAcc || 0) + ms; this.drsN = (this.drsN || 0) + 1;
      if (this.drsAcc < 600) return;
      const avg = this.drsAcc / this.drsN, s = this.drsScale || 1;
      this.drsAcc = 0; this.drsN = 0;
      this.drsCool = Math.max(0, (this.drsCool || 0) - 0.6);
      if (avg > 18.3 && s > DRS_MIN) {                 // below ~55 fps: step down
        this.drsScale = Math.max(DRS_MIN, s - (avg > 25 ? 0.12 : 0.06));
        this.drsCeil = s - 0.02; this.drsCool = 15; this.drsGood = 0;
        this.resize();
      } else if (avg < 17.4 && s < 1) {                // holding 60: try to climb back
        this.drsGood = (this.drsGood || 0) + 0.6;
        const cap = this.drsCool > 0 ? (this.drsCeil || 1) : 1;
        if (this.drsGood >= 2.4 && s + 0.04 <= cap + 1e-6) { this.drsScale = Math.min(1, s + 0.04); this.drsGood = 0; this.resize(); }
      } else this.drsGood = 0;
    }

    loop() {
      requestAnimationFrame((ts) => this.loop(ts));
      const now = performance.now();
      if (this._lastFrame) this.updateDRS(now - this._lastFrame);
      this._lastFrame = now;
      const rawDt = Math.min(this.clock.getDelta(), 1 / 20);
      // slow motion eases back to normal
      this.timeScale += (1 - this.timeScale) * Math.min(1, rawDt * (this.state === 'dying' ? 1.2 : 3));
      const dt = rawDt * this.timeScale;
      this.elapsed = (this.elapsed || 0) + dt;

      if (this.state === 'playing') this.updatePlaying(dt);
      else if (this.state === 'dying' || this.state === 'gameover') this.updateDeath(dt, rawDt);
      else if (this.state === 'levelDone') this.emit('finishUpdate', rawDt);
      else if (this.state === 'menu' || this.state === 'character' || this.state === 'loading' || this.state === 'missions' || (VR.MENU_STATES || []).includes(this.state)) this.updateMenu(rawDt);
      else if (this.state === 'settings' && this.settingsReturn !== 'paused') this.updateMenu(rawDt);
      else if (this.state === 'paused' || this.state === 'settings') { /* frozen frame */ }

      if (this.state !== 'paused' && this.state !== 'resuming' && this.state !== 'dialog' && !(this.state === 'settings' && this.settingsReturn === 'paused')) {
        this.fx.update(dt);
        this.fx.ambient(dt, this.camera, this.speed);
      }
      this.render(rawDt);

      if (this.settings.fps) {
        this.fpsAcc += rawDt; this.fpsFrames++;
        if (this.fpsAcc > 0.5) { UI.fps(true, Math.round(this.fpsFrames / this.fpsAcc) + ((this.drsScale || 1) < 1 ? ' · ' + Math.round((this.drsScale || 1) * 100) + '%' : '')); this.fpsAcc = 0; this.fpsFrames = 0; }
      }
      // last resort only: dynamic resolution is already at its floor and it's still < 26 fps
      if (this.state === 'playing' && !this.autoDowngraded && (this.drsScale || 1) <= DRS_MIN + 0.001) {
        this.perfAcc += rawDt; this.perfFrames++;
        if (this.perfAcc > 5) {
          const fps = this.perfFrames / this.perfAcc;
          if (fps < 26 && this.settings.quality !== 'low') {
            this.settings.quality = this.settings.quality === 'high' ? 'medium' : 'low';
            this.applySettings(); this.autoDowngraded = true;
          }
          this.perfAcc = 0; this.perfFrames = 0;
        }
      }
    }

    render(dt) {
      const cu = this.post.compUniforms, L = this.look;
      this.fxCA = Math.max(0, this.fxCA - dt * 2.5);
      this.fxFlash = Math.max(0, this.fxFlash - dt * 2);
      const boosting = this.state === 'playing' && this.powerups.active('boost');
      this.fxRadial += ((boosting ? 1 : 0) - this.fxRadial) * Math.min(1, dt * 4);
      if (L) {
        cu.uExposure.value += (L.exposure * (1 + this.tunnelDark * 0.35) * (this.envExposureMul || 1) - cu.uExposure.value) * Math.min(1, dt * 2);
        cu.uBloom.value += (L.bloom + this.tunnelDark * 0.3 - cu.uBloom.value) * Math.min(1, dt * 2);
        cu.uSat.value += (L.sat - cu.uSat.value) * Math.min(1, dt * 2);
        cu.uTint.value.lerp(L.tint, Math.min(1, dt * 2));
      }
      cu.uRadial.value = this.fxRadial;
      cu.uCA.value = this.fxCA + this.fxRadial * 0.4;
      cu.uFlash.value = this.fxFlash * 0.6;
      cu.uDesat.value = this.fxDesat;
      cu.uVignette.value = 0.32 + this.fxRadial * 0.2 + this.fxDesat * 0.4;
      if (this.Q.post) {
        this.renderer.toneMappingExposure = 1;
        this.post.render(this.scene, this.camera, dt);
      } else {
        this.renderer.toneMappingExposure = cu.uExposure.value;
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);
      }
    }

    updatePlaying(dt) {
      const p = this.player;
      let a;
      while ((a = VR.Input.next())) {
        const lane0 = p.lane;
        p.action(a, this);
        if ((a === 'left' || a === 'right') && p.lane !== lane0 && p.y < 0.6) {
          VR.Audio.play('lane', { pan: a === 'left' ? -0.5 : 0.5 });
          // close call: a train was right in front of you in the lane you left
          const o = this.world.closeCall(lane0, p.z, Math.max(5, this.speed * 0.45));
          if (o) this.onCloseCall(o);
        }
      }
      this.runTime += dt;
      p.accel = clamp(1 - this.runTime / 1.1, 0, 1);
      this.tutorialTick();

      this.powerups.update(dt);
      this.updateJetpack(dt);
      const boost = this.powerups.active('boost');
      const target = this.speedAt(this.distance) * (boost ? C.POWERUPS.boost.speedFactor : 1);
      this.speed += (target - this.speed) * Math.min(1, dt * 2.5);
      const diff = this.difficultyAt(this.distance);

      const z0 = p.z;
      p.update(dt, this.speed, this.world, this);
      const dm = z0 - p.z;
      this.distance += dm;
      this.updateScore(dm);

      this.world.update(dt, p, this.speed, diff, this);
      if (this.hitCooldown > 0) this.hitCooldown -= dt;
      this.resolveCollisions();
      if (this.state !== 'playing') return;
      this.collect.update(dt, p, this);
      this.updateFork();
      this.emit('update', dt);
      if (this.state !== 'playing') return;

      p.shieldMesh.visible = this.powerups.active('shield');
      p.aura.visible = this.powerups.active('invincible');
      if (boost && Math.random() < dt * 30) this.fx.sparks(p.x, p.y + 0.2, p.z + 0.3, 1);
      if (this.powerups.active('lemonade') && Math.random() < dt * 26)
        this.fx.sparkle(p.x + (Math.random() - 0.5) * 0.9, p.y + 0.4 + Math.random() * 1.3, p.z + 0.2, Math.random() < 0.5 ? 0xffe14a : 0x8fe06a, 1, 1.2, -this.speed * 0.8);
      if (p.aura.visible && Math.random() < dt * 20) this.fx.sparkle(p.x + (Math.random() - 0.5), p.y + 1 + Math.random(), p.z + 0.3, 0xffd23f, 1, 1, -this.speed * 0.8);
      p.updateShadow(this.world, this.renderer.shadowMap.enabled);

      if (p.z < -C.RECENTER_DISTANCE) {
        const dz = -p.z;
        p.z += dz; this.world.shift(dz); this.fx.shift(dz); this.camera.position.z += dz; this.camLook.z += dz;
        p.object.position.z = p.z;
        if (p.rig.scarf) p.rig.scarf.reset();
        this.emit('shift', dz);
      }

      this.updateEnvironment(dt);
      this.updateCamera(dt);
      const sN = clamp((this.speed - C.SPEED_START) / (C.SPEED_MAX - C.SPEED_START), 0, 1);
      this.fx.updateStreaks(dt, this.camera, boost ? 1 : Math.max(0, sN - 0.6) * 1.2);
      this.hudT = (this.hudT || 0) + dt;
      if (this.hudT >= 0.05) { this.hudT = 0; UI.setHUD(this.score, this.distance, this.coins, this.multiplier); }
      UI.setPowerups(this.powerups);
      UI.lemons(this.lemons, this.lemonNeed, this.powerups.remaining('lemonade') / C.LEMONADE.duration);
      this.missions.runValue('distRun', this.distance);
      this.missions.runValue('coinsRun', this.coins);
      this.missions.runValue('scoreRun', this.score);
    }

    // junction: warn on approach, apply the choice when the gate is passed
    updateFork() {
      const f = this.world.fork, p = this.player;
      if (!f || f.decided) return;
      if (!f.warned && p.z - f.z < this.speed * 3.2) {
        f.warned = true; VR.Audio.play('tick');
        UI.toast(UI.t('forkAhead'), 1800, true);
      }
      const o = this.world.checkFork(p);
      if (o) {
        const B = VR.BIOMES[o.biome];
        const perk = o.route.rich ? UI.t('routeRich') : UI.t('routeEasy');
        UI.toast((UI.lang === 'ar' ? B.name : B.nameEn) + ' · ' + perk, 1800, true);
        VR.Audio.play('whoosh'); this.missions.bump('forks');
      }
    }

    // coins etc. are hidden behind the menu so they don't float in front of the camera
    showPickups(on) {
      this.collect.coins.mesh.visible = on; this.collect.gems.mesh.visible = on;
      for (const p of this.collect.powerups) p.obj.visible = on;
    }

    // debug helper: advance the run quickly without rendering
    simulate(sec, step = 1 / 30) {
      for (let t = 0; t < sec && this.state === 'playing'; t += step) { this.elapsed += step; this.updatePlaying(step); this.fx.update(step); }
    }

    onCloseCall(o) {
      this.missions.bump('closeCalls');
      const bonus = 50 * this.multiplier;
      this.score += bonus;
      VR.Audio.play('closeCall');
      const [sx, sy] = this.screenPos(this.player.x, this.player.y + 2.2, this.player.z);
      UI.popup(UI.t('closeCall') + ' +' + bonus, sx, sy, '#7fe8ff');
      this.fx.sparkle(this.player.x, this.player.y + 1.2, this.player.z, 0x7fe8ff, 10, 4, -this.speed * 0.95);
    }

    tutorialTick() {
      if (!this.tutorialOn) return;
      if (this.player.flying) { if (this.tutStep) { UI.tutorial(null); this.tutStep = null; } return; }
      const t = this.runTime;
      const step = t < 0.8 ? null : t < 4 ? 'lane' : t < 7.2 ? 'jump' : t < 10.4 ? 'slide' : 'end';
      if (step !== this.tutStep) {
        this.tutStep = step;
        if (step === 'end') { UI.tutorial(null); this.tutorialOn = false; UI.store.set('tutorialDone', true); }
        else UI.tutorial(step);
      }
    }

    updateDeath(dt, rawDt) {
      this.player.update(dt, 0, this.world, this);
      this.collect.update(dt, this.player, null);
      const dc = this.deathCam; if (!dc) return;
      dc.t += rawDt;
      const p = this.player;
      // slow orbit to a side view of the fallen runner
      const k = clamp(dc.t / 1.6, 0, 1), e = k * k * (3 - 2 * k);
      const ang = e * 1.1;
      const target = this._v.set(p.x + Math.sin(ang) * 5.2, p.y + 2.2 + (1 - e) * 1.5, p.z + Math.cos(ang) * 5.2);
      this.camera.position.lerp(target, 1 - Math.exp(-rawDt * 3));
      this.camLook.lerp(new T.Vector3(p.x, p.y + 0.4, p.z + 0.8), 1 - Math.exp(-rawDt * 4));
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - rawDt);
        this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.6; this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.6;
      }
      this.camera.lookAt(this.camLook);
      this.fxDesat += (0.55 - this.fxDesat) * Math.min(1, rawDt * 1.5);
      this.updateEnvironment(rawDt);
    }

    // ------------------------------------------------------------ environment
    updateEnvironment(dt, instant = false) {
      const chunk = this.world.chunkAt(this.player.z) || this.world.chunks[1] || this.world.chunks[0];
      if (!chunk) return;
      const biome = VR.BIOMES[chunk.biome];
      if (chunk.biome !== this.lastBiome) {
        if (this.lastBiome && this.state === 'playing') { UI.biome(biome); if (this.S.weather) this.S.weather.biomeChanged(chunk.biome); }
        this.lastBiome = chunk.biome;
        this.fx.setAmbient(biome.particles);
        this.envTimer = 0; this.envDirty = 1;
      }
      const L = biome.look;
      if (!this.cur) {
        // working copy that eases toward the biome
        this.cur = {
          fog: L.fog.clone(), hemiSky: L.hemiSky.clone(), hemiGround: L.hemiGround.clone(), sunColor: L.sunColor.clone(),
          sunDir: L.sunDir.clone(), hemi: L.hemi, sunI: L.sunI, fogNear: L.fogNear, fogFar: L.fogFar, night: L.night,
        };
      }
      this.look = L;
      const inTunnel = chunk.style.startsWith('tunnel') && Math.abs(this.player.x) < 6;
      this.tunnelDark += ((inTunnel ? 1 : 0) - this.tunnelDark) * Math.min(1, dt * 3);
      const k = instant ? 1 : Math.min(1, dt * 0.9);
      const c = this.cur;
      c.fog.lerp(L.fog, k); c.hemiSky.lerp(L.hemiSky, k); c.hemiGround.lerp(L.hemiGround, k); c.sunColor.lerp(L.sunColor, k);
      c.sunDir.lerp(L.sunDir, k).normalize();
      c.hemi += (L.hemi - c.hemi) * k; c.sunI += (L.sunI - c.sunI) * k;
      c.fogNear += (L.fogNear - c.fogNear) * k; c.fogFar += (L.fogFar - c.fogFar) * k;
      c.night += (L.night - c.night) * k;

      this.sky.update(dt, this.camera, this.state === 'playing' && this.S.weather ? this.S.weather.skyLook(L) : L, k);
      const dark = this.tunnelDark;
      this.scene.fog.color.copy(c.fog).lerp(TUNNEL_COLOR, dark * 0.92);
      const fq = this.Q.fog;
      this.scene.fog.near = c.fogNear * fq * (1 - dark * 0.5);
      this.scene.fog.far = c.fogFar * fq * (1 - dark * 0.35);
      this.hemi.color.copy(c.hemiSky); this.hemi.groundColor.copy(c.hemiGround);
      this.hemi.intensity = c.hemi * (1 - dark * 0.8);
      this.sun.color.copy(c.sunColor);
      this.sun.intensity = c.sunI * (1 - dark * 0.9);
      if (this.state === 'playing' && this.S.weather) this.S.weather.applyEnv(this.scene.fog, this.hemi, this.sun);
      else this.envExposureMul = 1;
      for (const m of VR.nightMaterials) m.emissiveIntensity = c.night * 1.1;
      for (const m of VR.nightGlow) m.emissiveIntensity = c.night * m.userData.nightK * (1 - dark * 0.5);
      this.collect.coinMat.emissiveIntensity = 0.8 + c.night * 1.4 + dark * 1.0;
      // the hero stays white everywhere; it only settles a hair in tunnels / at night
      VR.charUniforms.uDim.value = 0.04 * c.night + 0.07 * dark;
      VR.waterUniforms.uSky.value.copy(c.fog);
      VR.waterUniforms.uTime.value += dt;
      // sun follows the player so its shadow map stays sharp around them
      const p = this.player;
      const ld = this._v.set(c.sunDir.x, Math.max(c.sunDir.y, 0.5), c.sunDir.z).normalize();
      this.sun.target.position.set(p.x * 0.5, 0, p.z - 10);
      this.sun.position.copy(this.sun.target.position).addScaledVector(ld, 60);
      // refresh image-based lighting a few times after a biome change
      this.envTimer += dt;
      // swap to the biome's pre-baked sky lighting once the sky has mostly blended over
      if (this.envDirty > 0 && (this.envTimer > 1.2 || instant)) { this.regenEnv(); this.envDirty = 0; }
    }
    // PERF: image-based lighting for every biome is baked ONCE while loading
    // (PMREM of the sky dome). Re-baking it during a run cost a long GPU
    // stall at every biome change and at the start of every run.
    buildEnvCache() {
      this.envCache = {};
      for (const key of VR.BIOME_ORDER) {
        this.sky.update(0, this.camera, VR.BIOMES[key].look, 1);
        this.envCache[key] = this.pmrem.fromScene(this.envScene, 0.02);
      }
    }
    regenEnv() {
      const key = this.lastBiome && this.envCache && this.envCache[this.lastBiome] ? this.lastBiome : null;
      if (key) { this.scene.environment = this.envCache[key].texture; return; }
      if (this.envRT) this.envRT.dispose();
      this.envRT = this.pmrem.fromScene(this.envScene, 0.02);
      this.scene.environment = this.envRT.texture;
    }

    // PERF: compile every shader (incl. shadow-depth variants) and upload every
    // texture during loading, so nothing compiles the first time a train type,
    // biome prop, power-up, shield or effect shows up mid-run (that caused hitches).
    warmup() {
      const r = this.renderer, taken = [];
      const pools = [this.world.pool, this.collect.pool];
      for (const pool of pools) for (const key in pool.factories) {
        const o = pool.get(key); o.position.set((taken.length % 5 - 2) * 3, 0, -12 - (taken.length / 5 | 0) * 2); taken.push([pool, o]);
      }
      const p = this.player, vis = [p.shieldMesh.visible, p.aura.visible, this.collect.coins.mesh.visible, this.collect.gems.mesh.visible];
      p.shieldMesh.visible = p.aura.visible = this.collect.coins.mesh.visible = this.collect.gems.mesh.visible = true;
      if (this.warmExtras) this.warmExtras(true);
      const cam = this.camera, cp = cam.position.clone(), cq = cam.quaternion.clone();
      cam.position.set(0, 5, 10); cam.lookAt(0, 1, -12); cam.updateMatrixWorld();
      try {
        r.compile(this.scene, cam);
        if (this.Q.post) this.post.render(this.scene, cam, 0);      // also builds shadow-depth programs + uploads textures
        else { r.setRenderTarget(null); r.render(this.scene, cam); }
      } catch (e) { console.warn('warmup', e); }
      cam.position.copy(cp); cam.quaternion.copy(cq);
      for (const [pool, o] of taken) pool.release(o);
      [p.shieldMesh.visible, p.aura.visible, this.collect.coins.mesh.visible, this.collect.gems.mesh.visible] = vis;
      if (this.warmExtras) this.warmExtras(false);
    }

    // ------------------------------------------------------------ camera
    updateCamera(dt) {
      const p = this.player;
      // ease any menu framing offset back to a centred view
      if (this.viewOff.x || this.viewOff.y) {
        const k = Math.exp(-dt * 5);
        this.viewOff.x *= k; this.viewOff.y *= k;
        if (Math.abs(this.viewOff.x) < 0.5 && Math.abs(this.viewOff.y) < 0.5) this.viewOff.x = this.viewOff.y = 0;
        this.applyViewOffset();
      }
      this.camBumpV += (-this.camBump * 60 - this.camBumpV * 10) * dt;
      this.camBump += this.camBumpV * dt;
      const sN = clamp((this.speed - C.SPEED_START) / (C.SPEED_MAX - C.SPEED_START), 0, 1);
      const dist = C.CAMERA_DISTANCE + (this.portrait ? 0.1 : 0) + sN * 0.6 - this.fxRadial * 0.8 + p.flyW * (this.portrait ? -1.3 : 0.5);
      const tx = p.x * (this.portrait ? 0.82 : 0.72);
      // (on the jetpack the camera stays just under bridge girders / wires: ~4.95 m)
      let ty = C.CAMERA_HEIGHT + p.y * (0.62 - p.flyW * 0.43) + this.camBump + (this.portrait ? 0.35 * (1 - p.flyW) : 0) - p.slideW * 0.5;
      // never rise into the tunnel vault (the camera would end up inside the hill)
      ty = Math.min(ty, ty + (VR.HALF_TRACK + 0.55 - ty) * this.tunnelDark);
      const tz = p.z + dist;
      // swoop in from the menu camera at the start of a run
      if (this.swoop !== undefined && this.swoop < 1) this.swoop = Math.min(1, this.swoop + dt / 0.9);
      const sw = this.swoop === undefined ? 1 : this.swoop * this.swoop * (3 - 2 * this.swoop);
      const kk = (r) => 1 - Math.exp(-dt * r * (0.3 + 0.7 * sw));
      const cam = this.camera.position;
      if (sw < 1 && this.swoopFrom) {
        // arc around the runner: from the menu shot (in front) to the chase cam (behind)
        const f = this.swoopFrom;
        const a = f.a + (0 - f.a) * sw, r = f.r + (dist - f.r) * sw;
        cam.set(p.x + Math.sin(a) * r * (1 - sw) + tx * sw, f.y + (ty - f.y) * sw + Math.sin(sw * Math.PI) * 1.2, p.z + Math.cos(a) * r);
      } else {
        cam.x += (tx - cam.x) * kk(7);
        cam.y += (ty - cam.y) * kk(5);
        cam.z += (tz - cam.z) * (1 - Math.exp(-dt * 14));
      }
      this.camLook.x += (p.x * 0.85 - this.camLook.x) * kk(7);
      this.camLook.y += ((this.portrait ? 0.35 : 1.2) + p.y * (0.55 + p.flyW * 0.15) - this.camLook.y) * kk(7);
      this.camLook.z += (p.z - C.CAMERA_LOOK_AHEAD * sw - this.camLook.z) * (sw < 1 ? kk(10) : 1);
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt);
        const s = this.shake * 0.5;
        cam.x += (Math.random() - 0.5) * s; cam.y += (Math.random() - 0.5) * s;
      }
      this.camera.lookAt(this.camLook);
      // lean into lane changes a touch
      this.camera.rotateZ(-p.laneW * 0.035);
      const fov = this.baseFov + sN * 6 + this.fxRadial * 10;
      if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3); this.camera.updateProjectionMatrix(); }
    }

    // where the hero sits on the menu / character screens (see updateMenu)
    menuFrame() {
      const rtl = UI.lang === 'ar', W = this.W || 1, H = this.H || 1, asp = W / H;
      if (this.state === 'character') return asp >= 1 ? { frac: 0.5, sx: 0, sy: 0.2 } : { frac: 0.4, sx: 0, sy: 0.22 };
      if (asp >= 1.15) return { frac: H < 500 ? 0.62 : 0.56, sx: rtl ? -0.42 : 0.42, sy: -0.08 };  // UI column on the other side
      if (asp >= 0.8) return { frac: 0.36, sx: 0, sy: -0.02 };
      return { frac: 0.34, sx: 0, sy: 0.02 };                                       // portrait: between logo and buttons
    }

    // menu: character faces the camera, idles and waves; the camera drifts
    updateMenu(dt) {
      this.menuTime += dt;
      this.emit('menuUpdate', dt);
      const p = this.player;
      p.object.position.set(0, 0, 0);
      p.x = p.y = p.z = 0;
      this.spinVel = (this.spinVel || 0) * Math.pow(0.02, dt);
      this.charSpin = (this.charSpin || 0) * Math.pow(0.35, dt);
      p.object.rotation.y = Math.sin(this.menuTime * 0.45) * 0.3 + this.charSpin - 0.3;
      const wave = this.menuTime % 9 > 6.2 && this.menuTime % 9 < 8.4 ? Math.sin(((this.menuTime % 9) - 6.2) / 2.2 * Math.PI) : 0;
      p.animateIdle(dt, this.menuTime, clamp(wave * 1.5, 0, 1), Math.sin(this.menuTime * 0.3) * 15);
      p.shieldMesh.visible = false; p.aura.visible = false;
      p.updateShadow(this.world, this.renderer.shadowMap.enabled);
      this.collect.update(dt, p, null);
      this.showPickups(false);
      const charView = this.state === 'character';
      const a = this.menuTime * 0.12;
      // FRAMING: the hero is placed in the part of the screen the UI leaves free
      //   landscape menu  -> beside the logo/buttons column (left in Arabic, right in English)
      //   portrait menu   -> between the logo (top) and the buttons (bottom)
      //   character shop  -> above the bottom panel
      // `frac` = how much of the screen height the hero fills, `sx/sy` = where
      // his middle goes (-1..1). The camera aims straight at him and the
      // picture is then slid into place with a view offset.
      let fr = this.menuFrame();
      // a feature screen can aim the camera elsewhere (e.g. the lemonade stand)
      for (const s of this.sys) if (s.menuCam) { const o = s.menuCam(this.state, a); if (o) { fr = Object.assign({}, fr, o); break; } }
      const vf = T.MathUtils.degToRad(this.baseFov);
      const d = (fr.h || 1.9) / (fr.frac * 2 * Math.tan(vf / 2));
      const dir = this._v.copy(fr.dir || this._v.set(0.34 + Math.sin(a) * 0.16, 0.2, -1)).normalize();
      const look = (this._mLook || (this._mLook = new T.Vector3())).copy(fr.look || this._v2.set(0, 0.95, 0));
      const target = (this._mTarget || (this._mTarget = new T.Vector3())).copy(look).addScaledVector(dir, d);
      if (!this.menuCamPos) { this.menuCamPos = target.clone(); this.menuLook = look.clone(); }
      this.menuCamPos.lerp(target, 1 - Math.exp(-dt * 3));
      this.menuLook.lerp(look, 1 - Math.exp(-dt * 3));
      this.camera.position.copy(this.menuCamPos);
      this.camera.lookAt(this.menuLook);
      if (Math.abs(this.camera.fov - this.baseFov) > 0.01) this.camera.fov = this.baseFov;
      const W = this.W || 1, H = this.H || 1;
      const ox = -fr.sx * W / 2, oy = fr.sy * H / 2;
      const kf = 1 - Math.exp(-dt * 4);
      this.viewOff.x += (ox - this.viewOff.x) * kf;
      this.viewOff.y += (oy - this.viewOff.y) * kf;
      this.applyViewOffset();
      this.updateEnvironment(dt);
      this.fx.updateStreaks(dt, this.camera, 0);
    }
  }

  VR.Game = Game;

  VR.GOD = new URLSearchParams(location.search).has('god');
  window.addEventListener('DOMContentLoaded', () => {
    let game;
    try { game = new Game(); VR.game = game; }
    catch (e) { document.getElementById('loadMsg').textContent = 'Could not start: ' + e.message; throw e; }
    requestAnimationFrame(() => setTimeout(() => {
      try { game.boot(); }
      catch (e) { document.getElementById('loadMsg').textContent = 'Could not start: ' + e.message; throw e; }
    }, 30));
  });
})();

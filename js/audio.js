/* =====================================================================
 * AUDIO — everything is synthesised with WebAudio (no files needed).
 *   • sound effects with stereo panning and a shared reverb
 *   • an adaptive soundtrack in maqam Hijaz on a maqsum darbuka groove:
 *     'menu' mode (pad, oud-like plucks, light percussion) and
 *     'game' mode (full drums, bass, lead)
 * To use real files instead:
 *     VR.Audio.useFile('coin', 'sounds/coin.mp3');
 *     VR.Audio.useMusicFile('sounds/theme.mp3');
 * ===================================================================== */
(function () {
  let ctx = null, master = null, comp = null, sfxBus = null, musicBus = null, verb = null, verbIn = null;
  const files = {};
  const settings = { sfx: true, music: true };
  const MUSIC_VOL = 0.42;

  function impulse(sec = 2.4, decay = 2.6) {
    const rate = ctx.sampleRate, len = rate * sec, buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.8;
    master.connect(comp); comp.connect(ctx.destination);
    verb = ctx.createConvolver(); verb.buffer = impulse();
    verbIn = ctx.createGain(); verbIn.gain.value = 1;
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.35;
    verbIn.connect(verb); verb.connect(verbOut); verbOut.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = MUSIC_VOL; musicBus.connect(master);
    const musicSend = ctx.createGain(); musicSend.gain.value = 0.3; musicBus.connect(musicSend); musicSend.connect(verbIn);
    const sfxSend = ctx.createGain(); sfxSend.gain.value = 0.12; sfxBus.connect(sfxSend); sfxSend.connect(verbIn);
    applySettings();
    return ctx;
  }
  function applySettings() {
    if (!ctx) return;
    sfxBus.gain.value = settings.sfx ? 1 : 0;
    musicBus.gain.value = settings.music ? MUSIC_VOL * musicLevel : 0;
  }

  // ------------------------------------------------------------ synth helpers
  function out(bus, pan) {
    if (!pan) return bus;
    const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(bus); return p;
  }
  function tone(freq, dur, o = {}) {
    const t = ctx.currentTime + (o.when || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + (o.slideT || dur));
    if (o.detune) osc.detune.value = o.detune;
    const v = o.vol ?? 0.2, a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp, t); if (o.lpTo) f.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur); f.Q.value = o.q || 0.7; node.connect(f); node = f; }
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = freq * 0.012; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05); }
    node.connect(g); g.connect(out(o.bus || sfxBus, o.pan));
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function getNoise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  function noise(dur, o = {}) {
    getNoise();
    const t = ctx.currentTime + (o.when || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.ft || 'lowpass';
    f.frequency.setValueAtTime(o.f || 1200, t);
    if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, t + dur);
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain(), v = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out(o.bus || sfxBus, o.pan));
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------ sound effects
  let coinStep = 0, coinTime = 0, stepAlt = 0, jet = null, amb = null;
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const SYNTH = {
    step() { stepAlt ^= 1; noise(0.05, { f: stepAlt ? 900 : 700, vol: 0.05, pan: stepAlt ? 0.15 : -0.15 }); },
    jump() { noise(0.22, { ft: 'bandpass', f: 500, fTo: 2200, q: 1.2, vol: 0.18 }); tone(280, 0.16, { type: 'triangle', slide: 520, vol: 0.07 }); },
    land() { tone(110, 0.14, { slide: 50, vol: 0.28 }); noise(0.1, { f: 420, vol: 0.18 }); },
    slide() { noise(0.45, { ft: 'bandpass', f: 1800, fTo: 500, q: 0.9, vol: 0.16 }); },
    lane(o) { noise(0.12, { ft: 'highpass', f: 1500, fTo: 4000, vol: 0.09, pan: o && o.pan }); },
    coin() {
      const now = ctx.currentTime;
      coinStep = now - coinTime < 0.4 ? Math.min(coinStep + 1, PENTA.length - 1) : 0;
      coinTime = now;
      const f = 1046 * Math.pow(2, PENTA[coinStep] / 12);
      tone(f, 0.22, { vol: 0.09 }); tone(f * 2.76, 0.12, { vol: 0.025 }); tone(f * 1.5, 0.18, { vol: 0.04, when: 0.045 });
    },
    gem() { [0, 4, 7, 12, 16].forEach((s, i) => { tone(784 * Math.pow(2, s / 12), 0.35, { type: 'triangle', vol: 0.1, when: i * 0.05 }); tone(784 * 2.76 * Math.pow(2, s / 12), 0.15, { vol: 0.02, when: i * 0.05 }); }); },
    powerup() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(392 * Math.pow(2, s / 12), 0.2, { type: 'square', vol: 0.05, lp: 3000, when: i * 0.045 })); noise(0.5, { ft: 'highpass', f: 5000, vol: 0.05, attack: 0.2 }); },
    shieldBreak() { noise(0.45, { ft: 'highpass', f: 3000, vol: 0.25 }); for (let i = 0; i < 4; i++) tone(1400 - i * 230, 0.3, { type: 'triangle', vol: 0.06, when: i * 0.03, slide: 300 }); },
    stumble() { tone(160, 0.22, { type: 'sawtooth', slide: 70, vol: 0.13, lp: 900 }); noise(0.15, { f: 800, vol: 0.2 }); tone(420, 0.25, { slide: 260, vol: 0.06, when: 0.06, vib: 18 }); },
    crash() { noise(0.8, { f: 1200, fTo: 200, vol: 0.5 }); tone(150, 0.7, { type: 'sawtooth', slide: 38, vol: 0.22, lp: 800 }); tone(180, 0.5, { type: 'square', vol: 0.06, lp: 2400, q: 8 }); },
    click() { tone(660, 0.07, { vol: 0.07, slide: 880 }); },
    tick() { tone(1200, 0.04, { vol: 0.04 }); },
    trainHorn() {
      for (const f of [311, 370, 466]) tone(f, 1.0, { type: 'sawtooth', vol: 0.035, lp: 1600, attack: 0.05, vib: 5 });
    },
    closeCall() { noise(0.35, { ft: 'bandpass', f: 3500, fTo: 400, q: 1.5, vol: 0.2 }); tone(1318, 0.2, { vol: 0.05, when: 0.12 }); tone(1760, 0.3, { vol: 0.05, when: 0.18 }); },
    newBest() { [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.28, { type: 'triangle', vol: 0.1, when: i * 0.1 })); },
    buy() { for (let i = 0; i < 6; i++) tone(1318 * Math.pow(2, (i % 3) * 4 / 12), 0.12, { vol: 0.06, when: i * 0.05 }); },
    denied() { tone(220, 0.15, { type: 'square', vol: 0.05, lp: 900 }); tone(180, 0.2, { type: 'square', vol: 0.05, lp: 900, when: 0.1 }); },
    jetStart() { noise(0.7, { ft: 'bandpass', f: 300, fTo: 2400, q: 0.7, vol: 0.3, attack: 0.05 }); tone(90, 0.6, { type: 'sawtooth', slide: 240, vol: 0.12, lp: 900 }); },
    thunder() { noise(2.2, { f: 900, fTo: 90, vol: 0.55, attack: 0.02 }); tone(48, 1.8, { type: 'sawtooth', slide: 30, vol: 0.18, lp: 160, when: 0.05 }); noise(0.25, { ft: 'highpass', f: 2500, vol: 0.2 }); },
    baa() { tone(420, 0.5, { type: 'sawtooth', vol: 0.07, lp: 1400, vib: 9, slide: 380 }); tone(840, 0.45, { type: 'triangle', vol: 0.03, vib: 9 }); },
    catch() { [0, 4, 7, 12].forEach((s, i) => tone(660 * Math.pow(2, s / 12), 0.25, { type: 'square', vol: 0.05, lp: 3200, when: i * 0.06 })); noise(0.3, { ft: 'bandpass', f: 1800, vol: 0.12 }); },
    meow() { tone(700, 0.35, { type: 'triangle', slide: 900, vol: 0.06, vib: 6 }); tone(1000, 0.25, { type: 'sine', slide: 600, vol: 0.04, when: 0.15 }); },
    chirp() { for (let i = 0; i < 3; i++) tone(2600 + i * 300, 0.07, { vol: 0.04, slide: 3400, when: i * 0.08 }); },
    ding() { tone(1568, 0.5, { type: 'sine', vol: 0.08 }); tone(2349, 0.4, { type: 'sine', vol: 0.04, when: 0.08 }); },
    fanfare() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.35, { type: 'triangle', vol: 0.09, when: i * 0.09 })); },
    boing() { tone(220, 0.28, { type: 'triangle', slide: 880, vol: 0.12 }); tone(440, 0.2, { type: 'sine', slide: 1320, vol: 0.05, when: 0.03 }); },
    whoosh() { noise(0.3, { ft: 'bandpass', f: 800, fTo: 2500, q: 1, vol: 0.12 }); },
  };

  // ------------------------------------------------------------ music
  const D2 = 73.42;
  const HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16, 17, 19];         // D Eb F# G A Bb C D' ...
  const deg = (d) => HIJAZ[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  const ROOTS = [0, 0, 5, 0, -2, -4, -5, 0];                         // D D G D C Bb A D
  // 32-step phrases, value = scale degree (null = rest)
  const _ = null;
  const PHRASES = [
    [4, _, 5, 4, 2, _, 1, 2, 0, _, _, _, 2, _, 4, _, 3, _, 4, 5, 6, _, 5, 4, 5, _, 4, _, 2, _, 1, _],
    [7, _, 6, 5, 4, _, 5, _, 4, _, 2, 3, 4, _, _, _, 2, _, 1, 2, 4, _, 2, _, 1, _, 0, _, _, _, _, _],
    [0, _, 1, _, 2, _, 3, 4, _, _, 4, _, 5, 4, 3, _, 4, _, _, _, 2, 1, 2, _, 0, _, _, _, 1, _, 2, _],
    [4, 5, 7, _, 7, _, 8, 7, 5, _, 4, _, 5, 4, 2, _, 4, _, 2, 1, 2, _, 0, _, 1, 2, 1, 0, _, _, _, _],
  ];
  // maqsum: D T - T D - T -  (16ths)
  const DOUM = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
  const TAK = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0.35, 0, 1, 0, 0.35, 0];

  let musicTimer = null, nextTime = 0, step = 0, musicSource = null, mode = 'menu', musicLevel = 1;
  const f = (semi) => D2 * Math.pow(2, semi / 12);

  function pluck(freq, when, vol, bus) {
    tone(freq, 0.5, { type: 'triangle', vol, when, bus, attack: 0.002 });
    tone(freq * 1.003, 0.35, { type: 'sawtooth', vol: vol * 0.35, when, bus, lp: 3200, lpTo: 500, attack: 0.002 });
  }
  function schedule() {
    const spb = 60 / (mode === 'game' ? 118 : 96) / 4;
    while (nextTime < ctx.currentTime + 0.15) {
      const when = nextTime - ctx.currentTime;
      const s = step % 16, bar = Math.floor(step / 16) % 8, root = ROOTS[bar];
      const bus = musicBus, game = mode === 'game';
      // percussion
      if (DOUM[s]) { tone(92, 0.28, { slide: 62, vol: game ? 0.5 : 0.28, when, bus }); noise(0.06, { f: 300, vol: 0.12, when, bus }); }
      if (TAK[s]) noise(0.07, { ft: 'bandpass', f: 3600, q: 1.4, vol: 0.2 * TAK[s] * (game ? 1 : 0.6), when, bus });
      if (game) {
        if (s === 0 || s === 8 || (s === 11 && bar % 2)) tone(140, 0.3, { slide: 42, vol: 0.55, when, bus });
        if (s === 4 || s === 12) { noise(0.16, { ft: 'bandpass', f: 1600, q: 0.8, vol: 0.2, when, bus }); tone(190, 0.08, { vol: 0.08, when, bus }); }
        if (s % 2 === 1) noise(0.035, { ft: 'highpass', f: 8000, vol: s % 4 === 3 ? 0.06 : 0.035, when, bus });
        // bass on the maqsum accents
        if (s === 0 || s === 3 || s === 8 || s === 10 || s === 14)
          tone(f(root), spb * 2.2, { type: 'sawtooth', vol: 0.16, lp: 520, lpTo: 180, when, bus, attack: 0.005 });
      }
      // pad (root + fifth + octave), re-struck each bar
      if (s === 0) for (const iv of [12, 19, 24]) tone(f(root + iv), spb * 16, { type: 'sawtooth', vol: game ? 0.014 : 0.02, lp: 900, attack: 0.35, when, bus, detune: (Math.random() - 0.5) * 12 });
      // melody (oud-like pluck); the menu plays it sparser, an octave lower
      const ph = PHRASES[Math.floor(step / 32) % PHRASES.length];
      const d = ph[step % 32];
      if (d !== null && (game || step % 2 === 0)) {
        const semi = deg(d) + (game ? 24 : 12);
        pluck(f(semi), when, game ? 0.09 : 0.08, bus);
        if (game && step % 64 >= 32) pluck(f(semi + 12), when + 0.005, 0.03, bus);
      }
      step++;
      nextTime += spb;
    }
  }

  VR.Audio = {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    play(name, opts) {
      if (!ensure() || !settings.sfx) return;
      if (files[name]) { const s = ctx.createBufferSource(); s.buffer = files[name]; s.connect(sfxBus); s.start(); }
      else if (SYNTH[name]) SYNTH[name](opts);
    },
    setMode(m) { mode = m; },
    // looping ambience for weather: 'rain' | 'wind' | null
    ambience(kind) {
      if (!ensure()) return;
      if (amb && amb.kind === kind) return;
      if (amb) { const a = amb, t = ctx.currentTime; amb = null; a.g.gain.setTargetAtTime(0.0001, t, 0.5); a.src.stop(t + 2); }
      if (!kind || !settings.sfx) return;
      const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = kind === 'rain' ? 'highpass' : 'bandpass';
      f.frequency.value = kind === 'rain' ? 1400 : 420; f.Q.value = kind === 'rain' ? 0.4 : 0.8;
      const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(kind === 'rain' ? 0.12 : 0.16, ctx.currentTime, 0.8);
      if (kind === 'wind') { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.23; lg.gain.value = 260; l.connect(lg); lg.connect(f.frequency); l.start(); }
      src.connect(f); f.connect(g); g.connect(sfxBus); src.start();
      amb = { kind, src, g };
    },
    // continuous jetpack roar (filtered noise + low rumble, with flutter)
    jet(on) {
      if (!ensure()) return;
      if (on && !jet && settings.sfx) {
        const t = ctx.currentTime;
        const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.55;
        const hs = ctx.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 3000; hs.gain.value = -8;
        const rum = ctx.createOscillator(); rum.type = 'sawtooth'; rum.frequency.value = 52;
        const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 180;
        const rg = ctx.createGain(); rg.gain.value = 0.35;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.35);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 11; const lg = ctx.createGain(); lg.gain.value = 0.035;
        lfo.connect(lg); lg.connect(g.gain);
        src.connect(bp); bp.connect(hs); hs.connect(g);
        rum.connect(rlp); rlp.connect(rg); rg.connect(g);
        g.connect(sfxBus);
        src.start(); rum.start(); lfo.start();
        jet = { g, stop: [src, rum, lfo] };
      } else if (!on && jet) {
        const j = jet; jet = null; const t = ctx.currentTime;
        j.g.gain.cancelScheduledValues(t); j.g.gain.setValueAtTime(Math.max(0.0001, j.g.gain.value), t);
        j.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        for (const n of j.stop) n.stop(t + 0.45);
      }
    },
    startMusic() {
      if (!ensure()) return;
      if (files.__music) {
        if (musicSource) return;
        musicSource = ctx.createBufferSource(); musicSource.buffer = files.__music; musicSource.loop = true;
        musicSource.connect(musicBus); musicSource.start();
        return;
      }
      if (musicTimer) return;
      nextTime = ctx.currentTime + 0.08; step = 0;
      musicTimer = setInterval(schedule, 40);
    },
    stopMusic() {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
      if (musicSource) { musicSource.stop(); musicSource = null; }
    },
    setMusicVolume(v) { musicLevel = v; if (musicBus && settings.music) musicBus.gain.setTargetAtTime(MUSIC_VOL * v, ctx.currentTime, 0.15); },
    setEnabled(kind, on) { settings[kind] = on; applySettings(); },
    settings,
    async useFile(name, url) {
      if (!ensure()) return;
      const buf = await fetch(url).then(r => r.arrayBuffer());
      files[name] = await ctx.decodeAudioData(buf);
    },
    async useMusicFile(url) { await this.useFile('__music', url); },
  };
})();

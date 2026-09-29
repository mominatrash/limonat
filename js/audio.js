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
    node.connect(g); g.connect(out(o.bus || sfxBus, o.pan ?? curPan));
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
    s.connect(f); f.connect(g); g.connect(out(o.bus || sfxBus, o.pan ?? curPan));
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------ MIX
  // Every sound belongs to a group with its own level, a minimum gap (so a
  // burst of 20 coins doesn't turn into noise) and a priority. A big moment
  // (power-up, catch, crash…) briefly ducks the music and swallows small
  // pickup sounds for a beat, so one clear sound is heard at a time.
  const GROUP = { move: 0.5, pickup: 0.62, event: 0.9, world: 0.75, ui: 0.55 };
  const RULES = {
    step: ['move', 90, 0], jump: ['move', 90, 1], land: ['move', 120, 1], slide: ['move', 200, 1], lane: ['move', 60, 0],
    coin: ['pickup', 38, 0], gem: ['pickup', 110, 1],
    powerup: ['event', 250, 3], lemonade: ['event', 400, 3], jetStart: ['event', 400, 3], boing: ['event', 200, 2], ding: ['event', 250, 2],
    closeCall: ['event', 400, 2], stumble: ['event', 300, 2], crash: ['event', 800, 3], shieldBreak: ['event', 300, 3],
    catch: ['event', 600, 3], newBest: ['event', 1000, 3], fanfare: ['event', 1200, 3], buy: ['ui', 200, 2], denied: ['ui', 200, 1],
    click: ['ui', 60, 0], tick: ['ui', 150, 1], whoosh: ['move', 250, 1], pop: ['world', 180, 1],
    trainHorn: ['world', 2600, 1], thunder: ['world', 3000, 2], baa: ['world', 900, 1], meow: ['world', 400, 1], chirp: ['world', 400, 1],
  };
  const last = {}; let hushUntil = 0, lastBig = -1e9, curPan = 0;
  const groups = {};
  function groupBus(name) {
    if (!groups[name]) { const g = ctx.createGain(); g.gain.value = GROUP[name] ?? 0.7; g.connect(sfxBus); groups[name] = g; }
    return groups[name];
  }
  function duck(amount, time) {
    if (!musicBus || !settings.music) return;
    const t = ctx.currentTime, base = MUSIC_VOL * musicLevel;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(base * (1 - amount), t, 0.03);
    musicBus.gain.setTargetAtTime(base, t + time, 0.25);
  }

  // ------------------------------------------------------------ sound effects
  let coinStep = 0, coinTime = 0, stepAlt = 0, jet = null, amb = null;
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  let B = null;                                    // the bus the current sound plays on
  const SYNTH = {
    // movement: soft and low so it never competes with the music
    step() { stepAlt ^= 1; noise(0.06, { f: stepAlt ? 380 : 320, vol: 0.05, pan: stepAlt ? 0.12 : -0.12, bus: B }); },
    jump() { noise(0.2, { ft: 'bandpass', f: 500, fTo: 1600, q: 0.9, vol: 0.12, bus: B }); tone(330, 0.14, { type: 'triangle', slide: 520, vol: 0.045, bus: B }); },
    land() { tone(95, 0.16, { slide: 55, vol: 0.22, bus: B }); noise(0.08, { f: 350, vol: 0.1, bus: B }); },
    slide() { noise(0.4, { ft: 'bandpass', f: 1300, fTo: 450, q: 0.7, vol: 0.1, bus: B }); },
    lane(o) { noise(0.1, { ft: 'bandpass', f: 1800, fTo: 3200, q: 0.8, vol: 0.06, pan: o && o.pan, bus: B }); },
    whoosh() { noise(0.35, { ft: 'bandpass', f: 600, fTo: 1800, q: 0.8, vol: 0.1, bus: B }); },
    // pickups: bell-like, climbing a pentatonic scale on a streak
    coin() {
      const now = ctx.currentTime;
      coinStep = now - coinTime < 0.35 ? (coinStep + 1) % PENTA.length : 0;
      coinTime = now;
      const f = 1175 * Math.pow(2, PENTA[coinStep] / 12);
      tone(f, 0.16, { vol: 0.06, bus: B }); tone(f * 2, 0.08, { vol: 0.012, when: 0.01, bus: B });
    },
    gem() { [0, 4, 7].forEach((s, i) => tone(880 * Math.pow(2, s / 12), 0.28, { type: 'triangle', vol: 0.07, when: i * 0.055, bus: B })); },
    // events: one clear, musical sound each
    powerup() { [0, 4, 7, 12].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.22, { type: 'triangle', vol: 0.08, when: i * 0.06, bus: B })); noise(0.4, { ft: 'highpass', f: 5500, vol: 0.035, attack: 0.15, bus: B }); },
    lemonade() { noise(0.6, { ft: 'highpass', f: 4200, vol: 0.06, attack: 0.05, bus: B }); [0, 4, 7, 11, 14].forEach((s, i) => tone(660 * Math.pow(2, s / 12), 0.3, { type: 'triangle', vol: 0.065, when: 0.05 + i * 0.07, bus: B })); },
    jetStart() { noise(0.9, { ft: 'lowpass', f: 250, fTo: 1400, q: 0.6, vol: 0.18, attack: 0.08, bus: B }); tone(70, 0.8, { slide: 140, vol: 0.12, attack: 0.1, bus: B }); },
    boing() { tone(260, 0.26, { type: 'triangle', slide: 700, vol: 0.09, bus: B }); },
    ding() { tone(1568, 0.45, { vol: 0.06, bus: B }); tone(2349, 0.3, { vol: 0.025, when: 0.07, bus: B }); },
    closeCall() { noise(0.3, { ft: 'bandpass', f: 2600, fTo: 600, q: 1.2, vol: 0.12, bus: B }); tone(1318, 0.18, { type: 'triangle', vol: 0.045, when: 0.1, bus: B }); tone(1760, 0.25, { type: 'triangle', vol: 0.045, when: 0.17, bus: B }); },
    stumble() { tone(220, 0.22, { slide: 110, vol: 0.12, bus: B }); noise(0.12, { f: 600, vol: 0.12, bus: B }); },
    crash() { noise(0.7, { f: 900, fTo: 150, vol: 0.38, bus: B }); tone(120, 0.6, { slide: 40, vol: 0.2, bus: B }); },
    shieldBreak() { for (let i = 0; i < 4; i++) tone(1900 - i * 260, 0.25, { type: 'triangle', vol: 0.035, when: i * 0.035, bus: B }); noise(0.25, { ft: 'highpass', f: 3500, vol: 0.1, bus: B }); },
    catch() { [0, 4, 7, 12, 16].forEach((s, i) => tone(587 * Math.pow(2, s / 12), 0.22, { type: 'triangle', vol: 0.075, when: i * 0.06, bus: B })); },
    newBest() { [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.26, { type: 'triangle', vol: 0.08, when: i * 0.1, bus: B })); },
    fanfare() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.32, { type: 'triangle', vol: 0.075, when: i * 0.09, bus: B })); },
    buy() { for (let i = 0; i < 5; i++) tone(1318 * Math.pow(2, (i % 3) * 4 / 12), 0.12, { vol: 0.05, when: i * 0.05, bus: B }); },
    denied() { tone(262, 0.12, { type: 'triangle', vol: 0.06, bus: B }); tone(220, 0.16, { type: 'triangle', vol: 0.06, when: 0.1, bus: B }); },
    click() { tone(880, 0.05, { vol: 0.045, slide: 1100, bus: B }); },
    tick() { tone(1250, 0.05, { vol: 0.05, bus: B }); tone(2500, 0.02, { vol: 0.01, bus: B }); },
    pop() { noise(0.18, { ft: 'bandpass', f: 1400, fTo: 300, q: 0.8, vol: 0.09, bus: B }); },
    // world: placed in the stereo field where they happen
    trainHorn(o) { for (const [f, d] of [[370, 0], [466, 0.02]]) tone(f, 0.75, { type: 'triangle', vol: 0.045, lp: 1200, attack: 0.06, vib: 4, when: d, pan: o && o.pan, bus: B }); },
    thunder() { noise(2.0, { f: 700, fTo: 80, vol: 0.4, attack: 0.03, bus: B }); tone(45, 1.6, { slide: 30, vol: 0.14, bus: B }); },
    baa(o) { tone(410, 0.45, { type: 'triangle', vol: 0.06, lp: 1500, vib: 8, slide: 370, pan: o && o.pan, bus: B }); },
    meow() { tone(700, 0.32, { type: 'triangle', slide: 900, vol: 0.05, vib: 6, bus: B }); },
    chirp() { for (let i = 0; i < 3; i++) tone(2600 + i * 300, 0.07, { vol: 0.035, slide: 3400, when: i * 0.08, bus: B }); },
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
      const R = RULES[name] || ['event', 0, 1], now = ctx.currentTime * 1000;
      if (now - (last[name] ?? -1e9) < R[1]) return;          // too soon after the same sound
      if (R[2] === 0 && now - lastBig < 220) return;           // small sounds give way to a big moment
      if (R[0] === 'pickup' && now < hushUntil) return;        // a celebration is playing: no pickup chatter on top
      if (R[2] >= 3 && name !== 'crash' && now - lastBig < 300) return; // one big sound at a time
      last[name] = now;
      if (R[2] >= 3) { lastBig = now; duck(0.45, 0.6); }
      B = groupBus(R[0]); curPan = Math.max(-0.8, Math.min(0.8, (opts && opts.pan) || 0));
      try {
        if (files[name]) { const s = ctx.createBufferSource(); s.buffer = files[name]; s.connect(out(B, curPan)); s.start(); }
        else if (SYNTH[name]) SYNTH[name](opts);
      } finally { B = null; curPan = 0; }
    },
    // swallow pickup sounds for a moment (used when a single event also hands out lemons/coins)
    hush(ms) { if (ctx) hushUntil = Math.max(hushUntil, ctx.currentTime * 1000 + ms); },
    setMode(m) { mode = m; if (musicBus && settings.music) musicBus.gain.setTargetAtTime(MUSIC_VOL * musicLevel * (m === 'game' ? 0.85 : 1), ctx.currentTime, 0.3); },
    // looping ambience for weather: 'rain' | 'wind' | null
    ambience(kind) {
      if (!ensure()) return;
      if (amb && amb.kind === kind) return;
      if (amb) { const a = amb, t = ctx.currentTime; amb = null; a.g.gain.setTargetAtTime(0.0001, t, 0.5); a.src.stop(t + 2); }
      if (!kind || !settings.sfx) return;
      const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = kind === 'rain' ? 'highpass' : 'bandpass';
      f.frequency.value = kind === 'rain' ? 1400 : 420; f.Q.value = kind === 'rain' ? 0.4 : 0.8;
      const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(kind === 'rain' ? 0.075 : 0.09, ctx.currentTime, 0.8);
      if (kind === 'wind') { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.23; lg.gain.value = 260; l.connect(lg); lg.connect(f.frequency); l.start(); }
      src.connect(f); f.connect(g); g.connect(groupBus('world')); src.start();
      amb = { kind, src, g };
    },
    // continuous jetpack sound: a warm filtered air rush + soft low hum,
    // the flutter moves the filter (not the volume) so it never pulses
    jet(on) {
      if (!ensure()) return;
      if (on && !jet && settings.sfx) {
        const t = ctx.currentTime;
        const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 140;
        const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 62;
        const hg = ctx.createGain(); hg.gain.value = 0.25;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.085, t + 0.6);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 3.2; const lg = ctx.createGain(); lg.gain.value = 180;
        lfo.connect(lg); lg.connect(lp.frequency);
        src.connect(hp); hp.connect(lp); lp.connect(g); hum.connect(hg); hg.connect(g);
        g.connect(groupBus('world'));
        src.start(); hum.start(); lfo.start();
        jet = { g, stop: [src, hum, lfo] };
        if (musicBus && settings.music) musicBus.gain.setTargetAtTime(MUSIC_VOL * musicLevel * 0.8, t, 0.4);
      } else if (!on && jet) {
        const j = jet; jet = null; const t = ctx.currentTime;
        j.g.gain.cancelScheduledValues(t); j.g.gain.setValueAtTime(Math.max(0.0001, j.g.gain.value), t);
        j.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        for (const n of j.stop) n.stop(t + 0.55);
        if (musicBus && settings.music) musicBus.gain.setTargetAtTime(MUSIC_VOL * musicLevel, t, 0.4);
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

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
  ];
  const BY_ID = Object.fromEntries(DEFS.map(d => [d.id, d]));
  const reward = (d, tier) => Math.round((60 + tier * 90) * (d.kind === 'run' ? 1.2 : 1) / 10) * 10;

  class Missions {
    constructor() {
      const saved = UI.store.get('missions', null);
      this.tiers = (saved && saved.tiers) || {};         // id -> next tier index
      this.active = ((saved && saved.active) || []).filter(m => BY_ID[m.id] && BY_ID[m.id].tiers[m.tier] !== undefined);
      this.life = Object.assign({ runs: 0, dist: 0, coins: 0, jumps: 0, slides: 0, lemons: 0, lemonade: 0, powerups: 0, jetpacks: 0, closeCalls: 0, bestDist: 0 },
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

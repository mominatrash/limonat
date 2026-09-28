/* =====================================================================
 * INPUT — keyboard + touch swipes, turned into 4 abstract actions:
 * 'left' | 'right' | 'jump' | 'slide'. Actions are queued so a quick
 * double-swipe is never lost between frames.
 * ===================================================================== */
(function () {
  const queue = [];
  let enabled = false;
  let onPause = null;

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
    ArrowDown: 'slide', KeyS: 'slide',
  };

  const typing = (e) => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };
  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;                       // let text fields receive every key
    if (e.code === 'Escape' || e.code === 'KeyP') { onPause && onPause(); return; }
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (enabled && !e.repeat) queue.push(a);
  });

  // --- swipes ---------------------------------------------------------
  let sx = 0, sy = 0, st = 0, tracking = false, fired = false;
  const MIN = 28; // px
  function start(x, y) { sx = x; sy = y; st = performance.now(); tracking = true; fired = false; }
  function move(x, y) {
    if (!tracking || fired) return;
    const dx = x - sx, dy = y - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < MIN) return;
    fired = true; // fire as soon as the swipe is recognised (feels snappier)
    if (enabled) queue.push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'slide' : 'jump'));
  }
  function end() { tracking = false; }

  const surface = () => document.getElementById('game');
  window.addEventListener('DOMContentLoaded', () => {
    const el = surface();
    el.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; start(t.clientX, t.clientY); }, { passive: true });
    el.addEventListener('touchmove', (e) => { const t = e.changedTouches[0]; move(t.clientX, t.clientY); if (enabled) e.preventDefault(); }, { passive: false });
    el.addEventListener('touchend', end);
    // mouse drag also works as swipe (handy for testing on desktop)
    el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') start(e.clientX, e.clientY); });
    window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') move(e.clientX, e.clientY); });
    window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') end(); });
  });

  VR.Input = {
    setEnabled(v) { enabled = v; if (!v) queue.length = 0; },
    next() { return queue.shift(); },
    clear() { queue.length = 0; },
    onPause(fn) { onPause = fn; },
  };
})();

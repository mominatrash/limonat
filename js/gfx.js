/* =====================================================================
 * GFX — the rendering toolkit every other module builds on.
 *
 *  VR.rng / VR.C        seeded random + colour helpers
 *  VR.Tex               procedural canvas textures (no image files)
 *  VR.Mat               shared materials (PBR, flat low-poly, glow)
 *  VR.MB                "mesh builder": merges hundreds of primitives
 *                       into one mesh per material (few draw calls)
 *  VR.Pool / clonePrefab  object pooling for streamed world pieces
 *  VR.Sky               gradient sky dome, sun, stars, clouds, far hills
 *  VR.Post              HDR post-processing: bloom, ACES tone mapping,
 *                       colour grading, vignette, radial speed blur
 * ===================================================================== */
window.VR = window.VR || {};
(function () {
  const T = THREE;

  // ------------------------------------------------------------ helpers
  VR.rng = function (seed) {
    let s = (seed >>> 0) || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  };
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  VR.C = {
    shade(c, f) {
      const r = Math.min(255, ((c >> 16) & 255) * f), g = Math.min(255, ((c >> 8) & 255) * f), b = Math.min(255, (c & 255) * f);
      return (r << 16) | (g << 8) | b;
    },
    mix(a, b, t) {
      const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
      const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
      return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
    },
    jitter(c, amt, rnd) { return VR.C.shade(c, 1 - amt + rnd() * amt * 2); },
    css(c) { return '#' + c.toString(16).padStart(6, '0'); },
  };

  // Additive glows (aura, shield, sparkles...) add colour but must leave the
  // alpha channel alone: alpha 0 marks the hero's pixels for the compositor
  // (see HERO COLOUR in character.js), and a glow drawn over the hero
  // must not un-mark them.
  VR.keepAlpha = function (m) {
    m.blending = T.CustomBlending;
    m.blendEquation = T.AddEquation;
    m.blendSrc = T.SrcAlphaFactor; m.blendDst = T.OneFactor;
    m.blendSrcAlpha = T.ZeroFactor; m.blendDstAlpha = T.OneFactor;
    return m;
  };

  // ------------------------------------------------------------ textures
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }

  // tileable value noise
  function makeNoise(cells, rnd) {
    const g = new Float32Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    return (x, y) => {
      x = ((x % cells) + cells) % cells; y = ((y % cells) + cells) % cells;
      const x0 = Math.floor(x), y0 = Math.floor(y), x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
      let fx = x - x0, fy = y - y0;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      const a = g[y0 * cells + x0], b = g[y0 * cells + x1], c = g[y1 * cells + x0], d = g[y1 * cells + x1];
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
  }
  function fbm(size, rnd, base = 4, oct = 4) {
    const layers = [];
    for (let o = 0; o < oct; o++) layers.push(makeNoise(base << o, rnd));
    return (px, py) => {
      let v = 0, amp = 0.5, tot = 0;
      for (let o = 0; o < oct; o++) {
        const c = base << o;
        v += layers[o](px / size * c, py / size * c) * amp; tot += amp; amp *= 0.5;
      }
      return v / tot;
    };
  }
  function fillGray(ctx, size, fn) {
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const v = Math.max(0, Math.min(255, fn(x, y) * 255)) | 0, i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  // draw with wrap-around so the texture tiles
  function wrapDraw(size, x, y, r, fn) {
    for (const dx of [0, -size, size]) for (const dy of [0, -size, size]) {
      if (x + dx < -r || x + dx > size + r || y + dy < -r || y + dy > size + r) continue;
      fn(x + dx, y + dy);
    }
  }

  const PAINTERS = {
    noise(ctx, s, r) { const n = fbm(s, r, 4, 5); fillGray(ctx, s, (x, y) => 0.8 + n(x, y) * 0.22); },
    grass(ctx, s, r) {
      const n = fbm(s, r, 4, 5), n2 = fbm(s, r, 16, 2);
      fillGray(ctx, s, (x, y) => 0.72 + n(x, y) * 0.22 + n2(x, y) * 0.1);
      for (let i = 0; i < 2600; i++) {
        const x = r() * s, y = r() * s, l = 2 + r() * 5, v = (170 + r() * 85) | 0;
        ctx.strokeStyle = `rgba(${v},${v},${v},0.55)`; ctx.lineWidth = 1;
        wrapDraw(s, x, y, 8, (px, py) => { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (r() - 0.5) * 2, py - l); ctx.stroke(); });
      }
    },
    gravel(ctx, s, r) {
      const n = fbm(s, r, 8, 3);
      fillGray(ctx, s, (x, y) => 0.35 + n(x, y) * 0.2);
      for (let i = 0; i < 1500; i++) {
        const x = r() * s, y = r() * s, rad = 1.5 + r() * 3.4, v = 0.5 + r() * 0.5, rot = r() * 3;
        wrapDraw(s, x, y, 8, (px, py) => {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath(); ctx.ellipse(px + 1, py + 1.2, rad, rad * 0.75, rot, 0, 7); ctx.fill();
          const g = (v * 255) | 0;
          ctx.fillStyle = `rgb(${g},${g},${g})`;
          ctx.beginPath(); ctx.ellipse(px, py, rad, rad * 0.75, rot, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.beginPath(); ctx.ellipse(px - rad * 0.3, py - rad * 0.3, rad * 0.4, rad * 0.3, rot, 0, 7); ctx.fill();
        });
      }
    },
    wood(ctx, s, r) {
      const n = fbm(s, r, 4, 4);
      fillGray(ctx, s, (x, y) => 0.78 + 0.14 * Math.sin((y / s) * Math.PI * 2 * 9 + n(x, y) * 7) + n(x * 3, y) * 0.08);
    },
    concrete(ctx, s, r) {
      const n = fbm(s, r, 4, 5), n2 = fbm(s, r, 32, 2);
      fillGray(ctx, s, (x, y) => 0.8 + n(x, y) * 0.14 + n2(x, y) * 0.07);
    },
    tiles(ctx, s, r) {
      const n = fbm(s, r, 8, 3), T4 = s / 4;
      const tv = []; for (let i = 0; i < 16; i++) tv.push(0.86 + r() * 0.12);
      fillGray(ctx, s, (x, y) => {
        const ix = (x / T4) | 0, iy = (y / T4) | 0, gx = x % T4, gy = y % T4;
        if (gx < 2 || gy < 2) return 0.55;
        return tv[iy * 4 + ix] + n(x, y) * 0.06 - (gx > T4 - 3 || gy > T4 - 3 ? 0.08 : 0);
      });
    },
    stone(ctx, s, r) {      // ashlar blocks (Levantine stone houses, tunnel portals)
      const n = fbm(s, r, 8, 4);
      fillGray(ctx, s, (x, y) => 0.8 + n(x, y) * 0.15);
      const rows = 6, rh = s / rows;
      for (let i = 0; i < rows; i++) {
        let x = (i % 2) * rh * 0.7;
        const xs = [];
        while (x < s + rh) { xs.push(x); x += rh * (1.2 + r() * 1.3); }
        for (let k = 0; k < xs.length; k++) {
          const v = 0.84 + r() * 0.16;
          const bw = (xs[k + 1] || xs[k] + rh * 1.6) - xs[k];
          ctx.fillStyle = `rgba(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0},0.45)`;
          ctx.fillRect(xs[k] % s, i * rh, bw, rh);
          ctx.fillStyle = 'rgba(60,60,60,0.55)';
          ctx.fillRect(xs[k] % s, i * rh, 2, rh);
        }
        ctx.fillStyle = 'rgba(60,60,60,0.55)'; ctx.fillRect(0, i * rh, s, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, i * rh + 2, s, 1);
      }
    },
    bricks(ctx, s, r) {
      fillGray(ctx, s, () => 0.62);
      const rows = 16, rh = s / rows, bw = s / 8;
      for (let i = 0; i < rows; i++) for (let k = -1; k < 9; k++) {
        const v = (0.8 + r() * 0.2) * 255 | 0, x = k * bw + (i % 2) * bw / 2;
        ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(x + 1, i * rh + 1, bw - 2, rh - 2);
      }
    },
    container(ctx, s) {
      fillGray(ctx, s, (x) => 0.78 + 0.2 * Math.sin((x / s) * Math.PI * 2 * 12) * (Math.sin((x / s) * Math.PI * 2 * 12) > 0 ? 1 : 0.5));
    },
    sand(ctx, s, r) {
      const n = fbm(s, r, 4, 4), n2 = fbm(s, r, 64, 1);
      fillGray(ctx, s, (x, y) => 0.84 + 0.06 * Math.sin((y / s) * Math.PI * 2 * 10 + n(x, y) * 9) + n2(x, y) * 0.08);
    },
    snow(ctx, s, r) {
      const n = fbm(s, r, 4, 4);
      fillGray(ctx, s, (x, y) => 0.9 + n(x, y) * 0.1);
      for (let i = 0; i < 400; i++) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(r() * s, r() * s, 1, 1); }
    },
    bark(ctx, s, r) {
      const n = fbm(s, r, 4, 4);
      fillGray(ctx, s, (x, y) => 0.72 + 0.2 * Math.abs(Math.sin((x / s) * Math.PI * 2 * 7 + n(x, y) * 5)));
    },
    hazard(ctx, s) {       // colour texture
      ctx.fillStyle = '#f5c518'; ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#1d1d1f';
      for (let i = -4; i < 8; i++) {
        ctx.beginPath(); const x = i * s / 4;
        ctx.moveTo(x, 0); ctx.lineTo(x + s / 8, 0); ctx.lineTo(x + s / 8 + s, s); ctx.lineTo(x + s, s); ctx.fill();
      }
    },
    redwhite(ctx, s) {
      ctx.fillStyle = '#f4f4f2'; ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#e03a2f';
      for (let i = -4; i < 8; i++) {
        ctx.beginPath(); const x = i * s / 4;
        ctx.moveTo(x, 0); ctx.lineTo(x + s / 8, 0); ctx.lineTo(x + s / 8 + s, s); ctx.lineTo(x + s, s); ctx.fill();
      }
    },
  };
  // textures that carry real colour (sRGB) rather than grey detail
  const COLOR_TEX = new Set(['hazard', 'redwhite']);

  const texCache = {};
  VR.Tex = {
    get(key) {
      if (texCache[key]) return texCache[key];
      const size = key === 'gravel' || key === 'grass' ? 512 : 256;
      const cv = canvas(size);
      let seed = 0; for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      PAINTERS[key](cv.getContext('2d'), size, VR.rng(seed + 11));
      const t = new T.CanvasTexture(cv);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = 8;
      t.colorSpace = COLOR_TEX.has(key) ? T.SRGBColorSpace : T.NoColorSpace;
      texCache[key] = t;
      return t;
    },
    register(key, painter, isColor) { PAINTERS[key] = painter; if (isColor) COLOR_TEX.add(key); delete texCache[key]; },
    canvas,
  };

  // Brand drawing: a glossy lemon (used for signs, the logo, UI)
  VR.drawLemon = function (ctx, cx, cy, r, rot = -0.5) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r * 1.2);
    g.addColorStop(0, '#fff7b0'); g.addColorStop(0.35, '#ffe23b'); g.addColorStop(1, '#e0a400');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-r * 1.25, 0);
    ctx.bezierCurveTo(-r * 1.0, -r * 0.95, r * 1.0, -r * 0.95, r * 1.25, 0);
    ctx.bezierCurveTo(r * 1.0, r * 0.95, -r * 1.0, r * 0.95, -r * 1.25, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.38, r * 0.32, r * 0.13, -0.2, 0, 7); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.fillStyle = '#3f9a3a';
    ctx.beginPath(); ctx.ellipse(r * 0.95, -r * 0.75, r * 0.55, r * 0.22, -0.6, 0, 7); ctx.fill();
    ctx.restore();
  };

  // ------------------------------------------------------------ materials
  // key -> recipe. uv = texture repeats per metre (planar mapping in MB).
  const RECIPES = {
    std:      { rough: 0.82 },
    matte:    { rough: 1 },
    flat:     { rough: 0.88, flat: true },
    leaf:     { rough: 0.7, flat: true },
    gloss:    { rough: 0.3 },
    paint:    { rough: 0.32, metal: 0.15, env: 1.1 },
    metal:    { rough: 0.35, metal: 0.85, env: 1.2 },
    // overhead wires: dissolve when close to the camera so they never slice across the view
    wire:     { rough: 0.35, metal: 0.85, env: 1.2, nearFade: [3.5, 9.0] },
    chrome:   { rough: 0.12, metal: 1, env: 1.4 },
    rail:     { rough: 0.55, metal: 0.85, env: 0.8 },
    glass:    { rough: 0.06, metal: 0.4, env: 2.2 },
    gravel:   { map: 'gravel', uv: 0.42, rough: 1 },
    grass:    { map: 'grass', uv: 0.1, rough: 1 },
    wood:     { map: 'wood', uv: 0.55, rough: 0.78 },
    bark:     { map: 'bark', uv: 1.1, rough: 0.95 },
    concrete: { map: 'concrete', uv: 0.25, rough: 0.9 },
    tiles:    { map: 'tiles', uv: 0.5, rough: 0.55 },
    stone:    { map: 'stone', uv: 0.33, rough: 0.95 },
    bricks:   { map: 'bricks', uv: 0.6, rough: 0.9 },
    container:{ map: 'container', uv: 0.55, rough: 0.5, metal: 0.35 },
    sand:     { map: 'sand', uv: 0.12, rough: 1 },
    snow:     { map: 'snow', uv: 0.15, rough: 0.75 },
    hazard:   { map: 'hazard', uv: 1.1, rough: 0.55 },
    redwhite: { map: 'redwhite', uv: 1.0, rough: 0.5 },
    glow:     { basic: true, hdr: 2.2 },
    glowSoft: { basic: true, hdr: 1.25 },
    neon:     { basic: true, hdr: 4 },
  };
  // shadow rules per material
  const NO_CAST = new Set(['wire', 'grass', 'sand', 'snow', 'glow', 'glowSoft', 'neon', 'gravel', 'tiles']);

  const matCache = {};
  // NIGHT READABILITY: these materials light up after dark (strength x night):
  // warning stripes act like reflective paint, train/station windows are lit,
  // rails pick up a cool moonlit sheen so the three lanes stay readable.
  const NIGHT_GLOW = {
    hazard:   { color: 0xffffff, map: true, k: 1.1 },
    redwhite: { color: 0xffffff, map: true, k: 1.0 },
    glass:    { color: 0xffd9a0, k: 0.9 },
    rail:     { color: 0x8fa6e0, k: 0.45 },
    container:{ color: 0xffffff, map: true, k: 0.22 },
  };
  VR.nightGlow = [];
  VR.Mat = {
    recipe(key) { return RECIPES[key.split('#')[0]] || RECIPES.std; },
    uvScale(key) { return this.recipe(key).uv || 1; },
    casts(key) { return !NO_CAST.has(key.split('#')[0]); },
    get(key) {
      if (matCache[key]) return matCache[key];
      const r = this.recipe(key);
      let m;
      if (r.basic) {
        m = new T.MeshBasicMaterial({ vertexColors: true });
        m.color.setScalar(r.hdr || 1);
      } else {
        m = new T.MeshStandardMaterial({
          vertexColors: true, roughness: r.rough ?? 0.8, metalness: r.metal || 0, flatShading: !!r.flat,
        });
        if (r.map) m.map = VR.Tex.get(r.map);
        m.envMapIntensity = r.env ?? 0.8;
        const ng = NIGHT_GLOW[key.split('#')[0]];
        if (ng) {
          m.emissive = new T.Color(ng.color); m.emissiveIntensity = 0;
          if (ng.map && m.map) m.emissiveMap = m.map;
          m.userData.nightK = ng.k; VR.nightGlow.push(m);
        }
        if (r.nearFade) {
          const [a, b] = r.nearFade;
          m.onBeforeCompile = (sh) => {
            sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
              { float nf = smoothstep(${a.toFixed(2)}, ${b.toFixed(2)}, length(vViewPosition));
                float dth = fract(dot(floor(gl_FragCoord.xy), vec2(0.5, 0.25)) + fract(gl_FragCoord.y * 0.5) * 0.5);
                if (nf < 0.999 && nf <= dth) discard; }`);
          };
          m.customProgramCacheKey = () => 'nearFade' + a + b;
        }
      }
      matCache[key] = m;
      return m;
    },
    define(key, recipe) { RECIPES[key] = recipe; delete matCache[key]; },
    all() { return Object.values(matCache); },
  };

  // ------------------------------------------------------------ geometry
  const geoCache = {};
  function cached(key, make) { return geoCache[key] || (geoCache[key] = make()); }

  // Rounded box with proper curved edges (non-uniform grid so corners stay smooth)
  function roundedBox(w, h, d, r, k = 3) {
    r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
    const n = 2 * k + 1;
    const g = new T.BoxGeometry(1, 1, 1, n, n, n);
    const p = g.attributes.position, nr = g.attributes.normal;
    const half = [w / 2, h / 2, d / 2];
    const v = new T.Vector3(), inner = new T.Vector3(), dv = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      const c = [p.getX(i), p.getY(i), p.getZ(i)];
      for (let a = 0; a < 3; a++) {
        const idx = Math.round((c[a] + 0.5) * n), H = half[a];
        c[a] = idx <= k ? -H + r * (idx / k) : H - r * ((n - idx) / k);
      }
      v.set(c[0], c[1], c[2]);
      inner.set(
        Math.max(-half[0] + r, Math.min(half[0] - r, v.x)),
        Math.max(-half[1] + r, Math.min(half[1] - r, v.y)),
        Math.max(-half[2] + r, Math.min(half[2] - r, v.z)));
      dv.subVectors(v, inner);
      if (dv.lengthSq() > 1e-10) {
        dv.normalize(); v.copy(inner).addScaledVector(dv, r);
        nr.setXYZ(i, dv.x, dv.y, dv.z);
      }
      p.setXYZ(i, v.x, v.y, v.z);
    }
    return g;
  }
  VR.roundedBox = roundedBox;

  // deterministic hash of a position -> [-1,1]
  function hash3(x, y, z, s) {
    const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.19) * 43758.5453;
    return (h - Math.floor(h)) * 2 - 1;
  }

  const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3();
  const _v = new T.Vector3(), _n = new T.Vector3(), _nm = new T.Matrix3(), _c = new T.Color();

  function mat4(x, y, z, o = {}, sx = 1, sy = 1, sz = 1) {
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ');
    _q.setFromEuler(_e);
    _p.set(x, y, z); _s.set(sx, sy, sz);
    return _m.compose(_p, _q, _s);
  }

  /**
   * MB — merge primitives into a handful of meshes.
   * Every method takes (materialKey, colour, ...position/size, options).
   * Options: rx/ry/rz rotation, vary (per-face colour jitter),
   * ao (darken towards the bottom of the piece), seed.
   */
  class MB {
    constructor(seed = 1) { this.buckets = {}; this.rnd = VR.rng(seed); this.off = null; }
    // offset every following primitive (e.g. props standing on a platform or a hill)
    at(x, y, z) { this.off = (x || y || z) ? new T.Vector3(x, y, z) : null; return this; }
    bucket(key) { return this.buckets[key] || (this.buckets[key] = { pos: [], nor: [], uv: [], col: [], idx: [], n: 0 }); }

    add(geo, mat, color, matrix, o = {}) {
      const b = this.bucket(mat);
      const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
      _nm.getNormalMatrix(matrix);
      const us = VR.Mat.uvScale(mat) * (o.uvScale || 1);
      const base = b.n;
      if (typeof color === 'number') _c.setHex(color); else _c.copy(color);
      const vary = o.vary || 0, ao = o.ao || 0;
      let y0 = 0, yh = 1;
      if (ao) { if (!geo.boundingBox) geo.computeBoundingBox(); y0 = geo.boundingBox.min.y; yh = Math.max(1e-4, geo.boundingBox.max.y - y0); }
      let k = 1;
      for (let i = 0; i < pos.count; i++) {
        const ly = pos.getY(i);
        _v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
        if (this.off) _v.add(this.off);
        _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize();
        b.pos.push(_v.x, _v.y, _v.z); b.nor.push(_n.x, _n.y, _n.z);
        if (o.keepUV && uv) b.uv.push(uv.getX(i) * (o.uRep || 1), uv.getY(i) * (o.vRep || 1));
        else {
          const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
          if (ay >= ax && ay >= az) b.uv.push(_v.x * us, _v.z * us);
          else if (ax >= az) b.uv.push(_v.z * us, _v.y * us);
          else b.uv.push(_v.x * us, _v.y * us);
        }
        if (vary && i % 3 === 0) k = 1 - vary + this.rnd() * vary * 2;
        let f = vary ? k : 1;
        if (ao) f *= 1 - ao * (1 - clamp01((ly - y0) / yh));
        if (o.topTint && _n.y > 0.5) b.col.push(o.topTint.r * f, o.topTint.g * f, o.topTint.b * f);
        else b.col.push(_c.r * f, _c.g * f, _c.b * f);
      }
      if (geo.index) { const ix = geo.index; for (let i = 0; i < ix.count; i++) b.idx.push(base + ix.getX(i)); }
      else for (let i = 0; i < pos.count; i++) b.idx.push(base + i);
      b.n += pos.count;
      return this;
    }

    // centred box; o.r = corner radius
    box(mat, color, x, y, z, w, h, d, o = {}) {
      if (o.r) {
        const g = cached(`rb${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)},${o.r}`, () => roundedBox(w, h, d, o.r, o.k || 3));
        return this.add(g, mat, color, mat4(x, y, z, o), o);
      }
      const g = cached('box', () => new T.BoxGeometry(1, 1, 1));
      return this.add(g, mat, color, mat4(x, y, z, o, w, h, d), o);
    }
    // box resting on y (bottom at y) — convenient for props
    block(mat, color, x, y, z, w, h, d, o = {}) { return this.box(mat, color, x, y + h / 2, z, w, h, d, o); }

    cyl(mat, color, x, y, z, rt, rb, h, o = {}) {
      const seg = o.seg || 16;
      const g = cached(`cy${rt},${rb},${seg},${!!o.open},${o.ts || 0},${o.tl || 0}`, () =>
        new T.CylinderGeometry(rt, rb, 1, seg, 1, !!o.open, o.ts || 0, o.tl || Math.PI * 2));
      return this.add(g, mat, color, mat4(x, y, z, o, o.sx || 1, h, o.sz || 1), o);
    }
    sphere(mat, color, x, y, z, r, o = {}) {
      const ws = o.seg || 16, hs = o.hseg || Math.max(6, ws >> 1);
      const g = cached(`sp${ws},${hs},${o.tl || 0}`, () => new T.SphereGeometry(1, ws, hs, 0, Math.PI * 2, 0, o.tl || Math.PI));
      return this.add(g, mat, color, mat4(x, y, z, o, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1)), o);
    }
    cone(mat, color, x, y, z, r, h, o = {}) { return this.cyl(mat, color, x, y, z, 0, r, h, o); }
    torus(mat, color, x, y, z, R, tube, o = {}) {
      const g = cached(`to${R},${tube},${o.arc || 0},${o.seg || 12}`, () => new T.TorusGeometry(R, tube, o.tseg || 6, o.seg || 24, o.arc || Math.PI * 2));
      return this.add(g, mat, color, mat4(x, y, z, o, o.sx || 1, o.sy || 1, o.sz || 1), o);
    }
    // faceted low-poly blob (rocks, foliage, mountains)
    blob(mat, color, x, y, z, r, o = {}) {
      const detail = o.detail ?? 1, seed = o.seed ?? ((this.rnd() * 1000) | 0), jit = o.jit ?? 0.18;
      const key = `bl${detail},${seed % 24},${jit}`;
      const g = cached(key, () => {
        const ge = new T.IcosahedronGeometry(1, detail);
        const p = ge.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
          const k = 1 + hash3(px, py, pz, seed % 24) * jit;
          p.setXYZ(i, px * k, py * k, pz * k);
        }
        ge.computeVertexNormals();
        return ge;
      });
      return this.add(g, mat, color, mat4(x, y, z, o, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1)), Object.assign({ vary: 0.08 }, o));
    }
    // any custom geometry, positioned
    geo(mat, color, g, x, y, z, o = {}, sx = 1, sy = 1, sz = 1) { return this.add(g, mat, color, mat4(x, y, z, o, sx, sy, sz), o); }

    isEmpty() { return Object.keys(this.buckets).length === 0; }
    geometries() {
      const out = [];
      for (const key in this.buckets) {
        const b = this.buckets[key];
        if (!b.n) continue;
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(b.pos, 3));
        g.setAttribute('normal', new T.Float32BufferAttribute(b.nor, 3));
        g.setAttribute('uv', new T.Float32BufferAttribute(b.uv, 2));
        g.setAttribute('color', new T.Float32BufferAttribute(b.col, 3));
        g.setIndex(b.n > 65535 ? new T.Uint32BufferAttribute(b.idx, 1) : new T.Uint16BufferAttribute(b.idx, 1));
        g.computeBoundingSphere();
        out.push({ key, geometry: g });
      }
      return out;
    }
    build(opts = {}) {
      const grp = new T.Group();
      for (const { key, geometry } of this.geometries()) {
        const m = new T.Mesh(geometry, VR.Mat.get(key));
        m.castShadow = opts.cast !== false && VR.Mat.casts(key);
        m.receiveShadow = opts.receive !== false;
        m.matrixAutoUpdate = false; m.updateMatrix();
        grp.add(m);
      }
      return grp;
    }
  }
  VR.MB = MB;

  // ------------------------------------------------------------ pooling
  class Pool {
    constructor(scene) { this.scene = scene; this.free = {}; this.factories = {}; }
    define(key, factory) { this.factories[key] = factory; this.free[key] = this.free[key] || []; }
    has(key) { return !!this.factories[key]; }
    get(key) {
      const list = this.free[key];
      let o = list && list.pop();
      if (!o) { o = this.factories[key](); o.userData.poolKey = key; }
      o.visible = true;
      this.scene.add(o);
      return o;
    }
    release(o) {
      if (!o) return;
      o.visible = false;
      this.scene.remove(o);
      o.scale.set(1, 1, 1); o.rotation.set(0, 0, 0);
      (this.free[o.userData.poolKey] || (this.free[o.userData.poolKey] = [])).push(o);
    }
  }
  VR.Pool = Pool;
  VR.clonePrefab = function (prefab) {
    const g = new T.Group();
    for (const child of prefab.children) {
      const m = new T.Mesh(child.geometry, child.material);
      m.castShadow = child.castShadow; m.receiveShadow = child.receiveShadow;
      m.position.copy(child.position); m.rotation.copy(child.rotation); m.scale.copy(child.scale);
      m.matrixAutoUpdate = false; m.updateMatrix();
      g.add(m);
    }
    return g;
  };

  // ------------------------------------------------------------ fullscreen helpers
  const FS_GEO = new T.BufferGeometry();
  FS_GEO.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  FS_GEO.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const FS_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

  /* ------------------------------------------------------------ SKY
   * Gradient dome + sun + stars, soft sprite clouds and two rings of
   * far-away hills that follow the camera (they read as "infinitely far").
   */
  class Sky {
    constructor(scene) {
      this.scene = scene;
      this.uniforms = {
        uTop: { value: new T.Color(0x3d8ee8) },
        uHorizon: { value: new T.Color(0xbfe6ff) },
        uBottom: { value: new T.Color(0x9cc9e8) },
        uSunDir: { value: new T.Vector3(-0.35, 0.42, -0.84).normalize() },
        uSunColor: { value: new T.Color(0xfff1d0) },
        uSunSize: { value: 1 },
        uStars: { value: 0 },
        uTime: { value: 0 },
      };
      this.material = new T.ShaderMaterial({
        uniforms: this.uniforms, side: T.BackSide, depthWrite: false, fog: false,
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
        fragmentShader: `
          uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor; uniform float uSunSize, uStars, uTime;
          varying vec3 vDir;
          float hash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
          void main(){
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(clamp(h,0.0,1.0), 0.55)) : mix(uHorizon, uBottom, pow(clamp(-h,0.0,1.0), 0.35));
            // horizon haze band
            col = mix(col, uHorizon * 1.04, exp(-abs(h) * 18.0) * 0.35);
            float s = max(dot(d, uSunDir), 0.0);
            float disk = smoothstep(0.99955 - 0.0004*uSunSize, 0.99975 - 0.0002*uSunSize, s);
            col += uSunColor * (disk * 14.0 + pow(s, 900.0) * 3.0 + pow(s, 60.0) * 0.45 + pow(s, 7.0) * 0.12);
            if (uStars > 0.0 && h > 0.0) {
              vec3 g = floor(d * 260.0);
              float st = hash(g);
              float tw = 0.6 + 0.4 * sin(uTime * 3.0 + st * 60.0);
              col += vec3(step(0.9965, st) * tw * uStars * 1.6) * smoothstep(0.0, 0.25, h);
            }
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      });
      this.dome = new T.Mesh(new T.SphereGeometry(900, 32, 20), this.material);
      this.dome.renderOrder = -10; this.dome.frustumCulled = false;
      scene.add(this.dome);

      this.buildClouds();
      this.buildRidges();
    }

    buildClouds() {
      const tex = [];
      for (let v = 0; v < 3; v++) {
        const cv = canvas(256, 128), c = cv.getContext('2d');
        const r = VR.rng(90 + v * 7);
        for (let i = 0; i < 26; i++) {
          const x = 40 + r() * 176, y = 58 + (r() - 0.5) * 34 - Math.sin((x - 40) / 176 * Math.PI) * 20, rad = 18 + r() * 26;
          const g = c.createRadialGradient(x, y - rad * 0.3, rad * 0.1, x, y, rad);
          g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(245,248,255,0.75)'); g.addColorStop(1, 'rgba(230,238,250,0)');
          c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill();
        }
        // soft grey underside
        const gr = c.createLinearGradient(0, 40, 0, 110);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(120,140,170,0.35)');
        c.globalCompositeOperation = 'source-atop'; c.fillStyle = gr; c.fillRect(0, 0, 256, 128);
        const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; tex.push(t);
      }
      this.cloudMats = tex.map(t => new T.SpriteMaterial({ map: t, fog: false, depthWrite: false, transparent: true, color: 0xffffff }));
      this.clouds = [];
      const r = VR.rng(5);
      for (let i = 0; i < 18; i++) {
        const s = new T.Sprite(this.cloudMats[i % 3]);
        const side = i % 2 ? 1 : -1;
        const c = { sprite: s, ox: side * (60 + r() * 380), oy: 70 + r() * 110, oz: -r() * 800, drift: 1 + r() * 2 };
        const w = 120 + r() * 160; s.scale.set(w, w * 0.45, 1);
        s.renderOrder = -9;
        this.scene.add(s); this.clouds.push(c);
      }
    }

    ridgeGeometry(radius, hMin, hMax, seed, style) {
      const seg = 360, r = VR.rng(seed);
      const pos = [], idx = [], ys = [];
      const noise = makeNoise(24, r), noise2 = makeNoise(96, r);
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        let t;
        if (style === 'dunes') t = 0.25 + 0.35 * noise(i / seg * 12, 0.5) + 0.05 * noise2(i / seg * 48, 0.5);
        else if (style === 'city') {
          const blk = Math.floor(i / 3);
          t = 0.15 + ((Math.sin(blk * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.85;
          if (blk % 7 === 0) t *= 0.4;
        } else t = Math.pow(noise(i / seg * 24, 0.5), 1.6) * 0.95 + noise2(i / seg * 96, 0.5) * 0.12;
        const hh = hMin + (hMax - hMin) * t;
        const x = Math.sin(a) * radius, z = Math.cos(a) * radius;
        pos.push(x, -30, z, x, hh, z);
        ys.push(0, 1);
        if (i < seg) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('aY', new T.Float32BufferAttribute(ys, 1));
      g.setIndex(idx);
      return g;
    }

    buildRidges() {
      const mk = (radius, hMin, hMax, seed, style, near) => {
        const u = {
          uTop: { value: new T.Color(near ? 0x6f8fa8 : 0x9db6cc) },
          uBottom: { value: new T.Color(0xbfe6ff) },
          uFade: { value: 0 },
          uWin: { value: style === 'city' ? 1 : 0 },
        };
        const m = new T.ShaderMaterial({
          uniforms: u, fog: false, transparent: true, depthWrite: false, side: T.DoubleSide,
          vertexShader: `attribute float aY; varying float vY; varying vec3 vP; void main(){ vY = aY; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: `uniform vec3 uTop, uBottom; uniform float uFade, uWin; varying float vY; varying vec3 vP;
            float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
            void main(){
              vec3 c = mix(uBottom, uTop, smoothstep(0.0, 0.9, vY));
              if (uWin > 0.5) {
                vec2 cell = floor(vec2(atan(vP.x, vP.z) * 420.0, vP.y * 0.55));
                float lit = step(0.8, h(cell)) * step(0.35, fract(atan(vP.x, vP.z) * 420.0)) * step(0.4, fract(vP.y * 0.55)) * step(2.0, vP.y);
                c += vec3(1.0, 0.8, 0.45) * lit * 1.6;
              }
              gl_FragColor = vec4(c, uFade);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`,
        });
        const mesh = new T.Mesh(this.ridgeGeometry(radius, hMin, hMax, seed, style), m);
        mesh.frustumCulled = false; mesh.renderOrder = near ? -7 : -8;
        mesh.visible = false;
        this.scene.add(mesh);
        return mesh;
      };
      this.ridges = {
        mountains: [mk(780, 30, 190, 3, 'mountains', false), mk(560, 10, 95, 4, 'mountains', true)],
        hills: [mk(780, 20, 90, 5, 'mountains', false), mk(560, 6, 42, 6, 'dunes', true)],
        dunes: [mk(780, 12, 60, 7, 'dunes', false), mk(560, 4, 30, 8, 'dunes', true)],
        city: [mk(780, 30, 140, 9, 'city', false), mk(560, 12, 70, 10, 'city', true)],
      };
      this.ridgeStyle = 'hills';
    }

    // smoothly move toward the colours of a biome "look"
    update(dt, camera, look, k) {
      const u = this.uniforms;
      u.uTime.value += dt;
      u.uTop.value.lerp(look.top, k);
      u.uHorizon.value.lerp(look.horizon, k);
      u.uBottom.value.lerp(look.bottom, k);
      u.uSunColor.value.lerp(look.sunColor, k);
      u.uSunDir.value.lerp(look.sunDir, k).normalize();
      u.uStars.value += (look.stars - u.uStars.value) * k;
      this.dome.position.copy(camera.position);

      for (const c of this.clouds) {
        c.oz += c.drift * dt;
        let z = camera.position.z * 0.9 + c.oz;
        // wrap clouds that fall behind the camera back into the distance
        while (z > camera.position.z + 150) { c.oz -= 900; z -= 900; }
        while (z < camera.position.z - 750) { c.oz += 900; z += 900; }
        c.sprite.position.set(camera.position.x * 0.9 + c.ox, c.oy, z);
      }
      for (const m of this.cloudMats) m.color.lerp(look.cloud, k);

      for (const key in this.ridges) {
        const on = key === look.ridge;
        for (let i = 0; i < 2; i++) {
          const mesh = this.ridges[key][i], U = mesh.material.uniforms;
          U.uFade.value += ((on ? 1 : 0) - U.uFade.value) * Math.min(1, k * 1.5);
          mesh.visible = U.uFade.value > 0.01;
          mesh.position.set(camera.position.x, 0, camera.position.z);
          U.uBottom.value.copy(u.uHorizon.value);
          U.uTop.value.lerp(i ? look.ridgeNear : look.ridgeFar, k);
        }
      }
    }
  }
  VR.Sky = Sky;

  /* ------------------------------------------------------------ POST
   * scene -> HDR (MSAA) target -> bloom mip chain -> composite to screen
   */
  class Post {
    constructor(renderer) {
      this.renderer = renderer;
      this.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.quad = new T.Mesh(FS_GEO, null); this.quad.frustumCulled = false;
      this.scene = new T.Scene(); this.scene.add(this.quad);
      this.levels = 5;
      this.mips = [];
      const opts = { type: T.HalfFloatType, depthBuffer: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter };
      for (let i = 0; i < this.levels; i++) this.mips.push(new T.WebGLRenderTarget(4, 4, opts));
      this.target = new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType, samples: 4, minFilter: T.LinearFilter, magFilter: T.LinearFilter });
      this.setSamples = (n) => { if (this.target.samples !== n) { this.target.dispose(); this.target.samples = n; } };

      this.brightMat = new T.ShaderMaterial({
        uniforms: { tSrc: { value: null }, uTexel: { value: new T.Vector2() }, uThreshold: { value: 1.35 }, uKnee: { value: 0.5 } },
        vertexShader: FS_VERT, depthTest: false, depthWrite: false,
        fragmentShader: `uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold, uKnee; varying vec2 vUv;
          void main(){
            // alpha 0 = hero pixel: the hero never feeds the bloom (keeps it crisp white, no glow)
            vec4 s0 = texture2D(tSrc, vUv + uTexel*vec2(-1.0,-1.0)), s1 = texture2D(tSrc, vUv + uTexel*vec2(1.0,-1.0));
            vec4 s2 = texture2D(tSrc, vUv + uTexel*vec2(-1.0,1.0)), s3 = texture2D(tSrc, vUv + uTexel*vec2(1.0,1.0));
            vec3 c = s0.rgb * clamp(s0.a, 0.0, 1.0) + s1.rgb * clamp(s1.a, 0.0, 1.0)
                   + s2.rgb * clamp(s2.a, 0.0, 1.0) + s3.rgb * clamp(s3.a, 0.0, 1.0);
            c *= 0.25; c = min(c, vec3(30.0));
            float br = max(c.r, max(c.g, c.b));
            float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
            soft = soft * soft / (4.0 * uKnee + 1e-4);
            float w = max(soft, br - uThreshold) / max(br, 1e-4);
            gl_FragColor = vec4(c * w, 1.0);
          }`,
      });
      this.downMat = new T.ShaderMaterial({
        uniforms: { tSrc: { value: null }, uTexel: { value: new T.Vector2() } },
        vertexShader: FS_VERT, depthTest: false, depthWrite: false,
        fragmentShader: `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
          void main(){
            vec3 c = texture2D(tSrc, vUv).rgb * 0.5;
            c += texture2D(tSrc, vUv + uTexel*vec2(-1.0,-1.0)).rgb * 0.125;
            c += texture2D(tSrc, vUv + uTexel*vec2(1.0,-1.0)).rgb * 0.125;
            c += texture2D(tSrc, vUv + uTexel*vec2(-1.0,1.0)).rgb * 0.125;
            c += texture2D(tSrc, vUv + uTexel*vec2(1.0,1.0)).rgb * 0.125;
            gl_FragColor = vec4(c, 1.0);
          }`,
      });
      this.upMat = new T.ShaderMaterial({
        uniforms: { tSrc: { value: null }, uTexel: { value: new T.Vector2() }, uScatter: { value: 0.8 } },
        vertexShader: FS_VERT, depthTest: false, depthWrite: false, blending: T.AdditiveBlending, transparent: true,
        fragmentShader: `uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uScatter; varying vec2 vUv;
          void main(){
            vec2 t = uTexel * 1.0;
            vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
            c += (texture2D(tSrc, vUv + vec2(-t.x,0.0)).rgb + texture2D(tSrc, vUv + vec2(t.x,0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0,-t.y)).rgb + texture2D(tSrc, vUv + vec2(0.0,t.y)).rgb) * 2.0;
            c += texture2D(tSrc, vUv + vec2(-t.x,-t.y)).rgb + texture2D(tSrc, vUv + vec2(t.x,-t.y)).rgb + texture2D(tSrc, vUv + vec2(-t.x,t.y)).rgb + texture2D(tSrc, vUv + vec2(t.x,t.y)).rgb;
            gl_FragColor = vec4(c / 16.0 * uScatter, 1.0);
          }`,
      });
      this.compUniforms = {
        tScene: { value: null }, tBloom: { value: null },
        uBloom: { value: 0.55 }, uExposure: { value: 1.0 }, uVignette: { value: 0.35 },
        uSat: { value: 1.12 }, uContrast: { value: 1.06 }, uTint: { value: new T.Color(1, 1, 1) },
        uRadial: { value: 0 }, uCA: { value: 0 }, uFlash: { value: 0 }, uDesat: { value: 0 },
        uTime: { value: 0 }, uAspect: { value: 1 },
      };
      this.compMat = new T.ShaderMaterial({
        uniforms: this.compUniforms, vertexShader: FS_VERT, depthTest: false, depthWrite: false,
        fragmentShader: `
          uniform sampler2D tScene, tBloom; uniform float uBloom, uExposure, uVignette, uSat, uContrast, uRadial, uCA, uFlash, uDesat, uTime, uAspect;
          uniform vec3 uTint; varying vec2 vUv;
          vec3 lmRRTFit(vec3 v){ vec3 a = v*(v+0.0245786)-0.000090537; vec3 b = v*(0.983729*v+0.4329510)+0.238081; return a/b; }
          vec3 lmAces(vec3 c){
            const mat3 i = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777);
            const mat3 o = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602);
            c = i * c; c = lmRRTFit(c); c = o * c; return clamp(c, 0.0, 1.0);
          }
          vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
          float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
          void main(){
            vec2 uv = vUv;
            vec2 dir = uv - vec2(0.5, 0.52);
            vec4 raw = texture2D(tScene, uv);
            // HERO COLOUR: the hero is drawn with alpha 0 and already in its final
            // display colour, so it skips exposure, biome tint, bloom and ACES
            // (which would turn white into cream/beige) and stays truly white.
            float hero = clamp(1.0 - raw.a, 0.0, 1.0);
            vec3 col;
            if (uCA > 0.0) {
              vec2 o = dir * uCA * 0.012;
              col = vec3(texture2D(tScene, uv + o).r, texture2D(tScene, uv).g, texture2D(tScene, uv - o).b);
            } else col = texture2D(tScene, uv).rgb;
            if (uRadial > 0.0) {
              vec3 acc = col; float w = 1.0;
              float amt = uRadial * 0.05 * smoothstep(0.1, 0.6, length(dir));
              for (int k = 1; k <= 6; k++) { float f = float(k) / 6.0; acc += texture2D(tScene, uv - dir * amt * f).rgb; w += 1.0; }
              col = acc / w;
            }
            col += texture2D(tBloom, uv).rgb * uBloom * (1.0 - hero);
            col *= uExposure * uTint;
            col = lmAces(col);
            col = mix(col, clamp(raw.rgb, 0.0, 1.0), hero);
            col = toSRGB(col);
            float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
            col = mix(vec3(l), col, uSat * (1.0 - uDesat));
            col = (col - 0.5) * uContrast + 0.5;
            vec2 vd = dir * vec2(uAspect, 1.0);
            col *= mix(1.0, smoothstep(1.05, 0.25, length(vd)), uVignette);
            col += (rand(uv * 731.0 + uTime) - 0.5) * 0.012;
            col = mix(col, vec3(1.0), uFlash);
            gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
          }`,
      });
      this.copyMat = this.compMat;
    }

    setSize(w, h, pr) {
      const W = Math.max(1, Math.floor(w * pr)), H = Math.max(1, Math.floor(h * pr));
      this.target.setSize(W, H);
      let mw = W >> 1, mh = H >> 1;
      for (let i = 0; i < this.levels; i++) {
        this.mips[i].setSize(Math.max(1, mw), Math.max(1, mh));
        mw >>= 1; mh >>= 1;
      }
      this.compUniforms.uAspect.value = w / h;
    }

    pass(mat, target) { this.quad.material = mat; this.renderer.setRenderTarget(target); this.renderer.render(this.scene, this.cam); }

    render(scene, camera, dt) {
      const r = this.renderer;
      r.setRenderTarget(this.target);
      r.render(scene, camera);
      // bloom chain
      const bm = this.brightMat.uniforms;
      bm.tSrc.value = this.target.texture;
      bm.uTexel.value.set(1 / this.target.width, 1 / this.target.height);
      this.pass(this.brightMat, this.mips[0]);
      for (let i = 1; i < this.levels; i++) {
        const src = this.mips[i - 1];
        this.downMat.uniforms.tSrc.value = src.texture;
        this.downMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        this.pass(this.downMat, this.mips[i]);
      }
      r.autoClear = false;
      for (let i = this.levels - 1; i > 0; i--) {
        const src = this.mips[i];
        this.upMat.uniforms.tSrc.value = src.texture;
        this.upMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        this.pass(this.upMat, this.mips[i - 1]);
      }
      r.autoClear = true;
      const cu = this.compUniforms;
      cu.tScene.value = this.target.texture; cu.tBloom.value = this.mips[0].texture;
      cu.uTime.value = (cu.uTime.value + dt) % 100;
      this.pass(this.compMat, null);
    }
  }
  VR.Post = Post;
})();

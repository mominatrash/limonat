/* =====================================================================
 * HEROES — production-style runners: Scout, Sprinter, Ninja.
 * ---------------------------------------------------------------------
 * How they are made (and why they no longer look like stacked shapes):
 *
 *  • ONE SKINNED MESH per character, bound to the same skeleton the hero
 *    uses (same bone names, lengths and rest layout), so every existing
 *    animation — run, jump, land, slide, lane change, jetpack, rides, idle,
 *    cheer, stumble, death — drives it unchanged and the feet stay planted.
 *    Limbs, torso and clothes are continuous surfaces whose vertices are
 *    weighted across joints, so elbows, knees, shoulders and hips bend
 *    smoothly instead of hinging between spheres.
 *
 *  • Everything is PARAMETRIC SURFACES (not primitives): the torso, pelvis
 *    and limbs are profiled ring surfaces; clothing details (pockets, flaps,
 *    plackets, bibs, patches) are raised panels that follow the garment
 *    surface with rounded edges; seams, piping, straps, laces, lash lines
 *    and hair strands are swept tubes laid ON the surface; the head is a
 *    sculpted surface (brow, sockets, cheeks, nose, lips, jaw, chin).
 *
 *  • ONE PHYSICALLY-BASED MATERIAL (MeshStandardMaterial, patched) for the
 *    whole body. Each vertex carries its material zone — roughness,
 *    metalness and a micro-surface pattern (skin pores, cotton weave, denim
 *    twill, leather grain, rubber, brushed metal, knit ribs, hair strands,
 *    canvas, sports mesh, satin) rendered as anti-aliased bump detail that
 *    fades out with distance. It is lit by the scene's sun, sky and
 *    environment reflections like the rest of the world, plus a soft rim
 *    and fill so the runner always separates from the background.
 *    Eyes are real eyeballs with a procedural iris, limbal ring, pupil and
 *    wet reflections. A thin inked outline (per-zone thickness) keeps the
 *    silhouette readable at gameplay distance.
 *
 *  • Secondary motion: headband tails / sweatband knot / neckerchief are
 *    skinned bone chains driven by springs (player.js), the backpack sits
 *    on its own sprung bone and bounces with every stride.
 *
 * Draw calls: body + outline, plus back gear (+ outline): ≈4 per runner.
 * ===================================================================== */
(function () {
  const T = THREE, D = VR.CHAR_DIM;
  const TAU = Math.PI * 2;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const col = (hex) => new T.Color(hex);
  const cmix = (a, b, t) => a.clone().lerp(b, t);

  // Catmull-Rom through n-dimensional points, t in [0,1]
  function spline(pts) {
    const n = pts.length;
    return (t) => {
      t = Math.min(1, Math.max(0, t)) * (n - 1);
      const i = Math.min(n - 2, Math.floor(t)), f = t - i;
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      const f2 = f * f, f3 = f2 * f;
      return p1.map((_, k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f3));
    };
  }

  // ------------------------------------------------------------ materials
  // surface zones: [roughness, metalness, pattern, outline factor]
  const M = {
    skin: [0.56, 0, 0, 1], cotton: [0.88, 0, 1, 1], denim: [0.8, 0, 2, 1], leather: [0.4, 0, 3, 1], rubber: [0.75, 0, 4, 1],
    metal: [0.28, 1, 5, 0], plastic: [0.3, 0, 6, 1], knit: [0.92, 0, 7, 1], eye: [0.05, 0, 8, 0], glow: [0.5, 0, 9, 0],
    hair: [0.52, 0, 10, 1], canvas: [0.84, 0, 11, 1], mesh: [0.55, 0, 12, 1], satin: [0.3, 0, 13, 1], lacquer: [0.16, 0, 6, 1],
    detail: [0.5, 0, 6, 0], suede: [0.95, 0, 4, 1],
  };
  const noOut = (m) => [m[0], m[1], m[2], 0];

  const PATCH_V = `
    attribute vec4 aSurf; attribute vec2 aUv;
    varying vec4 vSurf; varying vec2 vUv2; varying vec3 vObj;
`;
  const PATCH_F = `
    varying vec4 vSurf; varying vec2 vUv2; varying vec3 vObj;
    float hh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float vn(vec3 x) {
      vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hh(i), hh(i + vec3(1,0,0)), f.x), mix(hh(i + vec3(0,1,0)), hh(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(hh(i + vec3(0,0,1)), hh(i + vec3(1,0,1)), f.x), mix(hh(i + vec3(0,1,1)), hh(i + vec3(1,1,1)), f.x), f.y), f.z);
    }
    vec3 heroBump(vec3 N, float h, float k) {
      vec3 sp = -vViewPosition; vec3 dx = dFdx(sp), dy = dFdy(sp);
      vec3 r1 = cross(dy, N), r2 = cross(N, dx);
      float det = dot(dx, r1);
      vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2) * k;
      return normalize(abs(det) * N - g);
    }
`;
  // pattern height + roughness variation (faded out where the detail is smaller than a pixel)
  const PATTERN = `
    int heroPat = int(vSurf.z + 0.5);
    float heroFw = max(length(fwidth(vObj)), 1e-5);
    float heroH = 0.0, heroR = 0.0, heroK = 0.0;
    #define HFADE(f) clamp(1.6 - heroFw * (f) * 2.5, 0.0, 1.0)
    if (heroPat == 0) { float a = HFADE(300.0); heroH = (vn(vObj * 300.0) - 0.5) * a; heroK = 0.0005; heroR = (vn(vObj * 60.0) - 0.5) * 0.12;
      diffuseColor.rgb *= 1.0 + (vn(vObj * 40.0) - 0.5) * 0.06; }
    else if (heroPat == 1) { float a = HFADE(160.0); vec3 q = vObj * 1000.0; heroH = (sin(q.x + q.z) * sin(q.y)) * 0.5 * a; heroK = 0.002; heroR = (vn(vObj * 30.0) - 0.5) * 0.1;
      diffuseColor.rgb *= 1.0 + (vn(vObj * 22.0) - 0.5) * 0.08; }
    else if (heroPat == 2) { float a = HFADE(140.0); vec3 q = vObj * 900.0; heroH = sin(q.x + q.y + q.z * 0.6) * 0.5 * a; heroK = 0.003; heroR = (vn(vObj * 25.0) - 0.5) * 0.12;
      diffuseColor.rgb *= 1.0 + (vn(vObj * vec3(8.0, 60.0, 8.0)) - 0.5) * 0.16; }
    else if (heroPat == 3) { float a = HFADE(260.0); float g = vn(vObj * 260.0); heroH = -abs(g - 0.5) * 2.0 * a; heroK = 0.003; heroR = (vn(vObj * 45.0) - 0.5) * 0.24;
      diffuseColor.rgb *= 0.94 + vn(vObj * 30.0) * 0.12; }
    else if (heroPat == 4) { float a = HFADE(700.0); heroH = (vn(vObj * 700.0) - 0.5) * a; heroK = 0.0015; heroR = (vn(vObj * 50.0) - 0.5) * 0.08; }
    else if (heroPat == 5) { float a = HFADE(480.0); heroH = sin(vObj.y * 3000.0 + vn(vObj * 80.0) * 3.0) * 0.4 * a; heroK = 0.001; heroR = (vn(vObj * 90.0) - 0.5) * 0.14; }
    else if (heroPat == 7) { float a = HFADE(110.0); heroH = sin(atan(vObj.x - floor(vObj.x * 5.26 + 0.5) / 5.26, vObj.z) * 60.0) * 0.5 * a; heroK = 0.003; }
    else if (heroPat == 10) { float a = HFADE(300.0); heroH = (sin(vUv2.x * 6.2832 * 23.0 + vn(vObj * 90.0) * 4.0) * 0.5 + (vn(vObj * 400.0) - 0.5) * 0.4) * a; heroK = 0.0015;
      heroR = (vn(vObj * 60.0) - 0.5) * 0.12; diffuseColor.rgb *= 0.92 + 0.16 * vn(vec3(vUv2.x * 40.0, vUv2.y * 3.0, 0.0)); }
    else if (heroPat == 11) { float a = HFADE(90.0); vec3 q = vObj * 520.0; heroH = (sin(q.x + q.z) * sin(q.y)) * 0.6 * a; heroK = 0.004; heroR = (vn(vObj * 20.0) - 0.5) * 0.14;
      diffuseColor.rgb *= 1.0 + (vn(vObj * 14.0) - 0.5) * 0.1; }
    else if (heroPat == 12) { float a = HFADE(140.0); vec3 q = vObj * 900.0; float d = sin(q.x + q.z) * sin(q.y); heroH = smoothstep(0.4, 0.9, d) * a; heroK = 0.003; heroR = heroH * 0.25; }
    else if (heroPat == 13) { heroR = (vn(vObj * 30.0) - 0.5) * 0.08; }
    if (heroPat == 8) {
      // eyeball: iris with radial fibres, limbal ring, pupil, softly shaded sclera
      float r = vUv2.y, ir = 0.21, pr = 0.085;
      float rr = r / ir;
      vec3 iris = diffuseColor.rgb;
      vec3 ic = iris * (0.7 + 0.55 * rr) * (1.0 + 0.2 * sin(vUv2.x * 6.2832 * 26.0) * rr);
      ic = mix(ic, iris * 0.28, smoothstep(0.72, 1.0, rr));
      vec3 c = mix(vec3(0.015), ic, smoothstep(pr - 0.012, pr + 0.012, r));
      vec3 sclera = vec3(0.95, 0.94, 0.92) * (1.0 - 0.18 * smoothstep(0.45, 1.0, r));
      diffuseColor.rgb = mix(c, sclera, smoothstep(ir - 0.012, ir + 0.008, r));
    }`;
  const bodyMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.85 });
  bodyMat.onBeforeCompile = (sh) => {
    sh.vertexShader = PATCH_V + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSurf = aSurf; vUv2 = aUv; vObj = position;');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', PATCH_F + 'void main() {')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + PATTERN)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = clamp(vSurf.x + heroR, 0.04, 1.0);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = vSurf.y;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n if (heroK > 0.0) normal = heroBump(normal, heroH, heroK);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n if (heroPat == 9) totalEmissiveRadiance += diffuseColor.rgb * 1.2;')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        { vec3 hv = normalize(vViewPosition);
          float rim = pow(1.0 - clamp(dot(normal, hv), 0.0, 1.0), 3.0);
          reflectedLight.directDiffuse += diffuseColor.rgb * rim * 0.32;
          reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.09;
          if (heroPat == 0) { reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(1.0, 0.45, 0.32) * 0.08; } }`);
  };
  bodyMat.customProgramCacheKey = () => 'heroPBR2';

  // inked outline: back faces pushed out along the normal; zones choose thickness (0 = none)
  const outMat = new T.MeshBasicMaterial({ color: 0x16110e, side: T.BackSide });
  outMat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec4 aSurf;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      'vec3 transformed = aSurf.w > 0.01 ? position + normal * 0.0058 * aSurf.w : vec3(0.0);');
  };
  outMat.customProgramCacheKey = () => 'heroOutline2';
  VR.heroMaterials = { bodyMat, outMat };

  // ------------------------------------------------------------ skeleton
  const SW = 0.205, HW = 0.095;
  const LAYOUT = [
    ['hips', null, 0, D.hipY, 0], ['spine', 'hips', 0, D.spine, 0], ['chest', 'spine', 0, D.chest - 0.07, 0],
    ['neck', 'chest', 0, D.neck, 0], ['head', 'neck', 0, D.headY, 0],
    ['armL', 'chest', -SW, D.shoulderY, 0], ['foreL', 'armL', 0, -D.upper, 0], ['handL', 'foreL', 0, -D.fore, 0],
    ['armR', 'chest', SW, D.shoulderY, 0], ['foreR', 'armR', 0, -D.upper, 0], ['handR', 'foreR', 0, -D.fore, 0],
    ['thighL', 'hips', -HW, -0.02, 0], ['shinL', 'thighL', 0, -D.thigh, 0], ['footL', 'shinL', 0, -D.shin, 0],
    ['thighR', 'hips', HW, -0.02, 0], ['shinR', 'thighR', 0, -D.thigh, 0], ['footR', 'shinR', 0, -D.shin, 0],
  ];
  // rest-pose world heights (root at the origin)
  const Y = { hips: 0.8, spine: 0.87, chest: 1.0, neck: 1.25, head: 1.35, arm: 1.19, fore: 0.94, hand: 0.715, thigh: 0.78, shin: 0.42, foot: 0.07 };

  // ------------------------------------------------------------ builder
  const RES = 0.7;
  const _a = new T.Vector3(), _b = new T.Vector3(), _d = new T.Vector3(), _e = new T.Vector3();
  const mixW = (a, b, t) => { const o = {}; for (const k in a) o[k] = (o[k] || 0) + a[k] * (1 - t); for (const k in b) o[k] = (o[k] || 0) + b[k] * t; return o; };

  class SB {
    constructor(names) {
      this.bi = {}; names.forEach((n, i) => (this.bi[n] = i));
      this.pos = []; this.nor = []; this.uv = []; this.col = []; this.surf = []; this.si = []; this.sw = []; this.idx = []; this.n = 0;
    }
    weights(w) {
      const e = Object.entries(w).filter(([, v]) => v > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
      let s = 0; for (const [, v] of e) s += v;
      const I = [0, 0, 0, 0], W = [0, 0, 0, 0];
      e.forEach(([k, v], i) => { const b = this.bi[k]; if (b === undefined) throw new Error('no bone ' + k); I[i] = b; W[i] = v / s; });
      return [I, W];
    }
    // a surface from fn(u,v) -> { p, c (centre hint for the outside), w (bone weights), m?, col? }
    grid(fn, o) {
      // global level of detail: most surfaces are generated finer than they need to be
      const R = o.res ?? RES, nu = Math.max(3, Math.round(o.nu * R)), nv = Math.max(2, Math.round(o.nv * R)), u0 = o.u0 ?? 0, u1 = o.u1 ?? TAU, v0 = o.v0 ?? 0, v1 = o.v1 ?? 1;
      const eu = (u1 - u0) * 1e-3, ev = (v1 - v0) * 1e-3;
      const verts = [];
      let orient = 0;
      for (let j = 0; j <= nv; j++) {
        const v = v0 + (v1 - v0) * j / nv;
        for (let i = 0; i <= nu; i++) {
          const u = u0 + (u1 - u0) * i / nu;
          const s = fn(u, v);
          let n = s.n ? s.n.clone() : null;
          if (!n) {
            // (fresh vectors: fn may itself evaluate normals of an underlying surface)
            const pa = fn(u + eu, v).p, pb = fn(u - eu, v).p, pc = fn(u, Math.min(v1, v + ev)).p, pd = fn(u, Math.max(v0, v - ev)).p;
            const du = pa.clone().sub(pb), dv = pc.clone().sub(pd);
            n = new T.Vector3().crossVectors(du, dv);
            if (n.lengthSq() < 1e-26) n.copy(s.p).sub(s.c || V(0, s.p.y, 0));
            n.normalize();
          }
          if (s.c) orient += Math.sign(s.p.clone().sub(s.c).dot(n));
          verts.push([s, n, i, j, u, v]);
        }
      }
      const flip = (orient < 0) !== !!o.inside;
      const base = this.n, row = nu + 1;
      for (const [s, n, i, j, u, v] of verts) {
        if (flip) n.negate();
        const c = s.col || (typeof o.col === 'function' ? o.col(u, v, s.p, s) : o.col);
        const m = s.m || (o.matFn ? o.matFn(u, v) : o.mat);
        const [I, W] = this.weights(s.w || o.w);
        this.pos.push(s.p.x, s.p.y, s.p.z); this.nor.push(n.x, n.y, n.z);
        this.uv.push(o.uvAbs ? u : i / nu, o.uvAbs ? v : j / nv);
        this.col.push(c.r, c.g, c.b); this.surf.push(m[0], m[1], m[2], m[3] * (o.out ?? 1));
        this.si.push(...I); this.sw.push(...W);
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = base + j * row + i, b = a + 1, c = a + row + 1, d = a + row;
        if (flip) this.idx.push(a, d, b, b, d, c); else this.idx.push(a, b, d, b, c, d);
      }
      this.n += verts.length;
      return this;
    }
    geometry() {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
      g.setAttribute('aUv', new T.Float32BufferAttribute(this.uv, 2));
      g.setAttribute('aSurf', new T.Float32BufferAttribute(this.surf, 4));
      g.setAttribute('skinIndex', new T.Uint16BufferAttribute(this.si, 4));
      g.setAttribute('skinWeight', new T.Float32BufferAttribute(this.sw, 4));
      g.setIndex(this.n > 65535 ? new T.Uint32BufferAttribute(this.idx, 1) : new T.Uint16BufferAttribute(this.idx, 1));
      g.computeBoundingSphere();
      return g;
    }
  }

  // normal of a surface fn at (u,v)
  function nrm(fn, u, v, e = 1e-3) {
    const pa = fn(u + e, v).p, pb = fn(u - e, v).p, pc = fn(u, v + e).p, pd = fn(u, v - e).p;
    const n = new T.Vector3().crossVectors(pa.sub(pb), pc.sub(pd)).normalize();
    const s = fn(u, v);
    if (s.c && n.dot(s.p.clone().sub(s.c)) < 0) n.negate();
    return n;
  }
  // a raised panel on a surface: rounded edges melt into the garment (pockets, flaps, bibs, patches)
  function panel(sb, fn, u0, u1, v0, v1, o) {
    const h = o.h ?? 0.004, ed = o.edge ?? 0.2, shape = o.shape;
    return sb.grid((u, v) => {
      const s = fn(u, v), n = nrm(fn, u, v);
      const fu = Math.min(u - u0, u1 - u) / (u1 - u0), fv = Math.min(v - v0, v1 - v) / (v1 - v0);
      let e = sm(0, ed, Math.min(fu, fv));
      if (shape) e *= shape((u - u0) / (u1 - u0), (v - v0) / (v1 - v0));
      return { p: s.p.clone().addScaledVector(n, 0.0009 + h * e), c: s.c, w: s.w };
    }, { u0, u1, v0, v1, nu: o.nu || 8, nv: o.nv || 8, col: o.col, mat: o.mat, out: o.out ?? 0 });
  }
  // a swept tube: path(t) -> { p, up, w }, section(t, a) -> [x, y]  (x across, y along `up`)
  function sweep(sb, path, section, o) {
    const e = 1e-3;
    return sb.grid((a, t) => {
      const s = path(t);
      const pn = path(Math.min(1, t + e)).p, pp = path(Math.max(0, t - e)).p, tan = pn.clone().sub(pp).normalize();
      const up = s.up.clone().addScaledVector(tan, -s.up.dot(tan)).normalize();
      const bi = new T.Vector3().crossVectors(tan, up);
      const [x, y] = section(t, a);
      return { p: s.p.clone().addScaledVector(bi, x).addScaledVector(up, y), c: s.p, w: s.w, col: s.col, m: s.m };
    }, { u0: 0, u1: TAU, v0: 0, v1: 1, nu: o.na || 10, nv: o.nt || 12, col: o.col, mat: o.mat, out: o.out ?? 1, w: o.w });
  }
  // round (optionally flattened) cross-section with tapering; caps close the ends
  const roundSec = (rFn, flat = 1, cap = true) => (t, a) => {
    let r = rFn(t);
    if (cap) r *= Math.sqrt(Math.max(0, Math.min(1, t / 0.06))) * Math.sqrt(Math.max(0, Math.min(1, (1 - t) / 0.06))) || 1e-4;
    return [Math.cos(a) * r, Math.sin(a) * r * flat];
  };
  // a line laid on a surface (seams, piping, laces, straps): uv path over the surface fn
  function onLine(sb, fn, uvAt, o) {
    const off = o.off ?? 0.0015;
    return sweep(sb, (t) => {
      const [u, v] = uvAt(t), s = fn(u, v), n = nrm(fn, u, v);
      return { p: s.p.clone().addScaledVector(n, off + (o.r || 0.002) * (o.flat ?? 1)), up: n, w: s.w };
    }, roundSec(() => o.r || 0.002, o.flat ?? 1, o.cap ?? true), { na: o.na || 6, nt: o.nt || 16, col: o.col, mat: o.mat, out: o.out ?? 0 });
  }
  // unit direction for sphere-like surfaces (u = 0 faces front / -Z, v = 0 is the top)
  const sph = (u, v) => V(Math.sin(v) * Math.sin(u), Math.cos(v), -Math.sin(v) * Math.cos(u));
  function ellipsoid(sb, c, r, o) {
    const rot = o.rot || null;
    return sb.grid((u, v) => {
      const d = sph(u, v), q = V(d.x * r[0], d.y * r[1], d.z * r[2]);
      if (o.disp) q.multiplyScalar(1 + o.disp(d));
      if (rot) q.applyQuaternion(rot);
      return { p: q.add(c), c, w: o.w };
    }, { nu: o.nu || 16, nv: o.nv || 10, v0: o.v0 ?? 0.0001, v1: o.v1 ?? Math.PI - 0.0001, col: o.col, mat: o.mat, out: o.out ?? 1, w: o.w });
  }
  const quat = (x, y, z) => new T.Quaternion().setFromEuler(new T.Euler(x, y, z, 'YXZ'));

  // ------------------------------------------------------------ weights
  const side = (x) => (x < 0 ? 'L' : 'R');
  function armW(s, y) {
    const arm = 'arm' + s, fore = 'fore' + s, hand = 'hand' + s;
    if (y > 1.08) return mixW({ [arm]: 1 }, { chest: 1 }, sm(1.15, 1.27, y) * 0.55);
    if (y > 0.83) return mixW({ [arm]: 1 }, { [fore]: 1 }, sm(0.975, 0.905, y));
    return mixW({ [fore]: 1 }, { [hand]: 1 }, sm(0.75, 0.705, y));
  }
  function legW(s, y) {
    const th = 'thigh' + s, sh = 'shin' + s, ft = 'foot' + s;
    if (y > 0.6) return mixW({ [th]: 1 }, { hips: 1 }, sm(0.79, 0.9, y) * 0.55);
    if (y > 0.2) return mixW({ [th]: 1 }, { [sh]: 1 }, sm(0.465, 0.375, y));
    return mixW({ [sh]: 1 }, { [ft]: 1 }, sm(0.115, 0.05, y));
  }
  function torsoW(x, y) {
    let w;
    if (y < 0.84) w = { hips: 1 };
    else if (y < 0.93) w = mixW({ hips: 1 }, { spine: 1 }, sm(0.84, 0.93, y));
    else if (y < 1.04) w = mixW({ spine: 1 }, { chest: 1 }, sm(0.93, 1.04, y));
    else w = mixW({ chest: 1 }, { neck: 1 }, sm(1.24, 1.31, y) * 0.6);
    const k = sm(0.115, 0.19, Math.abs(x)) * sm(1.08, 1.22, y) * 0.5;
    return k > 0 ? mixW(w, { ['arm' + side(x)]: 1 }, k) : w;
  }
  const neckW = (y) => (y < 1.3 ? mixW({ chest: 1 }, { neck: 1 }, sm(1.2, 1.3, y)) : mixW({ neck: 1 }, { head: 1 }, sm(1.33, 1.42, y)));

  // ------------------------------------------------------------ body surfaces
  // torso-like ring surface from a profile spline of [rx, rz, frontBulge, backFlat] over y in [yb, yt]
  function ringFn(prof, yb, yt, wFn, o = {}) {
    const S = spline(prof), cx = o.cx || 0, cz = o.cz || 0;
    return (u, v) => {
      const y = lerp(yb, yt, v);
      const k = S(v), rx = k[0], rz = k[1], fb = k[2] || 0, bb = k[3] || 0;
      const su = Math.sin(u), cu = Math.cos(u);
      let r = 1 + (o.mod ? o.mod(u, v, y) : 0);
      const z = cu > 0 ? -cu * rz * (1 + fb * cu) : -cu * rz * (1 - bb * -cu);
      const p = V(cx + su * rx * r, y, cz + z * r);
      return { p, c: V(cx, y, cz), w: wFn(p.x, y) };
    };
  }
  // vertical limb along a bone chain: radius profile spline over y in [y0 (top), y1 (bottom)]
  function limbFn(cx, cz, y0, y1, prof, wFn, o = {}) {
    const S = spline(prof), ex = o.ex || 1, ez = o.ez || 1;
    return (u, v) => {
      const y = lerp(y0, y1, v), r = S(v)[0] * (1 + (o.mod ? o.mod(u, v, y) : 0));
      const p = V(cx + Math.sin(u) * r * ex, y, cz - Math.cos(u) * r * ez);
      return { p, c: V(cx, y, cz), w: wFn(y) };
    };
  }
  // an open tube's rolled hem: a small torus-ish lip at height y around a limb fn
  function hem(sb, fn, v, o) {
    return sweep(sb, (t) => {
      const u = t * TAU, s = fn(u, v), n = nrm(fn, u, v);
      return { p: s.p.clone().addScaledVector(n, (o.r || 0.004) * 0.6), up: n, w: s.w };
    }, (t, a) => [Math.cos(a) * (o.h || o.r || 0.004), Math.sin(a) * (o.r || 0.004)], { na: 8, nt: o.nt || 28, col: o.col, mat: o.mat, out: o.out ?? 1 });
  }

  // ------------------------------------------------------------ head
  const HC = V(0, 1.47, 0), HR = [0.19, 0.21, 0.197];
  const g3 = (ax, y, z, cx, cy, cz, s) => Math.exp(-((ax - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) / (s * s));
  function headShape(d, F) {
    const ax = Math.abs(d.x), y = d.y, fz = -d.z, front = sm(0.1, 0.5, fz);
    let a = 0;
    a += g3(ax, y, fz, 0.55, -0.22, 0.76, 0.28) * 0.026 * (F.cheek ?? 1);                // cheeks
    a += g3(ax, y, fz, 0.3, 0.3, 0.9, 0.2) * 0.022;                                       // brow ridge
    a -= g3(ax, y, fz, 0.34, 0.07, 0.93, 0.16) * 0.05;                                    // eye sockets
    a += g3(ax, y, fz, 0, -0.1, 1.0, 0.09) * 0.16 * (F.nose ?? 1);                        // nose tip
    a += g3(ax, y, fz, 0, 0.04, 1.0, 0.07) * 0.045 * (F.nose ?? 1);                       // bridge
    a += g3(ax, y, fz, 0.09, -0.15, 0.99, 0.06) * 0.05 * (F.nose ?? 1);                   // nostril wings
    a += Math.exp(-((ax / 0.16) ** 2) - (((y + 0.46) / 0.045) ** 2)) * 0.008 * front;       // soft lower lip
    a -= Math.exp(-((ax / 0.24) ** 2) - (((y + 0.4 - ax * ax * 1.2) / 0.03) ** 2)) * 0.018 * front;   // mouth crease (smiling)
    a += g3(ax, y, fz, 0, -0.74, 0.66, 0.22) * 0.05 * (F.chin ?? 1);                      // chin
    a -= g3(ax, y, fz, 0.82, 0.24, 0.4, 0.3) * 0.025;                                     // temples
    return a;
  }
  function headPoint(d, F) {
    const fz = -d.z;
    const jaw = 1 - (F.jaw ?? 0.26) * sm(0.0, -0.95, d.y) * (0.55 + 0.45 * sm(-0.2, 1, fz));
    const back = d.z > 0 ? 1 + 0.05 * sm(0, 1, d.z) * sm(-0.6, 0.2, d.y) : 1;
    const q = V(d.x * HR[0] * jaw, d.y * HR[1], d.z * HR[2] * back);
    return q.multiplyScalar(1 + headShape(d, F)).add(HC);
  }
  // point on (or above) the head: yaw (+ = right), pitch (+ = up), lift in metres along the surface normal
  function onHead(F, yaw, pitch, lift = 0) {
    const d = V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const p = headPoint(d, F), n = p.clone().sub(HC).normalize();
    return { p: p.addScaledVector(n, lift), n };
  }
  function buildHead(sb, K) {
    const F = K.face, skin = col(K.skin);
    const lip = cmix(skin, col(F.lip || 0xc0605a), 0.55), blush = col(F.blush || 0xe8837a), crease = cmix(skin, col(0x5a2a22), 0.6);
    sb.grid((u, v) => ({ p: headPoint(sph(u, v), F), c: HC, w: { head: 1 } }), {
      nu: 52, nv: 42, res: 0.85, v0: 0.0005, v1: Math.PI - 0.0005, mat: M.skin,
      col: (u, v) => {
        const d = sph(u, v), ax = Math.abs(d.x), y = d.y, fz = -d.z;
        let c = skin.clone();
        c.lerp(blush, g3(ax, y, fz, 0.58, -0.22, 0.72, 0.22) * (F.blushK ?? 0.35));
        c.lerp(lip, Math.exp(-((ax / 0.13) ** 2) - (((y + 0.44) / 0.045) ** 2)) * sm(0.3, 0.6, fz) * 0.8);
        c.multiplyScalar(1 - g3(ax, y, fz, 0.05, -0.19, 0.98, 0.05) * 0.18);                 // under the nose
        c.lerp(crease, Math.exp(-((ax / 0.16) ** 2) - (((y + 0.4 - ax * ax * 1.2) / 0.016) ** 2)) * sm(0.3, 0.6, fz) * 0.45);
        c.multiplyScalar(1 - g3(ax, y, fz, 0.34, 0.05, 0.93, 0.13) * 0.14);      // socket shadow
        c.multiplyScalar(1 - sm(-0.55, -0.95, y) * 0.12);                          // under the jaw
        return c;
      },
    });
    // neck
    const nk = limbFn(0, 0.012, 1.44, 1.2, [[0.05], [0.048], [0.05], [0.058]], (x, y) => neckW(y));
    sb.grid((u, v) => { const s = nk(u, v); s.w = neckW(s.p.y); return s; }, { nu: 20, nv: 8, mat: M.skin, col: (u, v) => skin.clone().multiplyScalar(0.86 + 0.14 * v) });
    // ears: shell with a curled rim and a hollow
    for (const s of [-1, 1]) {
      const c = V(s * 0.184, 1.455, 0.02), rot = quat(0, s * 0.18, s * -0.1);
      ellipsoid(sb, c, [0.022, 0.058, 0.042], { rot, w: { head: 1 }, nu: 18, nv: 12, mat: M.skin, col: skin,
        disp: (d) => -0.45 * sm(0.2, 0.9, d.x * s) * sm(0.85, 0.2, Math.hypot(d.y, d.z)) });
      sweep(sb, (t) => {
        const a = -1.2 + t * 3.6, p = V(0, Math.sin(a) * 0.052, -Math.cos(a) * 0.037).applyQuaternion(rot).add(c);
        return { p: p.add(V(s * 0.012, 0, 0)), up: V(s, 0, 0), w: { head: 1 } };
      }, roundSec(() => 0.007, 1), { na: 6, nt: 16, col: cmix(skin, col(0xd88870), 0.15), mat: M.skin, out: 0.6 });
    }
    // eyes
    const iris = col(F.eye), gaze0 = V(0, 0.02, -1);
    for (const s of [-1, 1]) {
      const yaw = s * 0.35, pitch = 0.07;
      const sp = onHead(F, yaw, pitch, 0);
      const er = F.eyeR || 0.049;
      const c = sp.p.clone().addScaledVector(sp.n, -er * 0.52);
      const ez = sp.n.clone().multiplyScalar(0.3).add(gaze0).normalize();
      const ey = V(0, 1, 0).addScaledVector(ez, -ez.y).normalize();          // up, across the eye
      const ex = new T.Vector3().crossVectors(ey, ez).normalize();
      if (ex.x * s < 0) ex.negate();                                         // ex points to the outer corner
      const eyeDir = (h, e) => ez.clone().multiplyScalar(Math.cos(e) * Math.cos(h)).addScaledVector(ex, Math.cos(e) * Math.sin(h)).addScaledVector(ey, Math.sin(e));
      const uv0 = sb.uv.length;
      sb.grid((u, v) => {
        const d = ez.clone().multiplyScalar(Math.cos(v)).addScaledVector(ex, Math.sin(v) * Math.cos(u)).addScaledVector(ey, Math.sin(v) * Math.sin(u));
        return { p: c.clone().addScaledVector(d, er), c, w: { head: 1 } };
      }, { nu: 24, nv: 14, res: 1, v0: 0.0005, v1: Math.PI * 0.75, mat: M.eye, col: iris, uvAbs: true, out: 0 });
      // correct the eye uv: u around (0..1), v = angle from the pupil / PI
      for (let k = uv0; k < sb.uv.length; k += 2) { sb.uv[k] /= TAU; sb.uv[k + 1] /= Math.PI; }
      // lids: skin shells slightly larger than the eyeball
      const up0 = F.lidUp ?? 0.5, lo0 = F.lidLo ?? -0.7;
      sb.grid((h, e) => ({ p: c.clone().addScaledVector(eyeDir(h, e), er * 1.07), c, w: { head: 1 } }),
        { u0: -1.35, u1: 1.35, v0: up0, v1: 1.5, nu: 18, nv: 7, mat: M.skin, out: 0, col: (h, e) => skin.clone().multiplyScalar(0.9 + 0.1 * sm(up0, up0 + 0.4, e)) });
      sb.grid((h, e) => ({ p: c.clone().addScaledVector(eyeDir(h, e), er * 1.05), c, w: { head: 1 } }),
        { u0: -1.3, u1: 1.3, v0: -1.4, v1: lo0 + 0.05 * 0, nu: 18, nv: 6, mat: M.skin, out: 0, col: skin });
      // lash line along the upper lid edge, flicking out at the outer corner
      sweep(sb, (t) => {
        const h = lerp(-1.1, 1.18, t), e = up0 + 0.02 + (t > 0.8 ? (t - 0.8) * 0.5 : 0);
        return { p: c.clone().addScaledVector(eyeDir(h, e), er * 1.1), up: eyeDir(h, e), w: { head: 1 } };
      }, roundSec((t) => 0.0048 * (0.6 + 0.4 * Math.sin(t * Math.PI)) + (t > 0.85 ? 0.002 : 0), 0.7), { na: 6, nt: 18, col: col(0x1a1411), mat: M.detail, out: 0 });
      // lower lid rim
      sweep(sb, (t) => {
        const h = lerp(-0.9, 1.0, t);
        return { p: c.clone().addScaledVector(eyeDir(h, lo0), er * 1.07), up: eyeDir(h, lo0), w: { head: 1 } };
      }, roundSec(() => 0.0028, 0.8), { na: 5, nt: 12, col: cmix(skin, col(0x9a5a4a), 0.35), mat: M.skin, out: 0 });
      // catch-lights
      for (const [hh, ee, rr] of [[0.28 * s * 0 + 0.3, 0.32, 0.0075], [-0.25, -0.2, 0.0035]]) {
        const p = c.clone().addScaledVector(eyeDir(hh, ee), er * 1.01);
        ellipsoid(sb, p, [rr, rr, rr], { w: { head: 1 }, nu: 8, nv: 5, mat: M.glow, col: col(0xffffff), out: 0 });
      }
      // brow: tapered, curved stroke of hair on the brow ridge
      const bt = F.browTilt ?? 0;
      sweep(sb, (t) => {
        const yw = s * lerp(0.13, 0.6, t), pt = 0.38 + Math.sin(t * Math.PI * 0.9) * 0.075 - (1 - t) * bt + t * bt * 0.3;
        const q = onHead(F, yw, pt, 0.007);
        return { p: q.p, up: q.n, w: { head: 1 } };
      }, roundSec((t) => lerp(0.012, 0.0045, t) * (0.75 + 0.25 * Math.sin(t * Math.PI + 0.4)) * (F.browW || 1), 0.38), { na: 8, nt: 14, col: col(F.brow), mat: M.hair, out: 0.35 });
    }
    // mouth line (a soft smile)
    const smile = F.smile ?? 0.05;
    sweep(sb, (t) => {
      const x = lerp(-1, 1, t), q = onHead(F, x * 0.25, -0.4 + x * x * (smile + 0.03), 0.0008);
      return { p: q.p, up: q.n, w: { head: 1 } };
    }, roundSec((t) => 0.0044 * (0.3 + 0.7 * Math.sin(t * Math.PI)), 0.55), { na: 6, nt: 18, col: col(0x4a1a14), mat: M.detail, out: 0 });
    return F;
  }

  // hair: a scalp shell with a shaped hairline + swept clumps
  function hairCap(sb, F, o) {
    const hc = col(o.col), dark = hc.clone().multiplyScalar(0.72);
    sb.grid((u, t) => {
      const lim = o.line(u);
      const v = 0.0005 + t * lim, d = sph(u, v);
      const base = headPoint(d, F), n = base.clone().sub(HC).normalize();
      const edge = sm(1, 0.82, t);
      return { p: base.addScaledVector(n, 0.0015 + (o.thick || 0.012) * edge), c: HC, w: { head: 1 } };
    }, { nu: 48, nv: 16, mat: M.hair, col: (u, t) => cmix(hc, dark, sm(0.7, 1, t) * 0.8), out: 1 });
  }
  // clump from a root direction (yaw, pitch) flowing to a tip, arched off the scalp
  function clump(sb, F, o) {
    const hc = col(o.col), tip = col(o.tip ?? o.col), root = hc.clone().multiplyScalar(0.78);
    const P = spline(o.pts);           // [yaw, pitch, lift]
    sweep(sb, (t) => {
      const [yw, pt, lf] = P(t), q = onHead(F, yw, pt, lf);
      return { p: q.p, up: q.n, w: o.w ? o.w(t) : { head: 1 }, col: t < 0.4 ? cmix(root, hc, t / 0.4) : cmix(hc, tip, (t - 0.4) / 0.6) };
    }, (t, a) => {
      const k = Math.max(0.18, Math.pow(Math.max(0, 1 - t), o.taper ?? 0.7)) * Math.min(1, t / 0.08 + 0.35);
      return [Math.cos(a) * o.w0 * k, Math.sin(a) * o.t0 * k];
    }, { na: o.na || 8, nt: o.nt || 10, mat: M.hair, out: 0.7 });
  }

  // ------------------------------------------------------------ hands & feet
  // a relaxed running fist: palm, four curled fingers with knuckles, thumb over the index
  function fist(sb, s, colHex, mat) {
    const S = s < 0 ? 'L' : 'R', c0 = V(s * SW, Y.hand, 0), cc = col(colHex);
    const hw = { ['hand' + S]: 1 };
    const w = (y) => (y > 0.7 ? mixW(hw, { ['fore' + S]: 1 }, sm(0.7, 0.735, y) * 0.5) : hw);
    // palm block (rounded)
    ellipsoid(sb, c0.clone().add(V(s * 0.004, -0.045, -0.004)), [0.03, 0.05, 0.042], { w: hw, nu: 14, nv: 9, mat, col: cc });
    // fingers: curled arcs from the knuckle line into the palm
    for (let i = 0; i < 4; i++) {
      const z = -0.03 + i * 0.02, len = [0.9, 1, 0.95, 0.8][i];
      sweep(sb, (t) => {
        const a = t * 2.6 * len;
        const p = c0.clone().add(V(s * (-0.006 - Math.sin(a) * 0.02), -0.078 - Math.sin(Math.min(a, 1.6)) * 0.018 + (a > 1.6 ? (a - 1.6) * 0.015 : 0), z));
        return { p, up: V(s, 0, 0), w: hw };
      }, roundSec((t) => 0.0098 * (1 - t * 0.2), 1), { na: 6, nt: 7, mat, col: cc.clone().multiplyScalar(1 - i * 0.02), out: 0.8 });
    }
    // thumb lying across the curled fingers
    sweep(sb, (t) => ({ p: c0.clone().add(V(s * lerp(-0.018, -0.03, t), lerp(-0.035, -0.07, t), lerp(-0.035, -0.012, t))), up: V(0, 0, -1), w: hw }),
      roundSec((t) => 0.011 * (1 - t * 0.2), 0.9), { na: 8, nt: 10, mat, col: cc, out: 0.8 });
    // wrist
    const lf = limbFn(s * SW, 0, 0.745, 0.69, [[0.031], [0.029], [0.03]], w);
    sb.grid(lf, { nu: 14, nv: 4, mat, col: cc });
  }

  // shoe along the foot: heel (z=+0.07) to toe (z=-0.19); zones: upper, collar, toe cap, midsole, outsole
  function shoe(sb, s, o) {
    const S = s < 0 ? 'L' : 'R', fx = s * HW, fy = Y.foot - D.ankle, w = { ['foot' + S]: 1 };
    const L = spline(o.prof || [[0.035, 0.055], [0.05, 0.075], [0.056, 0.08], [0.058, 0.075], [0.06, 0.062], [0.057, 0.05], [0.045, 0.036], [0.02, 0.022]]);  // [halfWidth, height]
    const z0 = 0.075, z1 = -0.19;
    const shape = (t, a, grow = 0, lift = 0) => {
      const [hw, hh] = L(t), ca = Math.cos(a), sa = Math.sin(a);
      const x = fx + s * 0.006 * t + Math.sign(ca) * Math.pow(Math.abs(ca), 0.8) * (hw + grow);
      const y = fy + lift + (sa >= 0 ? Math.pow(sa, 0.9) * (hh + grow) : sa * 0.004);
      return V(x, y, lerp(z0, z1, t));
    };
    const cap = (t) => Math.sqrt(Math.max(0, Math.min(1, t / 0.07))) * Math.sqrt(Math.max(0, Math.min(1, (1 - t) / 0.07)));
    // upper
    sb.grid((a, t) => {
      const k = cap(t), p = shape(t, a, 0, o.sole ?? 0.024), c = V(fx, fy + 0.04, lerp(z0, z1, t));
      return { p: c.clone().lerp(p, Math.max(k, 0.0001)), c, w };
    }, { u0: 0, u1: Math.PI, v0: 0, v1: 1, nu: 12, nv: 16, mat: o.upperMat, col: (a, t) => {
      const cz = o.toeCol && t > 0.78 ? col(o.toeCol) : col(o.upper);
      return cz.multiplyScalar(0.9 + 0.1 * Math.sin(a));
    } });
    // midsole + outsole (full loop, flat bottom)
    const sole = (grow, h0, h1, colHex, mat, pat) => sb.grid((a, t) => {
      const k = cap(t), ca = Math.cos(a), sa = Math.sin(a);
      const [hw] = L(t);
      const c = V(fx + s * 0.006 * t, fy + (h0 + h1) / 2, lerp(z0 + 0.004, z1 - 0.006, t));
      const p = V(c.x + Math.sign(ca) * Math.pow(Math.abs(ca), 0.35) * (hw + grow), c.y + Math.sign(sa) * Math.pow(Math.abs(sa), 0.35) * (h1 - h0) / 2, c.z);
      return { p: c.clone().lerp(p, Math.max(k, 0.0001)), c, w };
    }, { nu: 16, nv: 14, mat, col: col(colHex), out: 1 });
    sole(0.006, 0.0, 0.01, o.outsole, M.rubber);
    sole(0.004, 0.009, o.sole ?? 0.024, o.midsole, o.midMat || M.rubber);
    // collar padding around the ankle opening
    sweep(sb, (t) => {
      const a = t * TAU, p = V(fx + Math.sin(a) * 0.05, fy + 0.095 + Math.cos(a) * 0.012 + (Math.cos(a) > 0 ? 0 : 0.01), 0.01 + Math.cos(a) * 0.045);
      return { p, up: V(Math.sin(a), 0.2, Math.cos(a)).normalize(), w: mixW(w, { ['shin' + S]: 1 }, 0.3) };
    }, (t, a) => [Math.cos(a) * 0.009, Math.sin(a) * 0.011], { na: 8, nt: 24, col: col(o.collar || o.upper), mat: o.collarMat || o.upperMat, out: 1 });
    // tongue
    sb.grid((a, t) => {
      const p = V(fx + Math.sin(a - Math.PI / 2) * 0.03, fy + lerp(0.1, 0.075, t) + Math.cos(a - Math.PI / 2) * 0.006, lerp(-0.015, -0.085, t));
      return { p, c: V(fx, fy + 0.05, p.z), w };
    }, { u0: 0, u1: Math.PI, nu: 8, nv: 6, mat: o.upperMat, col: col(o.tongue || o.upper) });
    // laces crossing over the tongue, with eyelets
    for (let i = 0; i < (o.laces ?? 4); i++) {
      const z = -0.025 - i * 0.018, y = fy + 0.092 - i * 0.006;
      sweep(sb, (t) => ({ p: V(fx + lerp(-0.026, 0.026, t), y + Math.sin(t * Math.PI) * 0.005, z), up: V(0, 1, 0.3), w }),
        roundSec(() => 0.0032, 0.6), { na: 6, nt: 8, col: col(o.lace), mat: M.cotton, out: 0.4 });
      for (const e of [-1, 1]) ellipsoid(sb, V(fx + e * 0.03, y - 0.002, z), [0.0045, 0.0045, 0.0045], { w, nu: 6, nv: 4, mat: M.metal, col: col(o.eyelet || 0xb8bec8), out: 0 });
    }
    // side accent (swept stripe along the upper)
    if (o.stripe) for (const e of [-1, 1]) {
      sweep(sb, (t) => {
        const a = e > 0 ? 0.45 : Math.PI - 0.45, p = shape(lerp(0.25, 0.72, t), a, 0.0025, (o.sole ?? 0.024) + Math.sin(t * Math.PI) * 0.018);
        return { p, up: V(e * 1, 0.3, 0).normalize(), w };
      }, (t, a) => [Math.cos(a) * 0.004 * (1 - t * 0.6), Math.sin(a) * 0.0015], { na: 6, nt: 12, col: col(o.stripe), mat: M.plastic, out: 0 });
    }
    // heel tab
    sb.grid((a, t) => {
      const p = V(fx + Math.sin(a) * 0.012, fy + lerp(0.055, 0.11, t), z0 + 0.004 + Math.cos(a) * 0.004);
      return { p, c: V(fx, p.y, z0), w };
    }, { nu: 8, nv: 4, mat: o.tabMat || M.plastic, col: col(o.tab || o.collar || o.upper) });
  }

  // ------------------------------------------------------------ bone chains (cloth ribbons, pack)
  function chain(root, parentName, B, names, pos, rx0, ry0, seg) {
    const bones = [];
    let parent = B[parentName];
    names.forEach((n, i) => {
      const b = new T.Bone(); b.name = n;
      if (i === 0) { b.position.copy(pos); b.rotation.set(rx0, ry0, 0); }
      else { b.position.set(0, seg, 0); b.rotation.set(0.1, 0, 0); }
      b.userData.rx0 = b.rotation.x;
      parent.add(b); B[n] = b; bones.push(b); parent = b;
    });
    return bones;
  }
  function ribbonMesh(sb, bones, names, seg, width, thick, colHex, mat) {
    const pts = bones.map(b => b.getWorldPosition(new T.Vector3()));
    const tipB = bones[bones.length - 1], tip = V(0, seg, 0); tipB.localToWorld(tip); pts.push(tip);
    const P = spline(pts.map(p => [p.x, p.y, p.z]));
    const nB = bones.length;
    sweep(sb, (t) => {
      const q = P(t), f = t * nB, i = Math.min(nB - 1, Math.floor(f)), fr = f - i;
      const w = {};
      w[names[i]] = 1 - (fr > 0.75 && i < nB - 1 ? (fr - 0.75) * 2 : 0);
      if (fr > 0.75 && i < nB - 1) w[names[i + 1]] = (fr - 0.75) * 2;
      if (fr < 0.25 && i > 0) { w[names[i]] = 0.5 + fr * 2; w[names[i - 1]] = 0.5 - fr * 2; }
      return { p: V(q[0], q[1], q[2]), up: V(0, 0, 1), w };
    }, (t, a) => [Math.cos(a) * width * (1 - t * 0.25), Math.sin(a) * thick], { na: 8, nt: 6 * nB, col: col(colHex), mat, out: 0.7 });
  }

  // ------------------------------------------------------------ assembly
  const geoCache = {};
  function build(def) {
    const K = def.kid;
    const root = new T.Group(), B = {}, order = [];
    for (const [n, p, x, y, z] of LAYOUT) {
      const b = new T.Bone(); b.name = n; b.position.set(x, y, z);
      (p ? B[p] : root).add(b); B[n] = b; order.push(n);
    }
    // extra bones (cloth chains, backpack) described by the character
    const chains = [];
    if (K.chains) for (const c of K.chains) {
      const names = c.names;
      c.bones = chain(root, c.parent, B, names, c.pos, c.rx0, c.ry0 || 0, c.seg);
      order.push(...names); chains.push(c);
    }
    root.updateMatrixWorld(true);
    const bones = order.map(n => B[n]);

    let G = geoCache[def.id];
    if (!G) {
      const sb = new SB(order), gear = new SB(order);
      K.build(sb, gear, B);
      for (const c of chains) if (c.mesh) ribbonMesh(sb, c.bones, c.names, c.seg, c.width, c.thick, c.col, c.mat || M.satin);
      G = geoCache[def.id] = { body: sb.geometry(), gear: gear.n ? gear.geometry() : null };
    }
    const skeleton = new T.Skeleton(bones);
    const mk = (g, m, shadow) => {
      const mesh = new T.SkinnedMesh(g, m);
      mesh.frustumCulled = false; mesh.castShadow = shadow;
      root.add(mesh); mesh.bind(skeleton, new T.Matrix4());
      if (m === outMat) mesh.userData.outline = true;
      return mesh;
    };
    mk(G.body, bodyMat, true); mk(G.body, outMat, false);
    let backGear = null;
    if (G.gear) {
      backGear = new T.Group(); root.add(backGear);
      const a = mk(G.gear, bodyMat, true), b = mk(G.gear, outMat, false);
      root.remove(a); root.remove(b); backGear.add(a, b);
    }
    const soles = {};
    for (const s of ['L', 'R']) {
      const heel = new T.Object3D(); heel.position.set(0, -D.ankle, 0.06); B['foot' + s].add(heel);
      const toe = new T.Object3D(); toe.position.set(0, -D.ankle, -0.17); B['foot' + s].add(toe);
      soles[s] = { heel, toe };
    }
    const springs = chains.map(c => ({
      bones: c.bones, st: c.bones.map(() => ({ x: 0, z: 0, vx: 0, vz: 0 })),
      g: c.gains || c.bones.map((_, i) => 0.6 + i * 0.35), sx: c.sx ?? -1.35, sz: c.sz ?? 1, k: c.k || 120, d: c.d || 9,
      flutter: c.flutter ?? 0.12, dragK: c.dragK ?? 2.2, ay: c.ay || 0, rest: c.bones.map(b => b.rotation.x),
    }));
    return { root, bones: B, tuft: [], soles, def, scarf: null, springs, backGear, skinned: true };
  }

  // =================================================================== SHARED GARMENT PIECES
  // torso profiles: [rx, rz, frontBulge, backFlat] from y=0.8 (v=0) up to the collar
  const TORSO = [[0.152, 0.108, 0.05, 0.1], [0.143, 0.1, 0.05, 0.1], [0.139, 0.099, 0.1, 0.08], [0.146, 0.103, 0.14, 0.05], [0.156, 0.107, 0.16, 0.02],
    [0.163, 0.106, 0.14, 0.0], [0.168, 0.1, 0.08, 0.0], [0.162, 0.092, 0.02, 0.0], [0.118, 0.077, 0.0, 0.0], [0.062, 0.056, 0, 0]];
  const torsoFn = (prof = TORSO, yb = 0.8, yt = 1.285, mod) => ringFn(prof, yb, yt, torsoW, { mod });
  // pelvis: rounded under the crotch, legs come out below it
  const PELVIS = [[0.07, 0.05], [0.125, 0.09], [0.148, 0.104], [0.153, 0.108], [0.153, 0.108], [0.152, 0.108]];
  const pelvisFn = (prof = PELVIS) => ringFn(prof, 0.745, 0.9, (x, y) => (y > 0.86 ? mixW({ hips: 1 }, { spine: 1 }, sm(0.86, 0.9, y) * 0.3) : { hips: 1 }));
  const armFn = (s, y0, y1, prof, mod) => limbFn(s * SW, 0, y0, y1, prof, (y) => armW(s < 0 ? 'L' : 'R', y), { mod });
  const legFn = (s, y0, y1, prof, mod, o = {}) => limbFn(s * HW, o.cz || 0, y0, y1, prof, (y) => legW(s < 0 ? 'L' : 'R', y), { mod, ez: o.ez || 1 });
  // skin arm from y0 down to the wrist (biceps, elbow and forearm shaped)
  const ARM = (b) => [[0.05 * b], [0.048 * b], [0.05 * b], [0.047 * b], [0.04 * b], [0.042 * b], [0.04 * b], [0.034 * b], [0.03 * b]];
  const armProf = (y0, b) => { const all = ARM(b), from = Math.round((1.24 - y0) / (1.24 - 0.73) * (all.length - 1)); return all.slice(Math.max(0, from)); };
  // cross-section "fold" modulation for cloth near joints: soft ridges on the inside of the bend
  const folds = (n, amp, c0, c1, faceBack = false) => (u, v) => {
    const k = sm(c0, (c0 + c1) / 2, v) * sm(c1, (c0 + c1) / 2, v);
    const facing = faceBack ? Math.max(0, Math.cos(u - Math.PI)) : Math.max(0, Math.cos(u));
    return k * amp * (0.5 + 0.5 * facing) * Math.sin(v * n * Math.PI * 2 + u * 1.5);
  };

  // =================================================================== SCOUT
  const SC = { skin: 0xf2c39c, shirt: 0xcbb27b, shirtD: 0xa38b56, shorts: 0x6e6a3c, sock: 0x5c6a38, boot: 0x7b4a27, bootD: 0x4a2c17, hair: 0x6a3d1d, hat: 0xc79c5e, scarf: 0xe0602a, scarfB: 0xf3cf45, pack: 0x3d6a45, packD: 0x2a4a30, belt: 0x5a3417 };
  const scoutDef = {
    skin: SC.skin,
    face: { eye: 0x6a4424, brow: 0x5a3417, lip: 0xc56a5e, blush: 0xe8877a, blushK: 0.35, smile: 0.07, browTilt: -0.06, lidUp: 0.62, chin: 0.9, jaw: 0.28 },
    chains: [
      { names: ['packB'], parent: 'chest', pos: V(0, 0.16, 0.12), rx0: 0, seg: 0.1, sx: 0.5, gains: [0.35], dragK: 0, ay: 0.0016, k: 160, d: 10, flutter: 0 },
    ],
    build(sb, gear, B) {
      const K = scoutDef, F = buildHead(sb, K);
      // hair: short, side-swept fringe peeking out under the hat, full at the nape
      hairCap(sb, F, { col: SC.hair, thick: 0.01, line: (u) => { const c = Math.cos(u); return c > 0 ? lerp(1.28, 0.72, c) : lerp(1.28, 1.95, -c); } });
      const hc = SC.hair, tip = 0x8a5a30;
      // side-swept fringe: broad overlapping locks
      for (let i = 0; i < 7; i++) {
        const y0 = lerp(-0.7, 0.5, i / 6), dl = 0.1 + 0.05 * Math.sin(i * 2.1);
        clump(sb, F, { col: hc, tip, w0: 0.05, t0: 0.016, pts: [[y0, 0.86, 0.012], [y0 + 0.14, 0.66, 0.024], [y0 + 0.26, 0.5 - dl * 0.3, 0.016]], taper: 0.9 });
      }
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        const yw = s * (1.1 + i * 0.3);
        clump(sb, F, { col: hc, tip, w0: 0.045, t0: 0.016, pts: [[yw, 0.6, 0.012], [yw + s * 0.05, 0.3, 0.022], [yw + s * 0.08, 0.08, 0.012]] });
      }
      for (let i = 0; i < 5; i++) {
        const yw = Math.PI + lerp(-0.7, 0.7, i / 4);
        clump(sb, F, { col: hc, tip, w0: 0.05, t0: 0.016, pts: [[yw, 0.45, 0.014], [yw, 0.05, 0.022], [yw, -0.3, 0.012]] });
      }
      // campaign hat: wide brim with a slight roll, pinched crown, leather band, chin strap
      const hy = 1.61, hat = col(SC.hat);
      const brimR = (u) => 0.305 + 0.006 * Math.cos(u * 2);
      sb.grid((u, t) => {
        const r = lerp(0.16, brimR(u), t), roll = sm(0.8, 1, t) * 0.012 + Math.sin(u) ** 2 * 0.012 * t - Math.cos(u) * 0.012 * t;
        return { p: V(Math.sin(u) * r, hy + roll + (1 - t) * 0.0, -Math.cos(u) * r + 0.012), c: V(0, hy - 1, 0), w: { head: 1 } };
      }, { nu: 56, nv: 8, mat: M.suede, col: (u, t) => hat.clone().multiplyScalar(0.95 + 0.05 * t) });
      sb.grid((u, t) => {
        const r = lerp(0.16, brimR(u), t);
        return { p: V(Math.sin(u) * r, hy - 0.009 + Math.sin(u) ** 2 * 0.012 * t - Math.cos(u) * 0.012 * t + sm(0.8, 1, t) * 0.012, -Math.cos(u) * r + 0.012), c: V(0, hy + 1, 0), w: { head: 1 } };
      }, { nu: 56, nv: 8, mat: M.suede, col: hat.clone().multiplyScalar(0.62) });
      sweep(sb, (t) => { const u = t * TAU, r = brimR(u); return { p: V(Math.sin(u) * r, hy - 0.004 + Math.sin(u) ** 2 * 0.012 - Math.cos(u) * 0.012 + 0.012, -Math.cos(u) * r + 0.012), up: V(0, 1, 0), w: { head: 1 } }; },
        (t, a) => [Math.cos(a) * 0.0052, Math.sin(a) * 0.006], { na: 8, nt: 64, col: hat.clone().multiplyScalar(0.8), mat: M.suede });
      const crown = spline([[0.175, 0], [0.172, 0.04], [0.162, 0.08], [0.13, 0.12], [0.075, 0.142], [0.0, 0.136]]);
      sb.grid((u, t) => {
        const [r, y] = crown(t), pinch = 1 - 0.18 * Math.pow(Math.abs(Math.cos(u * 2)), 6) * sm(0.35, 0.9, t);
        return { p: V(Math.sin(u) * r * pinch, hy + y, -Math.cos(u) * r * pinch * 0.97 + 0.012), c: V(0, hy + 0.03, 0.012), w: { head: 1 } };
      }, { nu: 56, nv: 16, mat: M.suede, col: (u, t) => hat.clone().multiplyScalar(0.92 + 0.08 * t) });
      sweep(sb, (t) => { const u = t * TAU; return { p: V(Math.sin(u) * 0.176, hy + 0.022, -Math.cos(u) * 0.176 * 0.97 + 0.012), up: V(Math.sin(u), 0, -Math.cos(u)), w: { head: 1 } }; },
        (t, a) => [Math.cos(a) * 0.014, Math.sin(a) * 0.004], { na: 8, nt: 48, col: col(SC.belt), mat: M.leather });

      // --- shirt: khaki cotton, short sleeves with rolled cuffs
      const shirt = col(SC.shirt), shirtD = col(SC.shirtD);
      const tf = torsoFn(TORSO, 0.8, 1.285, folds(3, 0.012, 0.0, 0.35));
      sb.grid(tf, { nu: 40, nv: 22, mat: M.cotton, col: (u, v) => shirt.clone().multiplyScalar(1 - 0.12 * sm(0.25, 0, v) - 0.1 * Math.pow(Math.abs(Math.sin(u)), 6) * sm(0.5, 0.75, v)) });
      // placket, buttons, collar
      panel(sb, tf, -0.07, 0.07, 0.12, 0.9, { h: 0.004, nu: 4, nv: 16, col: shirt, mat: M.cotton });
      for (let i = 0; i < 5; i++) { const s = tf(0, lerp(0.2, 0.84, i / 4)), n = nrm(tf, 0, lerp(0.2, 0.84, i / 4)); ellipsoid(sb, s.p.addScaledVector(n, 0.006), [0.0075, 0.0075, 0.003], { rot: new T.Quaternion().setFromUnitVectors(V(0, 0, -1), n), w: s.w, nu: 10, nv: 5, mat: M.plastic, col: col(0x3d2b1c), out: 0 }); }
      for (const s of [-1, 1]) {
        // collar flap lying over the shoulders
        panel(sb, tf, s > 0 ? 0.05 : -0.95, s > 0 ? 0.95 : -0.05, 0.86, 1.0, { h: 0.008, edge: 0.3, nu: 10, nv: 6, col: shirt, mat: M.cotton, out: 1,
          shape: (a, b) => (s > 0 ? sm(0, 0.3, 1 - a + b * 0.3) : sm(0, 0.3, a + b * 0.3)) });
        // chest pocket + flap + button
        const u0 = s * 0.28, u1 = s * 0.62, lo = Math.min(u0, u1), hi = Math.max(u0, u1);
        panel(sb, tf, lo, hi, 0.5, 0.7, { h: 0.005, nu: 8, nv: 8, col: shirt.clone().multiplyScalar(0.97), mat: M.cotton, out: 0.6 });
        panel(sb, tf, lo - 0.01, hi + 0.01, 0.68, 0.76, { h: 0.009, nu: 8, nv: 4, col: shirt.clone().multiplyScalar(0.92), mat: M.cotton, out: 0.6, shape: (a, b) => sm(0, 0.4, b + 0.6 - Math.abs(a - 0.5)) });
        const bp = tf((u0 + u1) / 2, 0.69), bn = nrm(tf, (u0 + u1) / 2, 0.69);
        ellipsoid(sb, bp.p.addScaledVector(bn, 0.011), [0.006, 0.006, 0.0025], { rot: new T.Quaternion().setFromUnitVectors(V(0, 0, -1), bn), w: bp.w, nu: 8, nv: 4, mat: M.plastic, col: col(0x3d2b1c), out: 0 });
        onLine(sb, tf, (t) => [(u0 + u1) / 2, lerp(0.5, 0.67, t)], { r: 0.0012, col: shirtD, mat: M.cotton });
        // side seam
        onLine(sb, tf, (t) => [s * Math.PI / 2, lerp(0.05, 0.72, t)], { r: 0.0014, col: shirtD, mat: M.cotton });
        // epaulet from collar to shoulder
        const eu = s * Math.PI / 2;
        panel(sb, tf, Math.min(eu * 0.55, eu * 1.1), Math.max(eu * 0.55, eu * 1.1), 0.84, 0.92, { h: 0.005, nu: 6, nv: 4, col: shirt.clone().multiplyScalar(0.95), mat: M.cotton, out: 0.5 });
        // sleeve (short, with a rolled cuff) + shoulder cap
        const sf = armFn(s, 1.245, 1.06, [[0.004], [0.05], [0.061], [0.065], [0.067], [0.068]], folds(2, 0.02, 0.4, 1.0));
        sb.grid(sf, { nu: 22, nv: 10, mat: M.cotton, col: shirt });
        hem(sb, sf, 1.0, { r: 0.008, h: 0.012, col: shirt.clone().multiplyScalar(0.95), mat: M.cotton });
        // sleeve badge
        const bf = sf, bu = s * Math.PI / 2;
        panel(sb, bf, bu - 0.5, bu + 0.5, 0.35, 0.72, { h: 0.003, edge: 0.45, nu: 8, nv: 8, col: col(0x2f6b3a), mat: M.cotton, out: 0, shape: (a, b) => sm(0.5, 0.3, Math.hypot(a - 0.5, b - 0.5)) });
        panel(sb, bf, bu - 0.2, bu + 0.2, 0.44, 0.62, { h: 0.0045, edge: 0.45, nu: 6, nv: 6, col: col(SC.scarfB), mat: M.cotton, out: 0, shape: (a, b) => sm(0.5, 0.2, Math.abs(a - 0.5) + Math.abs(b - 0.5) * 0.7) });
        // skin arm below the cuff (occluded near the cuff)
        const af = armFn(s, 1.08, 0.73, armProf(1.08, 1));
        sb.grid(af, { nu: 18, nv: 18, mat: M.skin, col: (u, v) => col(SC.skin).multiplyScalar(1 - 0.22 * sm(0.12, 0, v)) });
        fist(sb, s, SC.skin, M.skin);
      }
      // neckerchief: rolled scarf around the collar, leather woggle, two tails down the chest
      const nk = sweep(sb, (t) => {
        const u = t * TAU, q = tf(u, 0.955), n = nrm(tf, u, 0.955);
        return { p: q.p.clone().addScaledVector(n, 0.012).add(V(0, -Math.cos(u) * 0.012, 0)), up: n, w: q.w };
      }, (t, a) => [Math.cos(a) * 0.016, Math.sin(a) * 0.014], { na: 10, nt: 40, col: col(SC.scarf), mat: M.cotton });
      for (const s of [-1, 1]) panel(sb, tf, s * 0.02 - 0.09, s * 0.02 + 0.09, 0.56, 0.9, { h: 0.01, edge: 0.3, nu: 6, nv: 10, col: col(SC.scarf), mat: M.cotton, out: 0.8,
        shape: (a, b) => sm(0, 0.25, b - Math.abs(a - 0.5) * 0.6) });
      const wq = tf(0, 0.88), wn = nrm(tf, 0, 0.88);
      sweep(sb, (t) => { const a = t * TAU; return { p: wq.p.clone().addScaledVector(wn, 0.02).add(V(Math.cos(a) * 0.017, Math.sin(a) * 0.017, 0)), up: wn, w: wq.w }; },
        (t, a) => [Math.cos(a) * 0.006, Math.sin(a) * 0.009], { na: 8, nt: 16, col: col(0x8a5a33), mat: M.leather });
      // backpack straps over the shoulders, sternum strap, buckles
      for (const s of [-1, 1]) {
        onLine(sb, tf, (t) => [s * lerp(0.42, 0.62, t), lerp(0.93, 0.28, t)], { r: 0.017, flat: 0.28, off: 0.003, col: col(SC.packD), mat: M.canvas, out: 0.7, nt: 18, cap: false });
        onLine(sb, tf, (t) => [s * lerp(0.95, 1.2, t) + (s < 0 ? 0 : 0), lerp(0.97, 0.99, t)], { r: 0.017, flat: 0.28, off: 0.003, col: col(SC.packD), mat: M.canvas, out: 0.7, nt: 6, cap: false });
        const bq = tf(s * 0.6, 0.34), bn = nrm(tf, s * 0.6, 0.34);
        ellipsoid(sb, bq.p.addScaledVector(bn, 0.008), [0.018, 0.011, 0.004], { rot: new T.Quaternion().setFromUnitVectors(V(0, 0, -1), bn), w: bq.w, nu: 10, nv: 5, mat: M.metal, col: col(0x9aa3ad), out: 0 });
      }
      onLine(sb, tf, (t) => [lerp(-0.52, 0.52, t), 0.62], { r: 0.011, flat: 0.3, off: 0.012, col: col(SC.packD), mat: M.canvas, out: 0.6, nt: 12, cap: false });
      // belt with loops and a brass buckle
      const pf = pelvisFn();
      sb.grid(pf, { nu: 40, nv: 12, mat: M.cotton, col: (u, v) => col(SC.shorts).multiplyScalar(0.85 + 0.15 * v) });
      const bf2 = ringFn([[0.158, 0.113], [0.158, 0.113]], 0.86, 0.9, torsoW);
      sb.grid(bf2, { nu: 40, nv: 2, mat: M.leather, col: col(SC.belt) });
      const bk = bf2(0, 0.5);
      ellipsoid(sb, bk.p.clone().add(V(0, 0, -0.012)), [0.03, 0.022, 0.006], { w: bk.w, nu: 12, nv: 6, mat: M.metal, col: col(0xc9a23a) });
      // shorts: cargo legs with side pockets and rolled hems
      for (const s of [-1, 1]) {
        const lf = legFn(s, 0.86, 0.6, [[0.088], [0.09], [0.09], [0.091], [0.093]], folds(2, 0.015, 0.3, 1));
        sb.grid(lf, { nu: 24, nv: 12, mat: M.cotton, col: (u, v) => col(SC.shorts).multiplyScalar(0.92 + 0.08 * Math.cos(u)) });
        hem(sb, lf, 1, { r: 0.006, h: 0.01, col: col(SC.shorts).multiplyScalar(0.9), mat: M.cotton });
        const pu = s * Math.PI / 2;
        panel(sb, lf, pu - 0.6, pu + 0.6, 0.3, 0.72, { h: 0.012, nu: 8, nv: 8, col: col(SC.shorts).multiplyScalar(0.96), mat: M.cotton, out: 0.7 });
        panel(sb, lf, pu - 0.62, pu + 0.62, 0.26, 0.36, { h: 0.017, nu: 8, nv: 3, col: col(SC.shorts).multiplyScalar(0.9), mat: M.cotton, out: 0.7 });
        // knee + shin (skin), knee socks with a turned cuff and two stripes, garter tab
        const kf = legFn(s, 0.63, 0.38, [[0.062], [0.058], [0.055], [0.056], [0.056]]);
        sb.grid(kf, { nu: 18, nv: 10, mat: M.skin, col: (u, v) => col(SC.skin).multiplyScalar(1 - 0.22 * sm(0.14, 0, v)) });
        const sk = legFn(s, 0.43, 0.105, [[0.06], [0.058], [0.052], [0.044], [0.037], [0.036]], (u, v) => 0.02 * Math.sin(v * 60) * sm(0.8, 1, v));
        sb.grid(sk, { nu: 20, nv: 16, mat: M.knit, col: (u, v) => {
          if (v < 0.16) return v < 0.05 ? col(0xc0392b) : v < 0.1 ? col(SC.scarfB) : col(SC.sock);
          return col(SC.sock);
        } });
        hem(sb, sk, 0.0, { r: 0.008, h: 0.012, col: col(SC.sock), mat: M.knit });
        panel(sb, sk, pu - 0.18, pu + 0.18, 0.06, 0.3, { h: 0.003, nu: 4, nv: 6, col: col(0xc0392b), mat: M.cotton, out: 0.4, shape: (a, b) => sm(0, 0.2, 1 - b + 0.1) });
        // hiking boot: leather upper, dark toe cap and collar, lug sole, red laces, brass hooks
        shoe(sb, s, { upper: SC.boot, upperMat: M.leather, toeCol: SC.bootD, collar: SC.bootD, collarMat: M.leather, midsole: 0xc8a878, midMat: M.rubber, outsole: 0x2a1c12, sole: 0.03, lace: 0xc0392b, tongue: 0x8a5a33, tab: SC.bootD, tabMat: M.leather, eyelet: 0xc9a23a, laces: 5,
          prof: [[0.038, 0.07], [0.052, 0.088], [0.058, 0.09], [0.06, 0.08], [0.062, 0.066], [0.059, 0.054], [0.047, 0.042], [0.022, 0.026]] });
      }
      // --- backpack (own mesh, on the sprung pack bone)
      const pw = { packB: 1 }, pc = V(0, 1.12, 0.215), P = col(SC.pack), PD = col(SC.packD);
      const box = (c, r, e, o) => ellipsoid(gear, c, r, Object.assign({ w: pw, nu: 24, nv: 16, disp: (d) => {
        const q = Math.pow(Math.pow(Math.abs(d.x), e) + Math.pow(Math.abs(d.y), e) + Math.pow(Math.abs(d.z), e), -1 / e);
        return q - 1;
      } }, o));
      box(pc, [0.135, 0.165, 0.085], 3.2, { mat: M.canvas, col: (u, v) => P.clone().multiplyScalar(0.88 + 0.12 * Math.cos(v - 0.4)) });
      box(pc.clone().add(V(0, 0.105, 0.01)), [0.14, 0.075, 0.092], 3.6, { mat: M.canvas, col: PD });                          // lid
      box(pc.clone().add(V(0, -0.045, 0.082)), [0.1, 0.075, 0.03], 3.2, { mat: M.canvas, col: P.clone().multiplyScalar(0.95) }); // front pocket
      for (const s of [-1, 1]) {
        sweep(gear, (t) => ({ p: pc.clone().add(V(s * 0.06, lerp(0.14, -0.02, t), 0.095 + Math.sin(t * Math.PI) * 0.01 + (t > 0.5 ? 0.02 : 0))), up: V(0, 0, 1), w: pw }),
          (t, a) => [Math.cos(a) * 0.013, Math.sin(a) * 0.003], { na: 6, nt: 12, col: PD, mat: M.canvas, out: 0.6 });
        ellipsoid(gear, pc.clone().add(V(s * 0.06, 0.02, 0.118)), [0.017, 0.013, 0.005], { w: pw, nu: 10, nv: 5, mat: M.metal, col: col(0xb0b6bd), out: 0 });
      }
      // side bottle (plastic + metal cap) and a coil of rope
      gear.grid(limbFn(0.155, 0.19, 1.18, 1.02, [[0.004], [0.032], [0.034], [0.034], [0.033], [0.004]], () => pw), { nu: 16, nv: 10, mat: M.plastic, col: col(0x2f8fd0) });
      gear.grid(limbFn(0.155, 0.19, 1.2, 1.175, [[0.004], [0.022], [0.024], [0.024], [0.02]], () => pw), { nu: 14, nv: 5, mat: M.metal, col: col(0xc8ced6) });
      sweep(gear, (t) => { const a = t * TAU * 3.2; return { p: V(-0.152 - Math.sin(a) * 0.0, 1.08 + Math.cos(a) * 0.045 + t * 0.02, 0.2 + Math.sin(a) * 0.045), up: V(-1, 0, 0), w: pw }; },
        roundSec(() => 0.0075, 1), { na: 6, nt: 48, col: col(0xd9c28a), mat: M.canvas, out: 0.5 });
      // bedroll with straps
      gear.grid((u, v) => {
        const x = lerp(-0.155, 0.155, v), r = 0.052 * (0.35 + 0.65 * Math.sqrt(Math.min(1, Math.min(v, 1 - v) / 0.06)));
        return { p: V(x, 1.335 + Math.cos(u) * r, 0.2 + Math.sin(u) * r), c: V(x, 1.335, 0.2), w: pw };
      }, { nu: 22, nv: 14, mat: M.canvas, col: (u, v) => (Math.min(v, 1 - v) < 0.05 ? col(0x8a2a22) : col(0xb03a2e)) });
      for (const x of [-0.1, 0.1]) sweep(gear, (t) => { const a = t * TAU; return { p: V(x, 1.335 + Math.cos(a) * 0.056, 0.2 + Math.sin(a) * 0.056), up: V(0, Math.cos(a), Math.sin(a)), w: pw }; },
        (t, a) => [Math.cos(a) * 0.009, Math.sin(a) * 0.003], { na: 6, nt: 20, col: col(SC.belt), mat: M.leather, out: 0.6 });
    },
  };

  // =================================================================== SPRINTER
  const SP = { skin: 0x9c6440, top: 0x1f63d8, topB: 0xffc629, shorts: 0x16224a, band: 0xff3d2e, shoe: 0xff4a32, hair: 0x17110d };
  const sprinterDef = {
    skin: SP.skin,
    face: { eye: 0x5a3820, brow: 0x16100c, lip: 0x7a3a30, blush: 0x8a4030, blushK: 0.15, smile: 0.09, browTilt: 0.0, lidUp: 0.56, nose: 1.15, chin: 1.1, jaw: 0.2 },
    chains: [
      { names: ['bandL0', 'bandL1', 'bandL2'], parent: 'head', pos: V(-0.02, 0.19, 0.2), rx0: Math.PI - 0.6, ry0: -0.3, seg: 0.055, mesh: true, width: 0.018, thick: 0.004, col: SP.band, mat: M.knit, gains: [0.5, 0.8, 1.1], flutter: 0.12 },
      { names: ['bandR0', 'bandR1', 'bandR2'], parent: 'head', pos: V(0.02, 0.19, 0.2), rx0: Math.PI - 0.6, ry0: 0.3, seg: 0.055, mesh: true, width: 0.018, thick: 0.004, col: SP.band, mat: M.knit, gains: [0.5, 0.8, 1.1], flutter: 0.12 },
    ],
    build(sb, gear, B) {
      const K = sprinterDef, F = buildHead(sb, K);
      // high-top twists over a tight fade
      hairCap(sb, F, { col: 0x2a1d15, thick: 0.004, line: (u) => { const c = Math.cos(u); return c > 0 ? lerp(1.3, 0.78, c) : lerp(1.3, 1.75, -c); } });
      let n = 0;
      for (let pt = 1.5; pt > 0.55; pt -= 0.13) {
        const ring = Math.max(1, Math.round(Math.cos(pt) * 15 + 1));
        for (let i = 0; i < ring; i++) {
          const yw = (i / ring) * TAU + (n++ % 2) * 0.18;
          if (Math.cos(yw) > 0.3 && pt < 0.72) continue;
          const len = 0.05 + 0.02 * Math.sin(n * 2.3), back = 0.12;
          clump(sb, F, { col: SP.hair, tip: 0x3a2a1e, w0: 0.013, t0: 0.013, taper: 0.45, nt: 5, na: 6,
            pts: [[yw, pt, 0.0], [yw, pt, len * 0.55], [yw + 0.03, pt, len]] });
        }
      }
      // sweatband (terry knit) with a white stripe, knot at the back
      const bandPath = (t, lift) => { const u = t * TAU, pt = 0.47 - 0.24 * sm(0.3, 1, -Math.cos(u)); return onHead(F, u, pt, lift); };
      sweep(sb, (t) => { const q = bandPath(t, 0.012); return { p: q.p, up: q.n, w: { head: 1 } }; }, (t, a) => [Math.cos(a) * 0.024, Math.sin(a) * 0.009], { na: 12, nt: 60, col: col(SP.band), mat: M.knit });
      sweep(sb, (t) => { const q = bandPath(t, 0.0215); return { p: q.p, up: q.n, w: { head: 1 } }; }, (t, a) => [Math.cos(a) * 0.004, Math.sin(a) * 0.0015], { na: 6, nt: 60, col: col(0xffffff), mat: M.knit, out: 0 });
      ellipsoid(sb, onHead(F, Math.PI, 0.25, 0.022).p, [0.028, 0.022, 0.018], { w: { head: 1 }, nu: 12, nv: 8, mat: M.knit, col: col(SP.band) });
      // racing singlet: mesh knit, yellow side panels, bare shoulders, bound armholes
      const top = col(SP.top), topB = col(SP.topB), skin = col(SP.skin);
      const TOP = TORSO.map((r, i) => (i >= 6 ? [r[0] * 0.96, r[1], r[2], r[3]] : r));
      const tf = torsoFn(TOP, 0.8, 1.285, folds(2, 0.008, 0, 0.3));
      const AH = { c: 0.74, ru: 0.5, rv: 0.29 };
      const bare = (u, v) => {                                   // skin: armholes + neck scoop
        let au = Math.atan2(Math.sin(u), Math.cos(u)); const a = Math.abs(au);
        if (((a - Math.PI / 2) / AH.ru) ** 2 + ((v - AH.c) / AH.rv) ** 2 < 1) return true;
        if (a < 0.86 && v > 0.9 - 0.13 * (1 - (a / 0.86) ** 2)) return true;
        if (a > Math.PI - 0.8 && v > 0.955 - 0.05 * (1 - ((Math.PI - a) / 0.8) ** 2)) return true;
        return false;
      };
      sb.grid(tf, { nu: 54, nv: 28, matFn: (u, v) => (bare(u, v) ? M.skin : M.mesh), col: (u, v) => {
        if (bare(u, v)) return skin.clone();
        const panel = sm(0.72, 0.9, Math.abs(Math.sin(u)));
        return cmix(top, topB, panel).multiplyScalar(1 - 0.1 * sm(0.2, 0, v));
      } });
      for (const s of [-1, 1]) onLine(sb, tf, (t) => { const a = t * TAU; return [s * (Math.PI / 2 + Math.cos(a) * AH.ru), Math.min(0.99, AH.c + Math.sin(a) * AH.rv)]; }, { r: 0.0055, flat: 0.55, off: 0.001, col: topB, mat: M.mesh, out: 0.8, nt: 40, cap: false });
      onLine(sb, tf, (t) => { const a = lerp(-0.86, 0.86, t); return [a, 0.9 - 0.13 * (1 - (a / 0.86) ** 2)]; }, { r: 0.0055, flat: 0.55, col: topB, mat: M.mesh, out: 0.8, nt: 20 });
      onLine(sb, tf, (t) => { const a = lerp(-0.8, 0.8, t); return [Math.PI + a, 0.955 - 0.05 * (1 - (a / 0.8) ** 2)]; }, { r: 0.0055, flat: 0.55, col: topB, mat: M.mesh, out: 0.8, nt: 16 });
      // shoulders & upper chest skin (inside the armholes) + neck scoop
      for (const s of [-1, 1]) {
        const sh = armFn(s, 1.24, 1.06, [[0.004], [0.046], [0.054], [0.054], [0.051], [0.05]]);
        sb.grid(sh, { nu: 20, nv: 10, mat: M.skin, col: skin });
        const af = armFn(s, 1.1, 0.73, armProf(1.1, 1.02));
        sb.grid(af, { nu: 18, nv: 18, mat: M.skin, col: skin });
        fist(sb, s, SP.skin, M.skin);
      }
      // race bib (front + back) with the number 7 and four safety pins
      for (const [uc, flip] of [[0, -1], [Math.PI, 1]]) {
        panel(sb, tf, uc - 0.5, uc + 0.5, 0.36, 0.66, { h: 0.0035, edge: 0.06, nu: 10, nv: 8, col: col(0xf6f4ee), mat: M.plastic, out: 0.5 });
        panel(sb, tf, uc - 0.5, uc + 0.5, 0.36, 0.42, { h: 0.0045, edge: 0.1, nu: 10, nv: 3, col: col(SP.band), mat: M.plastic, out: 0 });
        onLine(sb, tf, (t) => [uc + flip * lerp(-0.17, 0.17, t), 0.605], { r: 0.0085, flat: 0.25, off: 0.004, col: col(0x14182a), mat: M.plastic, cap: false, nt: 6 });
        onLine(sb, tf, (t) => [uc + flip * lerp(0.17, -0.05, t), lerp(0.605, 0.45, t)], { r: 0.0085, flat: 0.25, off: 0.004, col: col(0x14182a), mat: M.plastic, cap: false, nt: 8 });
        for (const [du, dv] of [[-0.44, 0.63], [0.44, 0.63], [-0.44, 0.39], [0.44, 0.39]]) {
          const q = tf(uc + du, dv), n = nrm(tf, uc + du, dv);
          sweep(sb, (t) => ({ p: q.p.clone().addScaledVector(n, 0.006).add(V(0, lerp(-0.012, 0.012, t), 0)), up: n, w: q.w }), roundSec(() => 0.0018, 1), { na: 5, nt: 6, col: col(0xc8ced6), mat: M.metal, out: 0 });
        }
      }
      // split shorts with piping; waistband with drawcord
      const pf = pelvisFn();
      sb.grid(pf, { nu: 40, nv: 12, mat: M.mesh, col: (u, v) => col(SP.shorts).multiplyScalar(0.85 + 0.15 * v) });
      const wb = ringFn([[0.157, 0.112], [0.157, 0.112]], 0.86, 0.9, torsoW);
      sb.grid(wb, { nu: 40, nv: 2, mat: M.knit, col: col(SP.shorts).multiplyScalar(1.4) });
      for (const s of [-1, 1]) { const q = wb(s * 0.08, 0.3); sweep(sb, (t) => ({ p: q.p.clone().add(V(s * t * 0.012, -t * 0.05, -0.006 - t * 0.004)), up: V(0, 0, -1), w: q.w }), roundSec(() => 0.0022, 1), { na: 5, nt: 6, col: col(0xffffff), mat: M.cotton, out: 0 }); }
      for (const s of [-1, 1]) {
        const lf = legFn(s, 0.86, 0.66, [[0.088], [0.09], [0.091], [0.094], [0.097]]);
        sb.grid(lf, { nu: 24, nv: 10, mat: M.mesh, col: col(SP.shorts) });
        hem(sb, lf, 1, { r: 0.004, h: 0.006, col: col(0xffffff), mat: M.plastic, out: 0.8 });
        onLine(sb, lf, (t) => [s * Math.PI / 2 - s * 0.08, lerp(0.02, 0.98, t)], { r: 0.0025, col: col(0xffffff), mat: M.plastic, nt: 10 });
        onLine(sb, lf, (t) => [s * Math.PI / 2 + s * 0.08, lerp(0.02, 0.98, t)], { r: 0.0025, col: col(0xffffff), mat: M.plastic, nt: 10 });
        // legs: long lean thigh, knee, calf; crew socks with two stripes
        const th = legFn(s, 0.68, 0.14, [[0.07], [0.066], [0.06], [0.056], [0.054], [0.056], [0.052], [0.047], [0.04], [0.036]]);
        sb.grid(th, { nu: 18, nv: 26, mat: M.skin, col: (u, v) => skin.clone().multiplyScalar(1 - 0.2 * sm(0.08, 0, v)) });
        const so = legFn(s, 0.2, 0.105, [[0.042], [0.041], [0.039], [0.038]]);
        sb.grid(so, { nu: 18, nv: 6, mat: M.knit, col: (u, v) => (v > 0.12 && v < 0.24) || (v > 0.34 && v < 0.46) ? top : col(0xf4f4f2) });
        hem(sb, so, 0.0, { r: 0.005, h: 0.006, col: col(0xf4f4f2), mat: M.knit });
        // racing shoe: mesh upper, big foam midsole, glossy heel counter, bright outsole
        shoe(sb, s, { upper: SP.shoe, upperMat: M.mesh, toeCol: 0xff6a4a, collar: 0x16224a, collarMat: M.mesh, midsole: 0xf5f3ee, midMat: M.plastic, outsole: 0x16224a, sole: 0.034, lace: 0xffffff, tongue: 0xffffff, tab: 0x16224a, tabMat: M.lacquer, stripe: SP.topB, laces: 4 });
      }
      // wrist gear: sweatband (right), watch (left)
      const wr = armFn(1, 0.79, 0.745, [[0.036], [0.037], [0.036]]);
      sb.grid(wr, { nu: 16, nv: 3, mat: M.knit, col: col(SP.band) });
      hem(sb, wr, 0, { r: 0.004, col: col(SP.band), mat: M.knit }); hem(sb, wr, 1, { r: 0.004, col: col(SP.band), mat: M.knit });
      const wa = armFn(-1, 0.775, 0.752, [[0.034], [0.034], [0.034]]);
      sb.grid(wa, { nu: 16, nv: 2, mat: M.rubber, col: col(0x1c1e22) });
      const fc = wa(-Math.PI / 2, 0.5).p.add(V(-0.012, 0, 0));
      ellipsoid(sb, fc, [0.008, 0.02, 0.02], { w: armW('L', 0.76), nu: 14, nv: 8, mat: M.metal, col: col(0x9aa2ab), out: 0 });
      ellipsoid(sb, fc.clone().add(V(-0.006, 0, 0)), [0.003, 0.016, 0.016], { w: armW('L', 0.76), nu: 12, nv: 6, mat: M.glow, col: col(0x49d6ff), out: 0 });
    },
  };

  // =================================================================== NINJA
  const NJ = { skin: 0xecbb91, cloth: 0x2e3445, clothD: 0x222735, lapel: 0x454d66, red: 0xc42f3a, wrap: 0xd9d2c1, steel: 0xb9c2cf, gold: 0xd4a443 };
  const ninjaDef = {
    skin: NJ.skin,
    face: { eye: 0x2f6fa3, brow: 0x121418, lip: 0xc27a66, blushK: 0.0, smile: 0, browTilt: 0.1, browW: 1.25, lidUp: 0.24 },
    chains: [
      { names: ['tailL0', 'tailL1', 'tailL2', 'tailL3'], parent: 'head', pos: V(-0.025, 0.16, 0.215), rx0: Math.PI - 0.35, ry0: -0.18, seg: 0.075, mesh: true, width: 0.02, thick: 0.004, col: NJ.red, mat: M.satin, gains: [0.5, 0.75, 1.0, 1.25], flutter: 0.18 },
      { names: ['tailR0', 'tailR1', 'tailR2', 'tailR3'], parent: 'head', pos: V(0.025, 0.16, 0.215), rx0: Math.PI - 0.3, ry0: 0.2, seg: 0.07, mesh: true, width: 0.019, thick: 0.004, col: NJ.red, mat: M.satin, gains: [0.5, 0.75, 1.0, 1.25], flutter: 0.18 },
    ],
    build(sb, gear, B) {
      const K = ninjaDef, F = buildHead(sb, K);
      const cloth = col(NJ.cloth), clothD = col(NJ.clothD), red = col(NJ.red);
      // hood: wraps the whole head, open only in a band around the eyes; folds gather at the chin
      const tA = Math.PI / 2 - 0.2, tB = Math.PI / 2 + 0.095, win = 0.95;
      const hood = (u, v, lift) => {
        const d = sph(u, v), base = headPoint(d, F), n = base.clone().sub(HC).normalize();
        const fold = 0.004 * Math.sin(u * 16) * sm(2.0, 2.7, v);
        return { p: base.addScaledVector(n, lift + fold + 0.004 * sm(1.9, 2.8, v)), c: HC, w: { head: 1 } };
      };
      const hcol = (u, v) => cloth.clone().multiplyScalar(0.9 + 0.1 * Math.cos(v));
      sb.grid((u, v) => hood(u, v, 0.012), { nu: 52, nv: 16, v0: 0.001, v1: tA, mat: M.cotton, col: hcol });
      sb.grid((u, v) => hood(u, v, 0.012), { nu: 52, nv: 18, v0: tB, v1: 2.75, mat: M.cotton, col: hcol });
      sb.grid((u, v) => hood(u, v, 0.012), { nu: 44, nv: 4, u0: win, u1: TAU - win, v0: tA, v1: tB, mat: M.cotton, col: hcol });
      // cowl from under the jaw down into the jacket collar
      sb.grid((u, t) => {
        const top = hood(u, 2.75, 0.012).p, r = lerp(0.07, 0.1, t), bot = V(Math.sin(u) * r * 1.2, 1.235, -Math.cos(u) * r + 0.01);
        const p = top.clone().lerp(bot, t);
        return { p, c: V(0, p.y, 0.01), w: neckW(p.y) };
      }, { nu: 48, nv: 8, mat: M.cotton, col: clothD });
      // rolled hem around the eye window
      for (const v of [tA, tB]) onLine(sb, (u, vv) => hood(u, vv, 0.012), (t) => [lerp(-win, win, t), v], { r: 0.005, off: 0.0, col: clothD, mat: M.cotton, out: 0.8, nt: 24 });
      // headband: satin band + engraved steel plate with rivets + knot
      const bandAt = (t, lift) => { const u = t * TAU, pt = 0.44 - 0.2 * sm(0.3, 1, -Math.cos(u)); return onHead(F, u, pt, lift); };
      sweep(sb, (t) => { const q = bandAt(t, 0.026); return { p: q.p, up: q.n, w: { head: 1 } }; }, (t, a) => [Math.cos(a) * 0.026, Math.sin(a) * 0.006], { na: 12, nt: 64, col: red, mat: M.satin });
      const pl = (u, v) => { const q = onHead(F, u, 0.44 + v, 0.034); return { p: q.p, c: HC, w: { head: 1 } }; };
      sb.grid((u, v) => {
        const s = pl(u, v), n = s.p.clone().sub(HC).normalize();
        const fu = Math.min(u + 0.42, 0.42 - u) / 0.84, fv = Math.min(v + 0.07, 0.07 - v) / 0.14;
        return { p: s.p.addScaledVector(n, 0.006 * sm(0, 0.25, Math.min(fu, fv))), c: HC, w: s.w };
      }, { u0: -0.42, u1: 0.42, v0: -0.07, v1: 0.07, nu: 16, nv: 6, mat: M.metal, col: col(NJ.steel) });
      for (const [u, v] of [[-0.36, 0.045], [0.36, 0.045], [-0.36, -0.045], [0.36, -0.045]]) ellipsoid(sb, onHead(F, u, 0.44 + v, 0.042).p, [0.004, 0.004, 0.004], { w: { head: 1 }, nu: 8, nv: 5, mat: M.metal, col: col(0x7c8594), out: 0 });
      sweep(sb, (t) => { const a = lerp(0.6, 5.4, t), q = onHead(F, Math.cos(a) * 0.1, 0.44 + Math.sin(a) * 0.045, 0.0425); return { p: q.p, up: q.n, w: { head: 1 } }; }, roundSec(() => 0.0028, 0.5), { na: 6, nt: 20, col: col(0x5c6574), mat: M.metal, out: 0 });
      for (const s of [-1, 1]) ellipsoid(sb, onHead(F, Math.PI + s * 0.13, 0.24, 0.03).p, [0.026, 0.02, 0.016], { w: { head: 1 }, nu: 12, nv: 8, mat: M.satin, col: red });
      // jacket: wrap top with crossing lapels, wide sleeves bound by wraps, shoulder guard
      const JT = TORSO.map((r, i) => [r[0] * 1.05, r[1] * 1.04, r[2], r[3]]);
      const tf = torsoFn(JT, 0.8, 1.285, folds(3, 0.014, 0, 0.45));
      sb.grid(tf, { nu: 40, nv: 22, mat: M.cotton, col: (u, v) => cloth.clone().multiplyScalar(1 - 0.12 * sm(0.3, 0, v)) });
      for (const s of [-1, 1]) {
        onLine(sb, tf, (t) => [s * lerp(0.9, -0.12, t) + (s > 0 ? 0 : 0), lerp(0.98, 0.3, t)], { r: 0.026, flat: 0.22, off: 0.002 + (s > 0 ? 0.004 : 0), col: col(NJ.lapel), mat: M.cotton, out: 0.9, nt: 20, cap: false });
        // wide sleeve to mid-forearm with folds, then arm wraps
        const sf = armFn(s, 1.245, 0.86, [[0.004], [0.058], [0.068], [0.073], [0.078], [0.082], [0.086], [0.09], [0.092]], folds(3, 0.03, 0.3, 1.0));
        sb.grid(sf, { nu: 24, nv: 20, mat: M.cotton, col: (u, v) => cloth.clone().multiplyScalar(0.92 + 0.08 * Math.cos(u)) });
        hem(sb, sf, 1, { r: 0.006, h: 0.01, col: clothD, mat: M.cotton });
        const af = armFn(s, 0.92, 0.73, [[0.042], [0.041], [0.039], [0.036], [0.033]]);
        sb.grid(af, { nu: 16, nv: 10, mat: M.cotton, col: col(NJ.wrap) });
        sweep(sb, (t) => { const y = lerp(0.9, 0.745, t), a = t * TAU * 5.5, r = lerp(0.043, 0.035, t);
          return { p: V(s * SW + Math.sin(a) * r, y + Math.cos(a) * 0.006, -Math.cos(a) * r), up: V(Math.sin(a), 0, -Math.cos(a)), w: armW(s < 0 ? 'L' : 'R', y) }; },
        (t, a) => [Math.cos(a) * 0.0045, Math.sin(a) * 0.0022], { na: 5, nt: 66, col: col(NJ.wrap).multiplyScalar(0.9), mat: M.cotton, out: 0.4 });
        // gloves
        fist(sb, s, 0x1c1f28, M.leather);
      }
      // left shoulder guard: three overlapping lacquered plates laced together
      for (let i = 0; i < 3; i++) {
        const sf = armFn(-1, 1.285 - i * 0.045, 1.2 - i * 0.045, [[0.004], [0.086 + i * 0.006], [0.094 + i * 0.006], [0.096 + i * 0.006]]);
        sb.grid((u, v) => { const s = sf(u, v); return s; }, { u0: -Math.PI + 0.3, u1: -0.3, nu: 16, nv: 6, mat: M.lacquer, col: i % 2 ? col(0x6e1f26) : col(0x8a2630) });
      }
      // obi: wide red sash, knot and hanging ends
      const ob = ringFn([[0.168, 0.12], [0.17, 0.122], [0.168, 0.12]], 0.84, 0.93, torsoW);
      sb.grid(ob, { nu: 44, nv: 6, mat: M.satin, col: red });
      onLine(sb, ob, (t) => [t * TAU, 0.08], { r: 0.003, col: red.clone().multiplyScalar(0.7), mat: M.satin, nt: 40, cap: false });
      onLine(sb, ob, (t) => [t * TAU, 0.92], { r: 0.003, col: red.clone().multiplyScalar(0.7), mat: M.satin, nt: 40, cap: false });
      const kq = ob(-0.6, 0.5);
      ellipsoid(sb, kq.p.clone().add(V(0, 0, -0.012)), [0.035, 0.028, 0.02], { w: kq.w, nu: 14, nv: 8, mat: M.satin, col: red });
      for (const [dx, rot] of [[-0.02, 0.2], [0.012, -0.12]]) {
        sweep(sb, (t) => ({ p: kq.p.clone().add(V(dx + Math.sin(t * 2) * rot * 0.05, -0.02 - t * 0.14, -0.02 - Math.sin(t * Math.PI) * 0.01)), up: V(0, 0, -1), w: t < 0.5 ? kq.w : mixW(kq.w, legW('L', 0.7), (t - 0.5) * 0.6) }),
          (t, a) => [Math.cos(a) * 0.02 * (1 - t * 0.2), Math.sin(a) * 0.004], { na: 8, nt: 12, col: red.clone().multiplyScalar(0.95), mat: M.satin, out: 0.7 });
      }
      // shuriken tucked in the sash
      const sq = ob(0.55, 0.5), sn = nrm(ob, 0.55, 0.5);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + 0.3, dir = V(Math.cos(a), Math.sin(a), 0);
        sweep(sb, (t) => ({ p: sq.p.clone().addScaledVector(sn, 0.012).addScaledVector(dir, t * 0.028), up: sn, w: sq.w }), (t, b) => [Math.cos(b) * 0.009 * (1 - t), Math.sin(b) * 0.0015], { na: 6, nt: 4, col: col(NJ.steel), mat: M.metal, out: 0 });
      }
      // pants: loose, gathered into shin wraps; thigh strap with a kunai pouch
      const pf = pelvisFn(PELVIS.map(r => [r[0] * 1.06, r[1] * 1.06]));
      sb.grid(pf, { nu: 40, nv: 12, mat: M.cotton, col: (u, v) => clothD.clone().multiplyScalar(0.85 + 0.15 * v) });
      for (const s of [-1, 1]) {
        const lf = legFn(s, 0.86, 0.23, [[0.096], [0.1], [0.102], [0.1], [0.094], [0.086], [0.074], [0.062], [0.052]], folds(4, 0.022, 0.1, 0.95, true));
        sb.grid(lf, { nu: 26, nv: 30, mat: M.cotton, col: (u, v) => clothD.clone().multiplyScalar(0.94 + 0.06 * Math.cos(u)) });
        const wf = legFn(s, 0.3, 0.1, [[0.056], [0.05], [0.046], [0.042], [0.04]]);
        sb.grid(wf, { nu: 18, nv: 8, mat: M.cotton, col: col(NJ.wrap) });
        sweep(sb, (t) => { const y = lerp(0.29, 0.11, t), a = t * TAU * 6 * s, r = lerp(0.057, 0.041, t);
          return { p: V(s * HW + Math.sin(a) * r, y + Math.cos(a) * 0.007, -Math.cos(a) * r), up: V(Math.sin(a), 0, -Math.cos(a)), w: legW(s < 0 ? 'L' : 'R', y) }; },
        (t, a) => [Math.cos(a) * 0.005, Math.sin(a) * 0.0024], { na: 5, nt: 76, col: col(NJ.wrap).multiplyScalar(0.9), mat: M.cotton, out: 0.4 });
        // tabi boots: split toe, cloth upper, rubber sole
        shoe(sb, s, { upper: 0x1c1f28, upperMat: M.cotton, collar: 0x1c1f28, collarMat: M.cotton, midsole: 0x3a3f4c, outsole: 0x14161c, sole: 0.018, lace: 0x1c1f28, tongue: 0x1c1f28, laces: 0, tab: 0x1c1f28, eyelet: NJ.gold,
          prof: [[0.036, 0.1], [0.05, 0.095], [0.054, 0.085], [0.056, 0.072], [0.058, 0.058], [0.054, 0.046], [0.044, 0.036], [0.02, 0.022]] });
        const tz = -0.17, ty = Y.foot - D.ankle + 0.03;
        sweep(sb, (t) => ({ p: V(s * HW + s * 0.012, lerp(ty + 0.02, ty - 0.004, t), lerp(tz + 0.03, tz - 0.012, t)), up: V(s, 0, 0), w: { ['foot' + (s < 0 ? 'L' : 'R')]: 1 } }),
          (t, a) => [Math.cos(a) * 0.0025, Math.sin(a) * 0.02], { na: 6, nt: 6, col: col(0x0e0f14), mat: M.detail, out: 0 });
      }
      const th = legFn(1, 0.72, 0.64, [[0.103], [0.103], [0.1]]);
      onLine(sb, th, (t) => [t * TAU, 0.5], { r: 0.012, flat: 0.25, col: col(0x5a3a2a), mat: M.leather, out: 0.6, nt: 30, cap: false });
      panel(sb, th, 0.9, 1.9, 0.0, 1.0, { h: 0.022, edge: 0.3, nu: 8, nv: 6, col: col(0x6a4430), mat: M.leather, out: 0.8 });
      // --- katana on the back (own mesh so the jetpack can take its place)
      const cw = { chest: 1 };
      const ang = 0.6, dir = V(-Math.sin(ang), -Math.cos(ang), 0), top = V(0.17, 1.41, 0.145);
      const along = (t) => top.clone().addScaledVector(dir, t);
      const rod = (a, b, r0, r1, c, m, o = {}) => sweep(gear, (t) => ({ p: along(lerp(a, b, t)), up: V(0, 0, 1), w: cw }), roundSec((t) => lerp(r0, r1, t), o.flat || 1, o.cap ?? true), { na: o.na || 14, nt: o.nt || 10, col: col(c), mat: m, out: o.out ?? 1 });
      rod(0.0, 0.03, 0.018, 0.02, NJ.gold, M.metal, { out: 0.6 });                      // pommel
      rod(0.02, 0.2, 0.02, 0.019, 0xe8e0cc, M.leather, { nt: 12 });                     // grip (ray skin)
      for (let i = 0; i < 6; i++) {                                                    // diamond wrap
        const t0 = 0.03 + i * 0.028;
        for (const sgn of [-1, 1]) sweep(gear, (t) => { const a = sgn * (t - 0.5) * 2.2; return { p: along(t0 + t * 0.028).add(V(Math.cos(ang) * Math.sin(a) * 0.021, -Math.sin(ang) * Math.sin(a) * 0.021, -Math.cos(a) * 0.021 + 0.0)), up: V(0, 0, -1), w: cw }; },
          roundSec(() => 0.004, 0.5), { na: 5, nt: 6, col: col(0x14161c), mat: M.cotton, out: 0 });
      }
      rod(0.2, 0.215, 0.05, 0.05, NJ.gold, M.metal, { flat: 0.65, cap: false, na: 20, nt: 2 });   // tsuba
      rod(0.198, 0.217, 0.05, 0.05, NJ.gold, M.metal, { flat: 0.65, cap: true, na: 20, nt: 4 });
      rod(0.215, 0.24, 0.023, 0.022, NJ.gold, M.metal);                                  // habaki / koiguchi
      rod(0.24, 0.86, 0.022, 0.018, 0x5a141c, M.lacquer, { nt: 20 });                   // saya
      rod(0.84, 0.88, 0.019, 0.016, NJ.gold, M.metal);                                  // kojiri
      sweep(gear, (t) => ({ p: along(0.27 + t * 0.04).add(V(0, 0, 0.022 * Math.sin(t * Math.PI))), up: V(0, 0, 1), w: cw }), roundSec(() => 0.0035, 1), { na: 6, nt: 8, col: col(0x6e1f26), mat: M.cotton, out: 0.3 });
      // harness strap across the chest (body) holding it
      onLine(sb, tf, (t) => [lerp(-0.85, 0.5, t) + Math.PI * 0, lerp(0.92, 0.2, t)], { r: 0.014, flat: 0.25, off: 0.003, col: col(0x5a3a2a), mat: M.leather, out: 0.6, nt: 20, cap: false });
      onLine(sb, tf, (t) => [Math.PI + lerp(0.85, -0.5, t), lerp(0.92, 0.2, t)], { r: 0.014, flat: 0.25, off: 0.003, col: col(0x5a3a2a), mat: M.leather, out: 0.6, nt: 20, cap: false });
    },
  };

  // ------------------------------------------------------------ register
  VR.buildCharacterBase = VR.buildCharacterBase || VR.buildCharacter;
  VR.buildCharacter = (def) => (def.kid ? build(def) : VR.buildCharacterBase(def));
  const PAL = (c) => ({ skin: c, shirt: c, shorts: c, shoe: c, sole: c, detail: c, cap: c, hair: c, ink: 0x161616 });
  const NEW = [
    { id: 'scout', name: 'الكشّاف', nameEn: 'Scout', tagline: 'جاهز لكل مغامرة', taglineEn: 'Ready for any trail', price: 0, palette: PAL(SC.shirt), kid: scoutDef,
      perk: { ar: 'المغناطيس يدوم ‎+40%', en: 'Magnet lasts +40%' }, perkMul: { magnet: 1.4 } },
    { id: 'sprinter', name: 'العدّاء', nameEn: 'Sprinter', tagline: 'ما حدا بيلحقه', taglineEn: 'Nobody catches him', price: 0, palette: PAL(SP.top), kid: sprinterDef,
      perk: { ar: 'الانطلاق يدوم ‎+60%', en: 'Boost lasts +60%' }, perkMul: { boost: 1.6 } },
    { id: 'ninja', name: 'النينجا', nameEn: 'Ninja', tagline: 'بيركض بصمت', taglineEn: 'Runs in silence', price: 0, palette: PAL(NJ.cloth), kid: ninjaDef,
      perk: { ar: 'حذاء النطّ يدوم ‎+50%', en: 'Super Sneakers last +50%' }, perkMul: { sneakers: 1.5 } },
  ];
  VR.CHARACTERS.splice(1, 0, ...NEW);

  // compile the character shaders during the loading warm-up (no hitch when you first pick one)
  class Heroes {
    constructor(game) { this.name = 'heroes'; this.g = game; this.warmRig = null; }
    warm(on) {
      const sc = this.g.scene;
      if (on) {
        if (!this.warmRig) { this.warmRig = build(NEW[0]).root; this.warmRig.position.set(5, 0, -14); }
        sc.add(this.warmRig);
      } else if (this.warmRig) sc.remove(this.warmRig);
    }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Heroes);
})();

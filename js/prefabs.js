/* =====================================================================
 * PREFABS — track segments, ground, water, trains and obstacles.
 * ---------------------------------------------------------------------
 * HOW TO ADD A NEW OBSTACLE: add an entry to VR.OBSTACLE_TYPES with
 *   build()      -> VR.MB model (front at z = 0, extends to -length)
 *   length       -> metres along the track
 *   colliders    -> boxes {x0,x1,y0,y1,z0,z1} relative to lane centre/front
 *   kind         -> 'jump' | 'slide' | 'block'  (used by the fairness check)
 * then reference it from a pattern in patterns.js.
 * ===================================================================== */
(function () {
  const T = THREE;
  const C = VR.CONFIG;
  const L = C.CHUNK_LENGTH;
  const LW = C.LANE_WIDTH;
  const HALF_TRACK = LW * 1.5 + 0.35;
  const PI = Math.PI;
  VR.HALF_TRACK = HALF_TRACK;

  // ------------------------------------------------------------ junction gate
  // Built per junction (its signs name the biomes on offer), removed with its chunk.
  function forkSign(o, dir) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    const c = cv.getContext('2d');
    const ar = !VR.UI || VR.UI.lang === 'ar';
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, o.biome ? '#1f7a4d' : '#3b3f8f'); g.addColorStop(1, o.biome ? '#135c38' : '#262a6b');
    c.fillStyle = g; c.fillRect(0, 0, 512, 256);
    c.strokeStyle = '#ffd43b'; c.lineWidth = 10; c.strokeRect(8, 8, 496, 240);
    // arrow
    c.save(); c.translate(256, 70); c.rotate(dir * 0.62); c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(0, -46); c.lineTo(36, -6); c.lineTo(13, -6); c.lineTo(13, 40); c.lineTo(-13, 40); c.lineTo(-13, -6); c.lineTo(-36, -6); c.closePath(); c.fill();
    c.restore();
    const B = o.biome && VR.BIOMES[o.biome];
    const name = B ? (ar ? B.name : B.nameEn) : (ar ? 'مفاجأة!' : 'Surprise!');
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '800 60px "Baloo Bhaijaan 2", Tahoma, sans-serif'; c.direction = ar ? 'rtl' : 'ltr';
    c.fillText(name, 256, 152);
    const perk = !o.route ? (ar ? '؟ طريق عشوائي' : '? random route') : o.route.rich ? (ar ? 'كنوز: ليمون وقدرات أكثر' : 'Riches: more lemons & power-ups') : (ar ? 'طريق أسهل' : 'Easier route');
    c.font = '700 34px "Baloo Bhaijaan 2", Tahoma, sans-serif'; c.fillStyle = '#ffe680';
    c.fillText(perk, 256, 210);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    return tex;
  }
  VR.buildForkGate = function (opts) {
    const g = new T.Group();
    const mb = new VR.MB(11);
    const X = HALF_TRACK + 1.3, top = 7.3;
    for (const s of [-1, 1]) {
      mb.box('metal', 0x39424d, s * X, top / 2, 0, 0.34, top, 0.34);
      mb.box('concrete', 0x8e8a84, s * X, 0.15, 0, 0.9, 0.3, 0.9);
    }
    mb.box('metal', 0x39424d, 0, top, 0, X * 2 + 0.4, 0.3, 0.3);
    for (let i = -1; i <= 1; i++) {
      mb.box('metal', 0x2b3038, i * LW - 0.7, top - 0.35, 0, 0.06, 0.5, 0.06);
      mb.box('metal', 0x2b3038, i * LW + 0.7, top - 0.35, 0, 0.06, 0.5, 0.06);
      mb.box('glow', 0xffe9a8, i * LW, top - 0.72 - 1.18, 0.06, 2.3, 0.05, 0.05);           // light strip under each sign
    }
    const frame = mb.build({ cast: true, receive: false });
    g.add(frame);
    const geos = [], mats = [], texs = [];
    const plane = new T.PlaneGeometry(2.3, 1.15); geos.push(plane);
    opts.forEach((o, i) => {
      const tex = forkSign(o, i - 1); texs.push(tex);
      const m = new T.MeshBasicMaterial({ map: tex, color: new T.Color(1.25, 1.25, 1.25), side: T.DoubleSide, fog: true }); mats.push(m);
      const sign = new T.Mesh(plane, m);
      sign.position.set((i - 1) * LW, top - 0.6 - 0.575, 0.08);
      g.add(sign);
    });
    g.userData.dispose = () => { geos.forEach(x => x.dispose()); mats.forEach(x => x.dispose()); texs.forEach(x => x.dispose()); frame.traverse(m => { if (m.geometry) m.geometry.dispose(); }); };
    return g;
  };

  // ---------------------------------------------------------------- station sign texture
  const SIGN_W = 512, SIGN_H = 128;
  function paintSign(ctx) {
    const c = ctx.canvas; c.width = SIGN_W; c.height = SIGN_H;
    const g = ctx.createLinearGradient(0, 0, 0, SIGN_H);
    g.addColorStop(0, '#1f6b45'); g.addColorStop(1, '#154d32');
    ctx.fillStyle = g; ctx.fillRect(0, 0, SIGN_W, SIGN_H);
    ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, SIGN_W - 12, SIGN_H - 12);
    VR.drawLemon(ctx, 78, 64, 30, -0.4);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 64px "Baloo Bhaijaan 2", "Lalezar", Tahoma, sans-serif';
    ctx.direction = 'rtl';
    ctx.fillText('محطة ليمونات', 300, 62);
  }
  VR.Tex.register('sign', (ctx) => paintSign(ctx), true);
  VR.Mat.define('sign', { map: 'sign', rough: 0.45 });
  // repaint once web fonts are ready
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
    const t = VR.Tex.get('sign'); paintSign(t.image.getContext('2d')); t.needsUpdate = true;
  });

  // ---------------------------------------------------------------- track
  function ballast(mb, len = L, zc = -L / 2) {
    mb.box('gravel', 0x8a8076, 0, -0.3, zc, HALF_TRACK * 2, 0.4, len);
    for (const s of [-1, 1]) mb.box('gravel', 0x7c736a, s * (HALF_TRACK + 0.3), -0.48, zc, 0.9, 0.3, len, { rz: -s * 0.45 });
  }
  function rails(mb, zFrom = 0, zTo = -L) {
    const len = Math.abs(zTo - zFrom), zc = (zFrom + zTo) / 2;
    for (const lane of [-1, 0, 1]) {
      const x = lane * LW;
      for (let z = zFrom - 0.35; z > zTo; z -= 0.7) mb.box('concrete', 0xa29d95, x, -0.09, z, 2.3, 0.16, 0.26);
      for (const s of [-1, 1]) {
        const rx = x + s * 0.72;
        mb.box('metal', 0x4a4038, rx, 0.0, zc, 0.15, 0.03, len);      // foot
        mb.box('metal', 0x5a4c40, rx, 0.06, zc, 0.03, 0.1, len);      // web
        mb.box('rail', 0xc9c6c0, rx, 0.125, zc, 0.075, 0.05, len);    // polished head
      }
    }
  }
  // overhead line: poles, cantilevers, wires
  function catenary(mb, zc = -L / 2) {
    for (const [side, z] of [[-1, -10], [1, -30]]) {
      const x = side * (HALF_TRACK + 0.9);
      mb.box('metal', 0x5d646d, x, 3.4, z, 0.26, 6.8, 0.26);
      mb.box('concrete', 0x8e8a84, x, 0.1, z, 0.7, 0.4, 0.7);
      mb.box('wire', 0x5d646d, x - side * (HALF_TRACK + 0.8) / 1, 6.4, z, HALF_TRACK * 2 + 1.6, 0.14, 0.14);   // gantry beam
      mb.box('wire', 0x5d646d, x - side * 1.3, 5.7, z, 2.6, 0.08, 0.08, { rz: side * 0.5 });
      for (const lane of [-1, 0, 1]) mb.box('wire', 0x3a3f45, lane * LW, 6.0, z, 0.05, 0.8, 0.05);
    }
    for (const lane of [-1, 0, 1]) {
      mb.box('wire', 0x2b2f34, lane * LW, 5.6, zc, 0.03, 0.03, L);
      mb.box('wire', 0x2b2f34, lane * LW, 6.2, zc, 0.03, 0.03, L);
    }
  }
  function signal(mb, x, z, side) {
    mb.cyl('metal', 0x2f3338, x, 1.6, z, 0.07, 0.09, 3.2, { seg: 8 });
    mb.box('metal', 0x1d1f23, x, 3.2, z, 0.36, 0.9, 0.3, { r: 0.08 });
    mb.sphere('neon', 0x3dff7a, x, 3.45, z + 0.16, 0.08, { seg: 8 });
    mb.sphere('std', 0x401010, x, 3.1, z + 0.16, 0.08, { seg: 8 });
  }

  // half-tube with inward-facing normals (tunnel vault), axis along z
  function vaultGeometry(R, len, seg = 20) {
    const pos = [], nor = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * PI;
      const x = Math.cos(a) * R, y = Math.sin(a) * R;
      for (const z of [0, -len]) { pos.push(x, y, z); nor.push(-Math.cos(a), -Math.sin(a), 0); }
      if (i < seg) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }
  // outward-facing half tube (the outside of the tunnel)
  function shellGeometry(R, len, seg = 16) {
    const pos = [], nor = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * PI, x = Math.cos(a) * R, y = Math.sin(a) * R;
      for (const z of [0, -len]) { pos.push(x, y, z); nor.push(Math.cos(a), Math.sin(a), 0); }
      if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }
  // portal facade with an arched hole
  function portalGeometry(R, W, H, depth) {
    const s = new T.Shape();
    s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H); s.lineTo(-W / 2, 0);
    const hole = new T.Path();
    hole.moveTo(R, 0); hole.absarc(0, 0, R, 0, PI, false); hole.lineTo(R, 0);
    s.holes.push(hole);
    const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 20 });
    g.translate(0, 0, -depth / 2);
    return g;
  }

  const TUNNEL_R = HALF_TRACK + 1.4;
  const TRACK = {
    normal() {
      const mb = new VR.MB(3);
      ballast(mb); rails(mb); catenary(mb);
      signal(mb, -HALF_TRACK - 0.6, -24, -1);
      return mb;
    },
    station() {
      const mb = new VR.MB(4);
      ballast(mb); rails(mb);
      for (const s of [-1, 1]) {
        const px = s * (HALF_TRACK + 3.2);
        mb.box('concrete', 0xb8b2a6, px, 0.45, -L / 2, 6.0, 1.3, L - 1);
        mb.box('tiles', 0xdcd6ca, px, 1.12, -L / 2, 6.0, 0.04, L - 1);
        mb.box('std', 0xf2c230, s * (HALF_TRACK + 0.45), 1.15, -L / 2, 0.45, 0.03, L - 1);
        // canopy
        for (let z = -4; z > -L; z -= 8) {
          mb.cyl('metal', 0x39424d, s * (HALF_TRACK + 4.6), 3.2, z, 0.12, 0.14, 4.2, { seg: 10 });
          mb.box('metal', 0x39424d, s * (HALF_TRACK + 3.4), 5.25, z, 3.6, 0.14, 0.14, { rz: s * 0.12 });
        }
        mb.box('paint', 0xe9e4da, s * (HALF_TRACK + 3.3), 5.5, -L / 2, 6.6, 0.18, L - 1, { rz: s * 0.12 });
        mb.box('glass', 0x7fb6d9, s * (HALF_TRACK + 3.3), 5.62, -L / 2, 2.2, 0.05, L - 2, { rz: s * 0.12 });
        for (let z = -6; z > -L; z -= 8) mb.box('glow', 0xfff1d0, s * (HALF_TRACK + 2.4), 5.32, z, 0.18, 0.05, 2.4);
        // benches, lamps, bins
        for (let z = -9; z > -L; z -= 14) {
          mb.box('wood', 0xb07d45, s * (HALF_TRACK + 4.4), 1.55, z, 0.5, 0.08, 2.2);
          mb.box('wood', 0xb07d45, s * (HALF_TRACK + 4.7), 1.85, z, 0.08, 0.45, 2.2);
          mb.box('metal', 0x39424d, s * (HALF_TRACK + 4.45), 1.33, z - 0.9, 0.4, 0.4, 0.08);
          mb.box('metal', 0x39424d, s * (HALF_TRACK + 4.45), 1.33, z + 0.9, 0.4, 0.4, 0.08);
        }
        // station name sign (textured plane facing the tracks)
        const sg = new T.PlaneGeometry(4, 1);
        mb.box('metal', 0x2b3038, s * (HALF_TRACK + 2.2), 3.55, -20, 0.12, 1.2, 4.2);
        mb.geo('sign', 0xffffff, sg, s * (HALF_TRACK + 2.13), 3.55, -20, { ry: -s * PI / 2, keepUV: true });
        mb.box('metal', 0x39424d, s * (HALF_TRACK + 2.2), 2.4, -18.3, 0.1, 2.4, 0.1);
        mb.box('metal', 0x39424d, s * (HALF_TRACK + 2.2), 2.4, -21.7, 0.1, 2.4, 0.1);
        // lemonade stand & crates
        mb.at(0, 1.14, 0); VR.Props.stall(mb, s * (HALF_TRACK + 4.2), -30, VR.rng(9 + s), -s); mb.at(0, 0, 0);
        VR.Props.crate(mb, s * (HALF_TRACK + 3.4), 1.14, -13, VR.rng(3), true);
        VR.Props.crate(mb, s * (HALF_TRACK + 3.4), 1.14, -14.1, VR.rng(4), true);
        VR.Props.crate(mb, s * (HALF_TRACK + 3.4), 1.66, -13.5, VR.rng(5), true);
      }
      return mb;
    },
    bridge() {
      const mb = new VR.MB(5);
      mb.box('concrete', 0x9d978d, 0, -0.55, -L / 2, HALF_TRACK * 2 + 1.2, 0.9, L);
      mb.box('gravel', 0x857b70, 0, -0.14, -L / 2, HALF_TRACK * 2, 0.08, L);
      rails(mb);
      // steel truss on both sides
      const steel = 0xc75b3d;
      for (const s of [-1, 1]) {
        const x = s * (HALF_TRACK + 0.8);
        mb.box('paint', steel, x, 0.05, -L / 2, 0.35, 0.35, L);
        mb.box('paint', steel, x, 5.2, -L / 2, 0.35, 0.35, L);
        for (let z = 0; z >= -L; z -= 5) mb.box('paint', steel, x, 2.62, z - 0.001, 0.28, 5.2, 0.28);
        for (let z = -2.5; z > -L; z -= 5) mb.box('paint', steel, x, 2.62, z, 0.2, 5.8, 0.2, { rx: (z / 5) % 2 ? 0.76 : -0.76 });
        for (let z = -2.5; z > -L; z -= 5) mb.box('paint', VR.C.shade(steel, 0.85), 0, 5.35, z, HALF_TRACK * 2 + 1.6, 0.2, 0.2);
      }
      for (const z of [-2, -22]) {
        mb.box('concrete', 0x8d877c, 0, -9, z - 1.5, HALF_TRACK * 2 + 1, 16, 3);
        mb.box('concrete', 0x7d776c, 0, -1.2, z - 1.5, HALF_TRACK * 2 + 2, 0.6, 3.4);
      }
      return mb;
    },
    tunnel(opts) {
      const mb = new VR.MB(6);
      ballast(mb); rails(mb);
      const R = TUNNEL_R;
      mb.geo('concrete', 0x8e8981, vaultGeometry(R, L), 0, -0.1, 0);
      // walkway ledges + light strips
      for (const s of [-1, 1]) {
        mb.box('concrete', 0x77726b, s * (R - 0.45), 0.3, -L / 2, 0.9, 0.8, L);
        for (let z = -2.5; z > -L; z -= 5) {
          const a = s > 0 ? 0.35 : PI - 0.35;
          mb.box('glow', 0xffd79a, Math.cos(a) * (R - 0.08), Math.sin(a) * (R - 0.08), z, 0.1, 0.45, 1.6, { rz: a - PI / 2 });
        }
        mb.box('metal', 0x3a3530, s * (R - 0.2), 1.6, -L / 2, 0.12, 0.12, L);
      }
      // the hill the tunnel is bored through: rock shell + grassy lumps,
      // kept behind the entrance portal so the camera never clips into it
      const r = VR.rng(opts.start ? 21 : 22);
      const z0 = opts.start ? -1.2 : 0, z1 = opts.end ? -L + 1.2 : -L;
      mb.geo('flat', 0x8b8577, shellGeometry(R + 1.3, z0 - z1), 0, -0.1, z0);
      for (let z = z0 - 6; z > z1 + 3; z -= 7) {
        mb.blob('flat', VR.C.jitter(0x7a8f52, 0.08, r), (r() - 0.5) * 4, R + 5.0 + r() * 1.2, z, 9, { sx: 1.5, sy: 0.42, sz: 0.62, detail: 1, seed: 5 + (z | 0) });
        for (const s of [-1, 1]) mb.blob('flat', VR.C.jitter(0x8b8577, 0.08, r), s * (R + 7 + r() * 3), 1.5 + r() * 2, z, 7, { sy: 0.7, sz: 0.75, detail: 1, seed: 9 });
      }
      mb.at(0, R + 7.6, 0);
      for (let i = 0; i < 7; i++) {
        const z = z0 - 5 - r() * (z0 - z1 - 10);
        VR.Props.pine(mb, (r() < 0.5 ? -1 : 1) * (2 + r() * 8), z, r, 5 + r() * 3);
      }
      mb.at(0, 0, 0);
      const portal = (z) => {
        mb.geo('stone', 0xcfc3a5, portalGeometry(R, R * 2 + 6, R + 3, 1.2), 0, -0.1, z);
        mb.box('stone', 0xbfb393, 0, R + 3.1, z, R * 2 + 7, 0.5, 1.6);
        mb.box('hazard', 0xffffff, 0, R + 1.2, z + 0.62, 4, 0.5, 0.02);
      };
      if (opts.start) portal(-0.6);
      if (opts.end) portal(-L + 0.6);
      return mb;
    },
  };
  VR.TUNNEL_R = TUNNEL_R;

  VR.TRACK_STYLES = {
    normal: () => TRACK.normal(),
    station: () => TRACK.station(),
    bridge: () => TRACK.bridge(),
    tunnel_start: () => TRACK.tunnel({ start: true }),
    tunnel_end: () => TRACK.tunnel({ end: true }),
  };

  // ---------------------------------------------------------------- ground
  // gentle hills away from the track, periodic in z so chunk seams match,
  // symmetric in x so mirrored scenery lines up on both sides
  VR.groundH = function (x, z, biome) {
    const hills = biome ? (biome.ground.hills ?? 1) : 1;
    const ax = Math.abs(x);
    const far = Math.max(0, ax - 10) / 30;
    return hills * far * far * (3 + 2.2 * Math.sin(z / L * PI * 2 + ax * 0.21) + 1.4 * Math.sin(z / L * PI * 4 - ax * 0.37));
  };
  function groundGeo(biome, side, w) {
    const g = new T.PlaneGeometry(w, L, 22, 10);
    g.rotateX(-PI / 2);
    g.translate(side * (HALF_TRACK + 0.2 + w / 2), 0, -L / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, VR.groundH(p.getX(i), p.getZ(i), biome));
    g.computeVertexNormals();
    return g;
  }
  VR.buildGround = function (biome) {
    const mb = new VR.MB(8);
    const gd = biome.ground, w = 100;
    const c1 = new T.Color(gd.color), c2 = new T.Color(gd.color2 || gd.color), col = new T.Color();
    for (const side of [-1, 1]) {
      const geo = groundGeo(biome, side, w);
      mb.add(geo, gd.mat, 0xffffff, new T.Matrix4().makeTranslation(0, -0.52, 0));
      // paint two-tone patches (MB colours are uniform per primitive)
      const b = mb.buckets[gd.mat], n = geo.attributes.position.count, start = b.col.length - n * 3;
      for (let i = 0; i < n; i++) {
        const x = Math.abs(geo.attributes.position.getX(i)), z = geo.attributes.position.getZ(i);
        const t = 0.5 + 0.5 * Math.sin(x * 0.23 + Math.sin(z / L * PI * 2) * 2) * Math.sin(z / L * PI * 4 + x * 0.05);
        col.copy(c1).lerp(c2, t);
        b.col[start + i * 3] = col.r; b.col[start + i * 3 + 1] = col.g; b.col[start + i * 3 + 2] = col.b;
      }
      mb.box(gd.mat, VR.C.shade(gd.color, 0.88), side * (HALF_TRACK + 0.8), -0.5, -L / 2, 1.4, 0.06, L);
    }
    return mb;
  };
  // water plane (animated shader) + river banks
  const waterUniforms = { uTime: { value: 0 }, uDeep: { value: new T.Color(0x1f6f8b) }, uShallow: { value: new T.Color(0x5cc6d0) }, uSky: { value: new T.Color(0xbfe6ff) } };
  VR.waterUniforms = waterUniforms;
  const waterMat = new T.ShaderMaterial({
    uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, {}]), fog: true,
    vertexShader: `varying vec3 vW; varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vUv = uv; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uDeep, uShallow, uSky; varying vec3 vW; varying vec2 vUv;
      #include <fog_pars_fragment>
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 p = vW.xz * 0.35;
        float w = n(p + vec2(uTime*0.4, uTime*0.25)) * 0.6 + n(p*2.3 - vec2(uTime*0.3, -uTime*0.5)) * 0.4;
        float edge = smoothstep(18.0, 50.0, abs(vW.x));
        vec3 c = mix(uDeep, uShallow, w * 0.55 + edge * 0.35);
        float spark = smoothstep(0.82, 0.95, w);
        c = mix(c, uSky, 0.25) + vec3(1.0, 0.97, 0.9) * spark * 0.9;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  waterMat.uniforms.uTime = waterUniforms.uTime; waterMat.uniforms.uDeep = waterUniforms.uDeep;
  waterMat.uniforms.uShallow = waterUniforms.uShallow; waterMat.uniforms.uSky = waterUniforms.uSky;
  VR.buildWater = function (biome) {
    const mb = new VR.MB(9);
    for (const s of [-1, 1]) {
      mb.blob('flat', VR.C.jitter(biome.ground.color, 0.05, VR.rng(s + 3)), s * 70, -8, -L / 2, 28, { sy: 0.4, sz: 1.2, detail: 1, seed: 11 });
      VR.Props.rock(mb, s * 16, -12, VR.rng(4), 3);
    }
    const grp = mb.build();
    const water = new T.Mesh(new T.PlaneGeometry(200, L).rotateX(-PI / 2).translate(0, -7.2, -L / 2), waterMat);
    water.receiveShadow = false; water.matrixAutoUpdate = false;
    grp.add(water);
    return { build: () => grp };
  };

  // ---------------------------------------------------------------- trains
  VR.TRAIN_COLORS = [0xd8392b, 0x2f7fd0, 0x3fa34d, 0xf2b630, 0x7a4fc2, 0xeeeeee, 0xe3702a];
  const CAR_LEN = 9, CAR_W = 2.25, CAR_H = 3.0;
  VR.CAR_LEN = CAR_LEN; VR.TRAIN_HEIGHT = CAR_H;
  const dk = (c, f = 0.7) => VR.C.shade(c, f);

  function bogies(mb, len) {
    for (const z of [-1.7, -len + 1.7]) {
      mb.box('metal', 0x2a2d31, 0, 0.42, z, CAR_W - 0.35, 0.3, 2.6, { r: 0.06 });
      for (const dz of [-0.75, 0.75]) for (const s of [-1, 1]) {
        mb.cyl('metal', 0x3a3d42, s * 0.75, 0.33, z + dz, 0.33, 0.33, 0.14, { rz: PI / 2, seg: 16 });
        mb.cyl('chrome', 0xb8bec6, s * 0.83, 0.33, z + dz, 0.12, 0.12, 0.04, { rz: PI / 2, seg: 10 });
      }
    }
    mb.box('metal', 0x1d1f23, 0, 0.62, -len / 2, CAR_W - 0.5, 0.25, len - 1.5);
  }
  function carShell(mb, color, len, opts = {}) {
    const body = opts.bodyMat || 'paint';
    mb.box(body, color, 0, 1.78, -len / 2, CAR_W, 2.44, len - 0.3, { r: 0.28 });
    mb.box('paint', dk(color, 0.55), 0, 0.82, -len / 2, CAR_W + 0.02, 0.36, len - 0.5, { r: 0.1 });            // skirt
    mb.box('paint', 0xf4f2ec, 0, 1.3, -len / 2, CAR_W + 0.03, 0.14, len - 0.6);                                // livery stripe
    mb.box('paint', 0xffd43b, 0, 1.16, -len / 2, CAR_W + 0.03, 0.06, len - 0.6);
    mb.box('metal', 0x8f969e, 0, CAR_H - 0.02, -len / 2, CAR_W - 0.5, 0.1, len - 0.8, { r: 0.04 });            // roof
  }
  function windows(mb, color, len, z0 = -1.2, step = 1.75, zEnd = -len + 1.0) {
    mb.box('glass', 0x16202b, 0, 2.05, (z0 + zEnd) / 2, CAR_W + 0.035, 0.78, Math.abs(zEnd - z0), { r: 0.08 });
    for (let z = z0; z >= zEnd; z -= step) mb.box('paint', color, 0, 2.05, z, CAR_W + 0.05, 0.84, 0.14);
    // doors
    for (const z of [-len * 0.3, -len * 0.7]) for (const s of [-1, 1]) {
      mb.box('paint', dk(color, 0.8), s * (CAR_W / 2 + 0.02), 1.7, z, 0.04, 2.1, 1.3, { r: 0.02 });
      mb.box('glass', 0x16202b, s * (CAR_W / 2 + 0.04), 2.1, z, 0.03, 0.9, 0.9);
    }
  }
  function gangway(mb, len) {
    mb.box('std', 0x1b1c1f, 0, 1.7, -len + 0.08, 1.5, 2.2, 0.3, { r: 0.08 });
  }
  const CARS = {
    passenger(color) {
      const mb = new VR.MB(20);
      bogies(mb, CAR_LEN); carShell(mb, color, CAR_LEN); windows(mb, color, CAR_LEN); gangway(mb, CAR_LEN);
      mb.box('metal', 0xa9b0b8, 0, CAR_H + 0.18, -CAR_LEN / 2, 1.2, 0.3, 2.2, { r: 0.1 });                     // AC unit
      mb.box('std', 0x1b1c1f, 0, 1.7, -0.15, 1.5, 2.2, 0.3, { r: 0.08 });
      return mb;
    },
    freight(color) {
      const mb = new VR.MB(21);
      bogies(mb, CAR_LEN);
      mb.box('metal', 0x3a3d42, 0, 0.9, -CAR_LEN / 2, CAR_W, 0.3, CAR_LEN - 0.3);
      mb.box('container', color, 0, 2.0, -CAR_LEN / 2, CAR_W - 0.05, 1.95, CAR_LEN - 0.9);
      for (const z of [-0.5, -CAR_LEN + 0.5]) for (const s of [-1, 1]) for (const y of [1.05, 2.95])
        mb.box('metal', dk(color, 0.5), s * (CAR_W / 2 - 0.05), y, z, 0.14, 0.14, 0.14);
      mb.box('container', dk(color, 0.85), 0, 2.0, -0.44, CAR_W - 0.1, 1.9, 0.04);
      for (let i = 0; i < 4; i++) mb.box('metal', 0xc9ced4, -0.3 + i * 0.2, 2.0, -0.42, 0.03, 1.6, 0.05);
      mb.box('paint', 0xffffff, CAR_W / 2 - 0.02, 2.5, -CAR_LEN / 2, 0.02, 0.36, 2.4);
      return mb;
    },
    tanker(color) {
      const mb = new VR.MB(22);
      bogies(mb, CAR_LEN);
      mb.box('metal', 0x2a2d31, 0, 0.9, -CAR_LEN / 2, CAR_W, 0.25, CAR_LEN - 0.3);
      mb.cyl('paint', color, 0, 1.95, -CAR_LEN / 2, 1.05, 1.05, CAR_LEN - 2.2, { rx: PI / 2, seg: 24 });
      for (const z of [-1.1, -CAR_LEN + 1.1]) mb.sphere('paint', color, 0, 1.95, z, 1.05, { sz: 0.45, seg: 24 });
      for (const z of [-2.5, -CAR_LEN / 2, -CAR_LEN + 2.5]) mb.torus('metal', dk(color, 0.6), 0, 1.95, z, 1.06, 0.05, { seg: 28 });
      mb.box('metal', 0x7c838c, 0, CAR_H + 0.02, -CAR_LEN / 2, 0.8, 0.06, CAR_LEN - 3);
      mb.cyl('metal', 0x7c838c, 0, CAR_H + 0.05, -CAR_LEN / 2, 0.35, 0.35, 0.25, { seg: 14 });
      return mb;
    },
    loco(color) {
      const mb = new VR.MB(23);
      bogies(mb, CAR_LEN); gangway(mb, CAR_LEN);
      // body a bit shorter at the front to make room for the nose
      mb.box('paint', color, 0, 1.78, -CAR_LEN / 2 - 0.9, CAR_W, 2.44, CAR_LEN - 2.1, { r: 0.28 });
      mb.box('paint', dk(color, 0.55), 0, 0.82, -CAR_LEN / 2, CAR_W + 0.02, 0.36, CAR_LEN - 0.5, { r: 0.1 });
      mb.box('paint', 0xf4f2ec, 0, 1.3, -CAR_LEN / 2 - 0.4, CAR_W + 0.03, 0.14, CAR_LEN - 1.4);
      mb.box('paint', 0xffd43b, 0, 1.16, -CAR_LEN / 2 - 0.4, CAR_W + 0.03, 0.06, CAR_LEN - 1.4);
      mb.box('metal', 0x8f969e, 0, CAR_H - 0.02, -CAR_LEN / 2 - 0.8, CAR_W - 0.5, 0.1, CAR_LEN - 2.4, { r: 0.04 });
      windows(mb, color, CAR_LEN, -3.2, 1.75, -CAR_LEN + 1.0);
      // aerodynamic nose (faces +z, toward the player)
      mb.box('paint', color, 0, 1.45, -1.05, CAR_W, 1.8, 2.0, { r: 0.45 });
      mb.box('paint', color, 0, 2.35, -1.3, CAR_W - 0.02, 1.4, 1.6, { r: 0.5, rx: -0.55 });
      mb.box('glass', 0x101820, 0, 2.3, -0.92, CAR_W - 0.35, 0.95, 0.12, { r: 0.05, rx: -0.55 });
      mb.box('paint', dk(color, 0.5), 0, 0.72, -0.2, CAR_W + 0.04, 0.4, 0.4, { r: 0.1 });
      mb.box('hazard', 0xffffff, 0, 0.72, -0.01, CAR_W - 0.2, 0.28, 0.04);
      for (const s of [-1, 1]) {
        mb.box('metal', 0x15181c, s * 0.72, 1.28, -0.06, 0.5, 0.26, 0.06, { r: 0.05 });
        mb.box('neon', 0xfff4d6, s * 0.72, 1.28, -0.03, 0.4, 0.16, 0.04, { r: 0.04 });
      }
      mb.sphere('gloss', 0xffd43b, 0, 1.7, -0.07, 0.22, { sx: 1.3, sz: 0.35, seg: 16 });   // lemon emblem
      mb.box('leaf', 0x2f8a45, 0.2, 1.88, -0.08, 0.14, 0.05, 0.05, { rz: 0.5 });
      // pantograph
      mb.box('metal', 0x3a3f45, 0, CAR_H + 0.1, -4.5, 0.9, 0.12, 0.9);
      mb.box('metal', 0x3a3f45, 0, CAR_H + 0.9, -4.3, 0.06, 1.6, 0.06, { rx: 0.7 });
      mb.box('metal', 0x3a3f45, 0, CAR_H + 1.6, -4.1, 1.2, 0.06, 0.08);
      return mb;
    },
  };
  VR.CAR_BUILDERS = CARS;

  // ---------------------------------------------------------------- obstacles
  const hw = 1.12;
  VR.OBSTACLE_TYPES = {
    barrier_low: {                                   // JUMP over
      kind: 'jump', length: 0.5, standable: true,
      colliders: [{ x0: -hw, x1: hw, y0: 0, y1: 1.0, z0: -0.5, z1: 0 }],
      build() {
        const mb = new VR.MB(30);
        for (const s of [-1, 1]) {
          mb.box('metal', 0xd9dde2, s * 0.95, 0.48, -0.25, 0.08, 1.0, 0.08, { rx: 0.25 });
          mb.box('metal', 0xd9dde2, s * 0.95, 0.48, -0.25, 0.08, 1.0, 0.08, { rx: -0.25 });
          mb.box('metal', 0x2b2f34, s * 0.95, 0.03, -0.25, 0.2, 0.06, 0.6);
        }
        mb.box('redwhite', 0xffffff, 0, 0.72, -0.25, 2.3, 0.42, 0.08, { r: 0.03 });
        mb.box('redwhite', 0xffffff, 0, 0.3, -0.25, 2.2, 0.16, 0.06);
        mb.sphere('neon', 0xff9a2a, 0, 1.0, -0.25, 0.1, { seg: 10 });
        mb.cyl('metal', 0x2b2f34, 0, 0.94, -0.25, 0.06, 0.07, 0.06, { seg: 8 });
        return mb;
      },
    },
    barrier_high: {                                  // SLIDE under
      kind: 'slide', length: 0.5, standable: false,
      colliders: [{ x0: -hw, x1: hw, y0: 1.05, y1: 3.2, z0: -0.5, z1: 0 }],
      build() {
        const mb = new VR.MB(31);
        for (const s of [-1, 1]) {
          mb.box('hazard', 0xffffff, s * 1.12, 1.6, -0.25, 0.16, 3.2, 0.16);
          mb.box('metal', 0x2b2f34, s * 1.12, 0.05, -0.25, 0.4, 0.1, 0.4);
        }
        mb.box('redwhite', 0xffffff, 0, 1.55, -0.25, 2.4, 0.9, 0.12, { r: 0.04 });
        mb.box('metal', 0x2b2f34, 0, 1.08, -0.25, 2.4, 0.08, 0.16);
        mb.box('metal', 0x2b2f34, 0, 2.35, -0.25, 2.4, 0.5, 0.16, { r: 0.05 });
        mb.box('std', 0xffd43b, 0, 2.35, -0.16, 1.9, 0.34, 0.02);
        for (const x of [-0.7, 0, 0.7]) mb.box('std', 0x1d1d1f, x, 2.35, -0.15, 0.32, 0.12, 0.02, { rz: 0.4 });
        for (const s of [-1, 1]) mb.sphere('neon', 0xff3b30, s * 1.12, 3.28, -0.25, 0.12, { seg: 10 });
        return mb;
      },
    },
    minecart: {                                      // JUMP over (or land on it) — a lemon cart
      kind: 'jump', length: 1.8, standable: true,
      colliders: [{ x0: -0.95, x1: 0.95, y0: 0, y1: 1.1, z0: -1.8, z1: 0 }],
      build() {
        const mb = new VR.MB(32);
        const r = VR.rng(7);
        mb.box('wood', 0xa8743e, 0, 0.62, -0.9, 1.8, 0.5, 1.7, { r: 0.05 });
        mb.box('wood', 0x8a5a2e, 0, 0.9, -0.9, 1.9, 0.08, 1.8);
        mb.box('hazard', 0xffffff, 0, 0.62, -0.04, 1.5, 0.16, 0.03);            // reflector strip
        for (const s of [-1, 1]) for (const z of [-0.35, -1.45]) {
          mb.cyl('wood', 0x5a3a1e, s * 0.95, 0.3, z, 0.3, 0.3, 0.1, { rz: PI / 2, seg: 14 });
          mb.cyl('metal', 0x333333, s * 1.0, 0.3, z, 0.08, 0.08, 0.06, { rz: PI / 2, seg: 8 });
        }
        mb.blob('leaf', 0x3f8a36, 0, 0.95, -0.9, 0.7, { sy: 0.25, sz: 1.1 });
        for (let i = 0; i < 16; i++) VR.Props.lemon(mb, (r() - 0.5) * 1.4, 0.88 + r() * 0.15, -0.9 + (r() - 0.5) * 1.3, 1.5, r() * 3);
        mb.box('wood', 0x7a5530, 0, 0.8, 0.25, 0.1, 0.1, 0.8, { rx: 0.3 });
        return mb;
      },
    },
    hay: {                                           // JUMP over — stacked lemon crates
      kind: 'jump', length: 1.2, standable: true,
      colliders: [{ x0: -hw, x1: hw, y0: 0, y1: 1.05, z0: -1.2, z1: 0 }],
      build() {
        const mb = new VR.MB(33);
        const r = VR.rng(11);
        for (const x of [-0.55, 0.5]) {
          mb.box('wood', 0xb07d45, x, 0.26, -0.6, 1.0, 0.52, 1.1, { ry: (r() - 0.5) * 0.1 });
          mb.box('wood', 0x8a5a2e, x, 0.5, -0.6, 1.04, 0.06, 1.14);
          mb.box('wood', 0xb07d45, x + 0.03, 0.78, -0.6, 1.0, 0.52, 1.1, { ry: (r() - 0.5) * 0.12 });
          mb.box('wood', 0x8a5a2e, x + 0.03, 1.02, -0.6, 1.04, 0.06, 1.14);
          for (let i = 0; i < 6; i++) VR.Props.lemon(mb, x + ((i % 3) - 1) * 0.28, 0.98, -0.6 + ((i / 3 | 0) - 0.5) * 0.4, 1.4, r() * 3);
        }
        mb.box('hazard', 0xffffff, 0, 0.28, 0.0, 2.1, 0.12, 0.03);               // reflector strip
        return mb;
      },
    },
    wall: {                                          // must change lane
      kind: 'block', length: 1.2, standable: true,
      colliders: [{ x0: -hw, x1: hw, y0: 0, y1: 3.0, z0: -1.2, z1: 0 }],
      build() {
        const mb = new VR.MB(34);
        mb.box('concrete', 0xb9b3a8, 0, 1.5, -0.6, 2.3, 3.0, 1.2, { r: 0.08 });
        mb.box('hazard', 0xffffff, 0, 2.3, -0.005, 2.3, 0.5, 0.04);
        mb.box('hazard', 0xffffff, 0, 0.35, -0.005, 2.3, 0.3, 0.04);
        mb.box('std', 0x2f8a45, 0, 1.3, 0.0, 1.2, 0.9, 0.03, { r: 0.02 });
        mb.sphere('gloss', 0xffd43b, 0, 1.3, 0.02, 0.3, { sx: 1.35, sz: 0.2, seg: 16 });
        for (const s of [-1, 1]) mb.sphere('neon', 0xff3b30, s * 0.8, 3.08, -0.3, 0.13, { seg: 10 });
        return mb;
      },
    },
    ramp: {                                          // walk up onto trains
      kind: 'ramp', length: 7, standable: true, rampHeight: CAR_H,
      colliders: [],
      build() {
        const mb = new VR.MB(35);
        const ang = Math.atan2(CAR_H, 7), len = Math.hypot(7, CAR_H);
        mb.box('metal', 0x8c949d, 0, CAR_H / 2 - 0.06, -3.5, 2.1, 0.12, len, { rx: ang });
        for (let i = 1; i < 14; i++) {
          const t = i / 14;
          mb.box('std', 0x2b2f34, 0, CAR_H * t + 0.005, -7 * t, 1.9, 0.03, 0.07, { rx: ang });
        }
        for (const s of [-1, 1]) {
          mb.box('std', 0xffd43b, s * 1.02, CAR_H / 2, -3.5, 0.08, 0.14, len, { rx: ang });
          for (const z of [-2, -4.5, -6.5]) mb.box('metal', 0x5d646d, s * 0.9, CAR_H * (-z / 7) / 2, z, 0.12, CAR_H * (-z / 7), 0.12);
        }
        mb.box('metal', 0x5d646d, 0, CAR_H - 0.3, -6.8, 2.0, 0.12, 0.12);
        return mb;
      },
    },
  };
})();

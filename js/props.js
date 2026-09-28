/* =====================================================================
 * PROPS — reusable scenery pieces, all drawn into a VR.MB builder.
 * Every function places its prop standing on the ground (y = 0 unless
 * a y is passed).  Stylised low-poly nature (flat shaded) + smooth,
 * glossy man-made things.  Add your own here and use them in biomes.js.
 * ===================================================================== */
(function () {
  const PI = Math.PI;
  const LEAF = 0x2f7a32, LEMON = 0xffd43b;

  // extra textures / materials used by props
  VR.Tex.register('facade', (ctx, s, r) => {       // city windows (grey detail map)
    ctx.fillStyle = '#9a9aa0'; ctx.fillRect(0, 0, s, s);
    const cols = 4, rows = 3, cw = s / cols, rh = s / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      ctx.fillStyle = '#3a3f4a'; ctx.fillRect(x * cw + cw * 0.18, y * rh + rh * 0.22, cw * 0.64, rh * 0.56);
      ctx.fillStyle = '#c8c8cc'; ctx.fillRect(x * cw + cw * 0.18, y * rh + rh * 0.78, cw * 0.64, rh * 0.04);
    }
  });
  VR.Tex.register('facadeLit', (ctx, s, r) => {    // which windows glow at night (colour)
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, s, s);
    const cols = 8, rows = 6, cw = s / cols, rh = s / rows;
    const warm = ['#ffcf7a', '#ffe2a8', '#ffd08a', '#bfe3ff', '#fff1c9'];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (r() < 0.62) continue;
      ctx.fillStyle = warm[(r() * warm.length) | 0];
      ctx.fillRect(x * cw + cw * 0.22, y * rh + rh * 0.26, cw * 0.56, rh * 0.48);
    }
  }, true);
  VR.Mat.define('facade', { map: 'facade', uv: 0.125, rough: 0.6, metal: 0.2 });
  const facadeMat = VR.Mat.get('facade');
  facadeMat.emissiveMap = (() => { const t = VR.Tex.get('facadeLit'); t.repeat.set(0.5, 0.5); return t; })();
  facadeMat.emissive.setHex(0xffffff);
  facadeMat.emissiveIntensity = 0;              // raised at night by game.js
  VR.nightMaterials = [facadeMat];

  const P = {
    // ---------------------------------------------------------- fruit
    lemon(mb, x, y, z, s = 1, ry = 0) {
      mb.sphere('gloss', LEMON, x, y + 0.1 * s, z, 0.1 * s, { sx: 1, sy: 0.92, sz: 1.35, ry, seg: 7, hseg: 5 });
    },

    // ---------------------------------------------------------- trees
    lemonTree(mb, x, z, rnd, h = 2.6) {
      mb.cyl('bark', 0x6b4a2e, x, h * 0.3, z, 0.12, 0.17, h * 0.6, { seg: 7, rz: (rnd() - 0.5) * 0.2 });
      mb.cyl('bark', 0x6b4a2e, x + 0.2, h * 0.65, z, 0.07, 0.1, h * 0.5, { seg: 6, rz: -0.5 });
      mb.cyl('bark', 0x6b4a2e, x - 0.2, h * 0.65, z, 0.07, 0.1, h * 0.5, { seg: 6, rz: 0.55 });
      const blobs = [[0, h + 0.3, 0, 1.35], [0.8, h, 0.3, 1.0], [-0.8, h + 0.05, -0.2, 1.05], [0.2, h - 0.1, -0.8, 0.95], [-0.1, h + 0.1, 0.85, 0.95], [0.1, h + 1.0, 0.1, 0.85]];
      for (const [dx, dy, dz, r] of blobs) mb.blob('leaf', VR.C.jitter(LEAF, 0.12, rnd), x + dx, dy, z + dz, r, { sy: 0.82, detail: 1 });
      const n = 7 + ((rnd() * 4) | 0);
      for (let i = 0; i < n; i++) {
        const a = rnd() * PI * 2, rr = 1.0 + rnd() * 0.55, yy = h - 0.45 + rnd() * 1.1;
        P.lemon(mb, x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr, 1.5, rnd() * 3);
      }
      if (rnd() < 0.7) P.lemon(mb, x + 1.2 + rnd(), 0, z + rnd() - 0.5, 1.5, rnd() * 3);
    },
    oliveTree(mb, x, z, rnd, h = 2.4) {
      const bark = 0x6f6352;
      mb.cyl('bark', bark, x, h * 0.25, z, 0.2, 0.32, h * 0.5, { seg: 7 });
      mb.cyl('bark', bark, x + 0.3, h * 0.6, z + 0.1, 0.1, 0.18, h * 0.55, { seg: 6, rz: -0.6, rx: 0.2 });
      mb.cyl('bark', bark, x - 0.35, h * 0.62, z - 0.1, 0.1, 0.17, h * 0.55, { seg: 6, rz: 0.7 });
      const col = 0x7a8c56;
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * PI * 2 + rnd();
        mb.blob('leaf', VR.C.jitter(col, 0.1, rnd), x + Math.cos(a) * 1.1, h + 0.3 + rnd() * 0.5, z + Math.sin(a) * 1.0, 0.8 + rnd() * 0.3, { sy: 0.55, detail: 1 });
      }
      mb.blob('leaf', col, x, h + 0.9, z, 1.1, { sy: 0.6 });
    },
    cypress(mb, x, z, rnd, h = 7) {
      mb.cyl('bark', 0x5a4632, x, 0.4, z, 0.12, 0.15, 0.8, { seg: 6 });
      const col = VR.C.jitter(0x2d5a36, 0.1, rnd);
      mb.blob('leaf', col, x, h * 0.45, z, 0.95, { sy: h * 0.55, detail: 1, jit: 0.12 });
      mb.blob('leaf', VR.C.shade(col, 1.1), x, h * 0.72, z, 0.6, { sy: h * 0.3, detail: 1, jit: 0.1 });
    },
    roundTree(mb, x, z, rnd, h = 4, col = 0x4f8f3a) {
      mb.cyl('bark', 0x6b4a2e, x, h * 0.35, z, 0.18, 0.26, h * 0.7, { seg: 7 });
      mb.blob('leaf', VR.C.jitter(col, 0.1, rnd), x, h + 0.4, z, 1.9, { sy: 0.85, detail: 1 });
      mb.blob('leaf', VR.C.jitter(col, 0.12, rnd), x + 1.1, h - 0.2, z + 0.4, 1.3, { sy: 0.8 });
      mb.blob('leaf', VR.C.jitter(col, 0.12, rnd), x - 1.0, h - 0.1, z - 0.5, 1.3, { sy: 0.8 });
    },
    birch(mb, x, z, rnd, h = 5.5) {
      mb.cyl('std', 0xe9e6de, x, h * 0.45, z, 0.12, 0.16, h * 0.9, { seg: 7 });
      for (let i = 0; i < 5; i++) mb.box('std', 0x2a2a2a, x, 0.6 + i * h * 0.16 + rnd() * 0.3, z - 0.12, 0.14, 0.05, 0.05);
      mb.blob('leaf', VR.C.jitter(0x8bbf45, 0.1, rnd), x, h, z, 1.3, { sy: 1.3 });
      mb.blob('leaf', VR.C.jitter(0x9ccc52, 0.1, rnd), x + 0.3, h + 1.1, z, 0.9, { sy: 1.1 });
    },
    pine(mb, x, z, rnd, h = 7, snowy = false) {
      mb.cyl('bark', 0x5a3e28, x, h * 0.2, z, 0.14, 0.2, h * 0.4, { seg: 6 });
      const col = VR.C.jitter(0x2b5e3f, 0.08, rnd);
      let y = h * 0.22, r = h * 0.3;
      for (let i = 0; i < 4; i++) {
        const hh = h * 0.34;
        mb.cone('leaf', VR.C.shade(col, 1 + i * 0.05), x, y + hh / 2, z, r, hh, { seg: 7, ry: rnd() });
        if (snowy) mb.cone('leaf', 0xf4f8fb, x, y + hh * 0.72, z, r * 0.62, hh * 0.45, { seg: 7, ry: rnd() });
        y += h * 0.19; r *= 0.74;
      }
    },
    palm(mb, x, z, rnd, h = 6) {
      const lean = (rnd() - 0.5) * 0.5, segs = 7;
      let px = x, py = 0;
      for (let i = 0; i < segs; i++) {
        const sh = h / segs, a = lean * (i / segs) * 1.6;
        const cx = px + Math.sin(a) * sh / 2, cy = py + Math.cos(a) * sh / 2;
        mb.cyl('bark', i % 2 ? 0x8a6a45 : 0x7a5c3a, cx, cy, z, 0.15 - i * 0.008, 0.18 - i * 0.008, sh * 1.02, { seg: 7, rz: -a });
        px += Math.sin(a) * sh; py += Math.cos(a) * sh;
      }
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * PI * 2 + rnd() * 0.3;
        const ex = Math.cos(a), ez = Math.sin(a);
        mb.box('leaf', VR.C.jitter(0x3f8f3a, 0.12, rnd), px + ex * 1.2, py - 0.15, z + ez * 1.2, 0.5, 0.08, 2.6,
          { ry: -a + PI / 2, rx: 0.45, order: 'YXZ' });
        mb.box('leaf', VR.C.jitter(0x357f33, 0.12, rnd), px + ex * 2.3, py - 0.75, z + ez * 2.3, 0.4, 0.06, 1.3,
          { ry: -a + PI / 2, rx: 0.95, order: 'YXZ' });
      }
      for (let i = 0; i < 3; i++) mb.sphere('std', 0x5a3e1e, px + Math.cos(i * 2) * 0.25, py - 0.3, z + Math.sin(i * 2) * 0.25, 0.14, { seg: 8 });
    },
    cactus(mb, x, z, rnd, h = 3) {
      const col = VR.C.jitter(0x4c8a3a, 0.08, rnd);
      mb.cyl('flat', col, x, h / 2, z, 0.26, 0.3, h, { seg: 8 });
      mb.sphere('flat', col, x, h, z, 0.26, { seg: 8 });
      for (const s of [-1, 1]) {
        if (rnd() < 0.3) continue;
        const ay = h * (0.35 + rnd() * 0.25), ah = h * 0.35;
        mb.cyl('flat', col, x + s * 0.5, ay, z, 0.16, 0.16, 0.5, { seg: 7, rz: PI / 2 });
        mb.cyl('flat', col, x + s * 0.72, ay + ah / 2, z, 0.16, 0.17, ah, { seg: 7 });
        mb.sphere('flat', col, x + s * 0.72, ay + ah, z, 0.16, { seg: 7 });
      }
    },
    bush(mb, x, z, rnd, s = 1, col = 0x3f8a36) { mb.blob('leaf', VR.C.jitter(col, 0.12, rnd), x, s * 0.4, z, s * 0.75, { sy: 0.7 }); },
    rock(mb, x, z, rnd, s = 1, col = 0x8b8a86) {
      mb.blob('flat', VR.C.jitter(col, 0.08, rnd), x, s * 0.25, z, s, { sy: 0.6, sx: 1 + rnd() * 0.4, detail: 0, jit: 0.25 });
    },
    flowers(mb, x, z, rnd, n = 6) {
      const cols = [0xf25c54, 0xffd43b, 0xffffff, 0x9b7ede, 0xff8fb1, 0x5ec8ff];
      const c = cols[(rnd() * cols.length) | 0];
      for (let i = 0; i < n; i++) {
        const fx = x + (rnd() - 0.5) * 1.4, fz = z + (rnd() - 0.5) * 1.4, hh = 0.25 + rnd() * 0.2;
        mb.box('std', 0x3c8a2a, fx, hh / 2, fz, 0.03, hh, 0.03);
        mb.sphere('std', c, fx, hh, fz, 0.07, { seg: 6, hseg: 4 });
      }
    },
    tuft(mb, x, z, rnd, col = 0x5a9e38) {
      for (let i = 0; i < 3; i++) mb.cone('leaf', VR.C.jitter(col, 0.1, rnd), x + (rnd() - 0.5) * 0.3, 0.2, z + (rnd() - 0.5) * 0.3, 0.07, 0.45, { seg: 4, rz: (rnd() - 0.5) * 0.5 });
    },

    // ---------------------------------------------------------- man-made
    crate(mb, x, y, z, rnd, full = true, ry = 0) {
      mb.box('wood', 0xb07d45, x, y + 0.26, z, 0.8, 0.52, 0.55, { ry });
      mb.box('wood', 0x8a5a2e, x, y + 0.49, z, 0.84, 0.06, 0.59, { ry });
      mb.box('wood', 0x8a5a2e, x, y + 0.05, z, 0.84, 0.06, 0.59, { ry });
      if (full) for (let i = 0; i < 6; i++) P.lemon(mb, x + ((i % 3) - 1) * 0.22, y + 0.46, z + ((i / 3 | 0) - 0.5) * 0.22, 1.1, rnd() * 3);
    },
    lampPost(mb, x, z, side = 1, h = 4.2) {
      mb.cyl('metal', 0x2f3338, x, h / 2, z, 0.07, 0.1, h, { seg: 8 });
      mb.box('metal', 0x2f3338, x + side * 0.45, h, z, 0.9, 0.08, 0.08);
      mb.box('metal', 0x2f3338, x + side * 0.85, h - 0.12, z, 0.34, 0.14, 0.26, { r: 0.04 });
      mb.box('glow', 0xffe0a0, x + side * 0.85, h - 0.21, z, 0.28, 0.04, 0.2);
    },
    fence(mb, x, z0, z1) {
      for (let z = z0; z > z1; z -= 2.2) mb.box('wood', 0x9a7248, x, 0.5, z, 0.12, 1.0, 0.12);
      mb.box('wood', 0xa87a4d, x, 0.75, (z0 + z1) / 2, 0.06, 0.1, Math.abs(z1 - z0));
      mb.box('wood', 0xa87a4d, x, 0.4, (z0 + z1) / 2, 0.06, 0.1, Math.abs(z1 - z0));
    },
    terrace(mb, x, z, len, h = 0.8) {        // dry-stone terrace wall (hills of Palestine)
      mb.box('stone', 0xcfc2a2, x, h / 2, z, 0.7, h, len);
      mb.box('stone', 0xbfb291, x, h + 0.05, z, 0.8, 0.12, len);
    },
    // Levantine stone house: arched windows, flat roof, parapet, water tank and solar heater
    house(mb, x, z, rnd, w = 6, d = 6, floors = 1, facing = 1) {
      const stone = VR.C.jitter(0xe6d8b8, 0.05, rnd), H = 3.1 * floors;
      mb.box('stone', stone, x, H / 2, z, w, H, d);
      mb.box('stone', VR.C.shade(stone, 0.9), x, H + 0.25, z, w + 0.2, 0.5, d + 0.2);        // parapet band
      mb.box('concrete', VR.C.shade(stone, 0.8), x, H + 0.02, z, w - 0.3, 0.1, d - 0.3);
      const fx = x + facing * (w / 2 + 0.01);
      for (let f = 0; f < floors; f++) {
        const y0 = 0.9 + f * 3.1;
        for (const dz of [-d * 0.28, d * 0.28]) {
          mb.box('glass', 0x1e2a36, fx, y0 + 0.6, z + dz, 0.06, 1.2, 0.8);
          mb.cyl('glass', 0x1e2a36, fx, y0 + 1.2, z + dz, 0.4, 0.4, 0.06, { seg: 12, rz: PI / 2, ts: 0, tl: PI });
          mb.box('wood', 0x3f7f9a, fx + facing * 0.03, y0 + 0.6, z + dz, 0.04, 1.2, 0.08);   // blue shutter bar
          mb.box('stone', VR.C.shade(stone, 1.06), fx + facing * 0.06, y0 - 0.05, z + dz, 0.14, 0.1, 1.0);
        }
      }
      // arched door
      mb.box('wood', 0x3f7f9a, fx, 1.05, z, 0.08, 2.1, 1.1);
      mb.cyl('wood', 0x3f7f9a, fx, 2.1, z, 0.55, 0.55, 0.08, { seg: 12, rz: PI / 2, ts: 0, tl: PI });
      // roof: black water tank on stand + solar heater
      const rx = x - facing * w * 0.2, rz = z + d * 0.18;
      for (const [a, b] of [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]]) mb.box('metal', 0x444444, rx + a, H + 0.45, rz + b, 0.06, 0.9, 0.06);
      mb.cyl('paint', 0x1d1d1f, rx, H + 1.35, rz, 0.55, 0.55, 1.0, { seg: 14 });
      mb.box('glass', 0x27415e, x + facing * w * 0.15, H + 0.75, z - d * 0.2, 1.4, 0.05, 1.0, { rz: facing * 0.6 });
      if (rnd() < 0.4) mb.sphere('stone', VR.C.shade(stone, 1.04), x + facing * w * 0.15, H + 0.3, z + d * 0.2, 1.2, { tl: PI / 2, seg: 16, hseg: 8 });
    },
    stall(mb, x, z, rnd, facing = 1) {
      mb.box('wood', 0x9a6a3a, x, 0.45, z, 1.6, 0.9, 2.6);
      for (const [a, b] of [[-0.7, -1.2], [0.7, -1.2], [-0.7, 1.2], [0.7, 1.2]]) mb.box('wood', 0x7a5530, x + a, 1.3, z + b, 0.08, 2.6, 0.08);
      const cols = [0xffd43b, 0xffffff];
      for (let i = 0; i < 6; i++) mb.box('std', cols[i % 2], x + facing * 0.2, 2.55 - 0.02 * i, z - 1.25 + i * 0.5 + 0.25, 2.1, 0.06, 0.5, { rz: -facing * 0.25 });
      for (let i = 0; i < 3; i++) P.crate(mb, x, 0.9, z - 0.8 + i * 0.8, rnd, true);
    },
    snowman(mb, x, z) {
      mb.sphere('snow', 0xf6f9fc, x, 0.55, z, 0.6, { seg: 14 });
      mb.sphere('snow', 0xf6f9fc, x, 1.35, z, 0.42, { seg: 14 });
      mb.sphere('snow', 0xf6f9fc, x, 1.95, z, 0.3, { seg: 14 });
      mb.cone('std', 0xff8a2a, x + 0.33, 1.95, z, 0.05, 0.3, { rz: -PI / 2, seg: 8 });
      mb.cyl('std', 0x1d1d1f, x, 2.3, z, 0.22, 0.22, 0.3, { seg: 12 });
      mb.cyl('std', 0x1d1d1f, x, 2.16, z, 0.32, 0.32, 0.04, { seg: 12 });
      mb.torus('std', 0xe8433a, x, 1.68, z, 0.28, 0.07, { rx: PI / 2, seg: 16 });
    },
    mountain(mb, x, z, rnd, w, h, snow = true, col = 0x7d7f86) {
      mb.blob('flat', VR.C.jitter(col, 0.06, rnd), x, h * 0.3, z, w / 2, { sy: h / w * 1.5, detail: 1, jit: 0.25 });
      if (snow) mb.blob('flat', 0xf2f6fa, x, h * 0.78, z, w * 0.2, { sy: h / w * 1.8, detail: 1, jit: 0.2 });
    },
    dune(mb, x, z, rnd, w, h) { mb.blob('flat', VR.C.jitter(0xe6c486, 0.04, rnd), x, 0, z, w / 2, { sy: h / w * 2, sz: 1.3, detail: 2, jit: 0.08 }); },
    building(mb, x, z, rnd, w, d, h) {
      const col = VR.C.jitter([0x8d95a3, 0x6d7a8c, 0xa39a8f, 0x5d6878, 0x9aa7b4][(rnd() * 5) | 0], 0.06, rnd);
      mb.box('facade', col, x, h / 2, z, w, h, d);
      mb.box('concrete', VR.C.shade(col, 0.7), x, h + 0.15, z, w + 0.2, 0.3, d + 0.2);
      if (rnd() < 0.5) mb.box('metal', 0x555a60, x + (rnd() - 0.5) * w * 0.4, h + 0.9, z + (rnd() - 0.5) * d * 0.4, 1.6, 1.2, 1.6);
      if (rnd() < 0.35) { mb.cyl('metal', 0x888888, x, h + 3, z, 0.05, 0.08, 5, { seg: 6 }); mb.sphere('neon', 0xff3b3b, x, h + 5.5, z, 0.15, { seg: 8 }); }
    },
    neonSign(mb, x, y, z, rnd, facing = 1) {
      const c = [0xff4fa3, 0x46e0ff, 0xffd43b, 0x7dff8a][(rnd() * 4) | 0];
      mb.box('metal', 0x1d1f24, x, y, z, 0.2, 1.4, 3.2);
      mb.box('neon', c, x + facing * 0.12, y + 0.5, z, 0.05, 0.08, 2.8);
      mb.box('neon', c, x + facing * 0.12, y - 0.5, z, 0.05, 0.08, 2.8);
      mb.sphere('neon', LEMON, x + facing * 0.14, y, z - 0.6, 0.35, { sx: 0.2, sz: 1.3, seg: 10 });
      mb.box('neon', c, x + facing * 0.12, y, z + 0.5, 0.05, 0.5, 1.2);
    },
  };
  VR.Props = P;
})();

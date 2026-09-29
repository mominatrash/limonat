/* =====================================================================
 * PLAYER CHARACTER — THIS IS THE FILE TO EDIT TO CHANGE THE HERO.
 * ---------------------------------------------------------------------
 * The hero from the original drawing (round white head, black beanie
 * with a spiky white tuft, big round eyes glancing to the side, tiny
 * dash mouth, stick neck/limbs, white V-neck shirt, shorts, rounded
 * shoes and mitten hands) rebuilt as a smooth, cel-shaded 3D figure
 * on a real skeleton:
 *
 *   root ─ hips ─┬ spine ─ chest ─┬ neck ─ head ─ tuft1 ─ tuft2 ─ tuft3
 *                │                ├ armL ─ foreL ─ handL
 *                │                └ armR ─ foreR ─ handR
 *                ├ thighL ─ shinL ─ footL
 *                └ thighR ─ shinR ─ footR
 *
 * All bones hang/point along the Y axis in the rest pose; the character
 * faces -Z and +X is its right-hand side.  Animation lives in anim.js.
 *
 * SKINS: VR.CHARACTERS lists palettes (colours) for the same model.
 * `price` is in coins (0 = unlocked). `scarf` adds a cloth scarf.
 * ===================================================================== */
(function () {
  const T = THREE;

  // ------------------------------------------------------------ skeleton
  // lengths in metres
  const DIM = {
    hipY: 0.8, hipW: 0.105, thigh: 0.36, shin: 0.35, ankle: 0.075,
    spine: 0.07, chest: 0.2, neck: 0.25, shoulderW: 0.215, shoulderY: 0.19,
    upper: 0.25, fore: 0.225, headY: 0.1, headR: 0.27,
  };
  VR.CHAR_DIM = DIM;

  const HERO = {
    skin: 0xf4f3ef, shirt: 0xf4f3ef, shorts: 0xeeede8, shoe: 0xf6f6f4, sole: 0xb4b9c5,
    cap: 0x1b1b1d, hair: 0xfafaf8, detail: 0xb4b9c5, ink: 0x161616,
  };

  // perk: text shown in the shop. perkMul = power-up duration multipliers,
  // lemonNeed = lemons for a Lemonade, coinBonus = extra share of coins.
  // acc = accessories: glasses | shades | headphones | crown | leaf | visor | tulips | hat | fez
  VR.CHARACTERS = [
    { id: 'hero', name: 'البطل', nameEn: 'Hero', tagline: 'الشخصية الأصلية', taglineEn: 'The original runner', price: 0, palette: HERO,
      perk: { ar: 'بطاقة البداية: درع أطول ‎+20%', en: 'Starter perk: shield +20%' }, perkMul: { shield: 1.2 } },
    { id: 'lemon', name: 'ليموني', nameEn: 'Lemony', tagline: 'حامض وسريع', taglineEn: 'Sour and speedy', price: 400,
      palette: Object.assign({}, HERO, { shirt: 0xffd83a, shorts: 0x2f8a45, cap: 0x2f8a45, sole: 0xffc21a, detail: 0xd9a90f }),
      acc: ['leaf'], perk: { ar: 'ليموناضة بـ 4 ليمونات بس', en: 'Lemonade with only 4 lemons' }, lemonNeed: 4 },
    { id: 'olive', name: 'زيتون', nameEn: 'Olive', tagline: 'من كروم الجبل', taglineEn: 'From the hill groves', price: 900,
      palette: Object.assign({}, HERO, { shirt: 0x7b8c3c, shorts: 0xe9dfc7, cap: 0x3a2f24, shoe: 0x8a5a33, sole: 0x3a2f24, detail: 0x55632a }),
      scarf: [0xf4f3ef, 0x1b1b1d], perk: { ar: 'الدرع يدوم ‎+60%', en: 'Shield lasts +60%' }, perkMul: { shield: 1.6 } },
    { id: 'mint', name: 'نعنع', nameEn: 'Mint', tagline: 'بارد على السكة', taglineEn: 'Cool on the rails', price: 1500,
      palette: Object.assign({}, HERO, { shirt: 0x6fdcc0, shorts: 0x23443d, cap: 0xff6b5b, shoe: 0xffffff, sole: 0xff6b5b, detail: 0x3fae93, acc1: 0xff6b5b, acc2: 0x23443d }),
      acc: ['headphones'], perk: { ar: 'المغناطيس يدوم ‎+60%', en: 'Magnet lasts +60%' }, perkMul: { magnet: 1.6 } },
    { id: 'night', name: 'ليل', nameEn: 'Night', tagline: 'يركض تحت النجوم', taglineEn: 'Runs under the stars', price: 2500,
      palette: Object.assign({}, HERO, { shirt: 0x262c3d, shorts: 0x3b4560, cap: 0xeceae4, hair: 0xbdf2ff, shoe: 0x262c3d, sole: 0x55d6ff, detail: 0x55d6ff, acc1: 0x55d6ff }),
      scarf: [0xe8433a, 0xb3261e], acc: ['visor'], perk: { ar: 'النجمة تدوم ‎+60%', en: 'Star lasts +60%' }, perkMul: { invincible: 1.6 } },
    { id: 'melon', name: 'بطيخة', nameEn: 'Melon', tagline: 'حمرا من جوّا', taglineEn: 'Red on the inside', price: 3200,
      palette: Object.assign({}, HERO, { shirt: 0xe8433a, shorts: 0x2f8a45, cap: 0x1f6b35, hair: 0xfafaf8, shoe: 0x2f8a45, sole: 0x1b1b1d, detail: 0x1b1b1d, acc1: 0x1b1d24 }),
      acc: ['shades'], perk: { ar: 'حذاء النطّ يدوم ‎+60%', en: 'Super Sneakers last +60%' }, perkMul: { sneakers: 1.6 } },
    { id: 'sunset', name: 'غروب', nameEn: 'Sunset', tagline: 'بلون آخر النهار', taglineEn: 'Colours of dusk', price: 4000,
      palette: Object.assign({}, HERO, { shirt: 0xff7a45, shorts: 0x5a2d82, cap: 0xffd23f, shoe: 0xffd23f, sole: 0x5a2d82, detail: 0xd9542a, acc1: 0x5a2d82 }),
      scarf: [0xffd23f, 0xff7a45], acc: ['glasses'], perk: { ar: 'الانطلاق والعملات المضاعفة ‎+50%', en: 'Boost & 2x Coins last +50%' }, perkMul: { boost: 1.5, double: 1.5 } },
    { id: 'tulip', name: 'توليب', nameEn: 'Tulip', tagline: 'من حقول الربيع', taglineEn: 'From the spring fields', price: 2500,
      palette: Object.assign({}, HERO, { shirt: 0xffe1ec, shorts: 0x2f8a45, cap: 0x2a6b3f, hair: 0xfafaf8, shoe: 0xff7fb0, sole: 0x2f8a45, detail: 0xe86fa0 }),
      acc: ['tulips'], perk: { ar: 'الدراجة والعربة تدوم ‎+60%', en: 'Bike & mine cart last +60%' }, perkMul: { bike: 1.6, minecart: 1.6 } },
    { id: 'astro', name: 'رائد فضاء', nameEn: 'Astro', tagline: 'وُلد ليطير', taglineEn: 'Born to fly', price: 6000,
      palette: Object.assign({}, HERO, { shirt: 0xf1f3f7, shorts: 0x3d6fd9, cap: 0x3d6fd9, hair: 0xfafaf8, shoe: 0xff7a2f, sole: 0x3d6fd9, detail: 0x8fa3c7, acc1: 0x6fd8ff }),
      acc: ['visor', 'headphones'], perk: { ar: 'الجيت باك يدوم ‎+50%', en: 'Jetpack lasts +50%' }, perkMul: { jetpack: 1.5 } },
    // seasonal event characters: unlocked with the event's collectible (see events.js)
    { id: 'farmer', name: 'الفلّاح', nameEn: 'The Farmer', tagline: 'من موسم قطف الزيتون', taglineEn: 'From the olive harvest', price: 0, event: 'olive', need: 150,
      palette: Object.assign({}, HERO, { shirt: 0x7b8c3c, shorts: 0x6b4a32, cap: 0x3a2f24, shoe: 0x6b4a32, sole: 0x3a2f24, detail: 0x55632a, acc1: 0x6b3a2a }),
      acc: ['hat'], scarf: [0xf4f3ef, 0x55632a], perk: { ar: 'زيتون أكثر بالمواسم ‎+50%', en: '+50% event items' }, eventBonus: 1.5 },
    { id: 'misaharati', name: 'المسحراتي', nameEn: 'Misaharati', tagline: 'من ليالي رمضان', taglineEn: 'From Ramadan nights', price: 0, event: 'ramadan', need: 150,
      palette: Object.assign({}, HERO, { shirt: 0x1f4f8a, shorts: 0xf4f3ef, cap: 0xc0282d, shoe: 0x8a5a33, sole: 0x3a2f24, detail: 0xd6b35a }),
      acc: ['fez'], scarf: [0xd6b35a, 0x8a6a2a], perk: { ar: 'فوانيس أكثر بالمواسم ‎+50%', en: '+50% event items' }, eventBonus: 1.5 },
    { id: 'snowy', name: 'ثلجي', nameEn: 'Snowy', tagline: 'من الشتوية', taglineEn: 'From the winter festival', price: 0, event: 'winter', need: 150,
      palette: Object.assign({}, HERO, { shirt: 0xe8433a, shorts: 0xf4f3ef, cap: 0xf4f3ef, shoe: 0xe8433a, sole: 0xf4f3ef, detail: 0xb3261e, acc1: 0xf4f3ef, acc2: 0xe8433a }),
      acc: ['headphones'], scarf: [0x2f8a45, 0xf4f3ef], perk: { ar: 'ندف ثلج أكثر ‎+50%', en: '+50% event items' }, eventBonus: 1.5 },
    { id: 'gold', name: 'الليمونة الذهبية', nameEn: 'Golden Lemon', tagline: 'لأبطال المسافات', taglineEn: 'For distance legends', price: 8000,
      palette: Object.assign({}, HERO, { shirt: 0xffc93c, shorts: 0x1b1b1d, cap: 0xffc93c, hair: 0xfff3b0, shoe: 0x1b1b1d, sole: 0xffc93c, detail: 0xd99a12, acc1: 0xffc93c }),
      scarf: [0x1b1b1d, 0xffc93c], acc: ['crown'], perk: { ar: 'عملات إضافية ‎+25%', en: '+25% coins' }, coinBonus: 0.25 },
  ];

  // ------------------------------------------------------------ materials
  const gradient = (() => {
    const d = new Uint8Array([88, 88, 88, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
    const t = new T.DataTexture(d, 3, 1, T.RGBAFormat);
    t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true;
    return t;
  })();
  // ------------------------------------------------------------ HERO COLOUR
  // The hero keeps its true colours (a clean WHITE body for the original
  // hero) in every biome, at sunset, at night, in tunnels and on the menu.
  // Scene lights are warm/green/blue and the post pipeline adds biome tint
  // + ACES tone mapping, which together turned the white body cream/beige.
  // So the hero is shaded on its own terms:
  //   * a fixed neutral key light (follows the sun's direction, plus a front
  //     fill so the face is never in shadow on the menu) -> 3 soft cel bands
  //     from white to a cool light grey, plus a thin rim light
  //   * output is its final display colour and is written with alpha 0, which
  //     tells the compositor (gfx.js) to skip tint / bloom / tone mapping.
  // uDim lets it settle a touch in tunnels / at night without ever going grey.
  VR.charUniforms = { uDim: { value: 0 } };
  const SHADED = `
    vec3 hN = normalize(normal);
    vec3 hKey = vec3(-0.32, 0.58, 0.78);
    #if NUM_DIR_LIGHTS > 0
      hKey += directionalLights[0].direction * 0.5;
    #endif
    hKey.z = max(hKey.z, 0.45);            // always some light from the camera side
    hKey = normalize(hKey);
    float hNdl = dot(hN, hKey);
    float hW = fwidth(hNdl) * 0.75 + 0.015;
    float hT1 = smoothstep(-0.22 - hW, -0.22 + hW, hNdl);
    float hT2 = smoothstep(0.30 - hW, 0.30 + hW, hNdl);
    vec3 hShade = mix(vec3(0.78, 0.80, 0.86), vec3(0.915, 0.922, 0.945), hT1);
    hShade = mix(hShade, vec3(1.0), hT2);
    hShade *= 0.94 + 0.06 * clamp(hN.y * 0.5 + 0.5, 0.0, 1.0);
    float hRim = pow(1.0 - clamp(dot(hN, normalize(vViewPosition)), 0.0, 1.0), 4.0);
    hShade = min(hShade + hRim * 0.12, vec3(1.0));
    hShade *= 1.0 - uDim;
    gl_FragColor = vec4(diffuseColor.rgb * pow(hShade, vec3(2.2)), 0.0);`;
  const FLAT = `
    gl_FragColor = vec4(diffuseColor.rgb * pow(1.0 - uDim, 2.2), 0.0);`;
  function heroColour(mat, shaded) {
    mat.toneMapped = false;   // low-quality path (no post): skip renderer ACES too
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uDim = VR.charUniforms.uDim;
      sh.fragmentShader = 'uniform float uDim;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', shaded ? SHADED : FLAT);
    };
    mat.customProgramCacheKey = () => 'heroColour' + (shaded ? 1 : 0);
    return mat;
  }
  VR.heroColour = heroColour;

  const toonMat = heroColour(new T.MeshToonMaterial({ vertexColors: true, gradientMap: gradient }), true);
  const inkMat = heroColour(new T.MeshBasicMaterial({ vertexColors: true }), false);
  const OUTLINE = 0.011;
  const outlineMat = new T.MeshBasicMaterial({ color: 0x131315, side: T.BackSide });
  outlineMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${OUTLINE.toFixed(4)};`);
  };
  VR.charMaterials = { toonMat, inkMat, outlineMat };

  // ------------------------------------------------------------ geometry helpers
  function lathe(points, seg = 28) {
    return new T.LatheGeometry(points.map(([r, y]) => new T.Vector2(r, y)), seg);
  }

  // Build one bone's meshes from a function that fills an MB
  function partMeshes(fill) {
    const mb = new VR.MB(7);
    fill(mb);
    const g = new T.Group();
    for (const { key, geometry } of mb.geometries()) {
      if (key === 'toon') {
        const m = new T.Mesh(geometry, toonMat); m.castShadow = true; g.add(m);
        const o = new T.Mesh(geometry, outlineMat); g.add(o);
      } else {
        const m = new T.Mesh(geometry, inkMat); m.castShadow = key === 'inkc'; g.add(m);
      }
    }
    return g;
  }

  // ------------------------------------------------------------ body parts
  function headParts(P, acc = []) {
    return partMeshes((mb) => {
      const R = DIM.headR, cy = 0.23;
      accessories(mb, P, acc, R, cy);
      mb.sphere('toon', P.skin, 0, cy, 0, R, { sx: 1.07, sy: 1.0, sz: 0.97, seg: 40, hseg: 28 });
      // beanie: a cap shell tilted back a little, rim, and the knot on top
      const CT = 0.15, CL = Math.PI * 0.36, CR = R * 1.045;
      mb.sphere('toon', P.cap, 0, cy + 0.015, 0.012, CR, { sx: 1.07, sy: 1.02, sz: 0.99, seg: 40, hseg: 20, tl: CL, rx: CT });
      const rh = Math.cos(CL) * CR;
      mb.torus('toon', P.cap, 0, cy + 0.015 + rh * Math.cos(CT), 0.012 + rh * Math.sin(CT), Math.sin(CL) * CR * 1.01, 0.034,
        { rx: Math.PI / 2 + CT, sx: 1.07, sy: 0.99, seg: 40 });
      mb.sphere('toon', P.cap, 0.03, cy + R * 1.03, 0.045, 0.072, { sy: 0.8, seg: 16 });
      // face: big round eyes (ink ring, white, pupil glancing to the side)
      const eye = (yaw, pitch, s) => {
        const dir = new T.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
        const p = (k) => new T.Vector3(dir.x * R * 1.07 * k, cy + dir.y * R * k, dir.z * R * 0.97 * k);
        const o = { rx: pitch, ry: -yaw, order: 'YXZ', seg: 24 };
        let q = p(0.955); mb.sphere('ink', P.ink, q.x, q.y, q.z, 0.098 * s, Object.assign({ sy: 1.1, sz: 0.3 }, o));
        q = p(0.99); mb.sphere('ink', 0xffffff, q.x, q.y, q.z, 0.079 * s, Object.assign({ sy: 1.12, sz: 0.34 }, o));
        // pupil glances toward the character's left
        const pd = new T.Vector3(Math.sin(yaw - 0.13) * Math.cos(pitch + 0.03), Math.sin(pitch + 0.03), -Math.cos(yaw - 0.13) * Math.cos(pitch + 0.03));
        mb.sphere('ink', P.ink, pd.x * R * 1.07 * 1.075, cy + pd.y * R * 1.075, pd.z * R * 0.97 * 1.075, 0.036 * s,
          { sy: 1.15, sz: 0.25, rx: pitch, ry: -(yaw - 0.13), order: 'YXZ', seg: 16 });
        mb.sphere('ink', 0xffffff, pd.x * R * 1.07 * 1.085 + 0.008, cy + pd.y * R * 1.085 + 0.013, pd.z * R * 0.97 * 1.085, 0.011 * s,
          { sz: 0.3, rx: pitch, ry: -(yaw - 0.13), order: 'YXZ', seg: 8 });
      };
      eye(0.36, 0.02, 1); eye(-0.4, 0.02, 1.04);
      // tiny dash mouth
      const my = -0.36, mp = -0.03;
      mb.box('ink', P.ink, Math.sin(mp) * R * 1.07, cy + Math.sin(my) * R, -Math.cos(my) * R * 0.97 - 0.004, 0.06, 0.012, 0.012, { r: 0.005, k: 2, rx: my });
      // soft cheek/side shading like the drawing
      mb.sphere('ink', P.detail, 0.196, cy - 0.077, -0.177, 0.045, { sy: 0.55, sz: 0.2, ry: -0.785, rx: -0.2, order: 'YXZ', seg: 12 });
    });
  }

  // ------------------------------------------------------------ accessories
  // eyes sit at yaw +0.36 / -0.40 (radians) on the head sphere's front (-Z)
  function onHead(R, cy, yaw, pitch, k) {
    return new T.Vector3(Math.sin(yaw) * Math.cos(pitch) * R * 1.07 * k, cy + Math.sin(pitch) * R * k, -Math.cos(yaw) * Math.cos(pitch) * R * 0.97 * k);
  }
  function accessories(mb, P, acc, R, cy) {
    const A1 = P.acc1 ?? 0x1b1d24, A2 = P.acc2 ?? 0x2a2f3a;
    for (const a of acc) {
      if (a === 'glasses' || a === 'shades' || a === 'visor') {
        // round frames (glasses), dark lenses (shades) or glowing neon goggles (visor)
        const frame = a === 'visor' ? 0x2a2f3a : A1;
        for (const [yaw, s] of [[0.36, 1], [-0.4, 1.04]]) {
          const q = onHead(R, cy, yaw, 0.02, 1.06), o = { rx: 0.02, ry: -yaw, order: 'YXZ' };
          if (a === 'shades') mb.sphere('toon', 0x16181f, q.x, q.y, q.z, 0.105 * s, Object.assign({ sy: 0.82, sz: 0.28, seg: 20 }, o));
          if (a === 'visor') mb.sphere('ink', A1, q.x, q.y, q.z, 0.1 * s, Object.assign({ sy: 0.62, sz: 0.26, seg: 20 }, o));
          mb.torus('toon', frame, q.x, q.y, q.z, 0.104 * s, a === 'visor' ? 0.02 : 0.013, Object.assign({ seg: 24, sy: a === 'visor' ? 0.64 : 0.84 }, o));
        }
        const b = onHead(R, cy, -0.02, 0.05, 1.07);
        mb.box('toon', frame, b.x, b.y, b.z, 0.06, 0.016, 0.016, { ry: 0.02 });
        if (a === 'visor') mb.torus('toon', frame, 0, cy + 0.02, 0, R * 1.09, 0.012, { rx: Math.PI / 2, sx: 1.07, sz: 0.97, seg: 36 });   // strap
      }
      if (a === 'headphones') {
        // band over the beanie + two ear cups
        mb.torus('toon', A2, 0, cy + 0.02, 0.01, R * 1.16, 0.016, { arc: Math.PI, sx: 1.03, seg: 28 });
        for (const sx of [-1, 1]) {
          mb.cyl('toon', A1, sx * R * 1.1, cy + 0.0, 0.01, 0.07, 0.07, 0.05, { rz: Math.PI / 2, seg: 18 });
          mb.cyl('toon', A2, sx * R * 1.15, cy + 0.0, 0.01, 0.052, 0.052, 0.03, { rz: Math.PI / 2, seg: 16 });
        }
      }
      if (a === 'crown') {
        const y0 = cy + R * 1.0;
        mb.cyl('toon', A1, 0, y0, 0.03, 0.12, 0.13, 0.06, { seg: 20 });
        for (let i = 0; i < 6; i++) {
          const ang = i / 6 * Math.PI * 2;
          mb.cone('toon', A1, Math.sin(ang) * 0.115, y0 + 0.07, 0.03 + Math.cos(ang) * 0.115, 0.03, 0.09, { seg: 6 });
          mb.sphere('ink', i % 2 ? 0xff5a4f : 0x5ad1ff, Math.sin(ang) * 0.128, y0, 0.03 + Math.cos(ang) * 0.128, 0.017, { seg: 8 });
        }
      }
      if (a === 'hat') {
        // wide straw hat for the harvest
        const y0 = cy + R * 0.72;
        mb.cyl('toon', 0xe3c27a, 0, y0, 0.01, R * 1.75, R * 1.8, 0.03, { seg: 28, sz: 0.95 });
        mb.cyl('toon', 0xe3c27a, 0, y0 + 0.08, 0.01, R * 0.86, R * 0.98, 0.16, { seg: 22 });
        mb.cyl('toon', A1, 0, y0 + 0.035, 0.01, R * 0.99, R * 0.99, 0.045, { seg: 22 });
      }
      if (a === 'fez') {
        const y0 = cy + R * 0.86;
        mb.cyl('toon', 0xc0282d, 0, y0 + 0.08, 0.02, R * 0.62, R * 0.78, 0.2, { seg: 22 });
        mb.cyl('ink', 0x1b1b1d, 0, y0 + 0.19, 0.02, 0.012, 0.012, 0.02, { seg: 6 });
        mb.sphere('toon', 0x1b1b1d, 0.1, y0 + 0.08, -0.02, 0.025, { sy: 2.2, seg: 8 });   // tassel
      }
      if (a === 'tulips') {
        // a spring garland on the beanie rim: six tulips leaning outward (the very front stays clear for the eyes)
        const CT = 0.15, yb = cy + 0.15, rr = R * 1.0, lean = 0.55;
        mb.torus('toon', 0x2f8a45, 0, yb, 0.03, rr, 0.017, { rx: Math.PI / 2 + CT, sx: 1.07, seg: 36 });
        const cols = [0xe8433a, 0xff7fb0, 0xffd23f, 0x9b5de5, 0xff7a45, 0xff4f8b];
        [-2.45, -1.55, -0.72, 0.72, 1.55, 2.45].forEach((a0, i) => {
          const dx = Math.sin(a0), dz = -Math.cos(a0), col = cols[i];
          const bx = dx * rr * 1.07, bz = dz * rr * 0.99 + 0.03, by = yb - dz * rr * Math.sin(CT);
          const o = { rz: -dx * lean, rx: dz * lean };
          mb.cyl('toon', 0x2f8a45, bx + dx * 0.025, by + 0.045, bz + dz * 0.025, 0.007, 0.009, 0.09, Object.assign({ seg: 6 }, o));
          const hx = bx + dx * 0.05, hy = by + 0.105, hz = bz + dz * 0.05;
          mb.sphere('toon', col, hx, hy, hz, 0.04, Object.assign({ sx: 0.92, sy: 1.25, sz: 0.92, seg: 12 }, o));
          for (let k = 0; k < 3; k++) {
            const ang = k * Math.PI * 2 / 3 + i;
            mb.cone('toon', col, hx + Math.cos(ang) * 0.021 + dx * 0.012, hy + 0.045, hz + Math.sin(ang) * 0.021 + dz * 0.012, 0.019, 0.034, Object.assign({ seg: 6 }, o));
          }
          mb.sphere('toon', 0x3fae4f, bx + dx * 0.03, by + 0.03, bz + dz * 0.03, 0.038, { sx: 0.3, sy: 1, sz: 0.16, rz: -dx * 0.9, rx: dz * 0.9, ry: a0, seg: 8 });
        });
      }
      if (a === 'leaf') {
        // a little lemon leaf sprouting from the beanie
        mb.sphere('toon', 0x3fae4f, -0.07, cy + R * 1.02, 0.02, 0.07, { sx: 0.45, sy: 0.14, sz: 1, rx: 0.5, ry: 0.6, seg: 12 });
        mb.cyl('toon', 0x1f6b35, -0.04, cy + R * 0.99, 0.03, 0.008, 0.01, 0.07, { rz: 0.5, seg: 6 });
      }
    }
  }

  function tuftPart(P, i) {
    // spiky white tuft sweeping up and out to the character's right
    return partMeshes((mb) => {
      const len = [0.12, 0.11, 0.09][i], r = [0.055, 0.042, 0.03][i];
      mb.cyl('toon', P.hair, 0, len / 2, 0, r * 0.62, r, len, { seg: 10 });
      mb.sphere('toon', P.hair, 0, 0, 0, r, { seg: 10 });
      if (i === 0) { mb.cone('toon', P.hair, -0.05, 0.05, 0.01, 0.028, 0.1, { rz: 0.55, seg: 8 }); mb.cone('toon', P.hair, 0.035, 0.03, -0.02, 0.03, 0.09, { rz: -0.9, seg: 8 }); }
      if (i === 1) mb.cone('toon', P.hair, 0.03, 0.06, 0, 0.026, 0.08, { rz: -1.25, seg: 8 });
      if (i === 2) mb.cone('toon', P.hair, 0, len + 0.03, 0, r * 0.62, 0.07, { seg: 8 });
    });
  }

  function chestParts(P) {
    return partMeshes((mb) => {
      // V-neck shirt (lathe profile, flattened front-to-back)
      const shirt = lathe([[0.0, -0.13], [0.185, -0.13], [0.198, -0.06], [0.2, 0.05], [0.222, 0.15], [0.214, 0.2], [0.16, 0.235], [0.07, 0.25], [0.0, 0.25]]);
      mb.geo('toon', P.shirt, shirt, 0, 0, 0, {}, 1, 1, 0.66);
      // V-neck collar lines
      mb.box('ink', P.detail, -0.035, 0.205, -0.142, 0.012, 0.075, 0.012, { rz: -0.5, rx: -0.35 });
      mb.box('ink', P.detail, 0.035, 0.205, -0.142, 0.012, 0.075, 0.012, { rz: 0.5, rx: -0.35 });
      // side shading stripe
      mb.box('ink', P.detail, 0.205, 0.05, 0, 0.01, 0.18, 0.2, { r: 0.004, k: 1 });
      // stick neck
      mb.cyl('toon', P.skin, 0, 0.29, 0, 0.034, 0.036, 0.1, { seg: 12 });
    });
  }
  function spineParts(P) {
    return partMeshes((mb) => {
      mb.torus('ink', P.ink, 0, -0.03, 0, 0.186, 0.009, { rx: Math.PI / 2, sy: 0.66, seg: 32 });   // shirt hem
      mb.cyl('toon', P.shirt, 0, 0.02, 0, 0.188, 0.186, 0.12, { sz: 0.66, seg: 24 });
    });
  }
  function hipsParts(P) {
    return partMeshes((mb) => {
      const band = lathe([[0.0, -0.09], [0.17, -0.1], [0.19, -0.02], [0.188, 0.06], [0.0, 0.06]], 24);
      mb.geo('toon', P.shorts, band, 0, 0, 0, {}, 1, 1, 0.68);
      mb.box('ink', P.detail, 0, -0.06, -0.128, 0.008, 0.07, 0.008);   // centre seam
    });
  }
  function thighParts(P, s) {
    return partMeshes((mb) => {
      mb.cyl('toon', P.shorts, 0, -0.09, 0, 0.105, 0.098, 0.2, { seg: 18 });
      mb.torus('ink', P.detail, 0, -0.19, 0, 0.096, 0.006, { rx: Math.PI / 2, seg: 20 });
      mb.cyl('toon', P.skin, 0, -0.26, 0, 0.034, 0.036, 0.22, { seg: 10 });
    });
  }
  function shinParts(P) {
    return partMeshes((mb) => {
      mb.sphere('toon', P.skin, 0, 0, 0, 0.038, { seg: 10 });
      mb.cyl('toon', P.skin, 0, -DIM.shin / 2, 0, 0.033, 0.03, DIM.shin, { seg: 10 });
    });
  }
  function footParts(P, s) {
    return partMeshes((mb) => {
      const fx = s * 0.012;
      mb.cyl('toon', P.shoe, 0, -0.01, 0.005, 0.048, 0.056, 0.05, { seg: 14 });                       // ankle cuff
      mb.box('toon', P.shoe, fx, -0.045, -0.055, 0.125, 0.085, 0.25, { r: 0.04 });                   // shoe
      mb.box('toon', P.sole, fx, -DIM.ankle + 0.012, -0.055, 0.13, 0.026, 0.258, { r: 0.012 });     // sole
      mb.box('ink', P.detail, fx, -0.02, -0.1, 0.06, 0.006, 0.06, { r: 0.003, k: 1, rx: -0.3 });     // laces
    });
  }
  function upperArmParts(P) {
    return partMeshes((mb) => {
      mb.cyl('toon', P.shirt, 0, -0.045, 0, 0.058, 0.066, 0.11, { seg: 14 });   // short sleeve
      mb.cyl('toon', P.skin, 0, -DIM.upper / 2 - 0.02, 0, 0.026, 0.028, DIM.upper - 0.04, { seg: 10 });
    });
  }
  function foreArmParts(P) {
    return partMeshes((mb) => {
      mb.sphere('toon', P.skin, 0, 0, 0, 0.03, { seg: 10 });
      mb.cyl('toon', P.skin, 0, -DIM.fore / 2, 0, 0.026, 0.024, DIM.fore, { seg: 10 });
    });
  }
  function handParts(P, s) {
    return partMeshes((mb) => {
      mb.cyl('toon', P.skin, 0, -0.012, 0, 0.042, 0.045, 0.03, { seg: 14 });                          // mitten cuff
      mb.torus('ink', P.ink, 0, -0.03, 0, 0.044, 0.005, { rx: Math.PI / 2, seg: 16 });
      mb.box('toon', P.skin, s * 0.005, -0.09, -0.005, 0.085, 0.11, 0.085, { r: 0.038 });             // mitten
      mb.box('toon', P.skin, -s * 0.045, -0.07, -0.02, 0.035, 0.06, 0.04, { r: 0.016, rz: s * 0.5 }); // thumb
    });
  }

  // ------------------------------------------------------------ scarf (cloth ribbon)
  class Scarf {
    constructor(colors) {
      this.n = 9; this.seg = 0.075;
      this.pts = []; this.prev = [];
      for (let i = 0; i < this.n; i++) { this.pts.push(new T.Vector3()); this.prev.push(new T.Vector3()); }
      const verts = this.n * 2;
      const g = new T.BufferGeometry();
      this.pos = new Float32Array(verts * 3);
      const col = new Float32Array(verts * 3), idx = [];
      const c1 = new T.Color(colors[0]), c2 = new T.Color(colors[1]);
      for (let i = 0; i < this.n; i++) {
        const c = (i >> 1) % 2 ? c2 : c1;
        for (let k = 0; k < 2; k++) col.set([c.r, c.g, c.b], (i * 2 + k) * 3);
        if (i < this.n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      g.setAttribute('position', new T.BufferAttribute(this.pos, 3));
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      g.setIndex(idx);
      this.geo = g;
      this.mesh = new T.Mesh(g, heroColour(new T.MeshToonMaterial({ vertexColors: true, gradientMap: gradient, side: T.DoubleSide }), true));
      this.mesh.frustumCulled = false; this.mesh.castShadow = true;
      // the knot around the neck
      this.ring = new T.Mesh(new T.TorusGeometry(0.06, 0.028, 8, 20), heroColour(new T.MeshToonMaterial({ color: colors[0], gradientMap: gradient }), true));
      this.ring.rotation.x = Math.PI / 2; this.ring.position.y = 0.25;
      this.initialised = false;
      this._a = new T.Vector3(); this._b = new T.Vector3(); this._side = new T.Vector3();
    }
    reset() { this.initialised = false; }
    update(dt, anchor, back, side, wind) {
      if (!this.initialised) {
        for (let i = 0; i < this.n; i++) { this.pts[i].copy(anchor).addScaledVector(back, i * this.seg); this.prev[i].copy(this.pts[i]); }
        this.initialised = true;
      }
      dt = Math.min(dt, 1 / 30);
      this.pts[0].copy(anchor); this.prev[0].copy(anchor);
      const g = -9.8 * dt * dt;
      for (let i = 1; i < this.n; i++) {
        const p = this.pts[i], q = this.prev[i];
        const vx = (p.x - q.x) * 0.96, vy = (p.y - q.y) * 0.96, vz = (p.z - q.z) * 0.96;
        q.copy(p);
        const flutter = Math.sin(performance.now() * 0.018 + i * 1.3) * 0.5;
        p.x += vx + (wind.x + side.x * flutter) * dt * dt;
        p.y += vy + g + (wind.y + flutter * 0.6) * dt * dt;
        p.z += vz + wind.z * dt * dt;
      }
      for (let it = 0; it < 3; it++) {
        for (let i = 1; i < this.n; i++) {
          const a = this.pts[i - 1], b = this.pts[i];
          this._a.subVectors(b, a); const d = this._a.length() || 1e-5;
          const diff = (d - this.seg) / d;
          if (i === 1) b.addScaledVector(this._a, -diff);
          else { a.addScaledVector(this._a, diff * 0.5); b.addScaledVector(this._a, -diff * 0.5); }
        }
      }
      const w = 0.075, tt = performance.now() * 0.009;
      for (let i = 0; i < this.n; i++) {
        const p = this.pts[i], ww = w * (1 - i / this.n * 0.35);
        // the ribbon twists as it flutters so it reads from every angle
        const tw = Math.sin(tt + i * 0.8) * 0.9 * (i / this.n);
        const sx = Math.cos(tw) * side.x, sy = Math.sin(tw), sz = Math.cos(tw) * side.z;
        this.pos.set([p.x - sx * ww, p.y - sy * ww, p.z - sz * ww, p.x + sx * ww, p.y + sy * ww, p.z + sz * ww], i * 6);
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.computeVertexNormals();
    }
  }
  VR.Scarf = Scarf;

  // ------------------------------------------------------------ build
  /**
   * Returns a rig: { root, bones{...}, tuft:[3], def, scarf, feet points }
   * root: feet at y = 0, facing -Z.
   */
  VR.buildCharacter = function (def) {
    const P = def.palette;
    const bone = (name, parent, x, y, z) => { const b = new T.Group(); b.name = name; b.position.set(x, y, z); if (parent) parent.add(b); return b; };
    const root = new T.Group();
    const B = {};
    B.hips = bone('hips', root, 0, DIM.hipY, 0);
    B.spine = bone('spine', B.hips, 0, DIM.spine, 0);
    B.chest = bone('chest', B.spine, 0, DIM.chest - 0.07, 0);
    B.neck = bone('neck', B.chest, 0, DIM.neck, 0);
    B.head = bone('head', B.neck, 0, DIM.headY, 0);
    B.armL = bone('armL', B.chest, -DIM.shoulderW, DIM.shoulderY, 0);
    B.armR = bone('armR', B.chest, DIM.shoulderW, DIM.shoulderY, 0);
    B.foreL = bone('foreL', B.armL, 0, -DIM.upper, 0);
    B.foreR = bone('foreR', B.armR, 0, -DIM.upper, 0);
    B.handL = bone('handL', B.foreL, 0, -DIM.fore, 0);
    B.handR = bone('handR', B.foreR, 0, -DIM.fore, 0);
    B.thighL = bone('thighL', B.hips, -DIM.hipW, -0.02, 0);
    B.thighR = bone('thighR', B.hips, DIM.hipW, -0.02, 0);
    B.shinL = bone('shinL', B.thighL, 0, -DIM.thigh, 0);
    B.shinR = bone('shinR', B.thighR, 0, -DIM.thigh, 0);
    B.footL = bone('footL', B.shinL, 0, -DIM.shin, 0);
    B.footR = bone('footR', B.shinR, 0, -DIM.shin, 0);

    B.head.add(headParts(P, def.acc || []));
    B.chest.add(chestParts(P));
    B.spine.add(spineParts(P));
    B.hips.add(hipsParts(P));
    B.thighL.add(thighParts(P, -1)); B.thighR.add(thighParts(P, 1));
    B.shinL.add(shinParts(P)); B.shinR.add(shinParts(P));
    B.footL.add(footParts(P, -1)); B.footR.add(footParts(P, 1));
    B.armL.add(upperArmParts(P)); B.armR.add(upperArmParts(P));
    B.foreL.add(foreArmParts(P)); B.foreR.add(foreArmParts(P));
    B.handL.add(handParts(P, -1)); B.handR.add(handParts(P, 1));

    // tuft chain (spring bones)
    const tuft = [];
    let parent = bone('tuftBase', B.head, 0.02, 0.23 + DIM.headR * 1.07, 0.04);
    parent.rotation.z = -0.5;
    for (let i = 0; i < 3; i++) {
      const b = bone('tuft' + i, parent, 0, i === 0 ? 0 : [0.12, 0.11][i - 1], 0);
      b.rotation.z = -0.28 - i * 0.12;
      b.userData.rest = b.rotation.z;
      b.add(tuftPart(P, i));
      tuft.push(b); parent = b;
    }

    // contact points on the soles (for ground planting)
    const soles = {};
    for (const s of ['L', 'R']) {
      const heel = new T.Object3D(); heel.position.set(0, -DIM.ankle, 0.06); B['foot' + s].add(heel);
      const toe = new T.Object3D(); toe.position.set(0, -DIM.ankle, -0.17); B['foot' + s].add(toe);
      soles[s] = { heel, toe };
    }

    let scarf = null;
    if (def.scarf) { scarf = new Scarf(def.scarf); B.chest.add(scarf.ring); }

    return { root, bones: B, tuft, soles, def, scarf };
  };
})();

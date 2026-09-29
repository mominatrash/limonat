/* =====================================================================
 * HEROES — three detailed, fully 3D runners with a real body:
 *   • Scout   (الكشّاف)  ranger hat, neckerchief, pocket shirt, badges,
 *                        belt, knee socks, hiking boots, full backpack
 *   • Sprinter (العدّاء) sweatband, spiky hair, number-7 vest, split
 *                        shorts, wristbands, sports watch, racing shoes
 *   • Ninja   (النينجا)  hood with an eye window, headband with a plate
 *                        and streaming tails, wrap top, obi, arm/leg wraps,
 *                        tabi boots, katana on the back
 *
 * They use the SAME skeleton and animation as the original hero (same bone
 * names and leg lengths), so running, jumping, sliding, flying, riding,
 * idling and the menu jump all just work, with feet planted exactly.
 * On top of that they add spring-driven cloth (headband tails, sweatband
 * knot) that trails with speed and swings with every move.
 *
 * Shading is a soft, smooth version of the hero shader (wrap lighting,
 * a gentle specular sheen and rim light) so volumes read as round 3D forms.
 * Pick one in the character shop to make it your main runner; pick the
 * original hero to go back.
 * ===================================================================== */
(function () {
  const T = THREE, D = VR.CHAR_DIM, shade = (c, f) => VR.C.shade(c, f);

  // ------------------------------------------------------------ soft material
  const SOFT = `
    vec3 hN = normalize(normal);
    vec3 hKey = vec3(-0.32, 0.58, 0.78);
    #if NUM_DIR_LIGHTS > 0
      hKey += directionalLights[0].direction * 0.5;
    #endif
    hKey.z = max(hKey.z, 0.45);
    hKey = normalize(hKey);
    vec3 hV = normalize(vViewPosition);
    float hNdl = dot(hN, hKey);
    float hWrap = smoothstep(-0.55, 0.75, hNdl);                    // soft wrap-around light
    vec3 hShade = mix(vec3(0.60, 0.62, 0.72), vec3(1.0), hWrap);    // cool, never-black shadow side
    hShade *= 0.92 + 0.08 * clamp(hN.y * 0.5 + 0.5, 0.0, 1.0);    // sky light from above
    float hRim = pow(1.0 - clamp(dot(hN, hV), 0.0, 1.0), 3.0);
    vec3 hH = normalize(hKey + hV);
    float hSpec = pow(max(dot(hN, hH), 0.0), 42.0) * 0.28;
    hShade *= 1.0 - uDim;
    vec3 hCol = diffuseColor.rgb * pow(hShade, vec3(2.2)) + diffuseColor.rgb * hRim * 0.16 + vec3(hSpec) * (1.0 - uDim);
    gl_FragColor = vec4(hCol, 0.0);`;
  const softMat = new T.MeshToonMaterial({ vertexColors: true });
  softMat.toneMapped = false;
  softMat.onBeforeCompile = (sh) => {
    sh.uniforms.uDim = VR.charUniforms.uDim;
    sh.fragmentShader = 'uniform float uDim;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', SOFT);
  };
  softMat.customProgramCacheKey = () => 'heroSoft';
  const { inkMat, outlineMat } = VR.charMaterials;

  // one bone's meshes: 'soft' = shaded + ink outline, 'ink' = flat colour details
  function part(fill) {
    const mb = new VR.MB(11);
    fill(mb);
    const g = new T.Group();
    for (const { key, geometry } of mb.geometries()) {
      if (key === 'soft') {
        const m = new T.Mesh(geometry, softMat); m.castShadow = true; g.add(m);
        g.add(new T.Mesh(geometry, outlineMat));
      } else if (key === 'bare') {                       // shaded, no outline (small / thin pieces)
        const m = new T.Mesh(geometry, softMat); m.castShadow = true; g.add(m);
      } else g.add(new T.Mesh(geometry, inkMat));
    }
    return g;
  }
  const geoCache = {};
  const cached = (k, f) => geoCache[k] || (geoCache[k] = f());
  const lathe = (pts, seg = 36) => new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), seg);
  // rounded limb from y=0 down to y=-len (top radius r0, bottom r1)
  function limb(mb, key, col, len, r0, r1, o = {}) {
    const y0 = o.y0 || 0, seg = o.seg || 18;
    mb.cyl(key, col, o.x || 0, y0 - len / 2, o.z || 0, r0, r1, len, { seg });
    if (o.capTop !== false) mb.sphere(key, col, o.x || 0, y0, o.z || 0, r0, { seg });
    if (o.capBot !== false) mb.sphere(key, col, o.x || 0, y0 - len, o.z || 0, r1, { seg });
  }
  // a point on the head's front surface: yaw (+ = character's left), pitch (+ = up)
  const HR = 0.215, HCY = 0.12, HS = [1.0, 1.05, 0.98];
  function onHead(yaw, pitch, k = 1) {
    return new T.Vector3(Math.sin(yaw) * Math.cos(pitch) * HR * HS[0] * k, HCY + Math.sin(pitch) * HR * HS[1] * k, -Math.cos(yaw) * Math.cos(pitch) * HR * HS[2] * k);
  }

  // ------------------------------------------------------------ head
  function head(P, O) {
    return part((mb) => {
      const skin = P.skin;
      mb.sphere('soft', skin, 0, HCY, 0, HR, { sx: HS[0], sy: HS[1], sz: HS[2], seg: 48, hseg: 32 });
      // ears (outer + inner fold)
      for (const s of [-1, 1]) {
        mb.sphere('soft', skin, s * HR * 0.98, HCY - 0.012, 0.012, 0.05, { sx: 0.42, sy: 0.9, sz: 0.66, seg: 18 });
        mb.sphere('ink', shade(skin, 0.8), s * HR * 1.012, HCY - 0.012, 0.006, 0.03, { sx: 0.25, sy: 0.7, sz: 0.5, seg: 12 });
      }
      // eyes: white, coloured iris, pupil, two catch-lights, upper lid line, brow
      for (const s of [-1, 1]) {
        const yaw = s * 0.34, pitch = 0.04, ry = -yaw, rx = pitch;
        const g = O.gaze || 0.03;                     // both eyes glance a little to one side
        let q = onHead(yaw, pitch, 0.95);
        mb.sphere('ink', 0xffffff, q.x, q.y, q.z, 0.054, { sx: 0.8, sy: 1.06, sz: 0.42, rx, ry, order: 'YXZ', seg: 24 });
        q = onHead(yaw + g, pitch - 0.01, 1.03);
        mb.sphere('ink', O.eye, q.x, q.y, q.z, 0.033, { sx: 0.92, sy: 1.08, sz: 0.3, rx, ry: ry - g, order: 'YXZ', seg: 20 });
        mb.torus('ink', shade(O.eye, 0.55), q.x, q.y, q.z, 0.031, 0.0035, { sy: 1.08, rx, ry: ry - g, order: 'YXZ', seg: 20, tseg: 4 });
        q = onHead(yaw + g, pitch - 0.01, 1.045);
        mb.sphere('ink', 0x121216, q.x, q.y, q.z, 0.017, { sy: 1.1, sz: 0.3, rx, ry: ry - g, order: 'YXZ', seg: 14 });
        q = onHead(yaw + g + 0.05, pitch + 0.06, 1.06);
        mb.sphere('ink', 0xffffff, q.x, q.y, q.z, 0.0095, { sz: 0.4, rx, ry, order: 'YXZ', seg: 10 });
        q = onHead(yaw + g - 0.03, pitch - 0.055, 1.055);
        mb.sphere('ink', 0xffffff, q.x, q.y, q.z, 0.0045, { sz: 0.4, rx, ry, order: 'YXZ', seg: 8 });
        q = onHead(yaw, pitch + 0.01, 1.005);
        mb.torus('ink', 0x1b1512, q.x, q.y, q.z, 0.05, 0.0075, { arc: Math.PI, sx: 0.84, sy: 1.1, rx, ry, order: 'YXZ', seg: 20, tseg: 5 });
        // lash flick at the outer corner
        q = onHead(yaw + s * 0.2, pitch + 0.1, 1.02);
        mb.box('ink', 0x1b1512, q.x, q.y, q.z, 0.018, 0.006, 0.006, { r: 0.002, k: 1, ry, rz: s * 0.5 });
        q = onHead(yaw + s * 0.02, pitch + 0.27, 1.0);
        mb.box('ink', O.brow, q.x, q.y, q.z, 0.078, 0.017, 0.02, { r: 0.008, k: 2, rx: rx + 0.25, ry, rz: s * (O.browTilt || 0.08), order: 'YXZ' });
      }
      // nose
      if (!O.noNose) mb.sphere('soft', skin, 0, HCY - 0.035, -HR * HS[2] - 0.004, 0.023, { sx: 1.05, sy: 0.85, sz: 0.8, seg: 14 });
      // mouth
      const my = -0.31, mq = onHead(0, my, 1.008);
      if (O.mouth === 'grin') {
        mb.sphere('ink', 0x7a2a2a, mq.x, mq.y + 0.004, mq.z + 0.003, 0.034, { sx: 1.1, sy: 0.55, sz: 0.3, rx: my, seg: 16, tl: Math.PI * 0.5, rz: Math.PI });
        mb.box('ink', 0xffffff, mq.x, mq.y + 0.004, mq.z - 0.004, 0.05, 0.01, 0.006, { r: 0.003, k: 1, rx: my });
      }
      if (O.mouth !== 'none') mb.torus('ink', 0x3a1f1a, mq.x, mq.y + 0.006, mq.z, 0.036, 0.0065, { arc: Math.PI, rz: Math.PI, rx: my, sy: 0.7, seg: 18, tseg: 5 });
      if (O.blush) for (const s of [-1, 1]) {
        const q = onHead(s * 0.58, -0.15, 1.0);
        mb.sphere('ink', O.blush, q.x, q.y, q.z, 0.034, { sy: 0.6, sz: 0.2, rx: -0.15, ry: -s * 0.58, order: 'YXZ', seg: 12 });
      }
      if (O.hair) O.hair(mb, P);
      if (O.headwear) O.headwear(mb, P);
    });
  }

  // ------------------------------------------------------------ body
  function torso(P, O) {
    return part((mb) => {
      const shirt = cached('kidShirt', () => lathe([[0, -0.13], [0.156, -0.13], [0.164, -0.05], [0.17, 0.05], [0.18, 0.14], [0.172, 0.2], [0.132, 0.236], [0.06, 0.252], [0, 0.252]]));
      mb.geo('soft', P.shirt, shirt, 0, 0, 0, {}, 1, 1, 0.7);
      // neck
      mb.cyl('soft', P.skin, 0, 0.29, 0, 0.045, 0.05, 0.12, { seg: 16 });
      if (O.chest) O.chest(mb, P);
    });
  }
  function waist(P, O) {
    return part((mb) => {
      mb.cyl('soft', P.shirt, 0, 0.02, 0, 0.158, 0.156, 0.12, { sz: 0.7, seg: 28 });
      if (O.waist) O.waist(mb, P);
    });
  }
  function hips(P, O) {
    return part((mb) => {
      const band = cached('kidHips', () => lathe([[0, -0.1], [0.15, -0.11], [0.17, -0.03], [0.168, 0.06], [0, 0.06]], 32));
      mb.geo('soft', P.shorts, band, 0, 0, 0, {}, 1, 1, 0.72);
      if (O.hips) O.hips(mb, P);
    });
  }
  function thigh(P, O, s) {
    return part((mb) => {
      if (O.pants) {           // long, loose trousers down to the knee piece
        limb(mb, 'soft', P.shorts, D.thigh, 0.09, 0.074, { seg: 20 });
      } else {
        mb.cyl('soft', P.shorts, 0, -0.1, 0, 0.09, 0.084, 0.21, { seg: 20 });
        mb.torus('ink', P.detail, 0, -0.205, 0, 0.083, 0.006, { rx: Math.PI / 2, seg: 22 });
        limb(mb, 'soft', P.skin, D.thigh - 0.1, 0.066, 0.056, { y0: -0.1, capTop: false });
      }
      if (O.thigh) O.thigh(mb, P, s);
    });
  }
  function shin(P, O, s) {
    return part((mb) => {
      if (O.pants) {
        mb.sphere('soft', P.shorts, 0, 0, 0, 0.074, { seg: 18 });
        mb.cyl('soft', P.shorts, 0, -0.14, 0, 0.074, 0.058, 0.28, { seg: 20 });
      } else {
        mb.sphere('soft', P.skin, 0, 0, 0, 0.056, { seg: 18 });                       // knee
        limb(mb, 'soft', P.skin, D.shin - 0.02, 0.052, 0.04, { capTop: false });
      }
      if (O.shin) O.shin(mb, P, s);
    });
  }
  function foot(P, O, s) {
    return part((mb) => (O.foot ? O.foot(mb, P, s) : sneaker(mb, P, s)));
  }
  // default running shoe: upper, toe cap, midsole, tread, heel tab, tongue, laces, side stripe
  function sneaker(mb, P, s, o = {}) {
    const y = -D.ankle, fx = s * 0.008;
    mb.cyl('soft', o.cuff || P.shoe, 0, -0.012, 0.004, 0.05, 0.057, 0.05, { seg: 18 });
    mb.box('soft', P.shoe, fx, y + 0.052, -0.05, 0.118, 0.078, 0.24, { r: 0.036 });
    mb.sphere('soft', P.shoe, fx, y + 0.045, -0.155, 0.058, { sx: 1.0, sy: 0.72, sz: 0.9, seg: 18 });
    mb.box('soft', P.sole, fx, y + 0.017, -0.055, 0.126, 0.03, 0.262, { r: 0.014 });              // midsole
    mb.box('ink', o.tread || shade(P.sole, 0.55), fx, y + 0.003, -0.055, 0.118, 0.008, 0.25, { r: 0.004, k: 1 });
    for (let i = 0; i < 4; i++) mb.box('ink', shade(P.sole, 0.4), fx, y + 0.0, -0.16 + i * 0.07, 0.1, 0.004, 0.02, { r: 0.002, k: 1 });
    mb.box('soft', o.tab || P.detail, fx, y + 0.1, 0.068, 0.05, 0.05, 0.02, { r: 0.01 });          // heel tab
    mb.box('soft', o.tongue || shade(P.shoe, 0.92), fx, y + 0.1, -0.075, 0.06, 0.04, 0.09, { r: 0.018, rx: -0.5 });
    for (let i = 0; i < 3; i++) mb.box('ink', o.lace || 0xf6f6f2, fx, y + 0.098 - i * 0.012, -0.095 + i * 0.03, 0.074, 0.008, 0.012, { r: 0.003, k: 1, rx: -0.45 });
    for (const side of [-1, 1]) mb.box('ink', o.stripe || P.detail, fx + side * 0.061, y + 0.055, -0.04, 0.004, 0.018, 0.12, { rx: 0.25 * side * 0 + 0.28, r: 0.002, k: 1 });
  }
  function upperArm(P, O) {
    return part((mb) => {
      if (O.longSleeves) limb(mb, 'soft', P.shirt, D.upper, 0.058, 0.05, { seg: 18 });
      else {
        mb.cyl('soft', P.shirt, 0, -0.05, 0, 0.062, 0.068, 0.12, { seg: 18 });
        mb.torus('ink', P.detail, 0, -0.108, 0, 0.066, 0.006, { rx: Math.PI / 2, seg: 22 });
        limb(mb, 'soft', P.skin, D.upper - 0.08, 0.045, 0.04, { y0: -0.08, capTop: false });
      }
      if (O.upperArm) O.upperArm(mb, P);
    });
  }
  function foreArm(P, O, s) {
    return part((mb) => {
      if (O.longSleeves) { mb.sphere('soft', P.shirt, 0, 0, 0, 0.05, { seg: 16 }); mb.cyl('soft', P.shirt, 0, -0.1, 0, 0.05, 0.046, 0.2, { seg: 18 }); }
      else { mb.sphere('soft', P.skin, 0, 0, 0, 0.041, { seg: 16 }); limb(mb, 'soft', P.skin, D.fore, 0.039, 0.032, { capTop: false }); }
      if (O.foreArm) O.foreArm(mb, P, s);
    });
  }
  // a relaxed running fist: palm block, four knuckles, curled fingers, thumb over them
  function hand(P, O, s) {
    return part((mb) => {
      const sk = O.glove || P.skin;
      mb.box('soft', sk, s * 0.004, -0.05, -0.004, 0.052, 0.07, 0.068, { r: 0.024 });
      for (let i = 0; i < 4; i++) {
        const z = -0.028 + i * 0.019;
        mb.sphere('bare', sk, s * -0.004, -0.088, z, 0.0125, { seg: 10 });
        mb.box('bare', sk, s * -0.022, -0.08, z, 0.026, 0.024, 0.017, { r: 0.008, k: 2 });
      }
      mb.box('soft', sk, s * -0.03, -0.056, -0.034, 0.02, 0.05, 0.022, { r: 0.01, rz: s * 0.35, rx: -0.2 });   // thumb
      mb.box('ink', shade(sk, 0.82), s * -0.028, -0.07, 0.0, 0.004, 0.03, 0.05, { r: 0.002, k: 1 });            // finger crease
      if (O.hand) O.hand(mb, P, s);
    });
  }

  // ------------------------------------------------------------ cloth springs
  // a chain of little ribbon pieces hanging from a parent bone; player.js
  // swings it from the head's motion (see Player.secondary)
  function ribbon(parent, x, y, z, rx0, ry0, col, n, len, w, gains) {
    const bones = [];
    let p = new T.Group(); p.position.set(x, y, z); p.rotation.set(0, ry0, 0); parent.add(p);
    for (let i = 0; i < n; i++) {
      const b = new T.Group();
      if (i > 0) b.position.y = len;
      b.userData.rx0 = i === 0 ? rx0 : 0.12;
      b.rotation.x = b.userData.rx0;
      b.add(part((mb) => {
        mb.box('soft', col, 0, len / 2, 0, w * (1 - i * 0.12), len * 1.06, 0.012, { r: 0.005, k: 1 });
      }));
      p.add(b); bones.push(b); p = b;
    }
    return { bones, st: bones.map(() => ({ x: 0, z: 0, vx: 0, vz: 0 })), g: gains || bones.map((_, i) => 0.6 + i * 0.35), sx: -1.35, sz: 1, k: 120, d: 9, flutter: 0.12 };
  }

  // ------------------------------------------------------------ builder
  function build(def) {
    const P = def.palette, O = def.kid;
    const bone = (name, parent, x, y, z) => { const b = new T.Group(); b.name = name; b.position.set(x, y, z); if (parent) parent.add(b); return b; };
    const root = new T.Group(), B = {};
    const SW = 0.205, HW = 0.095;
    B.hips = bone('hips', root, 0, D.hipY, 0);
    B.spine = bone('spine', B.hips, 0, D.spine, 0);
    B.chest = bone('chest', B.spine, 0, D.chest - 0.07, 0);
    B.neck = bone('neck', B.chest, 0, D.neck, 0);
    B.head = bone('head', B.neck, 0, D.headY, 0);
    B.armL = bone('armL', B.chest, -SW, D.shoulderY, 0);
    B.armR = bone('armR', B.chest, SW, D.shoulderY, 0);
    B.foreL = bone('foreL', B.armL, 0, -D.upper, 0);
    B.foreR = bone('foreR', B.armR, 0, -D.upper, 0);
    B.handL = bone('handL', B.foreL, 0, -D.fore, 0);
    B.handR = bone('handR', B.foreR, 0, -D.fore, 0);
    B.thighL = bone('thighL', B.hips, -HW, -0.02, 0);
    B.thighR = bone('thighR', B.hips, HW, -0.02, 0);
    B.shinL = bone('shinL', B.thighL, 0, -D.thigh, 0);
    B.shinR = bone('shinR', B.thighR, 0, -D.thigh, 0);
    B.footL = bone('footL', B.shinL, 0, -D.shin, 0);
    B.footR = bone('footR', B.shinR, 0, -D.shin, 0);

    // the head sits lower on the neck bone than the original (real neck, no stick)
    B.head.add(head(P, O));
    B.chest.add(torso(P, O));
    B.spine.add(waist(P, O));
    B.hips.add(hips(P, O));
    B.thighL.add(thigh(P, O, -1)); B.thighR.add(thigh(P, O, 1));
    B.shinL.add(shin(P, O, -1)); B.shinR.add(shin(P, O, 1));
    B.footL.add(foot(P, O, -1)); B.footR.add(foot(P, O, 1));
    B.armL.add(upperArm(P, O)); B.armR.add(upperArm(P, O));
    B.foreL.add(foreArm(P, O, -1)); B.foreR.add(foreArm(P, O, 1));
    B.handL.add(hand(P, O, -1)); B.handR.add(hand(P, O, 1));

    // gear on the back (hidden while the jetpack is on)
    let backGear = null;
    if (O.back) { backGear = part((mb) => O.back(mb, P)); B.chest.add(backGear); }
    const springs = O.springs ? O.springs(B, P) : [];

    const soles = {};
    for (const s of ['L', 'R']) {
      const heel = new T.Object3D(); heel.position.set(0, -D.ankle, 0.06); B['foot' + s].add(heel);
      const toe = new T.Object3D(); toe.position.set(0, -D.ankle, -0.17); B['foot' + s].add(toe);
      soles[s] = { heel, toe };
    }
    return { root, bones: B, tuft: [], soles, def, scarf: null, springs, backGear };
  }

  // ============================================================ SCOUT
  const SCOUT = {
    skin: 0xf1c29a, shirt: 0xcdb57c, shorts: 0x6f6b3b, shoe: 0x7a4a26, sole: 0x3d2a1b, detail: 0x9a8350, ink: 0x161616,
  };
  const scoutKid = {
    eye: 0x6a4424, brow: 0x5a3417, blush: 0xf29a8a, mouth: 'smile',
    hair(mb) {
      const hc = 0x6b3e1f;
      mb.sphere('soft', hc, 0, HCY + 0.012, 0.012, HR * 1.04, { sx: 1.02, sy: 1.05, sz: 1.0, seg: 40, hseg: 20, tl: Math.PI * 0.56, rx: 0.42 });
      for (let i = 0; i < 5; i++) {                                           // fringe tufts
        const q = onHead(-0.5 + i * 0.25, 0.5 - Math.abs(i - 2) * 0.03, 1.02);
        mb.sphere('soft', hc, q.x, q.y, q.z, 0.05, { sx: 1.1, sy: 0.55, sz: 0.6, rx: 0.6, ry: -(-0.5 + i * 0.25), order: 'YXZ', seg: 12 });
      }
      for (const s of [-1, 1]) mb.box('soft', hc, s * HR * 0.9, HCY + 0.03, -0.03, 0.03, 0.08, 0.05, { r: 0.012 });   // sideburns
    },
    headwear(mb) {
      // campaign hat: wide brim, pinched crown, leather band, chin strap
      const hat = 0xc49a5c, y0 = HCY + HR * 0.66;
      mb.cyl('soft', hat, 0, y0, 0.01, 0.33, 0.335, 0.016, { seg: 44, rx: -0.06 });
      mb.torus('ink', shade(hat, 0.75), 0, y0 - 0.002, 0.01, 0.332, 0.007, { rx: Math.PI / 2 - 0.06, seg: 48 });
      const crown = cached('scoutCrown', () => lathe([[0.2, 0], [0.196, 0.04], [0.18, 0.09], [0.14, 0.13], [0.07, 0.148], [0, 0.13]], 36));
      mb.geo('soft', hat, crown, 0, y0, 0.01, { rx: -0.06 });
      mb.torus('soft', 0x6b3e1f, 0, y0 + 0.022, 0.01, 0.197, 0.018, { rx: Math.PI / 2 - 0.06, seg: 40, sy: 0.9 });
      mb.box('ink', shade(0xc49a5c, 0.72), 0, y0 + 0.14, 0.01, 0.008, 0.01, 0.13, { rx: -0.06, r: 0.003, k: 1 });   // centre crease
      mb.torus('ink', 0x3d2a1b, 0, HCY - 0.07, -0.005, HR * 0.98, 0.005, { arc: Math.PI, rz: Math.PI, sx: 1.02, sy: 1.25, seg: 28 });
    },
    chest(mb, P) {
      const d = P.detail;
      // collar + button placket
      for (const s of [-1, 1]) mb.box('soft', P.shirt, s * 0.06, 0.235, -0.09, 0.08, 0.02, 0.07, { r: 0.008, rz: s * 0.35, rx: -0.2 });
      mb.box('ink', d, 0, 0.08, -0.123, 0.012, 0.28, 0.006, { r: 0.003, k: 1 });
      for (let i = 0; i < 4; i++) mb.sphere('ink', 0xf2e6c8, 0, 0.18 - i * 0.075, -0.127, 0.008, { sz: 0.4, seg: 8 });
      // two chest pockets with flaps and buttons
      for (const s of [-1, 1]) {
        mb.box('soft', shade(P.shirt, 0.97), s * 0.075, 0.09, -0.118, 0.07, 0.075, 0.012, { r: 0.006 });
        mb.box('soft', shade(P.shirt, 0.9), s * 0.075, 0.13, -0.122, 0.074, 0.024, 0.012, { r: 0.006 });
        mb.sphere('ink', 0xf2e6c8, s * 0.075, 0.122, -0.13, 0.007, { sz: 0.4, seg: 8 });
      }
      // badges: fleur-ish emblem, a patch row
      mb.sphere('ink', 0x2f6b3a, -0.075, 0.045, -0.126, 0.018, { sz: 0.3, seg: 14 });
      mb.cone('ink', 0xf5d547, -0.075, 0.048, -0.131, 0.008, 0.02, { seg: 6, rx: Math.PI / 2 });
      // neckerchief: rolled scarf around the collar, woggle, two tails
      const nc = 0xe0632a, nb = 0xf5d547;
      mb.torus('soft', nc, 0, 0.245, 0.0, 0.085, 0.022, { rx: Math.PI / 2 + 0.25, sx: 1.12, seg: 28 });
      mb.cyl('soft', 0x8a5a33, 0, 0.19, -0.122, 0.022, 0.022, 0.03, { seg: 14 });
      mb.torus('ink', 0x5a3417, 0, 0.19, -0.13, 0.021, 0.004, { seg: 14 });
      for (const s of [-1, 1]) {
        mb.cone('soft', nc, s * 0.022, 0.13, -0.124, 0.03, 0.12, { seg: 3, rz: Math.PI + s * 0.12, sz: 0.25 });
        mb.box('ink', nb, s * 0.022, 0.085, -0.13, 0.012, 0.012, 0.004, { rz: 0.785 });
      }
      mb.cone('soft', nc, 0, 0.14, 0.1, 0.12, 0.16, { seg: 3, rz: Math.PI, rx: -0.12, sz: 0.2 });    // back triangle
      // backpack straps over the shoulders + sternum strap
      for (const s of [-1, 1]) {
        mb.box('soft', 0x2c4a31, s * 0.095, 0.2, -0.02, 0.045, 0.02, 0.23, { r: 0.008, rx: 0.05 });
        mb.box('soft', 0x2c4a31, s * 0.095, 0.06, -0.122, 0.045, 0.26, 0.016, { r: 0.008 });
        mb.box('ink', 0x9aa1a8, s * 0.095, -0.06, -0.13, 0.05, 0.02, 0.006, { r: 0.003, k: 1 });
      }
      mb.box('soft', 0x2c4a31, 0, 0.1, -0.13, 0.19, 0.022, 0.012, { r: 0.006 });
      mb.box('ink', 0x1d1d1f, 0, 0.1, -0.138, 0.03, 0.026, 0.006, { r: 0.004, k: 1 });
    },
    waist(mb) {
      mb.cyl('soft', 0x5a3417, 0, -0.035, 0, 0.162, 0.162, 0.04, { sz: 0.72, seg: 28 });          // belt
      mb.box('soft', 0xd9b24a, 0, -0.035, -0.117, 0.05, 0.036, 0.012, { r: 0.006 });                // buckle
      mb.box('ink', 0x8a6a2a, 0, -0.035, -0.124, 0.03, 0.018, 0.004, { r: 0.003, k: 1 });
    },
    hips(mb, P) {
      for (const s of [-1, 1]) mb.box('ink', shade(P.shorts, 0.78), s * 0.12, -0.02, -0.085, 0.004, 0.08, 0.05, { ry: s * 0.6, r: 0.002, k: 1 });
    },
    thigh(mb, P, s) {
      mb.box('soft', shade(P.shorts, 0.94), s * 0.078, -0.12, 0.0, 0.03, 0.08, 0.075, { r: 0.012 });     // cargo pocket
      mb.box('soft', shade(P.shorts, 0.86), s * 0.082, -0.085, 0.0, 0.034, 0.02, 0.078, { r: 0.008 });
    },
    shin(mb, P) {
      // knee socks with a two-stripe turn-down and garter tab
      mb.cyl('soft', 0x5f6b3a, 0, -0.2, 0, 0.056, 0.047, 0.27, { seg: 18 });
      mb.cyl('soft', 0x5f6b3a, 0, -0.07, 0, 0.061, 0.06, 0.035, { seg: 18 });
      mb.torus('ink', 0xc0392b, 0, -0.08, 0, 0.06, 0.006, { rx: Math.PI / 2, seg: 20 });
      mb.torus('ink', 0xf5d547, 0, -0.064, 0, 0.061, 0.005, { rx: Math.PI / 2, seg: 20 });
      mb.box('ink', 0xc0392b, 0.062, -0.1, 0, 0.004, 0.05, 0.018, { r: 0.002, k: 1 });
    },
    foot(mb, P, s) {
      // hiking boot: high padded collar, toe bumper, lug sole, speed hooks
      sneaker(mb, P, s, { cuff: 0x5a3417, tab: 0x3d2a1b, tongue: 0x8a5a33, lace: 0xc0392b, stripe: 0x5a3417, tread: 0x2a1c12 });
      mb.cyl('soft', 0x5a3417, 0, 0.012, 0.004, 0.056, 0.058, 0.05, { seg: 18 });
      mb.sphere('soft', 0x5a3417, s * 0.008, -D.ankle + 0.035, -0.17, 0.048, { sx: 1.15, sy: 0.5, sz: 0.7, seg: 16 });
      for (const side of [-1, 1]) for (let i = 0; i < 2; i++) mb.sphere('ink', 0xd9b24a, s * 0.008 + side * 0.04, 0.0 - i * 0.02, -0.035, 0.007, { seg: 6 });
    },
    upperArm(mb) {
      mb.sphere('ink', 0xc0392b, -0.064, -0.05, 0, 0.022, { sx: 0.3, seg: 14 });                    // sleeve patch
      mb.sphere('ink', 0xf5d547, -0.07, -0.05, 0, 0.011, { sx: 0.3, seg: 10 });
    },
    foreArm(mb, P, s) { if (s < 0) { mb.cyl('soft', 0x3d2a1b, 0, -D.fore + 0.03, 0, 0.037, 0.037, 0.022, { seg: 16 }); mb.box('soft', 0xe8e0cc, -0.03, -D.fore + 0.03, 0, 0.014, 0.03, 0.03, { r: 0.006 }); } },
    back(mb) {
      // backpack: body, lid with buckle straps, front pocket, side bottle, bedroll on top
      const g = 0x3f6b46, gd = 0x2c4a31, z = 0.2;
      mb.box('soft', g, 0, 0.07, z, 0.25, 0.3, 0.15, { r: 0.05 });
      mb.box('soft', gd, 0, 0.19, z + 0.005, 0.255, 0.1, 0.16, { r: 0.04 });                           // lid
      mb.box('soft', shade(g, 0.94), 0, 0.02, z + 0.078, 0.18, 0.14, 0.04, { r: 0.02 });                 // front pocket
      mb.box('ink', shade(g, 0.7), 0, 0.075, z + 0.1, 0.16, 0.006, 0.004, { r: 0.002, k: 1 });           // zip
      for (const s of [-1, 1]) {
        mb.box('soft', gd, s * 0.06, 0.12, z + 0.083, 0.03, 0.15, 0.012, { r: 0.006 });
        mb.box('ink', 0x9aa1a8, s * 0.06, 0.07, z + 0.09, 0.036, 0.02, 0.006, { r: 0.003, k: 1 });
      }
      mb.cyl('soft', 0x3aa0d8, 0.14, 0.02, z + 0.02, 0.034, 0.034, 0.14, { seg: 18 });                   // bottle
      mb.cyl('soft', 0xdfe5ec, 0.14, 0.1, z + 0.02, 0.022, 0.03, 0.03, { seg: 14 });
      mb.cyl('soft', 0xb03a2e, 0, 0.275, z + 0.01, 0.05, 0.05, 0.28, { rz: Math.PI / 2, seg: 22 });    // bedroll
      for (const x of [-0.14, 0.14]) mb.torus('ink', shade(0xb03a2e, 0.7), x, 0.275, z + 0.01, 0.05, 0.004, { ry: Math.PI / 2, seg: 18 });
      for (const x of [-0.08, 0.08]) mb.torus('soft', 0x5a3417, x, 0.275, z + 0.01, 0.053, 0.008, { ry: Math.PI / 2, seg: 18 });
    },
  };

  // ============================================================ SPRINTER
  const SPRINT = {
    skin: 0xa8704a, shirt: 0x2f6fe0, shorts: 0x1b2a55, shoe: 0xff4b3e, sole: 0xf7f7f4, detail: 0xffd23f, ink: 0x161616,
  };
  const sprintKid = {
    eye: 0x3b2616, brow: 0x1c1410, mouth: 'grin', browTilt: 0.02,
    hair(mb) {
      const hc = 0x1c1410;
      mb.sphere('soft', hc, 0, HCY + 0.02, 0.01, HR * 1.03, { sx: 1.02, sy: 1.04, sz: 1.0, seg: 40, hseg: 20, tl: Math.PI * 0.52, rx: 0.3 });
      // short, tight curls: a layer of little bumps over the cap
      let n = 0;
      for (let pitch = 0.62; pitch < 1.5; pitch += 0.16) {
        const ring = Math.max(1, Math.round(Math.cos(pitch) * 16));
        for (let i = 0; i < ring; i++) {
          const yaw = (i / ring) * Math.PI * 2 + (n++ % 2) * 0.2;
          if (Math.cos(yaw) > 0.2 && pitch < 0.8) continue;           // keep the forehead clear
          const q = onHead(yaw, pitch, 1.05);
          mb.sphere('bare', i % 3 ? hc : 0x2a1f18, q.x, q.y + 0.004, q.z, 0.028, { seg: 8 });
        }
      }
    },
    headwear(mb) {
      // sweatband with a white stripe; its knot sits at the back
      const y = HCY + 0.1;
      mb.torus('soft', 0xff4b3e, 0, y, 0.0, HR * 1.02, 0.026, { rx: Math.PI / 2 + 0.12, sx: 1.0, sz: 0.97, seg: 44, tseg: 10 });
      mb.torus('ink', 0xffffff, 0, y, -0.001, HR * 1.045, 0.006, { rx: Math.PI / 2 + 0.12, sz: 0.97, seg: 44 });
      mb.sphere('soft', 0xff4b3e, 0, y - 0.022, HR * 1.0, 0.03, { sx: 1.2, sy: 0.9, seg: 12 });
    },
    chest(mb, P) {
      const Y = 0xffd23f, W = 0xffffff;
      // vest cut: side panels, collar trim
      for (const s of [-1, 1]) mb.box('soft', Y, s * 0.155, 0.04, 0, 0.03, 0.3, 0.2, { r: 0.012, rz: s * -0.04 });
      mb.torus('soft', Y, 0, 0.24, -0.01, 0.07, 0.012, { rx: Math.PI / 2 + 0.35, sx: 1.2, seg: 28 });
      // number 7 front and back (bars)
      for (const [z, f] of [[-0.121, 1], [0.121, -1]]) {
        mb.box('ink', W, 0, 0.15, z, 0.1, 0.022, 0.006, { r: 0.004, k: 1 });
        mb.box('ink', W, f * 0.01, 0.075, z, 0.022, 0.14, 0.006, { r: 0.004, k: 1, rz: f * -0.35 });
      }
      mb.box('ink', Y, 0, 0.235, 0.118, 0.08, 0.015, 0.006, { r: 0.003, k: 1 });                        // back neck tape
    },
    waist(mb, P) { mb.cyl('soft', 0xffd23f, 0, -0.045, 0, 0.16, 0.16, 0.02, { sz: 0.72, seg: 28 }); },
    hips(mb, P) {
      mb.cyl('soft', shade(P.shorts, 1.2), 0, 0.045, 0, 0.17, 0.169, 0.03, { sz: 0.72, seg: 28 });        // waistband
      mb.box('ink', 0xffffff, 0, 0.03, -0.122, 0.012, 0.03, 0.006, { r: 0.002, k: 1 });                    // drawstring
    },
    thigh(mb, P, s) {
      // split running shorts: two white side stripes + a notch
      for (const d of [-0.012, 0.012]) mb.box('ink', 0xffffff, s * 0.09, -0.1, d, 0.004, 0.2, 0.006, { r: 0.002, k: 1 });
      mb.box('ink', shade(P.shorts, 0.6), s * 0.088, -0.19, 0, 0.004, 0.03, 0.04, { r: 0.002, k: 1 });
    },
    shin(mb) {
      mb.cyl('soft', 0xf7f7f4, 0, -0.28, 0, 0.046, 0.044, 0.1, { seg: 18 });                             // crew socks
      mb.torus('ink', 0x2f6fe0, 0, -0.245, 0, 0.047, 0.005, { rx: Math.PI / 2, seg: 20 });
      mb.torus('ink', 0x2f6fe0, 0, -0.26, 0, 0.046, 0.005, { rx: Math.PI / 2, seg: 20 });
    },
    foot(mb, P, s) { sneaker(mb, P, s, { cuff: 0xff4b3e, tab: 0x1b2a55, tongue: 0xffffff, lace: 0xffffff, stripe: 0xffd23f, tread: 0x1b2a55 }); },
    upperArm(mb) {},
    foreArm(mb, P, s) {
      mb.cyl('soft', 0xff4b3e, 0, -D.fore + 0.03, 0, 0.038, 0.036, 0.05, { seg: 16 });                  // wristband
      mb.torus('ink', 0xffffff, 0, -D.fore + 0.03, 0, 0.039, 0.004, { rx: Math.PI / 2, seg: 18 });
      if (s < 0) { mb.cyl('soft', 0x1d1d1f, 0, -D.fore + 0.085, 0, 0.034, 0.033, 0.03, { seg: 16 }); mb.box('ink', 0x7fe8ff, -0.035, -D.fore + 0.085, 0, 0.006, 0.022, 0.028, { r: 0.004, k: 1 }); }
    },
    springs(B) {
      // sweatband knot tails flicking behind the head
      return [-1, 1].map(s => {
        const r = ribbon(B.head, s * 0.022, HCY + 0.075, HR * 1.1, Math.PI - 0.6, s * 0.3, 0xff4b3e, 3, 0.07, 0.036, [0.5, 0.8, 1.1]);
        r.flutter = 0.1; return r;
      });
    },
  };

  // ============================================================ NINJA
  const NINJA = {
    skin: 0xe9b98f, shirt: 0x323849, shorts: 0x323849, shoe: 0x1d202a, sole: 0x3a3e4a, detail: 0x454c62, ink: 0x161616,
  };
  const hoodGeo = (() => {
    // full hood, open only in a band around the eyes (front ~110°)
    const tA = Math.PI / 2 - 0.19, tB = Math.PI / 2 + 0.1, win = 0.98, front = Math.PI * 1.5;
    return [
      new T.SphereGeometry(1, 48, 18, 0, Math.PI * 2, 0, tA),
      new T.SphereGeometry(1, 48, 16, 0, Math.PI * 2, tB, Math.PI - tB),
      new T.SphereGeometry(1, 40, 6, front + win, Math.PI * 2 - win * 2, tA, tB - tA),
    ];
  })();
  const ninjaKid = {
    eye: 0x3a78a8, brow: 0x14161c, mouth: 'none', browTilt: -0.32, noNose: true,
    headwear(mb) {
      const cloth = 0x323849, R = HR * 1.035;
      for (const g of hoodGeo) mb.geo('soft', cloth, g, 0, HCY, 0, {}, R * HS[0], R * HS[1], R * HS[2]);
      // cloth fold lines + a hint of the nose under the mask
      mb.sphere('soft', cloth, 0, HCY - 0.045, -R * HS[2] + 0.004, 0.028, { sx: 1.1, sy: 0.9, sz: 0.7, seg: 14 });
      for (const s of [-1, 1]) mb.torus('ink', 0x1d202a, s * 0.06, HCY - 0.1, -0.16, 0.06, 0.004, { arc: 1.4, rz: s > 0 ? 3.6 : 4.4, ry: -s * 0.4, seg: 12 });
      // headband with a steel plate and an engraved crescent + star
      const y = HCY + 0.1, red = 0xc62f3a;
      mb.torus('soft', red, 0, y, 0.0, HR * 1.07, 0.024, { rx: Math.PI / 2 + 0.1, sz: 0.97, seg: 44, tseg: 10 });
      const q = onHead(0, 0.43, 1.1);
      mb.box('soft', 0xcfd6e0, q.x, q.y, q.z + 0.004, 0.15, 0.058, 0.014, { r: 0.008, rx: 0.36 });
      for (const s of [-1, 1]) mb.sphere('ink', 0x8a93a3, s * 0.063, q.y + 0.018, q.z - 0.003, 0.005, { seg: 6 });
      mb.torus('ink', 0x5a6272, q.x - 0.012, q.y, q.z - 0.006, 0.016, 0.0035, { arc: 4.3, rz: 1.0, rx: 0.36, seg: 14 });
      mb.cone('ink', 0x5a6272, q.x + 0.022, q.y + 0.004, q.z - 0.007, 0.006, 0.014, { seg: 4, rx: 0.36 + Math.PI / 2 });
      mb.sphere('soft', red, 0, y - 0.02, HR * 1.05, 0.032, { sx: 1.3, sy: 0.9, seg: 12 });                  // knot
    },
    chest(mb, P) {
      const lite = 0x3d4356;
      // wrap-top: crossing lapels (right over left) and a collar band
      mb.box('soft', lite, 0.03, 0.1, -0.12, 0.05, 0.3, 0.014, { r: 0.006, rz: -0.42 });
      mb.box('soft', lite, -0.03, 0.12, -0.124, 0.05, 0.26, 0.014, { r: 0.006, rz: 0.42 });
      mb.torus('soft', lite, 0, 0.24, 0.0, 0.08, 0.018, { rx: Math.PI / 2 + 0.25, sx: 1.15, seg: 28 });
      mb.box('ink', 0x1d202a, 0, -0.02, -0.12, 0.004, 0.2, 0.004, { r: 0.002, k: 1, rz: -0.42 });
      // chest harness for the sword
      mb.box('soft', 0x5a3a2a, 0.02, 0.07, -0.126, 0.03, 0.38, 0.012, { r: 0.006, rz: 0.62 });
      mb.box('soft', 0x5a3a2a, 0.02, 0.07, 0.122, 0.03, 0.38, 0.012, { r: 0.006, rz: -0.62 });
      mb.box('ink', 0xd9a43a, 0.02, 0.07, -0.134, 0.026, 0.026, 0.006, { r: 0.004, k: 1 });
    },
    waist(mb) {
      const red = 0xc62f3a;
      mb.cyl('soft', red, 0, -0.03, 0, 0.165, 0.165, 0.07, { sz: 0.72, seg: 30 });                        // obi
      mb.torus('ink', shade(red, 0.7), 0, -0.03, 0, 0.166, 0.004, { rx: Math.PI / 2, sz: 0.72, seg: 30 });
      mb.sphere('soft', red, -0.1, -0.03, -0.1, 0.034, { sx: 1.3, sy: 0.9, sz: 0.7, seg: 12 });             // knot
      for (const [rz, dy] of [[0.25, -0.07], [-0.1, -0.08]]) mb.box('soft', red, -0.1, -0.03 + dy, -0.108, 0.04, 0.1, 0.012, { r: 0.006, rz });
      // shuriken tucked into the belt
      const sx = 0.11, sy = -0.03, sz = -0.108;
      for (let i = 0; i < 4; i++) mb.cone('ink', 0xaab3c2, sx + Math.cos(i * Math.PI / 2) * 0.016, sy + Math.sin(i * Math.PI / 2) * 0.016, sz, 0.01, 0.03, { rz: i * Math.PI / 2 - Math.PI / 2, seg: 4, sz: 0.3 });
      mb.cyl('ink', 0x5a6272, sx, sy, sz - 0.003, 0.008, 0.008, 0.006, { rx: Math.PI / 2, seg: 8 });
    },
    hips() {},
    pants: true,
    longSleeves: true,
    thigh(mb, P, s) { mb.box('ink', 0x1d202a, s * 0.078, -0.16, -0.02, 0.004, 0.2, 0.004, { r: 0.002, k: 1, rz: s * 0.05 }); },
    shin(mb) {
      // leg wraps from mid-shin to the ankle
      for (let i = 0; i < 5; i++) mb.torus('soft', 0xd8d2c4, 0, -0.17 - i * 0.034, 0, 0.056 - i * 0.002, 0.012, { rx: Math.PI / 2 + (i % 2 ? 0.18 : -0.18), seg: 20, tseg: 6 });
    },
    foot(mb, P, s) {
      // split-toe tabi boot
      const y = -D.ankle, c = P.shoe;
      mb.cyl('soft', c, 0, -0.01, 0.004, 0.05, 0.056, 0.06, { seg: 18 });
      mb.box('soft', c, s * 0.008, y + 0.05, -0.04, 0.112, 0.08, 0.22, { r: 0.036 });
      mb.sphere('soft', c, s * 0.008 - s * 0.02, y + 0.04, -0.15, 0.04, { sx: 0.9, sy: 0.7, sz: 1.0, seg: 14 });     // big toe
      mb.sphere('soft', c, s * 0.008 + s * 0.025, y + 0.038, -0.14, 0.042, { sx: 1.1, sy: 0.65, sz: 0.95, seg: 14 });
      mb.box('ink', 0x0f1015, s * 0.008 - s * 0.002, y + 0.04, -0.17, 0.004, 0.04, 0.05, { r: 0.002, k: 1 });
      mb.box('soft', P.sole, s * 0.008, y + 0.012, -0.055, 0.12, 0.022, 0.26, { r: 0.01 });
      for (let i = 0; i < 3; i++) mb.sphere('ink', 0xaab3c2, s * 0.008 + s * 0.058, y + 0.1 - i * 0.025, 0.02, 0.005, { seg: 6 });   // clasps
    },
    upperArm(mb) {},
    foreArm(mb) {
      // arm wraps
      for (let i = 0; i < 5; i++) mb.torus('soft', 0xd8d2c4, 0, -0.07 - i * 0.03, 0, 0.049 - i * 0.002, 0.011, { rx: Math.PI / 2 + (i % 2 ? 0.2 : -0.2), seg: 20, tseg: 6 });
    },
    glove: 0x1d202a,
    hand(mb, P, s) { mb.cyl('soft', 0x1d202a, 0, -0.012, 0, 0.036, 0.04, 0.03, { seg: 14 }); },
    back(mb) {
      // katana on the back: scabbard, collar, guard, wrapped grip, pommel
      const len = 0.62, ang = 0.58, cx = 0.02, cy = 0.1, z = 0.17;
      const dx = -Math.sin(ang), dy = -Math.cos(ang);                  // pointing down to the left hip
      const at = (t) => [cx + dx * t, cy + dy * t];
      const o = { rz: ang, seg: 16 };
      let [x, y] = at(0.08);
      mb.cyl('soft', 0x6e1f26, x, y, z, 0.022, 0.018, len * 0.72, o);                                     // saya
      [x, y] = at(0.08 + len * 0.36); mb.sphere('soft', 0xd9a43a, x, y, z, 0.019, { seg: 12 });           // kojiri
      [x, y] = at(-0.19); mb.torus('ink', 0xd9a43a, x, y, z, 0.023, 0.006, { rx: Math.PI / 2, rz: ang, seg: 16 });
      [x, y] = at(-0.215); mb.cyl('soft', 0xd9a43a, x, y, z, 0.044, 0.044, 0.012, o);                   // tsuba
      [x, y] = at(-0.3); mb.cyl('soft', 0xe8e0cc, x, y, z, 0.019, 0.02, 0.16, o);                        // grip
      for (let i = 0; i < 5; i++) { [x, y] = at(-0.235 - i * 0.03); mb.box('ink', 0x1d202a, x, y, z - 0.012, 0.03, 0.012, 0.012, { rz: ang + 0.785, r: 0.004, k: 1 }); mb.box('ink', 0x1d202a, x, y, z + 0.012, 0.03, 0.012, 0.012, { rz: ang - 0.785, r: 0.004, k: 1 }); }
      [x, y] = at(-0.385); mb.sphere('soft', 0xd9a43a, x, y, z, 0.021, { sy: 0.7, seg: 12 });
    },
    springs(B) {
      // long headband tails streaming behind
      return [-1, 1].map(s => {
        const r = ribbon(B.head, s * 0.02, HCY + 0.08, HR * 1.06, Math.PI - 0.35, s * 0.18, 0xc62f3a, 4, 0.08, 0.036, [0.5, 0.75, 1.0, 1.25]);
        r.flutter = 0.18; return r;
      });
    },
  };

  // ------------------------------------------------------------ register
  VR.buildCharacterBase = VR.buildCharacter;
  VR.buildCharacter = (def) => (def.kid ? build(def) : VR.buildCharacterBase(def));
  const NEW = [
    { id: 'scout', name: 'الكشّاف', nameEn: 'Scout', tagline: 'جاهز لكل مغامرة', taglineEn: 'Ready for any trail', price: 0, palette: SCOUT, kid: scoutKid,
      perk: { ar: 'المغناطيس يدوم ‎+40%', en: 'Magnet lasts +40%' }, perkMul: { magnet: 1.4 } },
    { id: 'sprinter', name: 'العدّاء', nameEn: 'Sprinter', tagline: 'ما حدا بيلحقه', taglineEn: 'Nobody catches him', price: 0, palette: SPRINT, kid: sprintKid,
      perk: { ar: 'الانطلاق يدوم ‎+60%', en: 'Boost lasts +60%' }, perkMul: { boost: 1.6 } },
    { id: 'ninja', name: 'النينجا', nameEn: 'Ninja', tagline: 'بيركض بصمت', taglineEn: 'Runs in silence', price: 0, palette: NINJA, kid: ninjaKid,
      perk: { ar: 'حذاء النطّ يدوم ‎+50%', en: 'Super Sneakers last +50%' }, perkMul: { sneakers: 1.5 } },
  ];
  VR.CHARACTERS.splice(1, 0, ...NEW);

  // free to pick: they are simply owned from the start
  class Heroes {
    constructor(game) { this.name = 'heroes'; for (const c of NEW) game.owned.add(c.id); }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Heroes);
})();

/* =====================================================================
 * GLB CHARACTERS — runners made in another tool (a rigged .glb file),
 * driven by the game's own animation.
 *
 * The game animates one invisible skeleton (the same bones every runner
 * uses: hips, spine, chest, neck, head, arms, legs). Every frame the
 * model's own bones copy those motions ("retargeting"): each bone takes
 * the same rotation, measured from the rest pose, after its rest
 * direction has been lined up with ours (so an A-pose model's arms hang
 * down when ours do). Hips height and lean carry over too.
 *
 * Extra life: the hair gets spring bones of its own (the model came with
 * a rigid head) so the spikes bounce and stream back while running.
 *
 * Small self-contained .glb reader (no loader library needed): one
 * skinned mesh, PBR material with base colour / normal / metal-rough maps.
 * ===================================================================== */
(function () {
  const T = THREE, D = VR.CHAR_DIM;
  const SW = 0.205, HW = 0.095;
  const LAYOUT = [
    ['hips', null, 0, D.hipY, 0], ['spine', 'hips', 0, D.spine, 0], ['chest', 'spine', 0, D.chest - 0.07, 0],
    ['neck', 'chest', 0, D.neck, 0], ['head', 'neck', 0, D.headY, 0],
    ['armL', 'chest', -SW, D.shoulderY, 0], ['foreL', 'armL', 0, -D.upper, 0], ['handL', 'foreL', 0, -D.fore, 0],
    ['armR', 'chest', SW, D.shoulderY, 0], ['foreR', 'armR', 0, -D.upper, 0], ['handR', 'foreR', 0, -D.fore, 0],
    ['thighL', 'hips', -HW, -0.02, 0], ['shinL', 'thighL', 0, -D.thigh, 0], ['footL', 'shinL', 0, -D.shin, 0],
    ['thighR', 'hips', HW, -0.02, 0], ['shinR', 'thighR', 0, -D.thigh, 0], ['footR', 'shinR', 0, -D.shin, 0],
  ];

  // ------------------------------------------------------------ .glb reading
  const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  function readGLB(buf) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a glb');
    let off = 12, json = null, bin = null;
    while (off < buf.byteLength) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
      else if (type === 0x004e4942) bin = buf.slice(off + 8, off + 8 + len);
      off += 8 + len;
    }
    return { json, bin };
  }
  function accessor(g, i) {
    const a = g.json.accessors[i], bv = g.json.bufferViews[a.bufferView], C = COMP[a.componentType], n = NUM[a.type];
    const start = (bv.byteOffset || 0) + (a.byteOffset || 0), count = a.count * n;
    if (bv.byteStride && bv.byteStride !== n * C.BYTES_PER_ELEMENT) {        // interleaved: copy out
      const out = new C(count), src = new DataView(g.bin), sz = C.BYTES_PER_ELEMENT;
      const get = { 1: 'getUint8', 2: C === Int16Array ? 'getInt16' : 'getUint16', 4: C === Float32Array ? 'getFloat32' : 'getUint32' }[sz];
      for (let e = 0; e < a.count; e++) for (let k = 0; k < n; k++) out[e * n + k] = src[get](start + e * bv.byteStride + k * sz, true);
      return { arr: out, n, norm: !!a.normalized };
    }
    return { arr: new C(g.bin.slice(start, start + count * C.BYTES_PER_ELEMENT)), n, norm: !!a.normalized };
  }
  async function image(g, i, srgb) {
    const im = g.json.images[g.json.textures[i].source], bv = g.json.bufferViews[im.bufferView];
    const blob = new Blob([new Uint8Array(g.bin, bv.byteOffset || 0, bv.byteLength)], { type: im.mimeType });
    const url = URL.createObjectURL(blob), img = new Image();
    img.src = url; await img.decode(); URL.revokeObjectURL(url);
    const tex = new T.Texture(img);
    tex.flipY = false; tex.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
    tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.anisotropy = 4; tex.needsUpdate = true;
    return tex;
  }

  const templates = {};
  function loadTemplate(def) {
    if (templates[def.id]) return templates[def.id];
    const p = (async () => {
      const buf = await (await fetch(def.glb)).arrayBuffer();
      const g = readGLB(buf), J = g.json;
      const prim = J.meshes[0].primitives[0], at = prim.attributes;
      const geo = new T.BufferGeometry();
      const pos = accessor(g, at.POSITION), nor = accessor(g, at.NORMAL), uv = accessor(g, at.TEXCOORD_0);
      const jo = accessor(g, at.JOINTS_0), we = accessor(g, at.WEIGHTS_0);
      geo.setAttribute('position', new T.BufferAttribute(pos.arr, 3));
      if (nor) geo.setAttribute('normal', new T.BufferAttribute(nor.arr, 3));
      geo.setAttribute('uv', new T.BufferAttribute(uv.arr, 2, uv.norm));
      // skin attributes get rewritten below (hair spring bones), keep them as plain arrays
      const joints = new Uint16Array(jo.arr.length); joints.set(jo.arr);
      let weights = we.arr;
      if (!(weights instanceof Float32Array)) { const m = weights instanceof Uint8Array ? 255 : 65535; weights = Float32Array.from(weights, (x) => x / m); }
      if (prim.indices != null) geo.setIndex(new T.BufferAttribute(accessor(g, prim.indices).arr, 1));
      // material
      const mj = J.materials[prim.material || 0] || {}, pbr = mj.pbrMetallicRoughness || {};
      const mat = new T.MeshStandardMaterial({ roughness: pbr.roughnessFactor ?? 1, metalness: pbr.metallicFactor ?? 0, side: mj.doubleSided ? T.DoubleSide : T.FrontSide, envMapIntensity: 0.9 });
      if (pbr.baseColorTexture) mat.map = await image(g, pbr.baseColorTexture.index, true);
      if (mj.normalTexture) { mat.normalMap = await image(g, mj.normalTexture.index, false); mat.normalScale.set(1, -1); }
      if (pbr.metallicRoughnessTexture) { const t = await image(g, pbr.metallicRoughnessTexture.index, false); mat.roughnessMap = t; mat.metalnessMap = t; }
      Object.assign(mat, def.glbMat || {});
      // like the other characters, lit on its own terms (fixed soft key + front fill, a little gloss and rim),
      // so it keeps its true colours in every biome — at night and in tunnels too (uDim settles it a touch)
      mat.toneMapped = false;
      mat.onBeforeCompile = (sh) => {
        if (VR.charUniforms) sh.uniforms.uDim = VR.charUniforms.uDim; else sh.uniforms.uDim = { value: 0 };
        sh.fragmentShader = 'uniform float uDim;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
          vec3 nN = normalize(normal);
          vec3 nKey = vec3(-0.32, 0.58, 0.78);
          #if NUM_DIR_LIGHTS > 0
            nKey += directionalLights[0].direction * 0.5;
          #endif
          nKey.z = max(nKey.z, 0.5); nKey = normalize(nKey);
          float nL = smoothstep(-0.55, 0.85, dot(nN, nKey));
          vec3 nShade = mix(vec3(0.60, 0.62, 0.70), vec3(1.0), nL);
          nShade *= 0.92 + 0.08 * clamp(nN.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 nV = normalize(vViewPosition);
          float nRim = pow(1.0 - clamp(dot(nN, nV), 0.0, 1.0), 4.0);
          float nSpec = pow(max(dot(nN, normalize(nKey + nV)), 0.0), mix(48.0, 6.0, roughnessFactor)) * (1.0 - roughnessFactor) * 0.22;
          nShade = nShade * (1.0 - uDim);
          gl_FragColor = vec4(diffuseColor.rgb * pow(nShade, vec3(2.2)) + vec3(nSpec + nRim * 0.05) * (1.0 - uDim), 0.0);`);
      };
      mat.customProgramCacheKey = () => 'glbCharShade';
      // skeleton (bind pose from the inverse bind matrices)
      const sk = J.skins[0], ibmA = accessor(g, sk.inverseBindMatrices).arr;
      const nodeToJ = {}; sk.joints.forEach((n, i) => (nodeToJ[n] = i));
      const parent = sk.joints.map(() => -1);
      sk.joints.forEach((n, i) => (J.nodes[n].children || []).forEach(c => { if (nodeToJ[c] != null) parent[nodeToJ[c]] = i; }));
      const ibm = sk.joints.map((_, i) => new T.Matrix4().fromArray(ibmA, i * 16));
      const bind = ibm.map(m => m.clone().invert());
      const names = sk.joints.map(n => J.nodes[n].name || 'j' + n);
      return { geo, mat, names, parent, ibm, bind, joints, weights };
    })();
    templates[def.id] = p;
    return p;
  }

  // ------------------------------------------------------------ retarget setup (once per template)
  const FQ = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI), FQi = FQ.clone().invert();
  // our bone -> model bone, child used for the rest direction (null = keep the model's own rest orientation)
  const MAP = [
    ['hips', 'pelvis', null], ['spine', 'spine_01', 'spine_02'], ['chest', 'spine_03', 'neck_01'], ['neck', 'neck_01', 'head'], ['head', 'head', null],
    ['armL', 'upperarm_l', 'lowerarm_l'], ['foreL', 'lowerarm_l', 'hand_l'], ['handL', 'hand_l', 'middle_01_l'],
    ['armR', 'upperarm_r', 'lowerarm_r'], ['foreR', 'lowerarm_r', 'hand_r'], ['handR', 'hand_r', 'middle_01_r'],
    ['thighL', 'thigh_l', 'calf_l'], ['shinL', 'calf_l', 'foot_l'], ['footL', 'foot_l', null],
    ['thighR', 'thigh_r', 'calf_r'], ['shinR', 'calf_r', 'foot_r'], ['footR', 'foot_r', null],
  ];
  // arms hang a little away from the body (wide sleeves and vest), hands continue the forearm
  const OUR_DIR = { spine: [0, 1, 0], chest: [0, 1, 0], neck: [0, 1, 0], armL: [-0.26, -1, 0], foreL: [-0.2, -1, 0], handL: [-0.12, -1, 0.05], armR: [0.26, -1, 0], foreR: [0.2, -1, 0], handR: [0.12, -1, 0.05], thighL: [-0.035, -1, 0], shinL: [0.015, -1, 0], thighR: [0.035, -1, 0], shinR: [-0.015, -1, 0] };
  function prepare(tp, def) {
    if (tp.prep) return tp.prep;
    const idx = {}; tp.names.forEach((n, i) => (idx[n] = i));
    const wpos = tp.bind.map(m => new T.Vector3().setFromMatrixPosition(m));
    const wq = tp.bind.map(m => { const q = new T.Quaternion(), p = new T.Vector3(), s = new T.Vector3(); m.decompose(p, q, s); return q; });
    const lq = tp.bind.map((m, i) => {      // bind local transforms
      const pm = tp.parent[i] >= 0 ? tp.bind[tp.parent[i]].clone().invert().multiply(m) : m.clone();
      const q = new T.Quaternion(), p = new T.Vector3(), s = new T.Vector3(); pm.decompose(p, q, s); return { q, p, s };
    });
    const drive = tp.names.map(() => null);
    for (const [ours, theirs, child] of MAP) {
      const i = idx[theirs]; if (i == null) continue;
      let A = new T.Quaternion();
      if (child && idx[child] != null && OUR_DIR[ours]) {
        const dG = wpos[idx[child]].clone().sub(wpos[i]).normalize();
        const dO = new T.Vector3(...OUR_DIR[ours]).normalize().applyQuaternion(FQi);
        A.setFromUnitVectors(dG, dO);
        const tw = (def.glbTwist || {})[ours];
        if (tw) A.premultiply(new T.Quaternion().setFromAxisAngle(dO, tw));     // turn about the bone (palms inward etc.)
      }
      drive[i] = { ours, A, AQ: A.clone().multiply(wq[i]) };
    }
    // limbs: align as CHAINS (each joint swings from where its parent already put it), so no twist
    // builds up at the elbow / wrist / knee; then turn the whole arm so the palm faces the thigh.
    const swing = (from, to) => new T.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
    const tgt = (ours) => new T.Vector3(...OUR_DIR[ours]).normalize().applyQuaternion(FQi);
    const chain = (list) => {                    // list: [[ours, theirs, child], ...]
      let R = new T.Quaternion();
      const out = [];
      for (const [ours, theirs, child] of list) {
        const i = idx[theirs], c = idx[child]; if (i == null) return null;
        if (c != null && OUR_DIR[ours]) {
          const d = wpos[c].clone().sub(wpos[i]).normalize().applyQuaternion(R);
          R = swing(d, tgt(ours)).multiply(R);
        }
        out.push([ours, i, R.clone()]);
      }
      return out;
    };
    const palmNormal = (hi, side) => {           // flattest axis of the hand's vertices (PCA), facing down / inward in the A-pose
      const pos = tp.geo.attributes.position.array, J = tp.joints, W = tp.weights, n = pos.length / 3;
      const m = new T.Vector3(), pts = [];
      for (let k = 0; k < n; k++) for (let s2 = 0; s2 < 4; s2++) if (J[k * 4 + s2] === hi && W[k * 4 + s2] > 0.7) { const v = new T.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]); pts.push(v); m.add(v); break; }
      if (pts.length < 20) return null;
      m.divideScalar(pts.length);
      const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (const v of pts) { const d = [v.x - m.x, v.y - m.y, v.z - m.z]; for (let a2 = 0; a2 < 3; a2++) for (let b2 = 0; b2 < 3; b2++) C[a2 * 3 + b2] += d[a2] * d[b2]; }
      // smallest eigenvector: power iteration on (trace·I − C)
      const tr = C[0] + C[4] + C[8]; let v = new T.Vector3(0.3, 1, 0.2);
      for (let it = 0; it < 60; it++) {
        const x = (tr - C[0]) * v.x - C[1] * v.y - C[2] * v.z, y = -C[3] * v.x + (tr - C[4]) * v.y - C[5] * v.z, z = -C[6] * v.x - C[7] * v.y + (tr - C[8]) * v.z;
        v.set(x, y, z).normalize();
      }
      const guess = new T.Vector3(-side, -1, 0);          // A-pose palms face down and in
      if (v.dot(guess) < 0) v.negate();
      return v;
    };
    const palms = {};
    for (const sd of ['l', 'r']) {
      const S = sd === 'l' ? 'L' : 'R', side = sd === 'l' ? 1 : -1;     // model's left hand sits at +x
      const arm = chain([['arm' + S, 'upperarm_' + sd, 'lowerarm_' + sd], ['fore' + S, 'lowerarm_' + sd, 'hand_' + sd], ['hand' + S, 'hand_' + sd, 'middle_01_' + sd]]);
      if (arm) {
        const hi = idx['hand_' + sd], pn = palmNormal(hi, side);
        palms[sd] = pn;
        let tw = new T.Quaternion();
        if (pn) {
          const axis = tgt('hand' + S), now = pn.clone().applyQuaternion(arm[2][2]);
          const want = new T.Vector3(-side, 0, -0.3);         // palm toward the thigh, a little back (model space)
          const pa = now.addScaledVector(axis, -now.dot(axis)).normalize(), pb = want.addScaledVector(axis, -want.dot(axis)).normalize();
          let ang = Math.acos(Math.max(-1, Math.min(1, pa.dot(pb))));
          if (new T.Vector3().crossVectors(pa, pb).dot(axis) < 0) ang = -ang;
          tw.setFromAxisAngle(axis, ang + ((def.glbPalm || {})[S] || 0));
        }
        for (const [ours, i, R] of arm) { const A = tw.clone().multiply(R); drive[i] = { ours, A, AQ: A.clone().multiply(wq[i]) }; }
      }
      const leg = chain([['thigh' + S, 'thigh_' + sd, 'calf_' + sd], ['shin' + S, 'calf_' + sd, 'foot_' + sd], ['foot' + S, 'foot_' + sd, null]]);
      if (leg) {
        // the boot keeps its own flat-on-the-ground rest orientation (only the thigh / shin swing)
        // the boot keeps its flat rest pose but is turned (about the vertical only) to point straight ahead
        const fi = idx['foot_' + sd], bi2 = idx['ball_' + sd];
        let footA = new T.Quaternion();
        if (fi != null && bi2 != null) {
          const d = wpos[bi2].clone().sub(wpos[fi]);
          footA.setFromAxisAngle(new T.Vector3(0, 1, 0), -Math.atan2(d.x, d.z) + side * ((def.toeOut || 0.06)));
        }
        for (const [ours, i, R] of leg) { const A = ours.startsWith('foot') ? footA : R; drive[i] = { ours, A, AQ: A.clone().multiply(wq[i]) }; }
      }
    }
    // scale: match hip height
    const pel = idx.pelvis != null ? wpos[idx.pelvis] : new T.Vector3(0, 0.9, 0);
    const scale = (def.glbScale || 1) * D.hipY / pel.y;
    // clavicles shrug with the arm once it rises past ~50° (keeps the shoulder / collar / vest from pinching)
    const clav = {};
    for (const [sd, S] of [['l', 'L'], ['r', 'R']]) if (idx['clavicle_' + sd] != null) clav[idx['clavicle_' + sd]] = { arm: 'arm' + S, dir: tgt('arm' + S) };
    // palm aim: every frame the hand is turned about the forearm so the palm faces where a real hand would
    // (thigh when hanging, forward when raised / waving, inward when pumping); half the turn goes to the forearm
    const aim = {};
    for (const [sd, side] of [['l', 1], ['r', -1]]) {
      const hi = idx['hand_' + sd], fi = idx['lowerarm_' + sd], mi = idx['middle_01_' + sd];
      if (hi == null || fi == null || mi == null || !palms[sd]) continue;
      aim[hi] = { side, fi, pn: palms[sd].clone(), fd: wpos[mi].clone().sub(wpos[hi]).normalize(), wqi: wq[hi].clone().invert() };
    }
    return (tp.prep = { idx, wpos, wq, wqi: wq.map(q => q.clone().invert()), lq, drive, scale, pelvis: idx.pelvis, palms, clav, aim });
  }

  // ------------------------------------------------------------ finger bones
  // The model has one bone per hand with the fingers spread flat. Two hinge bones are added
  // across each hand (knuckles, middle of the fingers) so the fingers can curl into a loose fist.
  function addFingers(tp, P, def) {
    if (tp.fingers !== undefined) return tp.fingers;
    const out = [];
    const pos = tp.geo.attributes.position.array, J = tp.joints, W = tp.weights, n = pos.length / 3;
    for (const sd of ['l', 'r']) {
      const hi = P.idx['hand_' + sd], mi = P.idx['middle_01_' + sd], pn = P.palms[sd];
      if (hi == null || mi == null || !pn) continue;
      const h0 = P.wpos[hi], a = P.wpos[mi].clone().sub(h0).normalize();
      const nrm = pn.clone().addScaledVector(a, -pn.dot(a)).normalize(), wax = new T.Vector3().crossVectors(a, nrm).normalize();
      let smax = 0;
      const list = [];
      for (let k = 0; k < n; k++) {
        let wh = 0, slot = -1;
        for (let q = 0; q < 4; q++) if (J[k * 4 + q] === hi) { wh = W[k * 4 + q]; slot = q; }
        if (wh < 0.5) continue;
        const v = new T.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]).sub(h0), sp = v.dot(a);
        if (sp > smax) smax = sp;
        list.push([k, slot, wh, sp]);
      }
      if (!list.length) continue;
      const k1 = smax * (def.knuckle || 0.47), k2 = smax * 0.74, ramp = smax * 0.06;
      const sm = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
      const base = tp.names.length + (tp.extraBones || 0);
      for (const [k, slot, wh, sp] of list) {
        const w1 = sm(k1 - ramp, k1 + ramp, sp), w2 = sm(k2 - ramp, k2 + ramp, sp);
        if (w1 <= 0.001) continue;
        // hand keeps (1 - w1), first knuckle bone (w1 - w2), second (w2); scaled by the hand's share
        J[k * 4 + slot] = hi; W[k * 4 + slot] = wh * (1 - w1);
        const free = [0, 1, 2, 3].filter(q => q !== slot).sort((x, y) => W[k * 4 + x] - W[k * 4 + y]);
        J[k * 4 + free[0]] = base; W[k * 4 + free[0]] = wh * (w1 - w2);
        J[k * 4 + free[1]] = base + 1; W[k * 4 + free[1]] = wh * w2;
        // renormalise
        let t = 0; for (let q = 0; q < 4; q++) t += W[k * 4 + q];
        for (let q = 0; q < 4; q++) W[k * 4 + q] /= t || 1;
      }
      // curl direction: fingertips toward the palm
      const test = a.clone().applyAxisAngle(wax, 0.1);
      const sign = test.sub(a).dot(nrm) > 0 ? 1 : -1;
      out.push({ sd, hi, base, k1p: h0.clone().addScaledVector(a, k1), k2p: h0.clone().addScaledVector(a, k2), wax, sign });
      tp.extraBones = (tp.extraBones || 0) + 2;
    }
    tp.fingers = out;
    return out;
  }

  // ------------------------------------------------------------ hair spring bones
  // The model's head is one rigid bone. Vertices of the hair that stand away from the
  // skull are re-weighted onto three sprung bones (left / back / right) so they sway.
  function addHair(tp, P, def) {
    if (tp.hair !== undefined) return tp.hair;
    const H = def.hair; if (!H || P.idx.head == null) return (tp.hair = null);
    const head = P.idx.head, hp = P.wpos[head];
    const c = new T.Vector3(hp.x, hp.y + (H.cy || 0.06), hp.z + (H.cz || 0));     // skull centre (model space)
    const pos = tp.geo.attributes.position.array, J = tp.joints, W = tp.weights, n = pos.length / 3;
    const groups = H.groups || [{ az: Math.PI, name: 'hairB' }, { az: Math.PI / 2, name: 'hairL' }, { az: -Math.PI / 2, name: 'hairR' }, { az: 0, name: 'hairF' }];
    const base = tp.names.length + (tp.extraBones || 0);
    const v = new T.Vector3();
    let moved = 0;
    for (let k = 0; k < n; k++) {
      // only vertices fully on the head bone
      let wh = 0; for (let s = 0; s < 4; s++) if (J[k * 4 + s] === head) wh += W[k * 4 + s];
      if (wh < 0.98) continue;
      v.set(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]).sub(c);
      const r = v.length(), up = v.y / (r || 1);
      const f = Math.min(1, Math.max(0, (r - H.r0) / (H.r1 - H.r0))) * Math.min(1, Math.max(0, (up + 0.35) / 0.5));
      if (f <= 0.02) continue;
      // azimuth around the head (model faces +Z): split between neighbouring groups
      const az = Math.atan2(v.x, v.z);
      let best = [];
      for (let gi = 0; gi < groups.length; gi++) {
        let d = Math.abs(az - groups[gi].az); if (d > Math.PI) d = 2 * Math.PI - d;
        best.push([gi, Math.max(0, 1 - d / (Math.PI / 2))]);
      }
      best = best.filter(b => b[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 2);
      const tot = best.reduce((s, b) => s + b[1], 0) || 1;
      const ff = f * f * (3 - 2 * f);
      J[k * 4] = head; W[k * 4] = 1 - ff;
      for (let s = 1; s < 4; s++) { J[k * 4 + s] = 0; W[k * 4 + s] = 0; }
      best.forEach(([gi, w], s) => { J[k * 4 + 1 + s] = base + gi; W[k * 4 + 1 + s] = ff * w / tot; });
      moved++;
    }
    tp.hair = { groups, c, base, moved };
    return tp.hair;
  }

  // ------------------------------------------------------------ build a runner
  function build(def) {
    const root = new T.Group(), B = {};
    for (const [n, p, x, y, z] of LAYOUT) { const b = new T.Bone(); b.name = n; b.position.set(x, y, z); (p ? B[p] : root).add(b); B[n] = b; }
    const soles = {};
    for (const s of ['L', 'R']) {
      const heel = new T.Object3D(); heel.position.set(0, -D.ankle, 0.06); B['foot' + s].add(heel);
      const toe = new T.Object3D(); toe.position.set(0, -D.ankle, -0.17); B['foot' + s].add(toe);
      soles[s] = { heel, toe };
    }
    const rig = { root, bones: B, tuft: [], soles, def, scarf: null, springs: [], backGear: null, skinned: true };
    loadTemplate(def).then((tp) => attach(rig, tp, def)).catch((e) => console.warn('glb character', e));
    return rig;
  }

  function attach(rig, tp, def) {
    const P = prepare(tp, def);
    // a re-skinned file already carries finger and hair bones; otherwise build them here
    const digits = P.idx.fng_index_1_l != null, strands = Object.keys(P.idx).filter(n => /^hair_s\d+_1$/.test(n)).sort();
    const fileFingers = digits || P.idx.finger_01_l != null, fileHair = strands.length > 0 || P.idx.hair_back != null;
    const FG = fileFingers ? [] : addFingers(tp, P, def), H = fileHair ? null : addHair(tp, P, def);
    if (!tp.skinSet) {
      tp.geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(tp.joints, 4));
      tp.geo.setAttribute('skinWeight', new T.Float32BufferAttribute(tp.weights, 4));
      tp.geo.computeBoundingSphere(); tp.skinSet = true;
    }
    const G = new T.Group(); G.quaternion.copy(FQ); G.scale.setScalar(P.scale);
    const bones = tp.names.map((n) => { const b = new T.Bone(); b.name = 'g_' + n; return b; });
    bones.forEach((b, i) => {
      const L = P.lq[i]; b.position.copy(L.p); b.quaternion.copy(L.q); b.scale.copy(L.s);
      (tp.parent[i] >= 0 ? bones[tp.parent[i]] : G).add(b);
    });
    const allBones = bones.slice(), inverses = tp.ibm.slice();
    // finger hinge bones (same order they were numbered in addFingers)
    const fingers = [];
    for (const f of FG) {
      const hand = bones[f.hi], hb = tp.bind[f.hi], hq = P.wq[f.hi];
      const w1 = new T.Matrix4().compose(f.k1p, hq, new T.Vector3(1, 1, 1)), w2 = new T.Matrix4().compose(f.k2p, hq, new T.Vector3(1, 1, 1));
      const b1 = new T.Bone(), b2 = new T.Bone();
      b1.position.copy(f.k1p.clone().applyMatrix4(hb.clone().invert()));
      b2.position.copy(f.k2p.clone().sub(f.k1p).applyQuaternion(hq.clone().invert()));
      hand.add(b1); b1.add(b2);
      allBones.push(b1, b2); inverses.push(w1.clone().invert(), w2.clone().invert());
      fingers.push({ sd: f.sd, b1, b2, axis: f.wax.clone().applyQuaternion(hq.clone().invert()), sign: f.sign });
    }
    // per-digit chains from the file: curl about +X, and the flat-spread fingers drawn a little together
    if (digits) for (const sd of ['l', 'r']) {
      const DG = ['thumb', 'index', 'middle', 'ring', 'pinky'], ids = DG.map(d => [P.idx[`fng_${d}_1_${sd}`], P.idx[`fng_${d}_2_${sd}`]]);
      if (ids.some(([a, b]) => a == null || b == null)) continue;
      const dir = ids.map(([a, b]) => P.wpos[b].clone().sub(P.wpos[a]).normalize());
      const mean = dir.slice(1).reduce((m, d) => m.add(d), new T.Vector3()).normalize();
      ids.forEach(([i1, i2], k) => {
        let add = new T.Quaternion();
        if (k > 0) {
          const z = new T.Vector3(0, 0, 1).applyQuaternion(P.wq[i1]);
          const ang = Math.atan2(new T.Vector3().crossVectors(dir[k], mean).dot(z), dir[k].dot(mean));
          add.setFromAxisAngle(new T.Vector3(0, 0, 1), ang * 0.6);
        }
        fingers.push({ sd, file: true, digit: k, i1, i2, add });
      });
    }
    else if (fileFingers) for (const sd of ['l', 'r']) {
      const i1 = P.idx['finger_01_' + sd], i2 = P.idx['finger_02_' + sd];
      if (i1 != null && i2 != null) fingers.push({ sd, file: true, i1, i2 });       // curl = rotation about the bone's own +X
    }
    // hair: a fixed pivot at the skull centre (axes = our runner's axes), then the sprung bone
    const springs = [], hairFile = [];
    const spring = (az) => { const back = Math.cos(az) < -0.5, front = Math.cos(az) > 0.5;
      return { st: [{ x: 0, z: 0, vx: 0, vz: 0 }], g: [front ? 0.35 : back ? 0.8 : 0.6], sx: 0.55, sz: Math.sin(az) * 0.5 + 0.4, k: 120, d: 7.5, flutter: 0.05, dragK: back ? 0.55 : 0.35, ay: 0.0016, rest: [0] }; };
    // hair strands from the file: a 2-bone spring chain each (wind while running, a slow breeze when standing)
    strands.forEach((n1, k) => {
      const i1 = P.idx[n1], i2 = P.idx[n1.replace(/_1$/, '_2')]; if (i2 == null) return;
      const d = P.wpos[i2].clone().sub(P.wpos[i1]), len = d.length() * 2, az = Math.atan2(d.x, d.z);
      const lf = Math.max(0.6, Math.min(1.5, len / 0.15)), back = Math.cos(az) < -0.4, front = Math.cos(az) > 0.5;
      const p1 = new T.Object3D(), p2 = new T.Object3D(); p1.userData.rx0 = 0; p2.userData.rx0 = 0;
      springs.push({ bones: [p1, p2], st: [{ x: 0, z: 0, vx: 0, vz: 0 }, { x: 0, z: 0, vx: 0, vz: 0 }], g: [1.0 * lf, 1.6 * lf], sx: 0.9, sz: Math.sin(az) * 0.4 + 0.35,
        k: 105 + (k % 4) * 9, d: 6.5, flutter: 0.13, idleFl: 1.3, idleFq: 0.22, ph: k * 1.37, dragK: back ? 0.6 : front ? 0.3 : 0.45, ay: 0.0018, rest: [0, 0] });
      hairFile.push({ i: i1, proxy: p1 }, { i: i2, proxy: p2 });
    });
    if (fileHair && !strands.length) for (const [nm, az] of [['hair_back', Math.PI], ['hair_left', Math.PI / 2], ['hair_right', -Math.PI / 2], ['hair_front', 0]]) {
      const i = P.idx[nm]; if (i == null) continue;
      const proxy = new T.Object3D(); proxy.userData.rx0 = 0;        // the spring drives this; the file bone copies it
      springs.push(Object.assign({ bones: [proxy] }, spring(az)));
      hairFile.push({ i, proxy });
    }
    if (H) {
      const head = bones[P.idx.head], headBindInv = tp.bind[P.idx.head].clone().invert();
      for (const gr of H.groups) {
        const pivot = new T.Bone();
        const wm = new T.Matrix4().compose(H.c, FQi.clone(), new T.Vector3(1, 1, 1));   // our axes, in model space
        const lm = headBindInv.clone().multiply(wm), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
        lm.decompose(p, q, s); pivot.position.copy(p); pivot.quaternion.copy(q);
        head.add(pivot);
        const sb = new T.Bone(); sb.name = gr.name; pivot.add(sb);
        sb.rotation.set(0, 0, 0); sb.userData.rx0 = 0;
        allBones.push(sb); inverses.push(wm.clone().invert());
        const back = Math.cos(gr.az) < -0.5, front = Math.cos(gr.az) > 0.5;
        springs.push({ bones: [sb], st: [{ x: 0, z: 0, vx: 0, vz: 0 }], g: [front ? 0.35 : back ? 0.8 : 0.6], sx: 0.55, sz: Math.sin(gr.az) * 0.5 + 0.4, k: 120, d: 7.5,
          flutter: 0.05, dragK: back ? 0.55 : 0.35, ay: 0.0016, rest: [0] });
      }
    }
    const mesh = new T.SkinnedMesh(tp.geo, tp.mat);
    mesh.frustumCulled = false; mesh.castShadow = true;
    G.add(mesh);
    const skeleton = new T.Skeleton(allBones, inverses);
    mesh.bind(skeleton, new T.Matrix4());
    rig.root.add(G);
    rig.springs = springs;
    rig.glb = { G, bones, P, tp, fingers, hairFile };
    // copy the game's pose onto the model whenever the scene computes its matrices (before drawing and shadows)
    G.updateMatrixWorld = function (force) { if (!rig.glbFreeze) retarget(rig); T.Group.prototype.updateMatrixWorld.call(this, force); };
    retarget(rig);
  }

  const _qs = {}, _t = new T.Quaternion(), _n = [], _d = new T.Vector3(), _id = new T.Quaternion(), _fq = new T.Quaternion(), _X = new T.Vector3(1, 0, 0), _ax = new T.Vector3(),
    _fd = new T.Vector3(), _pn = new T.Vector3(), _want = new T.Vector3(), _c = new T.Vector3();
  function retarget(rig) {
    const { bones, P, tp } = rig.glb, B = rig.bones;
    // our bones' rotations in runner space (rest = identity everywhere)
    const tune = rig.def.glbTune || {};
    for (const [n, p] of LAYOUT) {
      const q = _qs[n] || (_qs[n] = new T.Quaternion());
      q.copy(B[n].quaternion);
      const k = tune[n];
      if (k != null && k <= 1) q.slerp(_id, 1 - k);         // soften (k < 1) a joint's bend for this model's proportions
      else if (k != null) {                                    // boost (k > 1), never past ~135° (slides / landings stay as they are)
        const a = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
        if (a > 1e-4) { const want = Math.max(a, Math.min(a * k, 2.36)); q.slerp(_id, 1 - want / a); }
      }
      if (p) q.premultiply(_qs[p]);
    }
    for (let i = 0; i < bones.length; i++) {
      const pi = tp.parent[i], Qn = _n[i] || (_n[i] = new T.Quaternion());
      const dr = P.drive[i];
      if (dr) {
        // model-space: (F⁻¹ · ours · F) · A · bind
        Qn.copy(FQi).multiply(_qs[dr.ours]).multiply(FQ).multiply(dr.AQ);
      } else {
        Qn.copy(P.lq[i].q); if (pi >= 0) Qn.premultiply(_n[pi]);
        const cl = P.clav[i];
        if (cl) {
          _d.copy(cl.dir).applyQuaternion(_fq.copy(FQi).multiply(_qs[cl.arm]).multiply(FQ));     // arm direction, model space
          const elev = Math.acos(Math.max(-1, Math.min(1, -_d.y)));
          if (elev > 0.87) {
            _ax.set(0, -1, 0).cross(_d); const l = _ax.length();
            if (l > 1e-4) Qn.premultiply(_fq.setFromAxisAngle(_ax.divideScalar(l), Math.min(0.5, (elev - 0.87) * 0.38)));
          }
        }
      }
      const am = P.aim[i];
      if (am) {
        _fq.copy(Qn).multiply(am.wqi);                                   // bind -> now (model space)
        _fd.copy(am.fd).applyQuaternion(_fq); _pn.copy(am.pn).applyQuaternion(_fq);
        const w = Math.max(0, Math.min(1, (_fd.y - 0.05) / 0.6)), ws = w * w * (3 - 2 * w); am.ws = ws;
        // hanging: palm to the thigh (a little back); raised: palm to the front; pumping forward: palm inward
        _want.set(-am.side * (1 - ws), 0, -0.3 * (1 - ws) * (1 - Math.max(0, _fd.z)) + ws).normalize();
        _ax.copy(_want).addScaledVector(_fd, -_want.dot(_fd));
        _pn.addScaledVector(_fd, -_pn.dot(_fd));
        if (_ax.lengthSq() > 1e-4 && _pn.lengthSq() > 1e-4) {
          _ax.normalize(); _pn.normalize();
          let ang = Math.acos(Math.max(-1, Math.min(1, _pn.dot(_ax))));
          if (_c.crossVectors(_pn, _ax).dot(_fd) < 0) ang = -ang;
          ang = Math.max(-2.2, Math.min(2.2, ang));
          // forearm axis (elbow -> wrist) now
          _c.copy(P.wpos[i]).sub(P.wpos[am.fi]).normalize().applyQuaternion(_t.copy(_n[am.fi]).multiply(P.wqi[am.fi]));
          _n[am.fi].premultiply(_fq.setFromAxisAngle(_c, ang * 0.5));
          const fp = tp.parent[am.fi];
          bones[am.fi].quaternion.copy(fp >= 0 ? _t.copy(_n[fp]).invert().multiply(_n[am.fi]) : _n[am.fi]);
          Qn.premultiply(_fq.setFromAxisAngle(_c, ang));
        }
      }
      const b = bones[i];
      if (pi >= 0) b.quaternion.copy(_t.copy(_n[pi]).invert().multiply(Qn));
      else b.quaternion.copy(Qn);
    }
    // fingers: relaxed when the arm hangs (each finger a little more curled than the one before, like a resting hand),
    // a loose fist while the elbows pump, open when the hand is raised (waving)
    if (rig.glb.fingers.length) {
      for (const f of rig.glb.fingers) {
        const fx = Math.abs(B[f.sd === 'l' ? 'foreL' : 'foreR'].rotation.x), k = Math.min(1, fx / 1.0);
        const am = P.aim[P.idx['hand_' + f.sd]], open = 1 - 0.75 * ((am && am.ws) || 0);
        if (f.digit != null) {
          const g = (f.digit - 1) * 0.08;
          const c1 = (f.digit === 0 ? 0.12 + 0.25 * k : 0.3 + g + 0.7 * k) * open, c2 = (f.digit === 0 ? 0.25 + 0.3 * k : 0.42 + g + 0.6 * k) * open;
          bones[f.i1].quaternion.copy(P.lq[f.i1].q).multiply(f.add).multiply(_fq.setFromAxisAngle(_X, c1));
          bones[f.i2].quaternion.copy(P.lq[f.i2].q).multiply(_fq.setFromAxisAngle(_X, c2));
          continue;
        }
        const c1 = (0.3 + 0.55 * k) * open, c2 = (0.25 + 0.5 * k) * open;
        if (f.file) {
          bones[f.i1].quaternion.copy(P.lq[f.i1].q).multiply(_fq.setFromAxisAngle(_X, c1));
          bones[f.i2].quaternion.copy(P.lq[f.i2].q).multiply(_fq.setFromAxisAngle(_X, c2));
        } else { f.b1.quaternion.setFromAxisAngle(f.axis, c1 * f.sign); f.b2.quaternion.setFromAxisAngle(f.axis, c2 * f.sign); }
      }
    }
    // hair bones from the file follow their springs (spring axes = runner axes)
    for (const h of rig.glb.hairFile || []) {
      bones[h.i].quaternion.copy(P.lq[h.i].q).multiply(_fq.copy(FQi).multiply(h.proxy.quaternion).multiply(FQ));
    }
    // hips: bob, crouch and lateral sway carry over (in model units)
    if (P.pelvis != null) {
      const pi = tp.parent[P.pelvis], hb = B.hips.position;
      _d.set(hb.x, hb.y - D.hipY, hb.z).applyQuaternion(FQi).divideScalar(P.scale);
      if (pi >= 0) _d.applyQuaternion(_t.copy(_n[pi]).invert());
      bones[P.pelvis].position.copy(P.lq[P.pelvis].p).add(_d);
    }
  }

  // ------------------------------------------------------------ register
  const prevBuild = VR.buildCharacter;
  VR.buildCharacter = (def) => (def.glb ? build(def) : prevBuild(def));
  VR.preloadGLBCharacter = (def) => loadTemplate(def);
  VR._glbDebug = { readGLB, accessor, retarget };
  const PAL = (c) => ({ skin: c, shirt: c, shorts: c, shoe: c, sole: c, detail: c, cap: c, hair: c, ink: 0x161616 });
  const NOVA = { id: 'nova', name: 'نوفا', nameEn: 'Nova', tagline: 'ستايل الشارع ع السكة', taglineEn: 'Street style on the rails', price: 0, palette: PAL(0xe9705c),
    glb: 'assets/nova.glb?v=20261010e', glbScale: 1.17, cadence: 1.45, glbTune: { foreL: 0.72, foreR: 0.72, handL: 0.15, handR: 0.15, shinL: 1.3, shinR: 1.3, thighL: 1.2, thighR: 1.2 }, hair: { r0: 0.13, r1: 0.24, cy: 0.05, cz: -0.01 },
    perk: { ar: 'جرس مشمش يدوم ‎+50%', en: 'Mishmish bell lasts +50%' }, perkMul: { goat: 1.5 },
    // menu stance: relaxed, weight on one leg, arms hanging close with the hands turned to the thighs
    idle(p, t, A) {
      const br = Math.sin(t * 2.1), sh = Math.sin(t * 0.7), lk = Math.sin(t * 0.7 + 1.1);      // all periods divide 2π/0.7 (seamless loop)
      A.set(p, 'hips', 0, 6 + sh * 2, 3 + sh * 1.5); p[0] = 0.015 + sh * 0.006;
      A.set(p, 'thighL', 3, 0, -1); A.set(p, 'shinL', -3); A.set(p, 'footL', 2, 0, 0);
      A.set(p, 'thighR', 7, 0, 0); A.set(p, 'shinR', -14 - Math.max(0, sh) * 4, 0, -5); A.set(p, 'footR', 6, 0, 3);
      A.set(p, 'spine', -2 + br * 0.6, -2, -2); A.set(p, 'chest', 2 + br * 1.2, -2, -2);
      A.set(p, 'head', 3 + Math.sin(t * 1.4) * 2, -10 + lk * 12, 5);
      A.set(p, 'armL', -3 + br, 0, -3 - br * 0.8); A.set(p, 'foreL', 10 + br * 2); A.set(p, 'handL', 0, 0, 0);
      A.set(p, 'armR', -3 + br, 0, 3 + br * 0.8); A.set(p, 'foreR', 10 + br * 2); A.set(p, 'handR', 0, 0, 0);
    } };
  const at = VR.CHARACTERS.findIndex(c => c.id === 'ninja');
  VR.CHARACTERS.splice(at >= 0 ? at + 1 : VR.CHARACTERS.length, 0, NOVA);
  // start downloading the model as soon as the character screen opens (it is a few MB)
  class GLBPreload {
    constructor(game) { this.name = 'glbPreload'; this.g = game; }
    state(s) { if (s === 'character' || s === 'party') for (const c of VR.CHARACTERS) if (c.glb) loadTemplate(c); }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(GLBPreload);
})();

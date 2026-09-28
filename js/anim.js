/* =====================================================================
 * ANIMATION — procedural, biomechanics-driven motion for the rig.
 * ---------------------------------------------------------------------
 * A Pose is a flat Float32Array: root offset (x,y,z), root rotation
 * (x,y,z), then an Euler (x,y,z) for every joint in JOINTS.
 * Poses are produced by generators (run, jump, slide, idle, death...),
 * blended with weights, then applied to the bones.  After applying,
 * `plant()` lowers/raises the hips so the lowest sole touches the
 * ground — feet never float or sink during the run cycle.
 *
 * The run cycle is sampled from gait curves modelled on real running
 * data (joint angles over one stride, 0 = right-foot contact):
 *   stance 0–36 %  ·  flight 36–50 %  ·  swing 50–100 %
 *   hip, knee and ankle curves; pelvis yaw/roll; thorax counter-
 *   rotation; contralateral arm swing with elbow drive; head
 *   stabilisation; stride and arm amplitude grow with speed.
 *
 * Rotation conventions (bones hang along -Y, character faces -Z):
 *   thigh/arm +x  = swing forward      shin -x = knee bends
 *   forearm +x    = elbow bends        foot +x = toes up
 *   spine -x      = lean forward       +y yaw brings the right side forward
 * ===================================================================== */
(function () {
  const T = THREE;
  const D = Math.PI / 180;
  const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR',
    'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR'];
  const JI = {}; JOINTS.forEach((j, i) => (JI[j] = 6 + i * 3));
  const SIZE = 6 + JOINTS.length * 3;

  const A = {
    SIZE, JOINTS, JI,
    pose() { return new Float32Array(SIZE); },
    // set a joint in degrees
    set(p, j, x = 0, y = 0, z = 0) { const i = JI[j]; p[i] = x * D; p[i + 1] = y * D; p[i + 2] = z * D; },
    add(p, j, x = 0, y = 0, z = 0) { const i = JI[j]; p[i] += x * D; p[i + 1] += y * D; p[i + 2] += z * D; },
    // out = a + (b - a) * t
    lerp(out, a, b, t) { for (let i = 0; i < SIZE; i++) out[i] = a[i] + (b[i] - a[i]) * t; return out; },
    addScaled(out, b, t) { for (let i = 0; i < SIZE; i++) out[i] += b[i] * t; return out; },
    copy(out, a) { out.set(a); return out; },
    zero(p) { p.fill(0); return p; },
    // static pose from a {joint: [x,y,z]} table (degrees)
    fromTable(tbl, p = A.pose()) {
      for (const j in tbl) {
        if (j === 'root') { const r = tbl.root; p[0] = r[0] || 0; p[1] = r[1] || 0; p[2] = r[2] || 0; p[3] = (r[3] || 0) * D; p[4] = (r[4] || 0) * D; p[5] = (r[5] || 0) * D; }
        else A.set(p, j, ...tbl[j]);
      }
      return p;
    },
  };

  // ------------------------------------------------------------ curves
  // periodic cubic Hermite through keys [[t, value], ...], t in [0,1)
  function periodic(keys) {
    const n = keys.length, N = 512, lut = new Float32Array(N + 1);
    const K = (i) => { const k = ((i % n) + n) % n, wrap = Math.floor(i / n); return [keys[k][0] + wrap, keys[k][1]]; };
    for (let s = 0; s <= N; s++) {
      const t = s / N;
      let i = 0; while (i < n - 1 && keys[i + 1][0] <= t) i++;
      if (t < keys[0][0]) i = -1;
      const [t0, v0] = K(i - 1), [t1, v1] = K(i), [t2, v2] = K(i + 1), [t3, v3] = K(i + 2);
      const h = t2 - t1, u = (t - t1) / h;
      const m1 = (v2 - v0) / (t2 - t0) * h, m2 = (v3 - v1) / (t3 - t1) * h;
      const u2 = u * u, u3 = u2 * u;
      lut[s] = (2 * u3 - 3 * u2 + 1) * v1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * v2 + (u3 - u2) * m2;
    }
    return (t) => { t = t - Math.floor(t); const f = t * N, i = f | 0, k = f - i; return lut[i] + (lut[i + 1] - lut[i]) * k; };
  }
  A.periodic = periodic;

  // Gait curves (degrees) for ONE leg. 0 = this foot's contact.
  const HIP = periodic([[0, 26], [0.1, 16], [0.2, 2], [0.3, -12], [0.36, -18], [0.45, -14], [0.55, 4], [0.65, 28], [0.75, 45], [0.85, 41], [0.93, 32]]);
  const KNEE = periodic([[0, 22], [0.1, 40], [0.2, 35], [0.3, 24], [0.36, 20], [0.45, 50], [0.55, 96], [0.63, 116], [0.72, 96], [0.82, 56], [0.92, 25]]);
  const ANKLE = periodic([[0, 2], [0.1, 22], [0.2, 30], [0.3, 18], [0.36, -6], [0.45, -14], [0.55, -4], [0.65, 6], [0.8, 12], [0.92, 2]]);
  // 1 during this foot's stance (smooth edges)
  const STANCE = periodic([[0, 0.7], [0.05, 1], [0.3, 1], [0.37, 0.15], [0.45, 0], [0.9, 0], [0.97, 0.3]]);
  // flight windows (both feet off the ground)
  const FLIGHT = periodic([[0, 0], [0.34, 0], [0.43, 1], [0.5, 0], [0.84, 0], [0.93, 1]]);
  // loading response (knee flex dip) -> small trunk flex
  const LOAD = periodic([[0, 0], [0.1, 1], [0.25, 0.2], [0.5, 0], [0.6, 1], [0.75, 0.2]]);
  A.curves = { HIP, KNEE, ANKLE, STANCE, FLIGHT };

  /**
   * Run cycle.  phase 0..1 (right-foot contact at 0), s = speed factor 0..1
   * (jog -> sprint).  Returns flight lift in metres (applied after planting).
   */
  A.run = function (p, phase, s) {
    A.zero(p);
    const tR = phase, tL = (phase + 0.5) % 1;
    const hipAmp = 1 + 0.38 * s, kneeSwing = 0.2 * s;
    const legs = [['R', tR, 1], ['L', tL, -1]];
    const hipDeg = {};
    for (const [side, t, sg] of legs) {
      const hip = HIP(t) * hipAmp;
      const kn = KNEE(t), knee = kn + Math.max(0, kn - 45) * kneeSwing;
      const ank = ANKLE(t) - s * 4 * STANCE(t);
      hipDeg[side] = hip;
      // slight adduction in stance ("running on a line"), outward in swing
      const add = (STANCE(t) * 3.2 - (1 - STANCE(t)) * 1.5) * -sg;
      A.set(p, 'thigh' + side, hip, 0, add);
      A.set(p, 'shin' + side, -knee, 0, 0);
      A.set(p, 'foot' + side, ank, 0, -add * 0.6);
    }
    // pelvis: yaw follows the swinging leg, drops on the swing side
    const yaw = (hipDeg.R - hipDeg.L) * 0.2;
    const roll = (STANCE(tR) - STANCE(tL)) * 4.5;
    A.set(p, 'hips', 0, yaw, roll);
    p[0] = (STANCE(tR) - STANCE(tL)) * 0.018;               // lateral weight shift
    // trunk: forward lean grows with speed, small flex on loading
    const load = LOAD(phase);
    const lean = 11 + 11 * s + load * 2.5;
    A.set(p, 'spine', -lean * 0.6, -yaw * 0.55, -roll * 0.5);
    A.set(p, 'chest', -lean * 0.4 - 2, -yaw * 0.95, -roll * 0.35);
    // head stabilised: keeps the gaze level and forward
    A.set(p, 'neck', lean * 0.45, yaw * 0.45, roll * 0.3);
    A.set(p, 'head', lean * 0.42 + load * 1.5, yaw * 0.55, roll * 0.4);
    // arms swing with the OPPOSITE leg, elbows at ~90°, cross the body a little
    const armAmp = 1.1 * (1 + 0.35 * s) * (1 + 0.06 * Math.sin(phase * Math.PI * 2 * 0.37 + 1.3));
    for (const [side, other, sg] of [['R', 'L', 1], ['L', 'R', -1]]) {
      const f = (hipDeg[other] / hipAmp - 12) * armAmp;
      const fwd = Math.max(0, Math.min(1, f / 45));
      A.set(p, 'arm' + side, f, sg * (6 + fwd * 16), sg * (11 - fwd * 7));
      A.set(p, 'fore' + side, 78 + fwd * 30 + s * 8, sg * -6, 0);
      A.set(p, 'hand' + side, 6, 0, sg * -4);
    }
    return 0.05 * (1 + 0.6 * s) * FLIGHT(phase);
  };

  // ------------------------------------------------------------ static poses
  const P = {};
  P.jumpLeapR = A.fromTable({
    thighR: [78, 0, -4], shinR: [-30], footR: [16], thighL: [-32, 0, 3], shinL: [-100], footL: [-28],
    spine: [-16, -8, 0], chest: [-6, -8, 0], neck: [10], head: [12, 10, 0],
    armL: [72, -10, -14], foreL: [46], armR: [-42, 8, 22], foreR: [62], handL: [10], handR: [10],
  });
  P.jumpLeapL = A.fromTable({
    thighL: [78, 0, 4], shinL: [-30], footL: [16], thighR: [-32, 0, -3], shinR: [-100], footR: [-28],
    spine: [-16, 8, 0], chest: [-6, 8, 0], neck: [10], head: [12, -10, 0],
    armR: [72, 10, 14], foreR: [46], armL: [-42, -8, -22], foreL: [62], handL: [10], handR: [10],
  });
  P.jumpTuck = A.fromTable({
    thighL: [96, 0, 6], thighR: [96, 0, -6], shinL: [-128], shinR: [-128], footL: [-22], footR: [-22],
    spine: [-26], chest: [-10], neck: [14], head: [18],
    armL: [58, -18, -22], armR: [58, 18, 22], foreL: [74], foreR: [74],
  });
  P.jumpFall = A.fromTable({
    thighL: [42, 0, 7], thighR: [34, 0, -7], shinL: [-48], shinR: [-38], footL: [12], footR: [8],
    spine: [-7], chest: [-2], neck: [4], head: [6],
    armL: [70, 0, -58], armR: [62, 0, 58], foreL: [26], foreR: [30], handL: [0, 0, -10], handR: [0, 0, 10],
  });
  P.slide = A.fromTable({
    root: [0, -0.43, 0],
    hips: [54, 0, 0], spine: [-24, 0, 0], chest: [-14, 0, 0], neck: [-18], head: [-24, 0, 0],
    thighR: [30, 0, -3], shinR: [-8], footR: [22],
    thighL: [-22, 0, -24], shinL: [-122], footL: [-34],
    armL: [-62, 0, -38], foreL: [14], handL: [-30],
    armR: [64, 12, 26], foreR: [58], handR: [8],
  });
  P.land = A.fromTable({                    // additive crouch on landing
    thighL: [34], thighR: [34], shinL: [-62], shinR: [-62], footL: [28], footR: [28],
    spine: [-14], chest: [-4], neck: [8], head: [6], armL: [16, 0, -16], armR: [16, 0, 16], foreL: [12], foreR: [12],
  });
  P.stumble = A.fromTable({                 // additive
    spine: [12, 22, 8], chest: [8, 18, 0], head: [-14, -30, 12],
    armL: [60, 0, -70], armR: [30, 0, 80], foreL: [-30], foreR: [10],
    thighL: [-10], shinL: [-30],
  });
  P.lane = A.fromTable({                    // additive, scaled by lateral direction (+ = moving right)
    root: [0, 0, 0, 0, 0, -9], spine: [0, -6, 5], chest: [0, -4, 3], neck: [0, 0, 6], head: [0, 8, 4],
    armL: [0, 0, -22], armR: [0, 0, 8],
  });
  P.deathHit = A.fromTable({
    spine: [36, 0, 0], chest: [18], neck: [20], head: [26, 12, 0],
    armL: [128, 0, -40], armR: [102, 0, 46], foreL: [20], foreR: [34],
    thighL: [38, 0, 6], thighR: [14, 0, -6], shinL: [-46], shinR: [-20], footL: [20], footR: [10],
  });
  P.deathLie = A.fromTable({
    spine: [4], chest: [0], neck: [-6], head: [4, 32, 0],
    armL: [50, 10, -76], armR: [28, -12, 70], foreL: [22], foreR: [34], handL: [0, 0, -20], handR: [0, 0, 20],
    thighL: [16, 0, 12], thighR: [6, 0, -9], shinL: [-24], shinR: [-8], footL: [-40], footR: [-50],
  });
  P.cheer = A.fromTable({
    armL: [20, 0, -150], armR: [20, 0, 150], foreL: [10, 0, -20], foreR: [10, 0, 20],
    thighL: [40, 0, 8], thighR: [30, 0, -8], shinL: [-70], shinR: [-60], footL: [-20], footR: [-20],
    spine: [4], head: [14, 0, 0],
  });
  A.P = P;

  /**
   * Jetpack flight: body pitched forward into the airflow, legs trailing and
   * gently scissoring, arms swept back for balance, head up to see ahead.
   * t = time (s), bank = -1..1 lane-change roll.
   */
  A.fly = function (p, t, bank = 0) {
    A.zero(p);
    const s1 = Math.sin(t * 5.2), s2 = Math.sin(t * 5.2 + 2.1), bob = Math.sin(t * 2.6);
    p[1] = bob * 0.05;                                   // hover bob
    p[3] = -(34 + bob * 3) * D;                          // pitch forward
    p[5] = -bank * 24 * D;                               // bank into lane changes
    A.set(p, 'spine', -6, 0, bank * 4); A.set(p, 'chest', -4);
    A.set(p, 'neck', 26); A.set(p, 'head', 20 + bob * 2, -bank * 10, 0);
    A.set(p, 'thighL', -10 + s1 * 7, 0, -5); A.set(p, 'shinL', -28 - s1 * 10); A.set(p, 'footL', -30);
    A.set(p, 'thighR', -4 + s2 * 7, 0, 5); A.set(p, 'shinR', -40 - s2 * 10); A.set(p, 'footR', -34);
    A.set(p, 'armL', -34 + s2 * 3, -10, -24 - bank * 10); A.set(p, 'foreL', 22); A.set(p, 'handL', 10, 0, 6);
    A.set(p, 'armR', -34 + s1 * 3, 10, 24 - bank * 10); A.set(p, 'foreR', 22); A.set(p, 'handR', 10, 0, -6);
  };

  /** Idle: breathing, weight shift, relaxed arms, looking around. */
  A.idle = function (p, t, look = 0) {
    A.zero(p);
    const br = Math.sin(t * 2.1), sh = Math.sin(t * 0.7), sh2 = Math.sin(t * 0.7 + 0.8);
    A.set(p, 'hips', 0, sh * 4, sh * 3);
    p[0] = sh * 0.025;
    A.set(p, 'thighL', 2, 0, -sh * 3 - 1.5); A.set(p, 'thighR', 2, 0, -sh * 3 + 1.5);
    A.set(p, 'shinL', -5 - Math.max(0, sh) * 6); A.set(p, 'shinR', -5 - Math.max(0, -sh) * 6);
    A.set(p, 'footL', 3, 0, sh * 3); A.set(p, 'footR', 3, 0, sh * 3);
    A.set(p, 'spine', -2 + br * 0.8, -sh * 2, -sh * 2.5);
    A.set(p, 'chest', -1 + br * 1.4, -sh * 2, -sh);
    A.set(p, 'neck', br * -0.6, look * 0.4, 0);
    A.set(p, 'head', Math.sin(t * 0.9) * 3, look * 0.6 + sh2 * 5, sh * 2);
    A.set(p, 'armL', 4 + br * 1.5, -4, -9 - br * 1.5); A.set(p, 'armR', 4 + br * 1.5, 4, 9 + br * 1.5);
    A.set(p, 'foreL', 14 + br * 2); A.set(p, 'foreR', 14 + br * 2);
    A.set(p, 'handL', 4, 0, 4); A.set(p, 'handR', 4, 0, -4);
  };
  /** Wave hello (additive over idle, w = 0..1). */
  A.wave = function (p, t, w) {
    if (w <= 0) return;
    const q = A.pose();
    A.set(q, 'armR', -8, 0, 122);
    A.set(q, 'foreR', 18, 0, 26 + Math.sin(t * 11) * 28);
    A.set(q, 'handR', 0, 0, Math.sin(t * 11 + 0.6) * 12);
    A.set(q, 'chest', 0, 0, -4); A.set(q, 'head', 4, -8, -6);
    const i0 = JI.armR, idx = [i0, i0 + 1, i0 + 2, JI.foreR, JI.foreR + 1, JI.foreR + 2, JI.handR, JI.handR + 1, JI.handR + 2];
    for (const i of idx) p[i] += (q[i] - p[i]) * w;
    const c = JI.chest, h = JI.head;
    p[c + 2] += q[c + 2] * w; p[h] += q[h] * w; p[h + 1] += q[h + 1] * w; p[h + 2] += q[h + 2] * w;
  };

  // ------------------------------------------------------------ apply + plant
  const _v = new T.Vector3();
  A.apply = function (rig, p) {
    const B = rig.bones;
    rig.root.rotation.set(p[3], p[4], p[5]);
    B.hips.position.set(p[0], VR.CHAR_DIM.hipY + p[1], p[2]);
    for (let j = 0; j < JOINTS.length; j++) {
      const i = 6 + j * 3;
      B[JOINTS[j]].rotation.set(p[i], p[i + 1], p[i + 2]);
    }
  };
  /** Lowest sole point relative to the root (metres, after apply). */
  A.lowestSole = function (rig) {
    rig.root.updateMatrixWorld(true);
    const baseY = rig.root.getWorldPosition(_v).y;
    let min = Infinity;
    for (const s of ['L', 'R']) for (const k of ['heel', 'toe']) {
      rig.soles[s][k].getWorldPosition(_v);
      if (_v.y < min) min = _v.y;
    }
    return min - baseY;
  };
  /** Move the hips so the lowest sole sits `lift` metres above ground. */
  A.plant = function (rig, weight, lift) {
    if (weight <= 0) return;
    const low = A.lowestSole(rig);
    rig.bones.hips.position.y += (-low + lift) * weight;
  };

  VR.Anim = A;
})();

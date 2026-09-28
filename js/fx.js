/* =====================================================================
 * FX — particles and ambience.
 *   VR.FX.dust / sparkle / sparks / confetti / ring  (one-shot bursts)
 *   ambient weather around the camera: petals, leaves, snow, sand,
 *   fireflies (chosen per biome)
 *   speed streaks while boosting
 * All particles are GPU points drawn by one shader (2 draw calls).
 * ===================================================================== */
(function () {
  const T = THREE;

  const VERT = `
    attribute float aSize; attribute vec4 aColor; attribute float aRot; attribute float aShape;
    uniform float uScale;
    varying vec4 vColor; varying float vRot; varying float vShape;
    void main(){
      vColor = aColor; vRot = aRot; vShape = aShape;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * uScale / max(0.1, -mv.z);
      gl_Position = projectionMatrix * mv;
    }`;
  const FRAG = `
    varying vec4 vColor; varying float vRot; varying float vShape;
    void main(){
      vec2 p = gl_PointCoord - 0.5;
      float c = cos(vRot), s = sin(vRot);
      p = vec2(c*p.x - s*p.y, s*p.x + c*p.y);
      float a;
      if (vShape < 0.5) a = smoothstep(0.5, 0.0, length(p));                                   // soft puff
      else if (vShape < 1.5) { float d = length(p); a = max(smoothstep(0.5, 0.0, d) * 0.6, smoothstep(0.08, 0.0, abs(p.x)) * smoothstep(0.5, 0.0, abs(p.y)) + smoothstep(0.08, 0.0, abs(p.y)) * smoothstep(0.5, 0.0, abs(p.x))); } // star
      else if (vShape < 2.5) a = step(abs(p.x), 0.32) * step(abs(p.y), 0.2);                   // confetti / leaf chip
      else a = smoothstep(0.5, 0.3, length(p * vec2(1.0, 2.2)));                               // petal
      if (a * vColor.a < 0.01) discard;
      gl_FragColor = vec4(vColor.rgb, a * vColor.a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  class Points {
    constructor(scene, max, additive) {
      this.max = max;
      const g = new T.BufferGeometry();
      this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4);
      this.size = new Float32Array(max); this.rot = new Float32Array(max); this.shape = new Float32Array(max);
      g.setAttribute('position', new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage));
      g.setAttribute('aColor', new T.BufferAttribute(this.col, 4).setUsage(T.DynamicDrawUsage));
      g.setAttribute('aSize', new T.BufferAttribute(this.size, 1).setUsage(T.DynamicDrawUsage));
      g.setAttribute('aRot', new T.BufferAttribute(this.rot, 1).setUsage(T.DynamicDrawUsage));
      g.setAttribute('aShape', new T.BufferAttribute(this.shape, 1).setUsage(T.DynamicDrawUsage));
      this.uniforms = { uScale: { value: 400 } };
      this.mat = new T.ShaderMaterial({
        uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
        blending: additive ? T.AdditiveBlending : T.NormalBlending,
      });
      if (additive) VR.keepAlpha(this.mat);
      this.mesh = new T.Points(g, this.mat);
      this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
      scene.add(this.mesh);
      this.geo = g;
      this.p = []; // live particles
    }
    spawn(o) {
      if (this.p.length >= this.max) this.p.shift();
      this.p.push(Object.assign({ vx: 0, vy: 0, vz: 0, g: 0, drag: 0, life: 1, age: 0, size: 0.3, grow: 0, r: 1, gg: 1, b: 1, a: 1, fade: 1, rot: 0, spin: 0, shape: 0 }, o));
    }
    update(dt) {
      const P = this.p;
      let n = 0;
      for (let i = 0; i < P.length; i++) {
        const q = P[i];
        q.age += dt;
        if (q.age >= q.life) continue;
        const d = Math.max(0, 1 - q.drag * dt);
        q.vx *= d; q.vy = q.vy * d - q.g * dt; q.vz *= d;
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
        q.rot += q.spin * dt;
        const t = q.age / q.life;
        P[n++] = q;
        const k = n - 1;
        this.pos[k * 3] = q.x; this.pos[k * 3 + 1] = q.y; this.pos[k * 3 + 2] = q.z;
        const alpha = q.a * (q.fade ? (t < 0.1 ? t / 0.1 : 1 - Math.pow(t, 2)) : 1);
        this.col[k * 4] = q.r; this.col[k * 4 + 1] = q.gg; this.col[k * 4 + 2] = q.b; this.col[k * 4 + 3] = alpha;
        this.size[k] = q.size * (1 + q.grow * t); this.rot[k] = q.rot; this.shape[k] = q.shape;
      }
      P.length = n;
      this.geo.setDrawRange(0, n);
      // PERF: upload only the live particles, and nothing at all when idle
      if (n === 0 && this.lastN === 0) return;
      this.lastN = n;
      for (const a of ATTRS) {
        const at = this.geo.attributes[a];
        at.updateRange.offset = 0; at.updateRange.count = Math.max(1, n) * at.itemSize;
        at.needsUpdate = true;
      }
    }
    clear() { this.p.length = 0; this.geo.setDrawRange(0, 0); }
  }

  const ATTRS = ['position', 'aColor', 'aSize', 'aRot', 'aShape'];
  const tmpC = new T.Color();
  const _m4 = new T.Matrix4();
  function rgb(hex, mul = 1) { tmpC.setHex(hex); return { r: tmpC.r * mul, gg: tmpC.g * mul, b: tmpC.b * mul }; }

  class FX {
    constructor(scene) {
      this.scene = scene;
      this.soft = new Points(scene, 900, false);
      this.glow = new Points(scene, 900, true);
      this.amb = new Points(scene, 420, false);
      this.ambGlow = new Points(scene, 160, true);
      this.ambType = null; this.ambT = 0;
      this.ambList = [];
      this.streaks = this.buildStreaks(scene);
      this.streakAmt = 0;
    }
    setScale(h, fov) {
      const s = h / (2 * Math.tan(fov * Math.PI / 360));
      for (const p of [this.soft, this.glow, this.amb, this.ambGlow]) p.uniforms.uScale.value = s;
    }

    // ------------------------------------------------------------ bursts
    dust(x, y, z, n = 5, color = 0xcbb89a, power = 1) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        this.soft.spawn(Object.assign({
          x: x + Math.cos(a) * 0.15, y: y + 0.08, z: z + Math.sin(a) * 0.15,
          vx: Math.cos(a) * (0.8 + Math.random()) * power, vy: 0.5 + Math.random() * 0.9 * power, vz: 2 + Math.random() * 3,
          drag: 3, g: 0.8, life: 0.45 + Math.random() * 0.35, size: 0.35 + Math.random() * 0.3, grow: 2.2, a: 0.45, shape: 0,
        }, rgb(color)));
      }
    }
    sparkle(x, y, z, color = 0xffe28a, n = 10, speed = 3, vz0 = 0) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.3) * Math.PI;
        this.glow.spawn(Object.assign({
          x, y, z, vx: Math.cos(a) * Math.cos(b) * speed, vy: Math.sin(b) * speed + 1, vz: Math.sin(a) * Math.cos(b) * speed + vz0,
          drag: vz0 ? 0 : 3.5, g: 3, life: 0.3 + Math.random() * 0.3, size: 0.22 + Math.random() * 0.2, shape: 1, rot: Math.random() * 3, spin: 3,
        }, rgb(color, 2.2)));
      }
    }
    sparks(x, y, z, n = 3) {
      for (let i = 0; i < n; i++) {
        this.glow.spawn(Object.assign({
          x: x + (Math.random() - 0.5) * 0.3, y: y + 0.05, z, vx: (Math.random() - 0.5) * 4, vy: 1 + Math.random() * 3, vz: 6 + Math.random() * 6,
          drag: 1, g: 14, life: 0.25 + Math.random() * 0.2, size: 0.1 + Math.random() * 0.08, shape: 0,
        }, rgb(Math.random() < 0.5 ? 0xffb347 : 0xffe07a, 3)));
      }
    }
    ring(x, y, z, color = 0xffffff, n = 18, speed = 5) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.glow.spawn(Object.assign({ x, y, z, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, vz: 0, drag: 4, life: 0.45, size: 0.3, shape: 1 }, rgb(color, 2)));
      }
    }
    confetti(x, y, z, n = 80) {
      const cols = [0xffd43b, 0xff6b5b, 0x46e0ff, 0x7dff8a, 0xff4fa3, 0xffffff];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        this.soft.spawn(Object.assign({
          x, y, z, vx: Math.cos(a) * (2 + Math.random() * 5), vy: 5 + Math.random() * 7, vz: Math.sin(a) * (2 + Math.random() * 5),
          drag: 1.4, g: 7, life: 2 + Math.random(), size: 0.22 + Math.random() * 0.12, shape: 2, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 18, fade: 1,
        }, rgb(cols[(Math.random() * cols.length) | 0])));
      }
    }
    smash(x, y, z, color = 0xb9b3a8) {
      for (let i = 0; i < 24; i++) {
        const a = Math.random() * Math.PI * 2;
        this.soft.spawn(Object.assign({
          x: x + (Math.random() - 0.5) * 2, y: y + Math.random() * 2, z,
          vx: Math.cos(a) * 6, vy: 3 + Math.random() * 6, vz: -2 - Math.random() * 6,
          drag: 0.5, g: 20, life: 0.9, size: 0.35 + Math.random() * 0.3, shape: 2, rot: Math.random() * 6, spin: 10, fade: 1,
        }, rgb(color)));
      }
      this.sparkle(x, y + 1, z, 0xffffff, 16, 7);
    }
    shift(dz) {
      for (const P of [this.soft, this.glow, this.amb, this.ambGlow]) for (const q of P.p) q.z += dz;
      for (const s of this.streakData) s.z += dz;
    }

    // ------------------------------------------------------------ ambient weather
    setAmbient(type) { if (type !== this.ambType) { this.ambType = type; } }
    ambient(dt, cam, speed) {
      const type = this.ambType;
      this.ambT += dt;
      const target = { petals: 90, leaves: 70, snow: 380, sand: 140, fireflies: 110 }[type] || 0;
      const P = type === 'fireflies' ? this.ambGlow : this.amb;
      const other = type === 'fireflies' ? this.amb : this.ambGlow;
      // fade out particles of the other kind
      for (const q of other.p) q.life = Math.min(q.life, q.age + 0.5);
      const box = (q) => {
        q.x = cam.position.x + (Math.random() - 0.5) * 50;
        q.z = cam.position.z - 5 - Math.random() * 70;
        q.y = type === 'snow' || type === 'leaves' || type === 'petals' ? 2 + Math.random() * 16 : 0.3 + Math.random() * 6;
      };
      while (P.p.filter ? P.p.reduce((n, q) => n + (q.kind === type ? 1 : 0), 0) < target && P.p.length < P.max : false) {
        const q = { kind: type, age: 0, life: 6 + Math.random() * 6, fade: 1, rot: Math.random() * 6, drag: 0, g: 0, grow: 0, a: 1, vx: 0, vy: 0, vz: 0 };
        box(q);
        if (type === 'snow') Object.assign(q, { vy: -1.2 - Math.random(), vx: 0.4, size: 0.1 + Math.random() * 0.1, shape: 0, a: 0.9 }, rgb(0xffffff));
        else if (type === 'petals') Object.assign(q, { vy: -0.5 - Math.random() * 0.5, vx: 0.8, size: 0.14, shape: 3, spin: 2 + Math.random() * 3, a: 0.95 }, rgb([0xffffff, 0xffe3ec, 0xfff3a0][(Math.random() * 3) | 0]));
        else if (type === 'leaves') Object.assign(q, { vy: -0.9 - Math.random() * 0.6, vx: 1.0, size: 0.22, shape: 2, spin: 3 + Math.random() * 4, a: 1 }, rgb([0xd98e2b, 0xc2542d, 0x8fae3a, 0xe8b23a][(Math.random() * 4) | 0]));
        else if (type === 'sand') Object.assign(q, { vy: 0.1, vx: 4 + Math.random() * 3, size: 0.07, shape: 0, a: 0.55, life: 3 }, rgb(0xf3d2a0));
        else if (type === 'fireflies') Object.assign(q, { vy: 0.2, vx: 0, size: 0.14, shape: 0, a: 1 }, rgb(0xffe27a, 2.5));
        else break;
        P.spawn(q);
      }
      for (const q of P.p) {
        if (q.kind !== type) { q.life = Math.min(q.life, q.age + 0.6); continue; }
        if (type === 'fireflies') { q.vx = Math.sin(this.ambT * 1.3 + q.rot * 7) * 0.6; q.vy = Math.cos(this.ambT * 1.1 + q.rot * 5) * 0.4; q.a = 0.5 + 0.5 * Math.sin(this.ambT * 4 + q.rot * 11); }
        if (type === 'leaves' || type === 'petals') q.vx = Math.sin(this.ambT * 1.5 + q.rot) * 1.2 + 0.6;
        // recycle particles that fell behind the camera
        if (q.z > cam.position.z + 2 || q.y < -1) { box(q); q.age = 0; }
      }
      this.amb.update(dt); this.ambGlow.update(dt);
    }

    // ------------------------------------------------------------ speed streaks
    buildStreaks(scene) {
      const n = 60;
      const g = new T.BoxGeometry(0.035, 0.035, 4);
      const m = new T.MeshBasicMaterial({ color: new T.Color(1.6, 1.6, 1.8), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false });
      VR.keepAlpha(m);
      const mesh = new T.InstancedMesh(g, m, n);
      mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.streakData = [];
      for (let i = 0; i < n; i++) this.streakData.push({ x: 0, y: 0, z: 0, v: 0, on: false });
      scene.add(mesh);
      return mesh;
    }
    updateStreaks(dt, cam, amount) {
      this.streakAmt += (amount - this.streakAmt) * Math.min(1, dt * 4);
      this.streaks.material.opacity = this.streakAmt * 0.55;
      this.streaks.visible = this.streakAmt > 0.02;
      if (!this.streaks.visible) return;
      const m = _m4;
      this.streakData.forEach((s, i) => {
        if (!s.on || s.z > cam.position.z + 4) {
          const a = Math.random() * Math.PI * 2, r = 2.2 + Math.random() * 5;
          s.x = cam.position.x + Math.cos(a) * r; s.y = cam.position.y - 1 + Math.sin(a) * r * 0.7;
          s.z = cam.position.z - 20 - Math.random() * 40; s.v = 60 + Math.random() * 40; s.on = true;
        }
        s.z += s.v * dt;
        m.makeTranslation(s.x, s.y, s.z);
        this.streaks.setMatrixAt(i, m);
      });
      this.streaks.instanceMatrix.needsUpdate = true;
    }

    update(dt) { this.soft.update(dt); this.glow.update(dt); }
    clear() { this.soft.clear(); this.glow.clear(); }
  }
  VR.FX = FX;
})();

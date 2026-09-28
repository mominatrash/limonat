/* =====================================================================
 * PLAYER CONTROLLER
 * Lanes, lane switching, jump, slide, fast-fall, stumble — plus the
 * animation state machine that blends run / air / slide / land /
 * stumble / lane-lean / death poses from anim.js, spring-driven hair,
 * the cloth scarf, footstep events and the shield bubble.
 * Collision response is driven from game.js (Game.resolveCollisions).
 * ===================================================================== */
(function () {
  const C = VR.CONFIG;
  const A = VR.Anim;
  const T = THREE;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  function softDisc() {
    const cv = VR.Tex.canvas(128), c = cv.getContext('2d');
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.5, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(cv);
  }

  class Player {
    constructor(scene) {
      this.scene = scene;
      this.object = new T.Group();
      scene.add(this.object);

      // soft contact shadow (always) — real shadows come from the sun
      const sh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: softDisc(), transparent: true, opacity: 0.5, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2; sh.renderOrder = 2;
      this.shadow = sh; scene.add(sh);

      // shield bubble (fresnel + moving bands)
      this.shieldUniforms = { uTime: { value: 0 }, uColor: { value: new T.Color(0x6fd8ff) } };
      this.shieldMesh = new T.Mesh(new T.SphereGeometry(1.15, 40, 28), new T.ShaderMaterial({
        uniforms: this.shieldUniforms, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); vP = position; gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vP;
          void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
            float bands = smoothstep(0.85, 1.0, sin(vP.y * 18.0 - uTime * 6.0)) * 0.35;
            float hex = smoothstep(0.92, 1.0, abs(sin(vP.x * 14.0 + uTime) * sin(vP.z * 14.0 - uTime)));
            gl_FragColor = vec4(uColor * (f * 1.8 + bands + hex * 0.25 + 0.05), 1.0); }`,
      }));
      VR.keepAlpha(this.shieldMesh.material);
      this.shieldMesh.position.y = 1.0;
      this.shieldMesh.visible = false;
      this.object.add(this.shieldMesh);

      // golden aura while the Star is active
      this.aura = new T.Mesh(new T.SphereGeometry(1.0, 24, 16), new T.ShaderMaterial({
        uniforms: this.shieldUniforms, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(vec3(1.0,0.8,0.25) * f * (1.6 + 0.4*sin(uTime*10.0)), 1.0); }`,
      }));
      VR.keepAlpha(this.aura.material);
      this.aura.position.y = 1.0; this.aura.scale.set(0.85, 1.25, 0.85); this.aura.visible = false;
      this.object.add(this.aura);

      this.pRun = A.pose(); this.pAir = A.pose(); this.pOut = A.pose(); this.pIdle = A.pose(); this.pTmp = A.pose();
      this.rig = null;
      this.tuftState = [0, 1, 2].map(() => ({ x: 0, z: 0, vx: 0, vz: 0 }));
      this._hp = new T.Vector3(); this._hv = new T.Vector3(); this._ha = new T.Vector3(); this._q = new T.Quaternion();
      this._anchor = new T.Vector3();
      this.events = {};                 // onStep(side, x, y, z), onSlideSpark()
      this.reset();
    }

    setCharacter(def) {
      if (this.rig) { this.object.remove(this.rig.root); if (this.rig.scarf) this.object.remove(this.rig.scarf.mesh); }
      this.rig = VR.buildCharacter(def);
      this.object.add(this.rig.root);
      if (this.rig.scarf) this.object.add(this.rig.scarf.mesh);
      this.hvInit = false;
    }

    reset() {
      this.lane = 0; this.prevLane = 0;
      this.x = 0; this.y = 0; this.z = 0; this.prevX = 0; this.lateralVel = 0;
      this.vy = 0;
      this.grounded = true;
      this.slideTimer = 0;
      this.pendingSlide = false;
      this.phase = 0;
      this.lastStumble = -99;
      this.stumbleAnim = 0;
      this.landT = 0; this.landPower = 1;
      this.dead = false;
      this.deathTimer = 0;
      this.onTopOf = null;
      this.flash = 0;
      this.airW = 0; this.slideW = 0; this.laneW = 0; this.startW = 1;
      this.jumpVariant = 0; this.spinT = -1; this.spinKind = null; this.jumpCount = 0;
      this.airTime = 0; this.accel = 0; this.cheer = 0;
      this.hvInit = false;
      this.object.position.set(0, 0, 0);
      this.object.rotation.set(0, 0, 0);
      if (this.rig) { this.rig.root.visible = true; this.rig.root.scale.set(1, 1, 1); if (this.rig.scarf) this.rig.scarf.reset(); }
    }

    get sliding() { return this.slideTimer > 0; }
    get height() { return this.sliding ? C.PLAYER_SLIDE_HEIGHT : C.PLAYER_HEIGHT; }
    laneX(l) { return l * C.LANE_WIDTH; }

    action(a, game) {
      if (this.dead) return;
      switch (a) {
        case 'left':
        case 'right': {
          const nl = this.lane + (a === 'left' ? -1 : 1);
          if (nl < -1 || nl > 1) { game.onWallBump(); return; }
          this.prevLane = this.lane; this.lane = nl;
          break;
        }
        case 'jump':
          if (this.grounded) {
            this.vy = C.JUMP_VELOCITY; this.grounded = false; this.slideTimer = 0;
            this.airTime = 0;
            this.jumpCount++;
            // pick a jump style: stride leap with the forward leg, sometimes a flip or a spin
            const r = Math.random();
            const legFwd = A.curves.HIP(this.phase) > A.curves.HIP(this.phase + 0.5) ? 0 : 1;
            this.jumpVariant = legFwd;
            this.spinKind = null;
            if (this.jumpCount > 2 && r < 0.2) { this.jumpVariant = 2; this.spinKind = 'flip'; this.spinT = 0; }
            else if (this.jumpCount > 2 && r < 0.32) { this.spinKind = 'spin'; this.spinT = 0; }
            VR.Audio.play('jump');
            if (game.onJump) game.onJump(this);
          }
          break;
        case 'slide':
          if (this.grounded) { if (!this.sliding) { VR.Audio.play('slide'); } this.slideTimer = C.SLIDE_TIME; if (game.onSlide) game.onSlide(this); }
          else { this.vy = Math.min(this.vy, C.FAST_FALL_VELOCITY); this.pendingSlide = true; }
          break;
      }
    }

    bounceBack() {
      const l = this.lane;
      this.lane = this.prevLane; this.prevLane = l;
      this.stumbleAnim = 0.5;
    }

    update(dt, speed, world, game) {
      if (this.dead) { this.animateDeath(dt); return; }
      this.z -= speed * dt;

      const tx = this.laneX(this.lane);
      const maxStep = (C.LANE_WIDTH / C.LANE_SWITCH_TIME) * dt;
      const dx = tx - this.x;
      this.prevX = this.x;
      // ease the last bit of a lane change so it doesn't stop dead
      const step = Math.abs(dx) < maxStep ? dx : Math.sign(dx) * maxStep;
      this.x += step;
      this.lateralVel = (this.x - this.prevX) / Math.max(dt, 1e-4);

      this.vy -= C.GRAVITY * dt;
      const newY = this.y + this.vy * dt;
      const ground = world.surfaceAt(this.x, this.z, Math.max(this.y, newY), C.PLAYER_HALF_WIDTH);
      if (newY <= ground.h) {
        const wasAir = !this.grounded;
        const impact = -this.vy;
        this.y = ground.h;
        if (this.vy < -2 && wasAir) this.onLand(game, impact);
        this.vy = 0; this.grounded = true;
        this.onTopOf = ground.obj;
      } else {
        this.y = newY;
        if (this.grounded && newY > ground.h + 0.05 && this.vy <= 0) this.grounded = false;
        if (this.vy > 0) this.grounded = false;
      }
      if (!this.grounded) this.airTime += dt;
      if (this.slideTimer > 0) this.slideTimer -= dt;

      this.animate(dt, speed, game);
    }

    onLand(game, impact) {
      VR.Audio.play('land');
      this.landT = 1;
      this.landPower = clamp(impact / 16, 0.45, 1.25);
      game.cameraImpulse(-0.14 * this.landPower);
      if (game.onLand) game.onLand(this, impact);
      if (this.pendingSlide) { this.slideTimer = C.SLIDE_TIME; this.pendingSlide = false; VR.Audio.play('slide'); }
    }

    // ------------------------------------------------------------ animation
    animate(dt, speed, game) {
      const r = this.rig; if (!r) return;
      this.object.position.set(this.x, this.y, this.z);
      this.object.rotation.set(0, 0, 0);

      const s = clamp((speed - C.SPEED_START) / (C.SPEED_MAX - C.SPEED_START), 0, 1);
      const prevPhase = this.phase;
      this.phase = (this.phase + dt * (1.32 + speed * 0.036)) % 1;
      // footfalls: right foot at phase 0, left at 0.5
      if (this.grounded && !this.sliding) {
        if (prevPhase > this.phase) this.footstep('R');
        else if (prevPhase < 0.5 && this.phase >= 0.5) this.footstep('L');
      }

      const lift = A.run(this.pRun, this.phase, s);
      const out = this.pOut;
      A.copy(out, this.pRun);

      // airborne pose: variant on the way up -> reach for the ground on the way down
      const k = (rate) => 1 - Math.exp(-dt * rate);
      this.airW += ((this.grounded ? 0 : 1) - this.airW) * k(this.grounded ? 22 : 14);
      if (this.airW > 0.001) {
        const jt = clamp(this.vy / C.JUMP_VELOCITY, -1, 1);
        const up = smooth(-0.45, 0.55, jt);
        const variant = [A.P.jumpLeapR, A.P.jumpLeapL, A.P.jumpTuck][this.jumpVariant];
        A.lerp(this.pAir, A.P.jumpFall, variant, up);
        A.lerp(out, out, this.pAir, this.airW);
      }
      // slide
      this.slideW += ((this.sliding ? 1 : 0) - this.slideW) * k(this.sliding ? 20 : 10);
      if (this.slideW > 0.001) {
        A.lerp(out, out, A.P.slide, this.slideW);
        if (this.sliding && game && game.onSlideTick) game.onSlideTick(this, dt);
      }
      // landing absorption
      if (this.landT > 0) {
        this.landT = Math.max(0, this.landT - dt / 0.3);
        const w = Math.sin(this.landT * Math.PI) * (this.landT > 0.5 ? 1 : this.landT * 2) * this.landPower * (1 - this.airW);
        A.addScaled(out, A.P.land, w * (1 - this.slideW));
      }
      // stumble
      if (this.stumbleAnim > 0) {
        this.stumbleAnim -= dt;
        const u = this.stumbleAnim / 0.5;
        A.addScaled(out, A.P.stumble, Math.sin(u * Math.PI) * (0.7 + 0.3 * Math.sin(u * 30)));
      }
      // lean into lane changes
      const laneT = clamp(this.lateralVel / (C.LANE_WIDTH / C.LANE_SWITCH_TIME), -1, 1);
      this.laneW += (laneT - this.laneW) * k(16);
      A.addScaled(out, A.P.lane, this.laneW * (1 - this.slideW * 0.6));

      // flip / spin tricks
      if (this.spinT >= 0) {
        this.spinT += dt;
        const u = smooth(0, 1, this.spinT / 0.52);
        if (this.spinKind === 'flip') out[A.JI.hips] -= u * Math.PI * 2;
        else out[4] += u * Math.PI * 2 * (this.jumpVariant ? -1 : 1);
        if (this.spinT >= 0.52) this.spinT = -1;
      }

      // explosive forward lean while accelerating off the start line
      if (this.accel > 0) {
        A.add(out, 'spine', -13 * this.accel); A.add(out, 'chest', -6 * this.accel);
        A.add(out, 'neck', 8 * this.accel); A.add(out, 'head', 7 * this.accel);
      }
      // blend in from the menu idle pose at the start of a run
      if (this.startW < 1) {
        this.startW = Math.min(1, this.startW + dt / 0.45);
        A.lerp(out, this.pIdle, out, smooth(0, 1, this.startW));
      }

      A.apply(r, out);
      const plantW = (1 - this.airW) * (1 - this.slideW);
      A.plant(r, plantW, lift * plantW);
      // cartoon stretch while rising fast
      const st = clamp(this.vy / C.JUMP_VELOCITY, -1, 1) * this.airW;
      r.root.scale.set(1 - st * 0.035, 1 + st * 0.07, 1 - st * 0.035);

      if (this.flash > 0) {
        this.flash -= dt;
        r.root.visible = Math.floor(this.flash * 14) % 2 === 0 || this.flash <= 0;
      } else r.root.visible = true;

      this.secondary(dt, s, true);
      this.shieldUniforms.uTime.value += dt;
    }

    footstep(side) {
      const f = this.rig.bones['foot' + side];
      f.getWorldPosition(this._anchor);
      if (this.events.onStep) this.events.onStep(side, this._anchor.x, this.y, this._anchor.z);
    }

    // spring hair + cloth scarf
    secondary(dt, speedN, running) {
      const r = this.rig; if (!r || dt <= 0) return;
      const head = r.bones.head;
      head.getWorldPosition(this._hp);
      if (!this.hvInit) { this.prevHead = this._hp.clone(); this._hv.set(0, 0, 0); this.hvInit = true; }
      const vel = this._ha.subVectors(this._hp, this.prevHead).divideScalar(dt);
      const acc = vel.clone().sub(this._hv).divideScalar(dt);
      this._hv.copy(vel); this.prevHead.copy(this._hp);
      if (acc.length() > 80) acc.setLength(80);
      head.getWorldQuaternion(this._q).invert();
      acc.applyQuaternion(this._q);
      const drag = running ? 0.25 + speedN * 0.25 : 0.03;
      r.tuft.forEach((b, i) => {
        const st = this.tuftState[i], g = [0.5, 0.85, 1.2][i];
        const tx = clamp(-acc.z * 0.0035 * g + drag * g, -0.9, 0.9);
        const tz = clamp(acc.x * 0.003 * g - acc.y * 0.0022 * g, -0.7, 0.7);
        st.vx += ((tx - st.x) * 170 - st.vx * 11) * dt;
        st.vz += ((tz - st.z) * 170 - st.vz * 11) * dt;
        st.x += st.vx * dt; st.z += st.vz * dt;
        b.rotation.x = st.x;
        b.rotation.z = b.userData.rest + st.z;
      });
      if (r.scarf) {
        r.bones.chest.localToWorld(this._anchor.set(0, 0.25, 0.08));
        this.object.worldToLocal(this._anchor);
        const inv = this.object.rotation.y;
        const wind = running ? new T.Vector3(0, 6, 60 + speedN * 60) : new T.Vector3(Math.sin(performance.now() * 0.0007) * 4 - Math.sin(inv) * 3, 1, 5 * Math.cos(inv) + 2);
        r.scarf.update(dt, this._anchor, new T.Vector3(0, -0.4, 1).normalize(), new T.Vector3(1, 0, 0), wind);
      }
    }

    /** Menu / character-screen idle (optionally waving). Tap him and he jumps for joy. */
    animateIdle(dt, t, wave = 0, look = 0) {
      const r = this.rig; if (!r) return;
      A.idle(this.pIdle, t, look);
      A.wave(this.pIdle, t, wave);
      let hop = 0;
      if (this.cheer > 0) {
        this.cheer = Math.max(0, this.cheer - dt / 0.9);
        const u = 1 - this.cheer;
        const air = u > 0.18 && u < 0.82 ? Math.sin((u - 0.18) / 0.64 * Math.PI) : 0;
        const crouch = u < 0.18 ? Math.sin(u / 0.18 * Math.PI) : u > 0.82 ? Math.sin((u - 0.82) / 0.18 * Math.PI) : 0;
        hop = air * 0.55;
        A.addScaled(this.pIdle, A.P.land, crouch * 0.8);
        A.lerp(this.pIdle, this.pIdle, A.P.cheer, air);
      }
      r.root.scale.set(1, 1, 1);
      r.root.visible = true;
      A.apply(r, this.pIdle);
      A.plant(r, hop > 0 ? 0 : 1, 0);
      r.bones.hips.position.y += hop;
      this.startW = 0;
      this.secondary(dt, 0, false);
    }

    updateShadow(world, shadowsOn) {
      const g = world.surfaceAt(this.x, this.z, this.y + 0.01, C.PLAYER_HALF_WIDTH).h;
      this.shadow.position.set(this.x, g + 0.03, this.z + 0.05);
      const hgt = Math.max(0, this.y - g);
      const sc = Math.max(0.35, 1 - hgt * 0.22);
      const sl = this.slideW * 0.6;
      this.shadow.scale.set(sc * 1.0, sc * (0.95 + sl), 1);
      this.shadow.material.opacity = (shadowsOn ? 0.32 : 0.6) * sc;
    }

    revive(d) {
      this.dead = false; this.deathTimer = 0;
      this.x = d.x; this.y = d.y; this.z = d.z;
      this.lane = d.lane; this.prevLane = d.lane; this.prevX = d.x;
      this.vy = 0; this.grounded = false; this.slideTimer = 0; this.pendingSlide = false;
      this.lastStumble = -99; this.stumbleAnim = 0;
      this.flash = 1.5; this.spinT = -1;
      this.object.position.set(this.x, this.y, this.z);
    }

    die() {
      this.dead = true; this.deathTimer = 0;
      this.deathVy = 6.5;
      this.spinT = -1;
      this.deathStart = A.copy(A.pose(), this.pOut);
    }
    animateDeath(dt) {
      this.deathTimer += dt;
      const t = this.deathTimer, r = this.rig;
      this.deathVy -= 30 * dt;
      this.y = Math.max(this.groundAtDeath || 0, this.y + this.deathVy * dt);
      this.z += dt * Math.max(0, 5.5 - t * 8);
      this.object.position.set(this.x, this.y, this.z);
      const out = this.pOut;
      A.lerp(out, this.deathStart, A.P.deathHit, smooth(0, 0.14, t));
      A.lerp(out, out, A.P.deathLie, smooth(0.3, 0.85, t));
      // fall backwards, pivoting at the feet, with a small bounce
      let fall = Math.min(1, Math.pow(t / 0.62, 2)) * Math.PI / 2;
      if (t > 0.62) fall -= Math.sin((t - 0.62) * 15) * Math.exp(-(t - 0.62) * 7) * 0.22;
      out[3] = fall;
      out[1] = -0.05 * smooth(0.3, 0.8, t);
      out[2] = 0;
      A.apply(r, out);
      r.root.position.set(0, 0.14 * smooth(0.2, 0.62, t), 0);
      r.root.scale.set(1, 1, 1);
      r.root.visible = true;
      this.secondary(dt, 0.3, false);
    }
  }

  VR.Player = Player;
})();

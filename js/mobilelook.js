/* =====================================================================
 * MOBILE LOOK — a lighter way to draw the same game (opt-in, reload).
 * How mobile runners stay light: the look is in the colours, not in the
 * lighting maths. With VR.MOBILE_LOOK on:
 *   • lit materials (MeshStandardMaterial) use a cheap sun + sky light
 *     instead of physically-based lights, image-based reflections and
 *     shadow-map lookups (a small gloss term keeps metal / paint shiny)
 *   • colour grading (saturation / contrast) happens inside the same draw
 *     instead of a full-screen HDR post chain + bloom
 *   • no shadow map: soft blob shadows under the runner, trains, obstacles
 *   • the world bends away over the horizon, so less of it is drawn
 * Must load right after three.js, before any material is compiled.
 * ===================================================================== */
(function () {
  const T = THREE;
  let on = false;
  try {
    const q = new URLSearchParams(location.search).get('look');
    const s = JSON.parse(localStorage.getItem('cubeexpress.settings') || '{}');
    on = q ? q === 'mobile' : s.look === 'mobile';
  } catch (e) { /* storage unavailable */ }
  VR.MOBILE_LOOK = on;
  if (!on) return;

  const SC = T.ShaderChunk;
  // ---- cheap lighting for STANDARD materials only (toon / basic / custom shaders untouched)
  const MOB = `
    vec3 mobL = ambientLightColor;
    #if NUM_HEMI_LIGHTS > 0
      mobL += mix(hemisphereLights[0].groundColor, hemisphereLights[0].skyColor, dot(normal, hemisphereLights[0].direction) * 0.5 + 0.5);
    #endif
    vec3 mobSpec = vec3(0.0);
    #if NUM_DIR_LIGHTS > 0
      float mobNL = dot(normal, directionalLights[0].direction);
      mobL += directionalLights[0].color * clamp(mobNL * 0.85 + 0.15, 0.0, 1.0);  // slight wrap: no harsh black sides
      vec3 mobH = normalize(directionalLights[0].direction + vec3(0.0, 0.0, 1.0));
      float mobGl = (1.0 - roughnessFactor);
      mobSpec = directionalLights[0].color * pow(max(dot(normal, mobH), 0.0), mix(6.0, 90.0, mobGl * mobGl)) * mobGl * mobGl * (0.06 + 0.22 * metalnessFactor);
    #endif
    // sky reflection stand-in for metal / gloss (top faces pick up the sky, sides the horizon)
    #if NUM_HEMI_LIGHTS > 0
      mobSpec += hemisphereLights[0].skyColor * metalnessFactor * (1.0 - roughnessFactor) * 0.08 * (0.3 + 0.7 * clamp(normal.y, 0.0, 1.0));
    #endif
    // metal keeps most of its colour as a tinted sheen (like the PBR look), so rails / chrome stay dark-ish and shiny
    reflectedLight.directDiffuse += diffuseColor.rgb * (1.0 - 0.65 * metalnessFactor) * mobL * RECIPROCAL_PI;
    reflectedLight.directSpecular += mobSpec * mix(vec3(1.0), diffuseColor.rgb, metalnessFactor);
  `;
  SC.lights_fragment_begin = `#ifdef STANDARD\n${MOB}\n#else\n${SC.lights_fragment_begin}\n#endif`;
  SC.lights_fragment_maps = `#ifndef STANDARD\n${SC.lights_fragment_maps}\n#endif`;
  SC.lights_fragment_end = `#ifndef STANDARD\n${SC.lights_fragment_end}\n#endif`;
  // ---- in-material colour grade (what the post chain's saturation / contrast did)
  SC.colorspace_fragment = SC.colorspace_fragment + `
    #ifdef STANDARD
      { float l = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        gl_FragColor.rgb = clamp((mix(vec3(l), gl_FragColor.rgb, 1.18) - 0.5) * 1.1 + 0.5, 0.0, 1.0); }
    #endif`;
  // ---- the world curves down over the horizon (view space, in front of the camera only)
  VR.BEND = 0.0011;
  SC.project_vertex = SC.project_vertex.replace('gl_Position = projectionMatrix * mvPosition;',
    `{ float bz = min(mvPosition.z + 6.0, 0.0); mvPosition.y -= ${VR.BEND} * bz * bz; }
     gl_Position = projectionMatrix * mvPosition;`);

  // ---- vignette as a CSS layer over the canvas (costs nothing on the GPU path we control)
  const addVignette = () => {
    const g = document.getElementById('game'); if (!g || document.getElementById('mobVignette')) return;
    const v = document.createElement('div'); v.id = 'mobVignette';
    v.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;background:radial-gradient(ellipse 85% 75% at 50% 52%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.28) 100%)';
    g.appendChild(v);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addVignette); else addVignette();

  // ---- soft blob shadow (shared texture / material)
  let blobTex = null;
  VR.blobShadow = function (w, d) {
    if (!blobTex) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 4, 32, 32, 31);
      g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.55, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      blobTex = new T.CanvasTexture(c); blobTex.colorSpace = T.SRGBColorSpace;
    }
    VR.blobMat = VR.blobMat || new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false, fog: true });
    const m = new T.Mesh(new T.PlaneGeometry(w, d).rotateX(-Math.PI / 2), VR.blobMat);
    m.renderOrder = -1; m.matrixAutoUpdate = false;
    return m;
  };
})();

/* =====================================================================
 * BIOMES — the environments the railway runs through.
 * ---------------------------------------------------------------------
 * HOW TO ADD A NEW ENVIRONMENT:
 *   1. Add an entry to VR.BIOMES with
 *        name / nameEn          shown when you enter it
 *        look                   sky, fog, light and grading colours
 *        ground                 material + two colours + hill height
 *        styleWeights           how often tunnels / bridges / stations appear
 *        particles              ambient weather: petals, leaves, snow, sand, fireflies
 *        scenery(mb, rnd, v, place)   draw props on the LEFT strip
 *                               (x < -5, z from 0 to -40). place(x, z) lifts
 *                               the builder onto the hills at that spot.
 *      The right side is automatically a mirror of another variant.
 *   2. Add its key to VR.BIOME_ORDER.
 * ===================================================================== */
(function () {
  const T = THREE;
  const L = 40;
  const P = VR.Props;
  const col = (h) => new T.Color(h);
  const dir = (x, y, z) => new T.Vector3(x, y, z).normalize();

  function look(o) {
    return {
      top: col(o.top), horizon: col(o.horizon), bottom: col(o.bottom || o.horizon),
      sunColor: col(o.sun || 0xfff1d0), sunDir: dir(...(o.sunDir || [-0.45, 0.62, 0.64])),
      stars: o.stars || 0, cloud: col(o.cloud || 0xffffff),
      ridge: o.ridge || 'hills', ridgeFar: col(o.ridgeFar || 0x9fb8c9), ridgeNear: col(o.ridgeNear || 0x7f9f8a),
      fog: col(o.fog || o.horizon), fogNear: o.fogNear ?? 55, fogFar: o.fogFar ?? 230,
      hemiSky: col(o.hemiSky || 0xdff0ff), hemiGround: col(o.hemiGround || 0x6b7a4a), hemi: o.hemi ?? 1.35,
      sunI: o.sunI ?? 2.7, exposure: o.exposure ?? 1.0, bloom: o.bloom ?? 0.5, sat: o.sat ?? 1.12,
      tint: col(o.tint || 0xffffff), night: o.night || 0,
    };
  }

  // scatter helper: n props in an x band of the left strip
  function scatter(rnd, n, xMin, xMax, fn, zPad = 1) {
    for (let i = 0; i < n; i++) fn(-(xMin + rnd() * (xMax - xMin)), -(zPad + rnd() * (L - zPad * 2)), i);
  }
  const FLOWER_ROW = (mb, rnd, place, xMin, xMax, n) =>
    scatter(rnd, n, xMin, xMax, (x, z) => { place(x, z); P.flowers(mb, x, z, rnd, 5); });

  VR.BIOMES = {
    grove: {
      name: 'بساتين الليمون', nameEn: 'Lemon Groves', particles: 'petals',
      look: look({ top: 0x3a86e8, horizon: 0xcfe9ff, bottom: 0xa8cde6, fog: 0xc9e4f6, ridge: 'hills', ridgeFar: 0x9fb8c9, ridgeNear: 0x86a88a, hemiGround: 0x6b8a4a }),
      ground: { mat: 'grass', color: 0x74b347, color2: 0x5e9c3a, hills: 1 },
      styleWeights: { normal: 10, bridge: 2, tunnel: 1, station: 1.5 },
      scenery(mb, rnd, v, place) {
        place(-5.8, -20); P.fence(mb, -5.8, -1, -39);
        // orchard rows of lemon trees on stone terraces
        for (const [x, off] of [[-10, 0], [-15.5, 3], [-21, 1]]) {
          place(x + 1.6, -20); P.terrace(mb, x + 1.6, -20, 38, 0.7);
          for (let z = -3 - off; z > -39; z -= 6.5) { place(x, z); P.lemonTree(mb, x, z, rnd, 2.3 + rnd() * 0.6); }
        }
        scatter(rnd, 3, 26, 40, (x, z) => { place(x, z); P.oliveTree(mb, x, z, rnd, 2.2 + rnd()); });
        scatter(rnd, 2, 30, 50, (x, z) => { place(x, z); P.cypress(mb, x, z, rnd, 7 + rnd() * 3); });
        FLOWER_ROW(mb, rnd, place, 6.5, 9, 6);
        scatter(rnd, 10, 6.5, 26, (x, z) => { place(x, z); P.tuft(mb, x, z, rnd); });
        if (v % 2) { place(-8, -30); P.crate(mb, -7.5, 0, -30, rnd); P.crate(mb, -7.5, 0, -30.8, rnd); P.crate(mb, -7.5, 0.52, -30.4, rnd); }
      },
    },
    forest: {
      name: 'الغابة', nameEn: 'Forest', particles: 'leaves',
      look: look({ top: 0x4a8fd0, horizon: 0xd6ecdf, bottom: 0xa9cbb5, fog: 0xc8e2d4, fogNear: 40, fogFar: 200, ridge: 'mountains', ridgeFar: 0x8fae9e, ridgeNear: 0x5f8a6a, hemiGround: 0x4f6a3a, sunI: 2.4 }),
      ground: { mat: 'grass', color: 0x4f9a3f, color2: 0x3c8233, hills: 1.2 },
      styleWeights: { normal: 10, bridge: 2, tunnel: 1.5, station: 0.5 },
      scenery(mb, rnd, v, place) {
        scatter(rnd, 7, 7, 30, (x, z) => { place(x, z); rnd() < 0.35 ? P.birch(mb, x, z, rnd, 5 + rnd() * 2) : P.roundTree(mb, x, z, rnd, 4 + rnd() * 2, rnd() < 0.5 ? 0x4f8f3a : 0x3f7f35); });
        scatter(rnd, 8, 14, 45, (x, z) => { place(x, z); P.pine(mb, x, z, rnd, 8 + rnd() * 5); });
        scatter(rnd, 5, 6.5, 18, (x, z) => { place(x, z); P.bush(mb, x, z, rnd, 1 + rnd() * 0.6); });
        scatter(rnd, 4, 7, 20, (x, z) => { place(x, z); P.rock(mb, x, z, rnd, 0.6 + rnd() * 0.8, 0x7f8a80); });
        scatter(rnd, 3, 7, 16, (x, z) => { place(x, z); mb.cyl('std', 0xeee1c8, x, 0.2, z, 0.06, 0.08, 0.4, { seg: 6 }); mb.sphere('gloss', 0xd8392b, x, 0.42, z, 0.2, { sy: 0.6, seg: 10 }); });
        if (rnd() < 0.6) { const z = -6 - rnd() * 28; place(-9, z); P.lemonTree(mb, -9, z, rnd, 2.6); }
        scatter(rnd, 12, 6.5, 22, (x, z) => { place(x, z); P.tuft(mb, x, z, rnd, 0x4a8a30); });
      },
    },
    village: {
      name: 'القرية', nameEn: 'Old Village', particles: 'petals',
      look: look({ top: 0x4f8fd8, horizon: 0xffe0b8, bottom: 0xe7c9a6, sun: 0xffd9a0, sunDir: [-0.72, 0.42, 0.55], fog: 0xf2dcc2, ridge: 'hills', ridgeFar: 0xbba88f, ridgeNear: 0x9a9272, hemiSky: 0xffeedd, hemiGround: 0x9a7b55, tint: 0xfff4e6, sunI: 2.9 }),
      ground: { mat: 'grass', color: 0xa4b25e, color2: 0xc2b27a, hills: 1.1 },
      styleWeights: { normal: 10, bridge: 1, tunnel: 0.3, station: 3 },
      scenery(mb, rnd, v, place) {
        place(-6.3, -20); P.terrace(mb, -6.3, -20, 38, 0.6);
        const zs = [-8, -22, -34];
        zs.forEach((z, i) => {
          if ((v + i) % 3 === 2) { place(-10, z); P.stall(mb, -9.5, z, rnd, 1); P.crate(mb, -8, 0, z + 2, rnd); }
          else { const x = -12 - rnd() * 2; place(x, z); P.house(mb, x, z, rnd, 5.5 + rnd() * 1.5, 6, rnd() < 0.4 ? 2 : 1, 1); }
        });
        place(-8, -15); P.lampPost(mb, -8, -15, 1);
        place(-8, -29); P.lampPost(mb, -8, -29, 1);
        scatter(rnd, 3, 20, 30, (x, z) => { place(x, z); P.oliveTree(mb, x, z, rnd, 2.3 + rnd() * 0.5); });
        scatter(rnd, 3, 18, 34, (x, z) => { place(x, z); P.cypress(mb, x, z, rnd, 6 + rnd() * 3); });
        scatter(rnd, 2, 22, 30, (x, z) => { place(x, z); P.lemonTree(mb, x, z, rnd, 2.5); });
        scatter(rnd, 2, 30, 44, (x, z) => { place(x, z); P.house(mb, x, z, rnd, 6, 6, 2, 1); });
        FLOWER_ROW(mb, rnd, place, 7.2, 9, 4);
      },
    },
    desert: {
      name: 'الصحراء', nameEn: 'Desert', particles: 'sand',
      look: look({ top: 0x3e5fa8, horizon: 0xffb27a, bottom: 0xe8a070, sun: 0xffb070, sunDir: [-0.2, 0.13, -0.97], fog: 0xf0b98e, fogNear: 60, fogFar: 240,
        ridge: 'dunes', ridgeFar: 0xd9905f, ridgeNear: 0xc98a58, hemiSky: 0xffd9b0, hemiGround: 0xb0784a, cloud: 0xffd2b0, sunI: 2.5, exposure: 1.05, tint: 0xfff0e0, bloom: 0.6 }),
      ground: { mat: 'sand', color: 0xe8c688, color2: 0xd9b172, hills: 0.7 },
      styleWeights: { normal: 10, bridge: 0.3, tunnel: 0.8, station: 1 },
      scenery(mb, rnd, v, place) {
        scatter(rnd, 4, 7, 26, (x, z) => { place(x, z); P.cactus(mb, x, z, rnd, 2 + rnd() * 2.5); });
        scatter(rnd, 3, 9, 28, (x, z) => { place(x, z); P.palm(mb, x, z, rnd, 5 + rnd() * 3); });
        scatter(rnd, 5, 7, 30, (x, z) => { place(x, z); P.rock(mb, x, z, rnd, 0.6 + rnd() * 1.4, 0xc49a6c); });
        scatter(rnd, 2, 24, 40, (x, z) => { place(x, z); P.dune(mb, x, z, rnd, 16 + rnd() * 8, 4 + rnd() * 3); }, 6);
        if (v === 2) { place(-16, -20); mb.blob('flat', 0x2f8fb0, -16, 0.02, -20, 4, { sy: 0.02, sz: 1.4 }); P.palm(mb, -13, -17, rnd, 6); P.palm(mb, -19, -24, rnd, 5); }
        if (rnd() < 0.4) { place(-7.2, -12); P.crate(mb, -7.2, 0, -12, rnd); }
      },
    },
    mountains: {
      name: 'الجبال', nameEn: 'Mountains', particles: null,
      look: look({ top: 0x2f6fd0, horizon: 0xcfe2f5, bottom: 0xa9c1d9, fog: 0xd2e2f1, ridge: 'mountains', ridgeFar: 0xa7b7cc, ridgeNear: 0x8497ad, hemiGround: 0x5f6a55, sunI: 2.8 }),
      ground: { mat: 'grass', color: 0x6f9a4a, color2: 0x8a9a6a, hills: 1.8 },
      styleWeights: { normal: 8, bridge: 2.5, tunnel: 3, station: 0.5 },
      scenery(mb, rnd, v, place) {
        const mx = -38 - rnd() * 10, mz = -20;
        place(mx, mz); P.mountain(mb, mx, mz, rnd, 30 + rnd() * 10, 26 + rnd() * 10, true);
        scatter(rnd, 6, 7, 22, (x, z) => { place(x, z); P.pine(mb, x, z, rnd, 7 + rnd() * 4); });
        scatter(rnd, 6, 7, 24, (x, z) => { place(x, z); P.rock(mb, x, z, rnd, 0.8 + rnd() * 1.8, 0x8b8a86); });
        scatter(rnd, 8, 6.5, 18, (x, z) => { place(x, z); P.tuft(mb, x, z, rnd, 0x6a8f40); });
      },
    },
    snow: {
      name: 'الثلج', nameEn: 'Snowfields', particles: 'snow',
      look: look({ top: 0x7fa6cc, horizon: 0xe8f0f7, bottom: 0xcfdbe8, sun: 0xf0f4ff, fog: 0xe2ebf4, fogNear: 35, fogFar: 190, ridge: 'mountains', ridgeFar: 0xc7d5e4, ridgeNear: 0xdde7f0,
        hemiSky: 0xeef4ff, hemiGround: 0xa9b8c8, hemi: 1.6, sunI: 2.1, cloud: 0xf2f5fa, sat: 1.02 }),
      ground: { mat: 'snow', color: 0xf2f6fa, color2: 0xdde6ef, hills: 1.3 },
      styleWeights: { normal: 10, bridge: 1.2, tunnel: 2.5, station: 0.7 },
      scenery(mb, rnd, v, place) {
        scatter(rnd, 8, 7, 34, (x, z) => { place(x, z); P.pine(mb, x, z, rnd, 6 + rnd() * 4, true); });
        scatter(rnd, 4, 8, 24, (x, z) => { place(x, z); P.rock(mb, x, z, rnd, 0.8 + rnd(), 0xa9c4dc); });
        if (v % 2 === 0) { place(-8.5, -18); P.snowman(mb, -8.5, -18); }
        const mx = -44, mz = -20; place(mx, mz); P.mountain(mb, mx, mz, rnd, 28, 22, true, 0x9aa6b4);
      },
    },
    city: {
      name: 'المدينة ليلاً', nameEn: 'City Nights', particles: 'fireflies',
      look: look({ top: 0x060b1f, horizon: 0x2c2f5e, bottom: 0x10122a, sun: 0xc4d6ff, sunDir: [-0.35, 0.7, 0.62], stars: 1, fog: 0x262b58, fogNear: 60, fogFar: 240,
        ridge: 'city', ridgeFar: 0x1a1d3a, ridgeNear: 0x11132a, hemiSky: 0x8f9ee6, hemiGround: 0x3a3d5c, hemi: 1.5, sunI: 1.9, cloud: 0x2a2d4a, exposure: 1.28, bloom: 0.7, tint: 0xe8ecff, night: 1 }),
      ground: { mat: 'grass', color: 0x2e3b33, color2: 0x273029, hills: 0.15 },
      styleWeights: { normal: 10, bridge: 1, tunnel: 1, station: 2 },
      scenery(mb, rnd, v, place) {
        place(-7, -20);
        mb.box('concrete', 0x3a3d45, -9, 0.1, -20, 5, 0.2, L);                 // sidewalk
        for (let z = -4; z > -L; z -= 12) P.lampPost(mb, -7, z, 1, 4.6);
        for (let z = -10; z > -L; z -= 12) { mb.box('std', 0x444a55, -8.2, 0.5, z, 0.5, 0.8, 0.5); mb.box('neon', [0x46e0ff, 0xff4fa3][(z / 12 | 0) & 1], -7.94, 0.7, z, 0.02, 0.3, 0.3); }
        let z = -2;
        while (z > -L + 2) {
          const w = 7 + rnd() * 6, d = 6 + rnd() * 5, h = 8 + rnd() * 26;
          const x = -14 - w / 2 - rnd() * 3;
          place(x, z - d / 2); P.building(mb, x, z - d / 2, rnd, w, d, h);
          if (rnd() < 0.45) P.neonSign(mb, x + w / 2 + 0.12, 4 + rnd() * 4, z - d / 2, rnd, 1);
          z -= d + 1 + rnd() * 2;
        }
        scatter(rnd, 4, 24, 40, (x, zz) => { place(x - 6, zz); P.building(mb, x - 6, zz, rnd, 10, 10, 20 + rnd() * 30); });
        scatter(rnd, 3, 7.5, 10, (x, zz) => { place(x, zz); P.bush(mb, x, zz, rnd, 0.8, 0x2d5a36); });
      },
    },
  };

  // Order biomes rotate in (random start)
  VR.BIOME_ORDER = ['grove', 'forest', 'village', 'desert', 'mountains', 'snow', 'city'];
  VR.BIOME_VARIANTS = 4;   // pre-built scenery strips per biome
})();

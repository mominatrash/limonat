/* =====================================================================
 * SECRET CODES — "continue" codes for the Game Over screen.
 * ---------------------------------------------------------------------
 * Codes are never stored in plain text: only a salted SHA-256
 * fingerprint of each code is kept here, and whatever the player types
 * is fingerprinted the same way before comparing.
 *
 * Normalisation before hashing (so small typing slips still work):
 *   - Unicode NFC
 *   - invisible marks removed (tatweel, harakat, bidi/zero-width marks)
 *   - leading/trailing spaces trimmed, repeated inner spaces collapsed
 *
 * TO ADD A CODE: open the browser console in the game and run
 *     VR.SecretCodes.fingerprint('your new code')
 * then paste the printed value into FINGERPRINTS below.
 * ===================================================================== */
(function () {
  const SALT = 'limonat:';
  const FINGERPRINTS = [
    'f13ab13f2642bf47a0c7a5ad14dfe25acba8f54fc1e54c9f753ded06ac4d0da8',
    'fe72a965d1c7d66ab01ec2942e024b869be6d2c13c9d7648a149b23cdf34a1e8',
    'aec97aba0948d72a3f7c8002f98ac58b509c97cb1eb613d9b66b30f5252f0fcc',
    'e03cdea7b3641b6aecf3299d9a94261399df0626d384b2c13b283bd1c65f75fa',
    'e205ef87f6927a88f6963c52dd5eadf3dfcea9ac45389a54c3e26a7ae4a6111b',
  ];

  function normalize(text) {
    return String(text || '')
      .normalize('NFC')
      .replace(/[ـً-ْ​-‏‪-‮⁦-⁩﻿]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  // Compact synchronous SHA-256 (works everywhere, including file://,
  // where crypto.subtle is unavailable).
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  function sha256Hex(str) {
    const bytes = new TextEncoder().encode(str);
    const len = bytes.length;
    const nBlocks = Math.ceil((len + 9) / 64);
    const buf = new Uint8Array(nBlocks * 64);
    buf.set(bytes); buf[len] = 0x80;
    const bitLen = len * 8;
    const view = new DataView(buf.buffer);
    view.setUint32(buf.length - 8, Math.floor(bitLen / 0x100000000));
    view.setUint32(buf.length - 4, bitLen >>> 0);
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const W = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let b = 0; b < nBlocks; b++) {
      for (let i = 0; i < 16; i++) W[i] = view.getUint32(b * 64 + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
      }
      let [a, bb, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & bb) ^ (a & c) ^ (bb & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
      }
      H[0] += a; H[1] += bb; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    return Array.from(H, x => x.toString(16).padStart(8, '0')).join('');
  }

  const fingerprint = (text) => sha256Hex(SALT + normalize(text));
  const valid = new Set(FINGERPRINTS);

  VR.SecretCodes = {
    normalize,
    fingerprint,
    /** Returns the code's fingerprint when valid, otherwise null. */
    check(text) {
      if (!normalize(text)) return null;
      const fp = fingerprint(text);
      return valid.has(fp) ? fp : null;
    },
  };
})();

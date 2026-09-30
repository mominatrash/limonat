/* =====================================================================
 * STORY MODE — «سرّ البيّارة» (The Grove's Secret)
 * Zahran the contractor wants to bulldoze the family lemon grove. Grandpa
 * (جدّي) hid the land deed decades ago and left 16 letters along the
 * railway. Laila guides you over Grandpa's old radio, Mishmish the goat
 * goes from thief to best friend, and a masked runner keeps getting in
 * the way… until the mask comes off.
 *
 * 4 chapters (seasons) × 4 hand-tuned levels: fixed seed, biomes, weather,
 * a finish line and 3 stars:
 *   ★ reach the finish   ★ the level's objective   ★ flawless (no stumble, no continue)
 * In-run radio calls, a hidden letter in every level (collect all 16 for
 * the true ending), comic panels between chapters, and bosses:
 *   'dozer'  Zahran's bulldozer chases you — stumble while it is close and it's over
 *   drone    Zahran's courier drone steals a map piece (thief system, skin 'drone')
 *   ally     Mishmish runs beside you and drops coins (thief system, mode 'ally')
 * ===================================================================== */
(function () {
  const T = THREE, C = VR.CONFIG, UI = VR.UI, LW = C.LANE_WIDTH;

  // ------------------------------------------------------------ portraits (inline SVG, with moods)
  // moods: happy · sad · angry · shock · smug · worried · neutral
  function mouth(m, cx, cy, col = '#8a3b2a', w = 1) {
    const s = (d) => `<path d="${d}" stroke="${col}" stroke-width="${2.4 * w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    switch (m) {
      case 'happy': return `<path d="M${cx - 7} ${cy - 1}c3 7 11 7 14 0z" fill="${col}"/><path d="M${cx - 4} ${cy + 2.6}c2 1.4 6 1.4 8 0" stroke="#e7897b" stroke-width="1.6" fill="none"/>`;
      case 'sad': return s(`M${cx - 6} ${cy + 3}c3-4 9-4 12 0`);
      case 'angry': return `<path d="M${cx - 7} ${cy + 2}q7-5 14 0q-7 3-14 0z" fill="${col}"/><path d="M${cx - 5} ${cy + 0.8}h10" stroke="#fff" stroke-width="1.4"/>`;
      case 'shock': return `<ellipse cx="${cx}" cy="${cy + 1}" rx="3.4" ry="4.6" fill="${col}"/>`;
      case 'smug': return s(`M${cx - 6} ${cy + 1}c4 3 9 2 12-3`);
      case 'worried': return s(`M${cx - 6} ${cy + 1.5}q3-2.4 6 0t6 0`);
      default: return s(`M${cx - 4} ${cy + 1}h8`);
    }
  }
  function brows(m, x1, x2, y, col = '#3b2a1e', w = 2.4) {
    // [inner, outer] offsets (+ = lower)
    const [di, dO] = { angry: [2.6, -1.6], sad: [-2.6, 1.4], worried: [-2.2, 1.2], shock: [-3.4, -2.8], smug: [0.6, -1.4], happy: [-1, -0.6] }[m] || [0, 0];
    const b = (x, s) => `<path d="M${x - 5 * s} ${y + di}Q${x} ${y - 2.4 + (di + dO) / 2} ${x + 5 * s} ${y + dO}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
    return b(x1, -1) + b(x2, 1);    // s = direction from the inner end to the outer end
  }
  function eyes(m, x1, x2, y, iris, r = 5) {
    const ry = m === 'shock' ? r * 1.2 : m === 'happy' ? r * 0.55 : m === 'smug' ? r * 0.5 : r;
    if (m === 'happy') return [x1, x2].map(x => `<path d="M${x - r} ${y + 1}q${r} -${r * 1.3} ${r * 2} 0" stroke="#1b1b1d" stroke-width="2.6" fill="none" stroke-linecap="round"/>`).join('');
    return [x1, x2].map(x => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${ry}" fill="#fff"/>`
      + `<circle cx="${x + (m === 'smug' ? 1.4 : 0)}" cy="${y + (m === 'sad' ? 1 : 0)}" r="${Math.min(ry, r * 0.62)}" fill="${iris}"/>`
      + `<circle cx="${x}" cy="${y}" r="${Math.min(ry, r * 0.62) * 0.5}" fill="#111"/>`
      + `<circle cx="${x + 1.4}" cy="${y - 1.4}" r="1.1" fill="#fff"/>`
      + (m === 'smug' ? `<path d="M${x - r - 0.5} ${y - ry + 0.4}h${r * 2 + 1}" stroke="#2a1d14" stroke-width="2"/>` : '')).join('');
  }
  const tear = (m, x, y) => m === 'sad' ? `<path d="M${x} ${y}q-2.5 4 0 5.5q2.5-1.5 0-5.5z" fill="#6ec3ff"/>` : '';
  const blush = (x1, x2, y, o = 0.5) => `<circle cx="${x1}" cy="${y}" r="3.4" fill="#f2a58c" opacity="${o}"/><circle cx="${x2}" cy="${y}" r="3.4" fill="#f2a58c" opacity="${o}"/>`;
  const sweat = (m) => m === 'worried' || m === 'shock' ? `<path d="M64 26q-3 5 0 7q3-2 0-7z" fill="#8fd3ff"/>` : '';
  const svg = (bg, body) => `<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="38" fill="${bg}"/>${body}</svg>`;

  const FACES = {
    sitti: (m) => svg('#ffe7c7', `<path d="M8 44c0-22 14-36 32-36s32 14 32 36c0 8-2 14-5 18-3-18-12-30-27-30S16 44 13 62c-3-4-5-10-5-18z" fill="#fbfbf7"/>
      <path d="M13 62c3 8 13 14 27 14s24-6 27-14" fill="#e9e3d5"/><ellipse cx="40" cy="48" rx="19" ry="21" fill="#f3c9a2"/>
      <path d="M20 30c8-8 32-8 40 0" stroke="#d6b35a" stroke-width="3" fill="none" stroke-dasharray="3 3"/>
      ${eyes(m, 32, 48, 46, '#5a3d28', 3.6)}<circle cx="32" cy="46" r="6" fill="none" stroke="#6b4a32" stroke-width="2"/><circle cx="48" cy="46" r="6" fill="none" stroke="#6b4a32" stroke-width="2"/><path d="M38 46h4" stroke="#6b4a32" stroke-width="2"/>
      ${brows(m, 32, 48, 37, '#d9d4c8', 2.2)}${mouth(m, 40, 58, '#b5533c')}${blush(26, 54, 54, 0.6)}${tear(m, 27, 50)}${sweat(m)}`),
    hero: (m) => svg('#cfe9ff', `<circle cx="40" cy="44" r="24" fill="#f4f3ef" stroke="#161616" stroke-width="2.5"/><path d="M16 38c0-16 10-22 24-22s24 6 24 22z" fill="#1b1b1d"/>
      <path d="M42 16c4-8 12-10 18-8-3 4-8 7-14 8" fill="#fafaf8" stroke="#161616" stroke-width="2"/>
      ${eyes(m, 30, 45, 47, '#161616', 6)}${brows(m, 30, 45, 38.5, '#161616', 2.4)}${mouth(m, 38, 58, '#3a1f1a')}${blush(24, 52, 54, 0.45)}${tear(m, 26, 51)}${sweat(m)}`),
    laila: (m) => svg('#ffd9e6', `<path d="M14 70c-4-14-2-40 10-50 10-8 26-8 34 0 12 10 13 36 8 50z" fill="#4a2c1d"/>
      <ellipse cx="40" cy="44" rx="18" ry="21" fill="#f1c7a3"/><path d="M22 38c2-14 12-19 20-19 9 0 16 6 17 17-8-6-22-8-37 2z" fill="#4a2c1d"/>
      ${eyes(m, 32, 48, 45, '#2f7fd6', 4.6)}${brows(m, 32, 48, 37, '#3a2217', 2.2)}${mouth(m, 40, 56, '#b5485a')}${blush(27, 53, 52, 0.55)}${tear(m, 28, 50)}
      <path d="M18 42c0-18 10-26 22-26s22 8 22 26" stroke="#2b2f3a" stroke-width="3.2" fill="none"/>
      <rect x="13" y="38" width="8" height="12" rx="3" fill="#2b2f3a"/><rect x="59" y="38" width="8" height="12" rx="3" fill="#2b2f3a"/>
      <path d="M17 49c0 8 6 12 14 11" stroke="#2b2f3a" stroke-width="2" fill="none"/><circle cx="32" cy="60" r="2.4" fill="#e8433a"/>`),
    zahran: (m) => svg('#ffe6a8', `<ellipse cx="40" cy="45" rx="21" ry="23" fill="#d9a27a"/><path d="M19 40c-2-8 0-14 4-16M61 40c2-8 0-14-4-16" stroke="#2a2420" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M22 24c6-7 30-7 36 0" stroke="#c48c64" stroke-width="2" fill="none"/>
      ${brows(m, 31, 49, 34, '#2a2420', 3.4)}
      <rect x="23" y="37" width="15" height="9" rx="3.5" fill="#161616"/><rect x="42" y="37" width="15" height="9" rx="3.5" fill="#161616"/><path d="M38 40h4" stroke="#161616" stroke-width="2.4"/><path d="M26 39l4 0" stroke="#fff" stroke-width="1.2" opacity=".6"/>
      <path d="M40 46q2 5-1 7" stroke="#b57d58" stroke-width="2" fill="none"/>
      ${mouth(m, 40, 60, '#6b2a20')}${(m === 'smug' || m === 'happy') ? '<rect x="42" y="59.4" width="3" height="3" rx=".8" fill="#ffc933"/>' : ''}
      <path d="M26 55c5-5 11-4 14-1 3-3 9-4 14 1-4 2-9 2-14 0-5 2-10 2-14 0z" fill="#2a2420"/>${sweat(m)}
      <path d="M22 72l18-6 18 6" stroke="#f2b705" stroke-width="5" fill="none"/>`),
    masked: (m) => svg('#3a3f52', `<path d="M10 76c0-30 12-58 30-58s30 28 30 58z" fill="#1d2130"/><ellipse cx="40" cy="46" rx="17" ry="20" fill="#e8b996"/>
      <path d="M16 46c0-20 10-30 24-30s24 10 24 30c-6-10-14-14-24-14s-18 4-24 14z" fill="#1d2130"/>
      ${eyes(m, 32, 48, 44, '#2f7fd6', 4.4)}${brows(m, 32, 48, 36, '#1d1d1d', 2.6)}
      <path d="M22 50h36v14c-6 5-12 7-18 7s-12-2-18-7z" fill="#c0392b"/><path d="M22 50h36" stroke="#8e2a20" stroke-width="2"/><path d="M28 56l4 4M36 56l4 4M44 56l4 4" stroke="#8e2a20" stroke-width="1.4"/>`),
    karim: (m) => svg('#dfe6f5', `<path d="M10 76c0-18 12-28 30-28s30 10 30 28z" fill="#1d2130"/><ellipse cx="40" cy="45" rx="17" ry="20" fill="#e8b996"/>
      <path d="M22 36c0-12 8-18 18-18s19 6 18 18c-4-5-10-7-18-7s-14 2-18 7z" fill="#3a2217"/>
      ${eyes(m, 32, 48, 44, '#2f7fd6', 4.4)}${brows(m, 32, 48, 36, '#2a1a12', 2.4)}${mouth(m, 40, 56, '#8a3b2a')}${tear(m, 28, 49)}
      <path d="M22 60c4 6 10 9 18 9" stroke="#c0392b" stroke-width="4" fill="none"/>`),
    goat: (m) => svg('#d9f2c7', `<path d="M26 22c-6-10-4-16 0-18 0 6 4 10 8 14M54 22c6-10 4-16 0-18 0 6-4 10-8 14" fill="#cdbb9a" stroke="#a8977a" stroke-width="1.4"/>
      <path d="M12 34c6-4 12-2 16 2-4 4-12 4-16-2zM68 34c-6-4-12-2-16 2 4 4 12 4 16-2z" fill="#f1ede4" stroke="#c9c1b0"/>
      <path d="M26 30c0-8 6-12 14-12s14 4 14 12v18c0 10-6 18-14 18s-14-8-14-18z" fill="#f1ede4"/><path d="M40 20c-4 4-6 10-4 14 2-3 6-4 8-4-1-4-2-7-4-10z" fill="#6b4a32"/>
      ${eyes(m, 33, 47, 38, '#7a5a2a', 3.8)}
      <ellipse cx="40" cy="56" rx="9" ry="7" fill="#e4dccc"/><circle cx="37" cy="54" r="1.2" fill="#6b4a32"/><circle cx="43" cy="54" r="1.2" fill="#6b4a32"/>
      ${mouth(m, 40, 59, '#6b4a32', 0.8)}<path d="M36 66l4 10 4-10z" fill="#f1ede4"/>${tear(m, 29, 43)}`),
    jiddo: (m) => svg('#f1e3c2', `<path d="M8 50C8 26 22 12 40 12s32 14 32 38c0 10-3 18-7 24-3-20-12-34-25-34S18 54 15 74c-4-6-7-14-7-24z" fill="#faf7f0"/>
      <path d="M12 40l6 6 6-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6 6-6" stroke="#b33b2e" stroke-width="1.6" fill="none" opacity=".7"/>
      <path d="M14 30c8-6 44-6 52 0" stroke="#1d1d1d" stroke-width="5" fill="none"/><path d="M15 36c8-6 42-6 50 0" stroke="#1d1d1d" stroke-width="4" fill="none"/>
      <ellipse cx="40" cy="50" rx="16" ry="18" fill="#dcae86"/>
      ${eyes(m, 33, 47, 48, '#5a3d28', 3.2)}${brows(m, 33, 47, 42, '#f4f1ea', 2.8)}
      <path d="M27 58c5-4 10-3 13 0 3-3 8-4 13 0-2 5-8 6-13 3-5 3-11 2-13-3z" fill="#f4f1ea"/>${mouth(m === 'happy' ? 'smug' : m, 40, 64, '#6b3a2a', 0.8)}
      <path d="M30 42l-2 2M52 42l-2-2" stroke="#b58a66" stroke-width="1"/>`),
  };
  const chBg = (ch) => `linear-gradient(160deg,${ch.c[0]},${ch.c[1]})`;
  const face = (who, mood) => (FACES[who] || FACES.hero)(mood || 'neutral');

  const NAMES = {
    sitti: ['ستّي', 'Sitti'], hero: ['إنت', 'You'], laila: ['ليلى · ع اللاسلكي', 'Laila · on the radio'], zahran: ['زهران المقاول', 'Zahran the contractor'],
    masked: ['المقنّع', 'The masked runner'], karim: ['كريم', 'Karim'], goat: ['مِشمِش', 'Mishmish'], jiddo: ['جدّي', 'Grandpa'],
  };
  const S = (who, mood, ar, en) => ({ who, mood, ar, en });
  const P = (who, mood, ar, en, scene) => ({ who, mood, ar, en, scene });

  // ------------------------------------------------------------ chapters
  const CHAPTERS = [
    { n: 1, ar: 'الرسالة الأولى', en: 'The first letter', e: '🌸', c: ['#ffe0ec', '#ff9ec4'],
      intro: [P('jiddo', 'happy', 'قبل أربعين سنة، زرعت أول شجرة ليمون بهالبيّارة… وخبّيت فيها سرّ.', 'Forty years ago I planted the first lemon tree in this grove… and hid a secret in it.', '🌳🍋'),
              P('sitti', 'worried', 'لقيت هالرسالة تحت بلاطة المطبخ… بخط جدّك، الله يرحمه!', 'I found this letter under a kitchen tile… in your grandpa’s handwriting, God rest him!', '✉️'),
              P('zahran', 'smug', 'البيّارة هاي رح تصير موقف سيارات. معكم شهر وبتطلعوا!', 'This grove will be a car park. You have one month to get out!', '🚜📄'),
              P('hero', 'angry', 'مش قبل ما أعرف شو خبّى جدّي!', 'Not before I find out what Grandpa hid!', '🏃‍♂️💨')],
      outro: [P('laila', 'happy', 'جدّك كان يحكي معي ع هاللاسلكي وأنا صغيرة. قال: «الخريطة بتدلّ ع الطابو».', 'Your grandpa used to talk to me on this radio when I was little. He said: “the map leads to the deed.”', '📻'),
              P('zahran', 'angry', 'طابو؟! مستحيل أخلّيكم تلاقوه.', 'A deed?! I will never let you find it.', '😤')] },
    { n: 2, ar: 'الخريطة الممزقة', en: 'The torn map', e: '☀️', c: ['#fff2c2', '#ffc94a'],
      intro: [P('jiddo', 'neutral', 'قسمت الخريطة لقطع، وخبيتها وين ما حدا بيدوّر: عالجسور، وبالصحرا.', 'I tore the map into pieces and hid them where nobody looks: on the bridges, in the desert.', '🗺️✂️'),
              P('laila', 'worried', 'زهران اشترى درون! شايفته ع الرادار بيدوّر ع نفس القطع.', 'Zahran bought a drone! I can see it on radar hunting for the same pieces.', '📡🛸'),
              P('goat', 'happy', 'ماااع! (مشمش بدّه يساعد هالمرة)', 'Maaa! (Mishmish wants to help this time)', '🐐✨')],
      outro: [P('laila', 'shock', 'استنى… في حدا تاني كان بيراقب السباق. لابس قناع أحمر.', 'Wait… someone else was watching the race. Wearing a red mask.', '👀'),
              P('masked', 'angry', 'ارجع ع بيتك. هاي مش لعبة أطفال.', 'Go home. This is not a kids’ game.', '🎭')] },
    { n: 3, ar: 'المقنّع', en: 'The masked runner', e: '🍂', c: ['#ffe2c4', '#f08a3c'],
      intro: [P('masked', 'neutral', 'كل قطعة بتلاقيها… أنا بسبقك عليها.', 'Every piece you find… I get there first.', '🌆🌧️'),
              P('laila', 'worried', 'عيونه زرقا… شفت هالعيون قبل. بس وين؟', 'His eyes are blue… I’ve seen those eyes before. But where?', '🔵'),
              P('sitti', 'sad', 'جدّك كان يقول: «اللي بيركض ورا الحق، ما بيتعب».', 'Your grandpa used to say: “whoever runs after what’s right never tires.”', '🫖')],
      outro: [P('karim', 'sad', 'أنا كريم… أخو ليلى. زهران ماسك علينا دين، وقال بيسامحنا إذا جبتله الخريطة.', 'I’m Karim… Laila’s brother. Zahran holds our family’s debt, said he’d forgive it if I brought him the map.', '🎭➡️😔'),
              P('laila', 'shock', 'كريم؟! ليش ما حكيتلي؟!', 'Karim?! Why didn’t you tell me?!', '💔'),
              P('karim', 'worried', 'خلص… بدّي أصلّح غلطتي. آخر قطعة عند البير القديم.', 'Enough… I want to fix my mistake. The last piece is at the old well.', '🗺️')] },
    { n: 4, ar: 'الطابو', en: 'The deed', e: '❄️', c: ['#e3f1ff', '#7fb8ff'],
      intro: [P('jiddo', 'happy', 'الطابو الأصلي للأرض مدفون جنب البير القديم، تحت أول شجرة زرعتها.', 'The original land deed is buried by the old well, under the first tree I planted.', '📜🌳'),
              P('karim', 'happy', 'رح أركض معك هالمرة، مش ضدك.', 'I’ll run with you this time, not against you.', '🤝'),
              P('zahran', 'angry', 'لو لقيتوا الطابو، بخسر كل إشي! شغّلوا الجرّافة!', 'If you find that deed, I lose everything! Start the bulldozer!', '🚜🔥')],
      outro: [P('sitti', 'happy', 'الطابو باسم جدّك! البيّارة إلنا، وإلنا للأبد!', 'The deed is in your grandpa’s name! The grove is ours, forever!', '📜✅'),
              P('zahran', 'sad', '…خلص. البيّارة إلكم. وبسامح كريم بالدين.', '…Fine. The grove is yours. And I’ll forgive Karim’s debt.', '🏳️'),
              P('laila', 'happy', 'بنعمل عرس للبيّارة! والليموناضة ع حسابك يا بطل.', 'We’re throwing the grove a party! And the lemonade is on you, hero.', '🎉🍋')] },
  ];
  const TRUE_END = [
    P('jiddo', 'happy', 'إذا قريت هالرسالة، يعني لقيت كل رسائلي… كلها، وحدة وحدة.', 'If you are reading this, you found all my letters… every single one.', '✉️×16'),
    P('jiddo', 'neutral', 'السرّ الحقيقي مش بالطابو يا حبيبي. السرّ إنك ما وقفت ركض، وما تركت حدا وراك.', 'The real secret was never the deed, my dear. It’s that you never stopped running, and never left anyone behind.', '❤️'),
    P('hero', 'sad', '…شكراً يا جدّي.', '…Thank you, Grandpa.', '🌅'),
    P('sitti', 'happy', 'تعال… نزرع شجرة ليمون جديدة، باسمك إنت.', 'Come… let’s plant a new lemon tree, in your name.', '🌱🍋'),
  ];

  // ------------------------------------------------------------ 16 levels
  const LEVELS = [
    // ---------------- chapter 1 · spring
    { id: 1, ch: 1, ar: 'ريحة الليمون', en: 'Scent of lemons', goal: 500, seed: 2101, biomes: ['grove'], obj: { type: 'coins', n: 40 }, diff: [0.02, 3000], reward: 150, letter: 360,
      intro: [S('sitti', 'worried', 'الرسالة بتقول: «أول ظرف عند السكة، بين شجرتين».', 'The letter says: “the first envelope is by the tracks, between two trees.”'),
              S('hero', 'happy', 'على عيني يا ستّي، بجيبه!', 'Leave it to me, Sitti!')],
      ev: [[120, S('laila', 'happy', 'ألو؟ سامعني؟ أنا ليلى بنت الجيران. معي لاسلكي جدّك القديم!', 'Hello? Can you hear me? It’s Laila from next door. I have your grandpa’s old radio!')],
           [300, S('laila', 'shock', 'في ظرف بيلمع قدامك! التقطه!', 'There’s a glowing envelope ahead! Grab it!')]],
      outro: S('sitti', 'happy', 'شاطر! هاي أول رسالة… وفي كمان كتير.', 'Well done! That’s the first letter… and there are many more.'),
      teaser: ['مين الغريب اللي بيتصوّر البيّارة من ورا الشجر؟', 'Who is the stranger filming the grove from behind the trees?'] },
    { id: 2, ch: 1, ar: 'غريب بالبيّارة', en: 'A stranger in the grove', goal: 800, seed: 2102, biomes: ['grove', 'village'], obj: { type: 'lemons', n: 4 }, lemonMul: 2.2, diff: [0.08, 2600], reward: 200, letter: 520,
      intro: [S('sitti', 'angry', 'في زلمة بنظارات سودا بيقيس الأرض! جيبلي ليمون قبل ما يقطفوه.', 'A man in dark glasses is measuring the land! Get lemons before they pick them.')],
      ev: [[200, S('zahran', 'smug', 'اركض اركض… هالأرض رح تصير إلي عن قريب.', 'Run, run… this land will be mine soon.')],
           [480, S('laila', 'worried', 'هاد زهران المقاول. بيقولوا ما حدا بيقلّه لأ.', 'That’s Zahran the contractor. They say nobody ever tells him no.')]],
      outro: S('sitti', 'happy', 'ريحة الليمون بتجنن! بس زهران مش ناوي يستسلم.', 'They smell wonderful! But Zahran won’t give up.'),
      teaser: ['مشمش، ماعز أبو سليم، شاف الظرف التالت… وبلعه؟!', 'Mishmish, Abu Salim’s goat, spotted the third envelope… and ate it?!'] },
    { id: 3, ch: 1, ar: 'مِشمِش الهربان', en: 'Runaway Mishmish', goal: 1000, seed: 2103, biomes: ['village'], obj: { type: 'thief' }, thief: 240, diff: [0.12, 2400], reward: 250, letter: 700,
      intro: [S('sitti', 'shock', 'يا ويلي! مشمش خطف ظرف جدّك بتمّه وهرب ع السكة!', 'Oh no! Mishmish grabbed Grandpa’s envelope in his mouth and ran onto the tracks!'),
              S('hero', 'angry', 'ما رح يفلت مني!', 'He won’t get away from me!')],
      ev: [[200, S('laila', 'shock', 'شايفته! الماعز قدامك، الحقه قبل ما يهرب!', 'I see him! The goat is ahead, catch him before he escapes!')],
           [650, S('goat', 'sad', 'مااااع… (مشمش بس كان جوعان)', 'Maaaa… (Mishmish was only hungry)')]],
      outro: S('goat', 'happy', 'ماع! (مشمش قرّر إنه صاحبك هلأ)', 'Maa! (Mishmish has decided you are friends now)'),
      teaser: ['صوت محرّك كبير جاي من ورا… الأرض بترجف.', 'A huge engine roars behind you… the ground is shaking.'] },
    { id: 4, ch: 1, boss: 'dozer', ar: 'الجرّافة!', en: 'The bulldozer!', goal: 1200, seed: 2104, biomes: ['grove'], obj: { type: 'dozer' }, diff: [0.16, 2200], reward: 400, letter: 880,
      intro: [S('zahran', 'angry', 'اطلع من طريقي يا ولد! الجرّافة ما بتستنّى حدا!', 'Get out of my way, kid! The bulldozer waits for no one!'),
              S('laila', 'worried', 'اسمعني: إذا تعثّرت وهي قريبة… خلصت. ركّز!', 'Listen: if you stumble while it’s close… it’s over. Focus!')],
      ev: [[40, S('laila', 'shock', 'الجرّافة وراك!! لا تتعثّر!', 'The bulldozer is right behind you!! Don’t stumble!')],
           [250, S('laila', 'happy', 'جمّع 5 ليمونات! الليموناضة بتزحلق الجرّافة 🥤', 'Collect 5 lemons! Lemonade makes the bulldozer slip 🥤')],
           [600, S('laila', 'worried', 'كمان شوي… محركها بلّش يسخن!', 'A bit more… its engine is overheating!')],
           [1000, S('zahran', 'angry', 'ليش هالولد ما بيوقف؟!', 'Why won’t this kid stop?!')]],
      outro: S('zahran', 'angry', 'هاي أول جولة بس! رح ترجعلي.', 'That was only round one! You’ll be back.'),
      teaser: ['الرسالة الرابعة فيها خريطة… بس مقطّعة لقطع.', 'The fourth letter holds a map… torn to pieces.'] },
    // ---------------- chapter 2 · summer
    { id: 5, ch: 2, ar: 'جسور الوادي', en: 'Valley bridges', goal: 1300, seed: 2205, biomes: ['forest', 'mountains'], styles: { bridge: 4, tunnel: 0.5 }, obj: { type: 'coins', n: 150 }, diff: [0.2, 2200], reward: 300, letter: 900,
      intro: [S('laila', 'happy', 'أول قطعة من الخريطة عالجسور. وبدنا مصاري لنوقّف المحامي!', 'The first map piece is on the bridges. And we need money for a lawyer!')],
      ev: [[120, S('laila', 'shock', 'زهران بعت درونات! ارميهم بليمون أو بدّل خطك 🍋', 'Zahran sent drones! Throw lemons or switch lanes 🍋')],
           [250, S('laila', 'worried', 'الريح قوية ع الجسر، ركّز بالخطوط!', 'The wind is strong on the bridge, watch your lanes!')],
           [800, S('jiddo', 'neutral', '«من الجسر التالت، عدّ تسع خطوات…» — بخط جدّك ع حجر!', '“From the third bridge, count nine steps…” — Grandpa’s writing on a stone!')]],
      outro: S('laila', 'happy', 'قطعة أولى من الخريطة! فيها رسمة كثبان رمل…', 'First map piece! It shows sand dunes…'),
      teaser: ['الصحرا… وعاصفة رمل جاية بسرعة.', 'The desert… and a sandstorm rolling in fast.'] },
    { id: 6, ch: 2, ar: 'عاصفة الرمل', en: 'The sandstorm', goal: 1500, seed: 2206, biomes: ['desert'], obj: { type: 'lemons', n: 5 }, lemonMul: 2, diff: [0.24, 2000], reward: 350, letter: 1100,
      intro: [S('laila', 'worried', 'القطعة التانية ورا الكثبان. الأرصاد بتقول في عاصفة…', 'The second piece is past the dunes. The forecast says a storm…'),
              S('hero', 'happy', 'بغمّض عيوني وبركض!', 'I’ll squint and run!')],
      ev: [[260, S('laila', 'shock', 'العاصفة وصلت! ما عدت شايفة إشي ع الرادار!', 'The storm is here! I can’t see anything on radar!'), 'sandstorm'],
           [900, S('laila', 'worried', 'صوتك بيقطع… ضلّك ع السكة… ضلّك…', 'You’re breaking up… stay on the tracks… stay…')]],
      outro: S('laila', 'happy', 'رجعت! وجبت الليمون الصحراوي كمان. جدّك كان رح يفتخر فيك.', 'You made it back! With desert lemons too. Your grandpa would be proud.'),
      teaser: ['مشمش بدّه يرد الجميل… وجايب معه مفاجأة.', 'Mishmish wants to return the favour… and he’s bringing a surprise.'] },
    { id: 7, ch: 2, ar: 'مشمش صاحبي', en: 'My friend Mishmish', goal: 1600, seed: 2207, biomes: ['village', 'grove'], obj: { type: 'coins', n: 200 }, ally: 120, diff: [0.28, 1900], reward: 400, letter: 1150,
      intro: [S('goat', 'happy', 'ماع ماع! (مشمش بيعرف طريق مختصر، وبيوقّع مصاري وهو راكض)', 'Maa maa! (Mishmish knows a shortcut, and drops coins as he runs)')],
      ev: [[150, S('laila', 'happy', 'هههه مشمش راكض جنبك! لمّ اللي بيوقّعه.', 'Haha, Mishmish is running beside you! Grab what he drops.')],
           [900, S('laila', 'worried', 'بزززز… في إشي طاير فوق البلد. مش عاجبني.', 'Bzzzz… something is flying over the village. I don’t like it.')]],
      outro: S('goat', 'happy', 'ماااع! (مشمش لقى القطعة التالتة مدفونة بالقش)', 'Maaa! (Mishmish found the third piece buried in the hay)'),
      teaser: ['الدرون خطف القطعة من إيد ستّي وطار!', 'The drone snatched the piece from Sitti’s hand and flew off!'] },
    { id: 8, ch: 2, boss: 'drone', ar: 'سباق الدرون', en: 'Drone race', goal: 1800, seed: 2208, biomes: ['city'], obj: { type: 'drone' }, thief: 220, thiefSkin: 'drone', diff: [0.32, 1800], reward: 550, letter: 1300,
      intro: [S('zahran', 'smug', 'الدرون تبعي أسرع منك بمية مرة يا شاطر.', 'My drone is a hundred times faster than you, kid.'),
              S('laila', 'angry', 'ارميه بليمونة 🍋، أو اطلع ع القطار والمسه!', 'Throw a lemon at it 🍋, or climb the train and touch it!')],
      ev: [[235, S('laila', 'shock', 'هاد هو! الدرون قدامك، الحقه!', 'There it is! The drone is ahead, chase it!')],
           [900, S('zahran', 'angry', 'شو؟! مين علّمك تركض هيك؟', 'What?! Who taught you to run like that?')],
           [1500, S('masked', 'neutral', '…مش سيّئ.', '…Not bad.')]],
      outro: S('laila', 'shock', 'مين هاد اللي لابس قناع؟ كان واقف ع السطح وبيتفرّج!', 'Who was that in the mask? He was standing on the roof, watching!'),
      teaser: ['المقنّع بيركض بالليل ع سطوح المدينة… وبيسبقك.', 'The masked runner races across the city rooftops at night… ahead of you.'] },
    // ---------------- chapter 3 · autumn
    { id: 9, ch: 3, ar: 'ظل ع السطوح', en: 'A shadow on the roofs', goal: 1700, seed: 2309, biomes: ['city'], weather: 'rain', obj: { type: 'flawless' }, diff: [0.34, 1800], reward: 450, letter: 1200,
      intro: [S('masked', 'angry', 'إذا بدك تسبقني، ولا غلطة. ولا وحدة.', 'If you want to beat me, not a single mistake. Not one.'),
              S('hero', 'angry', 'اتفقنا.', 'Deal.')],
      ev: [[300, S('laila', 'worried', 'الدنيا شتا والسكة بتزحلق. بهدوء…', 'It’s pouring and the rails are slippery. Easy…')],
           [1100, S('masked', 'shock', '…كيف لحقتني؟', '…How did you catch up?')]],
      outro: S('masked', 'sad', 'بتذكّرني بحدا… كان يركض هيك.', 'You remind me of someone… who used to run like that.'),
      teaser: ['نفق طويل بالجبل، والضباب ما بيخلّيك تشوف إيدك.', 'A long mountain tunnel, and fog so thick you can’t see your hand.'] },
    { id: 10, ch: 3, ar: 'نفق الضباب', en: 'Tunnel of fog', goal: 1900, seed: 2310, biomes: ['mountains', 'snow'], styles: { tunnel: 5, bridge: 0.5 }, weather: 'fog', obj: { type: 'lemons', n: 6 }, lemonMul: 2, diff: [0.38, 1700], reward: 500, letter: 1400,
      intro: [S('sitti', 'worried', 'جدّك كان يطلع ع الجبل كل خريف يجيب ليمون بلدي. خليك صاحي!', 'Your grandpa climbed the mountain every autumn for wild lemons. Stay sharp!')],
      ev: [[400, S('laila', 'worried', 'ما عاد في إشارة جوّا النفق… إذا سامعني، كمّل دغري!', 'No signal inside the tunnel… if you can hear me, keep going straight!')],
           [1300, S('jiddo', 'happy', '«اللي بيضيع بالضباب، بيلاقي حاله بالشمس» — محفورة ع باب النفق!', '“Who gets lost in the fog finds himself in the sun” — carved on the tunnel door!')]],
      outro: S('sitti', 'happy', 'برد الجبل ما وقّفك. تعال اشرب شاي بميرمية.', 'The mountain cold didn’t stop you. Come have some sage tea.'),
      teaser: ['ليلى لقيت صورة قديمة… فيها ولد عيونه زرقا.', 'Laila found an old photo… of a boy with blue eyes.'] },
    { id: 11, ch: 3, ar: 'لقاء بالمحطة', en: 'Meeting at the station', goal: 2000, seed: 2311, biomes: ['village', 'city'], obj: { type: 'coins', n: 300 }, diff: [0.42, 1700], reward: 550, letter: 1500,
      intro: [S('laila', 'sad', 'بالصورة أنا وأخوي كريم قبل ما يسافر… عيونه نفس عيون المقنّع.', 'In the photo it’s me and my brother Karim before he left… his eyes are the masked runner’s.')],
      ev: [[500, S('masked', 'worried', 'ليلى… إذا سامعة، سامحيني.', 'Laila… if you can hear me, forgive me.')],
           [1400, S('laila', 'shock', 'هاد صوته! هاد كريم!!', 'That’s his voice! That’s Karim!!')]],
      outro: S('laila', 'sad', 'لازم أعرف ليش بيشتغل مع زهران.', 'I have to know why he’s working for Zahran.'),
      teaser: ['الليلة: الجرّافة رجعت، وأكبر من قبل.', 'Tonight: the bulldozer is back, and bigger than before.'] },
    { id: 12, ch: 3, boss: 'dozer', ar: 'الليلة الطويلة', en: 'The long night', goal: 2100, seed: 2312, biomes: ['grove', 'village'], weather: 'rain', obj: { type: 'dozer' }, diff: [0.44, 1600], reward: 800, letter: 1600,
      intro: [S('zahran', 'angry', 'خلص! الليلة بجرف البيّارة كلها، ومعها الولد.', 'Enough! Tonight I flatten the whole grove, and the kid with it.'),
              S('masked', 'worried', 'اسمعني… خبّي ليمونك للليموناضة، الجرّافة ما بتقدر ع الزحلقة.', 'Listen… save your lemons for lemonade, the bulldozer can’t handle the slick.')],
      ev: [[40, S('laila', 'shock', 'الجرّافة! ركض ركض ركض!', 'The bulldozer! Run run run!')],
           [800, S('masked', 'angry', 'زهران! وقّف! هاد مش اتفاقنا!', 'Zahran! Stop! This wasn’t our deal!')],
           [1600, S('zahran', 'shock', 'إنت كمان يا كريم؟!', 'You too, Karim?!')]],
      outro: S('karim', 'sad', 'أنا كريم… خلص، ما عاد بدي أركض ضدكم.', 'I’m Karim… I don’t want to run against you anymore.'),
      teaser: ['القطعة الأخيرة عند البير القديم… ع قمّة التلج.', 'The last piece is at the old well… up in the snow.'] },
    // ---------------- chapter 4 · winter
    { id: 13, ch: 4, ar: 'درب التلج', en: 'The snow trail', goal: 2000, seed: 2413, biomes: ['snow', 'mountains'], obj: { type: 'coins', n: 300 }, diff: [0.46, 1600], reward: 600, letter: 1450,
      intro: [S('karim', 'happy', 'بعرف الطريق. ضلّك ورا أثري ع التلج.', 'I know the way. Follow my footprints in the snow.')],
      ev: [[400, S('laila', 'happy', 'كريم معك ع الخط؟ ياااه، زي زمان!', 'Karim is with you? Just like old times!')],
           [1500, S('zahran', 'angry', 'إذا ما بتقدر تغلبهم… اشتري الجبل كله!', 'If you can’t beat them… buy the whole mountain!')]],
      outro: S('karim', 'happy', 'شفت؟ بتركض أحسن مني.', 'See? You run better than me.'),
      teaser: ['مشمش لحقكم ع التلج… ومش لابس إشي!', 'Mishmish followed you into the snow… without a coat!'] },
    { id: 14, ch: 4, ar: 'مشمش ع التلج', en: 'Mishmish in the snow', goal: 2200, seed: 2414, biomes: ['snow'], weather: 'fog', obj: { type: 'lemons', n: 6 }, lemonMul: 2, ally: 150, diff: [0.5, 1500], reward: 650, letter: 1650,
      intro: [S('goat', 'worried', 'ماع… (مشمش بردان بس مصمّم)', 'Maa… (Mishmish is cold but determined)')],
      ev: [[200, S('laila', 'happy', 'مشمش عم يدلّك ع الليمون المدفون بالتلج!', 'Mishmish is sniffing out lemons buried in the snow!')],
           [1400, S('laila', 'shock', 'الدرون رجع! وهالمرة معه إشي ثقيل…', 'The drone is back! And this time it’s carrying something heavy…')]],
      outro: S('goat', 'happy', 'مااااع! (مشمش بطل الشتا)', 'Maaaa! (Mishmish, winter champion)'),
      teaser: ['الدرون خطف آخر قطعة من الخريطة… آخر فرصة.', 'The drone snatched the final map piece… last chance.'] },
    { id: 15, ch: 4, boss: 'drone', ar: 'الدرون الأخير', en: 'The last drone', goal: 2300, seed: 2415, biomes: ['mountains', 'snow'], obj: { type: 'drone' }, thief: 260, thiefSkin: 'drone', diff: [0.54, 1500], reward: 800, letter: 1750,
      intro: [S('zahran', 'smug', 'الخريطة معي هلأ. ودّعوا البيّارة.', 'The map is mine now. Say goodbye to your grove.'),
              S('karim', 'angry', 'بطاريته ضعيفة بالبرد! ضربة ليمونة وبيوقع 🍋', 'Its battery is weak in the cold! One lemon and it drops 🍋')],
      ev: [[275, S('laila', 'shock', 'قدامك! لا تخلّيه يفلت!', 'Right ahead! Don’t let it get away!')],
           [1200, S('zahran', 'worried', 'ارجع! ارجع يا درون!', 'Come back! Come back, drone!')]],
      outro: S('laila', 'happy', 'الخريطة كاملة! وفيها إكس أحمر… عند البير!', 'The map is complete! And there’s a red X… at the well!'),
      teaser: ['آخر ركضة. البير، الطابو… والجرّافة.', 'The last run. The well, the deed… and the bulldozer.'] },
    { id: 16, ch: 4, boss: 'dozer', ar: 'البير القديم', en: 'The old well', goal: 2600, seed: 2416, biomes: ['grove', 'village'], obj: { type: 'dozer' }, diff: [0.58, 1400], reward: 1500, letter: 2000,
      intro: [S('sitti', 'worried', 'يا حبيبي… هاي آخر ركضة. الله يحميك.', 'My dear… this is the last run. May God protect you.'),
              S('hero', 'angry', 'عشان جدّي… وعشان البيّارة. يلا!', 'For Grandpa… and for the grove. Let’s go!')],
      ev: [[40, S('zahran', 'angry', 'ما حدا رح يوصل للبير!', 'Nobody reaches that well!')],
           [900, S('karim', 'happy', 'أنا بشغلهم من اليمين، إنت كمّل!', 'I’ll distract them on the right, keep going!')],
           [1800, S('laila', 'shock', 'شايفة البير! كمان شوي!!', 'I can see the well! Almost there!!')],
           [2400, S('jiddo', 'happy', '«وصلت يا حبيبي.»', '“You made it, my dear.”')]],
      outro: S('sitti', 'happy', 'الطابو! باسم جدّك! الله يرضى عليك يا حبيبي.', 'The deed! In your grandpa’s name! God bless you, my dear.'),
      teaser: ['جمعت كل رسائل جدّك؟ في رسالة أخيرة ما حدا قرأها…', 'Found all of Grandpa’s letters? There’s one final letter nobody has read…'] },
  ];
  VR.STORY = LEVELS;

  // Grandpa's letters, one hidden in every level
  const LETTERS = [
    ['يا حبيبي، إذا لقيت هالرسالة يعني بلّشت الرحلة. الليمون بيحب اللي بيتعب عليه.', 'My dear, if you found this letter the journey has begun. Lemons love those who work for them.'],
    ['زرعت أول شجرة يوم ولدت ستّك بأبوك. سمّيتها «الصبر».', 'I planted the first tree the day your grandma gave birth to your father. I named it “Patience”.'],
    ['المعزة اللي بتسرق ليمونك، يوم من الأيام بتدلّك ع الطريق.', 'The goat that steals your lemons will one day show you the way.'],
    ['الجرّافة قوية، بس ما بتعرف تركض ع السكة. إنت بتعرف.', 'A bulldozer is strong, but it can’t run the rails. You can.'],
    ['قسمت الخريطة لأنه الحِمل التقيل بينحمل ع دفعات.', 'I split the map because heavy loads are carried a piece at a time.'],
    ['بالصحرا، الليمونة الوحدة بتسوى بستان.', 'In the desert, a single lemon is worth an orchard.'],
    ['الصاحب اللي بيركض جنبك أغلى من اللي بيستنّاك بآخر الطريق.', 'A friend who runs beside you is worth more than one waiting at the finish.'],
    ['اللي بيطير عالي بيوقع بسرعة. خلّيك قريب من الأرض.', 'Whoever flies high falls fast. Stay close to the ground.'],
    ['مش كل وجه مخبّى وجه عدو. أحياناً بيكون وجه خايف.', 'Not every hidden face is an enemy. Sometimes it’s a frightened one.'],
    ['بالضباب، امشِ ع ريحة الليمون. عمرها ما بتكذب.', 'In the fog, follow the scent of lemons. It never lies.'],
    ['أبو كريم كان أعزّ أصحابي. إذا شفت ابنه، قلّه إني سامحته.', 'Karim’s father was my dearest friend. If you see his son, tell him I forgave him.'],
    ['الليل طويل، بس الشمس دايماً بتطلع ع البيّارة أول إشي.', 'The night is long, but the sun always rises over the grove first.'],
    ['التلج بيغطّي الأرض، بس ما بيغطّي الحق.', 'Snow can cover the land, but not what’s right.'],
    ['حتى المعزة بتبرد… دفّيها وبتدفّيك.', 'Even a goat gets cold… warm her and she’ll warm you.'],
    ['الخريطة بتوصّلك للمكان، بس القلب بيوصّلك للناس.', 'A map takes you to a place, but the heart takes you to people.'],
    ['الطابو ورقة. البيّارة إلها، بس إنت إلها أكتر. احكيلي عن الشجرة الجديدة لما تزرعها.', 'The deed is paper. The grove belongs to it, but you belong to the grove more. Tell me about the new tree when you plant it.'],
  ];

  // ------------------------------------------------------------ props
  function finishGate(ar) {
    const g = new T.Group(), mb = new VR.MB(61);
    const X = VR.HALF_TRACK + 0.9;
    for (const s of [-1, 1]) {
      mb.cyl('paint', 0xffffff, s * X, 3.2, 0, 0.16, 0.18, 6.4, { seg: 12 });
      for (let i = 0; i < 8; i++) mb.cyl('paint', i % 2 ? 0x2f8a45 : 0xe8433a, s * X, 0.5 + i * 0.75, 0, 0.19, 0.19, 0.25, { seg: 12 });
      for (let i = 0; i < 5; i++) mb.sphere('gloss', [0xffd23f, 0xe8433a, 0x3ec1ff, 0x7bc86c, 0xe86fb3][i], s * (X + 0.2) + Math.sin(i * 2) * 0.3, 7.0 + i * 0.25, Math.cos(i * 2) * 0.3, 0.32, { sy: 1.2, seg: 12 });
    }
    g.add(mb.build({ receive: false }));
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 192;
    const c = cv.getContext('2d');
    for (let x = 0; x < 1024; x += 32) for (let y = 0; y < 192; y += 32) { c.fillStyle = ((x + y) / 32) % 2 ? '#111' : '#fff'; c.fillRect(x, y, 32, 32); }
    c.fillStyle = 'rgba(20,110,60,.92)'; c.fillRect(120, 22, 784, 148);
    c.fillStyle = '#ffd43b'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '800 92px "Baloo Bhaijaan 2", Tahoma, sans-serif'; c.direction = ar ? 'rtl' : 'ltr';
    c.fillText(ar ? 'خط النهاية' : 'FINISH', 512, 100);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    const mat = new T.MeshBasicMaterial({ map: tex, color: new T.Color(1.2, 1.2, 1.2), side: T.DoubleSide });
    const banner = new T.Mesh(new T.PlaneGeometry(X * 2, X * 2 * 192 / 1024), mat);
    banner.position.set(0, 6.2, 0); g.add(banner);
    g.userData.dispose = () => { tex.dispose(); mat.dispose(); banner.geometry.dispose(); };
    return g;
  }

  // Grandpa's letter: a sealed envelope floating in a golden halo
  function buildLetter() {
    const g = new T.Group(), spin = new T.Group(); g.add(spin);
    const mb = new VR.MB(62);
    mb.box('flat', 0xf4ead2, 0, 0, 0, 0.72, 0.48, 0.05, { r: 0.02 });
    // flap (two slanted strips forming a V) and the red wax seal
    mb.box('flat', 0xe6d7b4, -0.18, 0.09, 0.03, 0.44, 0.04, 0.02, { rz: -0.55 });
    mb.box('flat', 0xe6d7b4, 0.18, 0.09, 0.03, 0.44, 0.04, 0.02, { rz: 0.55 });
    mb.cyl('gloss', 0xc0392b, 0, -0.02, 0.04, 0.08, 0.08, 0.03, { rx: Math.PI / 2, seg: 14 });
    mb.box('flat', 0xe6d7b4, 0, 0, -0.03, 0.72, 0.48, 0.01);
    spin.add(mb.build({ receive: false }));
    const halo = new T.Mesh(new T.TorusGeometry(0.62, 0.035, 8, 40), new T.MeshBasicMaterial({ color: new T.Color(2.4, 1.9, 0.6), fog: false }));
    g.add(halo);
    const glow = new T.Mesh(new T.CircleGeometry(0.6, 24), new T.MeshBasicMaterial({ color: new T.Color(1.4, 1.1, 0.4), transparent: true, opacity: 0.28, depthWrite: false, fog: false }));
    g.add(glow);
    g.userData = { spin, halo, glow, dispose: () => { halo.geometry.dispose(); halo.material.dispose(); glow.geometry.dispose(); glow.material.dispose(); } };
    return g;
  }

  // Zahran's bulldozer (built facing -z, towards the runner it chases)
  function buildDozer() {
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const mb = new VR.MB(63);
    const Y = 0xf2b705, D = 0x2b2622;
    for (const s of [-1, 1]) {                                            // tracks
      mb.box('flat', D, s * 0.95, 0.38, 0.3, 0.5, 0.72, 2.6, { r: 0.3 });
      for (let i = 0; i < 4; i++) mb.cyl('metal', 0x6b6f76, s * 1.22, 0.38, -0.6 + i * 0.6, 0.2, 0.2, 0.06, { rz: Math.PI / 2, seg: 14 });
    }
    mb.box('paint', Y, 0, 0.95, 0.4, 1.5, 0.7, 2.2, { r: 0.1 });            // engine body
    mb.box('paint', Y, 0, 1.75, 0.75, 1.2, 0.95, 1.1, { r: 0.08 });         // cab
    mb.box('glass', 0x9fc7e0, 0, 1.85, 0.19, 1.0, 0.6, 0.04);              // windscreen
    for (const s of [-1, 1]) mb.box('glass', 0x9fc7e0, s * 0.61, 1.85, 0.75, 0.04, 0.55, 0.8);
    mb.cyl('metal', 0x3a3a3a, 0.45, 1.7, 1.2, 0.07, 0.08, 1.0, { seg: 10 });   // exhaust stack
    mb.cyl('glow', 0xff8a00, 0, 2.3, 0.75, 0.12, 0.12, 0.14, { seg: 12 });     // beacon
    for (const s of [-1, 1]) mb.box('paint', Y, s * 0.55, 0.9, -1.0, 0.14, 0.18, 1.2, { rx: 0.25 });   // blade arms
    mb.box('hazard', 0xffffff, 0, 0.72, -1.55, 2.9, 1.15, 0.16, { r: 0.04, rx: -0.12 });                // hazard-striped blade
    mb.box('metal', 0x8a8f96, 0, 0.18, -1.66, 2.9, 0.12, 0.2);
    for (const s of [-1, 1]) mb.sphere('glow', 0xfff2c0, s * 0.5, 1.2, -0.72, 0.1, { seg: 10 });        // headlights
    body.add(mb.build({ receive: false }));
    root.userData = { body };
    root.scale.setScalar(0.78);
    root.visible = false;
    return root;
  }

  // ------------------------------------------------------------ the story system
  class Story {
    constructor(game) {
      this.name = 'story'; this.g = game;
      const sv = UI.store.get('story2', {});
      this.save = { stars: sv.stars || {}, letters: sv.letters || {}, seen: sv.seen || {} };
      this.level = null;
      this.dozer = buildDozer(); game.scene.add(this.dozer);
      UI.addStrings({
        story: 'القصة', storyTitle: 'سرّ البيّارة', storyLocked: 'خلّص المرحلة اللي قبلها', next: 'التالي', start: 'يلا!', arrived: 'وصلت!', skip: 'تخطّي',
        objLemons: 'اجمع {n} ليمونات', objCoins: 'اجمع {n} عملة', objThief: 'امسك مشمش', objDrone: 'وقّع درون زهران', objDozer: 'اهرب من الجرّافة بدون ما تلحقك',
        objFinish: 'وصلت لخط النهاية', objFlawless: 'بدون تعثّر ولا متابعة', objLetter: 'لاقي رسالة جدّي',
        nextLevel: 'المرحلة الجاية', retry: 'أعد المحاولة', storyDone: 'خلصت القصة! 🎉', m2: 'م', chapter: 'الفصل', level: 'المرحلة',
        letters: 'رسائل جدّي', letterFound: '✉️ لقيت رسالة من جدّي!', letterNew: 'رسالة جديدة من جدّي', letterLocked: 'لسّا ما لقيتها · المرحلة {n}',
        nextTime: 'المرة الجاية…', dozer: 'الجرّافة', dozerNear: 'الجرّافة قريبة! لا تتعثّر!', caughtByDozer: 'لحقتك الجرّافة!', dozerLunge: 'الجرّافة قرّبت!',
        trueEnd: 'النهاية الحقيقية', lettersHint: 'جمّع الـ16 رسالة لتفتح النهاية الحقيقية',
      }, {
        story: 'Story', storyTitle: 'The Grove’s Secret', storyLocked: 'Finish the previous level', next: 'Next', start: 'Go!', arrived: 'You made it!', skip: 'Skip',
        objLemons: 'Collect {n} lemons', objCoins: 'Collect {n} coins', objThief: 'Catch Mishmish', objDrone: 'Take down Zahran’s drone', objDozer: 'Escape the bulldozer without it catching up',
        objFinish: 'Reach the finish line', objFlawless: 'No stumbles, no continues', objLetter: 'Find Grandpa’s letter',
        nextLevel: 'Next level', retry: 'Try again', storyDone: 'Story complete! 🎉', m2: 'm', chapter: 'Chapter', level: 'Level',
        letters: 'Grandpa’s letters', letterFound: '✉️ You found a letter from Grandpa!', letterNew: 'A new letter from Grandpa', letterLocked: 'Not found yet · level {n}',
        nextTime: 'Next time…', dozer: 'Bulldozer', dozerNear: 'The bulldozer is close! Don’t stumble!', caughtByDozer: 'The bulldozer got you!', dozerLunge: 'The bulldozer lunges!',
        trueEnd: 'The true ending', lettersHint: 'Collect all 16 letters to unlock the true ending',
      });
    }
    get stars() { return this.save.stars; }
    persist() { UI.store.set('story2', this.save); }
    letterCount() { return Object.keys(this.save.letters).length; }
    objText(o) {
      if (!o) return UI.t('objFinish');
      const k = { lemons: 'objLemons', coins: 'objCoins', thief: 'objThief', drone: 'objDrone', dozer: 'objDozer', flawless: 'objFlawless' }[o.type];
      return UI.t(k).replace('{n}', o.n);
    }
    unlocked(i) { return i === 0 || (this.stars[LEVELS[i - 1].id] || 0) > 0; }
    tr(o) { return UI.lang === 'ar' ? o.ar : o.en; }
    who(w) { return NAMES[w] ? NAMES[w][UI.lang === 'ar' ? 0 : 1] : w; }

    // ------------------------------------------------------------ screens
    bind() {
      UI.addScreen('story'); UI.addScreen('dialog'); UI.addScreen('comic'); UI.addScreen('letters');
      UI.addScreen('levelDone', 'levelDone', false);
      const add = (html, parent = document.body) => { const d = document.createElement('div'); d.innerHTML = html; const el = d.firstElementChild; parent.appendChild(el); return el; };
      add(`<section id="story" class="screen dim" hidden><div class="card glass rise sm-card">
            <div class="sm-head"><h2 data-i18n="storyTitle"></h2><button class="btn sm-let" id="smLetters">✉️ <span id="smLetN"></span></button></div>
            <div class="sm-map" id="smMap"></div>
            <button class="btn" id="storyBack"><svg><use href="#i-home"/></svg><span data-i18n="menu"></span></button></div></section>`);
      add(`<section id="dialog" class="screen" hidden style="justify-content:flex-end"><div class="dlg glass rise">
            <div class="dlg-face" id="dlgFace"></div><div class="dlg-body"><b id="dlgWho"></b><p id="dlgText"></p>
            <div class="dlg-goal" id="dlgGoal"></div></div>
            <button class="btn primary" id="dlgNext" style="font-size:20px;min-height:52px"></button></div></section>`);
      add(`<section id="comic" class="screen dim" hidden><div class="cm-wrap">
            <div class="cm-top"><span id="cmTitle"></span><button class="btn cm-skip" id="cmSkip" data-i18n="skip"></button></div>
            <div class="cm-panel rise" id="cmPanel"></div>
            <div class="cm-dots" id="cmDots"></div>
            <button class="btn primary" id="cmNext" style="font-size:20px;min-height:52px"></button></div></section>`);
      add(`<section id="letters" class="screen dim" hidden><div class="card glass rise sm-card">
            <h2 data-i18n="letters"></h2><div class="lt-hint" id="ltHint"></div>
            <div class="lt-grid" id="ltGrid"></div><div class="lt-read" id="ltRead" hidden></div>
            <button class="btn" id="ltBack"><svg><use href="#i-left"/></svg><span data-i18n="storyTitle"></span></button></div></section>`);
      add(`<section id="levelDone" class="screen dim" hidden><div class="card glass rise ld-card">
            <h2 data-i18n="arrived"></h2><div class="lv-stars" id="ldStars"></div><div class="lv-objs" id="ldObjs"></div>
            <div class="lv-reward" id="ldReward"></div>
            <div class="ld-say" id="ldSay"></div><div class="ld-letter" id="ldLetter"></div><div class="ld-tease" id="ldTease"></div>
            <button class="btn primary" id="ldNext"></button>
            <div class="row2"><button class="btn" id="ldRetry"><svg><use href="#i-retry"/></svg><span data-i18n="retry"></span></button>
            <button class="btn" id="ldMenu"><svg><use href="#i-book"/></svg><span data-i18n="story"></span></button></div></div></section>`);
      const hud = document.getElementById('hud') || document.body;
      this.radioEl = add(`<div id="radio" class="radio"><div class="rd-face"></div><div class="rd-body"><b></b><p></p></div></div>`, hud);
      this.bossEl = add(`<div id="bossBar" class="boss-bar" hidden><span>🚜 <em></em></span><i><b></b></i></div>`, hud);
      const st = document.createElement('style');
      st.textContent = `
        .sm-card{width:min(640px,100%);max-height:calc(100vh - 24px);display:flex;flex-direction:column}
        .sm-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.sm-head h2{margin:0}
        .sm-let{flex:none;width:auto;min-height:40px;padding:6px 14px;font-weight:800;direction:ltr}.sm-head h2{font-size:clamp(22px,6vw,30px);white-space:nowrap}
        .sm-map{overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:2px;flex:1;min-height:0;-webkit-overflow-scrolling:touch}
        .ch{border-radius:20px;padding:12px;background:linear-gradient(135deg,var(--c1),var(--c2));color:#1d1f2b;box-shadow:0 6px 18px rgba(0,0,0,.25)}
        .ch.locked{filter:grayscale(.9) brightness(.6)}
        .ch-h{display:flex;align-items:center;gap:10px}.ch-e{font-size:34px;line-height:1}.ch-h small{display:block;font-weight:800;opacity:.65;font-size:12px}.ch-h b{font-size:19px}
        .ch-h>div{min-width:0}.ch-s{flex:none;white-space:nowrap;margin-inline-start:auto;font-weight:800;direction:ltr;background:rgba(255,255,255,.55);border-radius:99px;padding:3px 10px;font-size:14px}
        .ch-path{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}
        .ch-path:before{content:"";position:absolute;inset-inline:12%;top:27px;border-top:4px dashed rgba(0,0,0,.25)}
        .nd{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:0;font:inherit;cursor:pointer;color:inherit;padding:0}
        .nd-c{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:20px;background:#fff;border:3px solid rgba(0,0,0,.18);box-shadow:0 4px 0 rgba(0,0,0,.18)}
        .nd.boss .nd-c{background:#2b2f3a;color:#ffd23f;border-color:#ffd23f;font-size:24px}
        .nd.cur .nd-c{border-color:#e8433a;animation:ndPulse 1.2s ease-in-out infinite}
        .nd.locked{opacity:.5;cursor:not-allowed}.nd.locked .nd-c{background:#d6d6d6}
        .nd-t{font-size:11.5px;font-weight:800;line-height:1.15;text-align:center;max-width:100%}
        .nd-st{font-size:12px;letter-spacing:1px;direction:ltr;color:rgba(0,0,0,.3)}.nd-st i{font-style:normal;color:#c98a00}
        .nd-l{position:absolute;top:-4px;inset-inline-end:8%;font-size:16px;font-style:normal;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))}
        @keyframes ndPulse{50%{transform:scale(1.08)}}
        .dlg{width:min(640px,100%);display:grid;grid-template-columns:auto 1fr;gap:10px 14px;align-items:center;padding:14px;border-radius:24px}
        .dlg-face svg{width:84px;height:84px;display:block}.dlg-body b{color:var(--lemon);font-size:16px}.dlg-body p{margin:2px 0 0;font-size:18px;line-height:1.45;font-weight:600}
        .dlg-goal{margin-top:6px;font-size:14px;color:var(--muted)}.dlg-goal:empty{display:none}.dlg #dlgNext{grid-column:1/-1}
        .dlg-face{animation:faceIn .35s cubic-bezier(.2,.9,.3,1.4)}@keyframes faceIn{from{transform:scale(.6) rotate(-8deg);opacity:0}}
        .cm-wrap{width:min(560px,100%);display:flex;flex-direction:column;gap:12px}
        .cm-top{display:flex;align-items:center;justify-content:space-between;font-weight:900;font-size:18px;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.5)}
        .cm-skip{min-height:34px;padding:4px 14px;font-size:14px}
        .cm-panel{position:relative;border-radius:22px;overflow:hidden;background:#fffaf0;color:#1d1f2b;border:5px solid #1d1f2b;box-shadow:8px 8px 0 rgba(0,0,0,.35);min-height:300px;display:flex;flex-direction:column}
        .cm-scene{position:relative;flex:1;min-height:190px;display:grid;place-items:center;background:var(--cbg,linear-gradient(160deg,#ffe0ec,#ff9ec4))}
        .cm-scene .cm-emoji{position:absolute;inset-inline-end:14px;top:10px;font-size:40px;opacity:.9;filter:drop-shadow(0 3px 3px rgba(0,0,0,.25))}
        .cm-scene svg{width:150px;height:150px;filter:drop-shadow(0 8px 10px rgba(0,0,0,.25));animation:faceIn .45s cubic-bezier(.2,.9,.3,1.4)}
        .cm-panel.sepia .cm-scene{filter:sepia(.85) contrast(.95)}.cm-panel.sepia{background:#f4e7cc}
        .cm-cap{padding:12px 16px 16px;font-size:18px;font-weight:700;line-height:1.5;border-top:4px solid #1d1f2b}.cm-cap b{display:block;font-size:14px;color:#b5533c}
        .cm-dots{display:flex;gap:6px;justify-content:center}.cm-dots i{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.35)}.cm-dots i.on{background:var(--lemon)}
        .lt-hint{font-size:14px;color:var(--muted);text-align:center}
        .lt-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;overflow-y:auto}
        .lt{aspect-ratio:1/0.8;border-radius:14px;border:1px solid var(--edge);background:var(--glass-2);display:grid;place-items:center;font-size:28px;cursor:pointer;color:var(--text);font-weight:800;position:relative}
        .lt small{position:absolute;bottom:4px;font-size:11px;color:var(--muted)}.lt.got{background:linear-gradient(160deg,#fff6de,#f1dfb3);color:#6b4a32}.lt.got small{color:#8a6a4a}
        .lt-read{background:#f7ecd2;color:#4a3526;border-radius:16px;padding:14px 16px;font-size:17px;line-height:1.6;font-weight:600;box-shadow:inset 0 0 0 2px #e4cfa2}
        .lt-read b{display:block;font-size:13px;color:#b5533c;margin-bottom:4px}
        .ld-card{max-height:calc(100vh - 24px);overflow-y:auto}
        .lv-stars{display:flex;justify-content:center;gap:10px;font-size:54px;direction:ltr}.lv-stars span{color:#3a3f52;filter:drop-shadow(0 4px 10px rgba(0,0,0,.3))}.lv-stars span.on{color:var(--lemon);animation:starPop .5s cubic-bezier(.2,.9,.3,1.5) both}
        @keyframes starPop{from{transform:scale(0) rotate(-40deg)}to{transform:none}}
        .lv-objs{display:flex;flex-direction:column;gap:6px}.lv-objs div{display:flex;gap:8px;align-items:center;font-weight:700;padding:6px 10px;border-radius:12px;background:var(--glass-2)}.lv-objs div.ok{color:#9ff0b8}.lv-objs div:not(.ok){color:var(--muted)}
        .lv-reward{text-align:center;font-weight:800;color:var(--lemon);font-size:20px;direction:ltr}.lv-reward:empty{display:none}
        .ld-say{display:flex;gap:10px;align-items:center;background:var(--glass-2);border-radius:16px;padding:8px 10px}.ld-say:empty{display:none}.ld-say svg{width:52px;height:52px;flex:none}.ld-say p{margin:0;font-weight:700;line-height:1.4}.ld-say b{display:block;font-size:12px;color:var(--lemon)}
        .ld-letter{background:#f7ecd2;color:#4a3526;border-radius:14px;padding:10px 14px;font-weight:600;line-height:1.5;animation:starPop .6s .6s both}.ld-letter:empty{display:none}.ld-letter b{display:block;color:#b5533c;font-size:13px}
        .ld-tease{text-align:center;font-style:italic;color:var(--muted);font-weight:700}.ld-tease:empty{display:none}.ld-tease b{font-style:normal;color:#ff9e7a}
        .radio{position:fixed;top:calc(112px + var(--safe-t, 0px));left:50%;transform:translate(-50%,-20px);opacity:0;transition:opacity .25s,transform .25s;display:flex;align-items:center;gap:8px;
          width:min(460px,calc(100vw - 24px));padding:6px 12px 6px 6px;border-radius:18px;background:rgba(16,20,34,.8);color:#fff;pointer-events:none;z-index:5}
        .radio.on{opacity:1;transform:translate(-50%,0)}.radio .rd-face svg{width:46px;height:46px;display:block}.radio b{font-size:12px;color:var(--lemon)}.radio p{margin:0;font-size:15px;font-weight:700;line-height:1.35}
        .radio.jiddo{background:rgba(92,70,40,.88)}.radio.jiddo .rd-face{filter:sepia(.8)}
        .boss-bar{position:fixed;bottom:calc(18px + var(--safe-b, 0px));left:50%;transform:translateX(-50%);width:min(320px,70vw);display:flex;flex-direction:column;gap:4px;align-items:center;pointer-events:none;z-index:4}
        .boss-bar span{font-weight:900;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.6);font-size:14px}.boss-bar em{font-style:normal}
        .boss-bar i{display:block;width:100%;height:12px;border-radius:99px;background:rgba(0,0,0,.45);overflow:hidden;box-shadow:0 0 0 2px rgba(255,255,255,.25)}
        .boss-bar i b{display:block;height:100%;width:0;background:linear-gradient(90deg,#ffd23f,#ff5a36);transition:width .12s}
        @media (max-width:560px){.boss-bar{bottom:calc(112px + var(--safe-b, 0px))}}
        .boss-bar.hot i{animation:bossHot .35s ease-in-out infinite alternate}@keyframes bossHot{to{box-shadow:0 0 0 3px #ff5a36,0 0 16px #ff5a36}}`;
      document.head.appendChild(st);
      UI.bind('storyBack', () => this.g.setState('menu'));
      UI.bind('smLetters', () => this.openLetters());
      UI.bind('ltBack', () => this.open());
      UI.bind('dlgNext', () => this.nextLine());
      UI.bind('cmNext', () => this.nextPanel());
      UI.bind('cmSkip', () => { this.panels = [this.panels[this.panels.length - 1]]; this.nextPanel(); });
      document.getElementById('cmPanel').addEventListener('click', () => this.nextPanel());
      UI.bind('ldNext', () => this.afterLevel());
      UI.bind('ldRetry', () => this.play(this.level));
      UI.bind('ldMenu', () => { this.g.toMenu(); this.open(); });
    }

    // ------------------------------------------------------------ journey map
    open() { this.g.setState('story'); UI.setLang(UI.lang); this.renderMap(); }
    renderMap() {
      const ar = UI.lang === 'ar';
      const firstOpen = LEVELS.findIndex((l, i) => this.unlocked(i) && !this.stars[l.id]);
      document.getElementById('smLetN').textContent = this.letterCount() + '/16';
      document.getElementById('smMap').innerHTML = CHAPTERS.map(ch => {
        const lv = LEVELS.filter(l => l.ch === ch.n), i0 = LEVELS.indexOf(lv[0]);
        const got = lv.reduce((s, l) => s + (this.stars[l.id] || 0), 0);
        const nodes = lv.map(l => {
          const i = LEVELS.indexOf(l), s = this.stars[l.id] || 0, lock = !this.unlocked(i);
          const icon = l.boss === 'dozer' ? '🚜' : l.boss === 'drone' ? '🛸' : l.id;
          return `<button class="nd${l.boss ? ' boss' : ''}${lock ? ' locked' : ''}${i === firstOpen ? ' cur' : ''}" data-i="${i}">
            <span class="nd-c">${lock ? '🔒' : icon}</span><span class="nd-t">${ar ? l.ar : l.en}</span>
            <span class="nd-st">${[0, 1, 2].map(k => k < s ? '<i>★</i>' : '★').join('')}</span>${this.save.letters[l.id] ? '<i class="nd-l">✉️</i>' : ''}</button>`;
        }).join('');
        return `<div class="ch${this.unlocked(i0) ? '' : ' locked'}" style="--c1:${ch.c[0]};--c2:${ch.c[1]}">
          <div class="ch-h"><span class="ch-e">${ch.e}</span><div><small>${UI.t('chapter')} ${ch.n}</small><b>${ar ? ch.ar : ch.en}</b></div><span class="ch-s">★ ${got}/12</span></div>
          <div class="ch-path">${nodes}</div></div>`;
      }).join('');
      document.querySelectorAll('#smMap .nd').forEach(b => b.addEventListener('click', () => {
        const i = +b.dataset.i;
        if (!this.unlocked(i)) { VR.Audio.play('denied'); UI.toast(UI.t('storyLocked'), 1200); return; }
        VR.Audio.play('click'); this.pick(i);
      }));
      const cur = document.querySelector('#smMap .nd.cur');
      if (cur && cur.scrollIntoView) setTimeout(() => cur.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
    }

    // ------------------------------------------------------------ letters album
    openLetters() {
      this.g.setState('letters'); UI.setLang(UI.lang);
      const n = this.letterCount();
      document.getElementById('ltHint').textContent = n >= 16 ? '🌱 ' + UI.t('trueEnd') : UI.t('lettersHint') + ` (${n}/16)`;
      const read = document.getElementById('ltRead'); read.hidden = true;
      document.getElementById('ltGrid').innerHTML = LEVELS.map(l => this.save.letters[l.id]
        ? `<button class="lt got" data-id="${l.id}">✉️<small>${l.id}</small></button>`
        : `<button class="lt" data-id="${l.id}">?<small>${l.id}</small></button>`).join('')
        + (this.save.seen.trueEnd ? `<button class="lt got" data-id="end" style="grid-column:1/-1;aspect-ratio:auto;padding:10px;font-size:16px">🌱 ${UI.t('trueEnd')}</button>` : '');
      document.querySelectorAll('#ltGrid .lt').forEach(b => b.addEventListener('click', () => {
        VR.Audio.play('click');
        if (b.dataset.id === 'end') { this.comic(TRUE_END, '🌱 ' + UI.t('trueEnd'), () => this.openLetters(), { sepia: true, bg: 'linear-gradient(160deg,#fff1d6,#e9c98f)' }); return; }
        const id = +b.dataset.id, isAr = UI.lang === 'ar';
        read.hidden = false;
        read.innerHTML = this.save.letters[id]
          ? `<b>${this.who('jiddo')} · ${UI.t('level')} ${id}</b>${LETTERS[id - 1][isAr ? 0 : 1]}`
          : `<b>?</b>${UI.t('letterLocked').replace('{n}', id)}`;
      }));
    }

    // ------------------------------------------------------------ comic panels
    comic(panels, title, done, o = {}) {
      this.panels = panels.slice(); this.panelN = panels.length; this.afterComic = done; this.sepiaAll = !!o.sepia;
      this.comicBg = o.bg || null;
      document.getElementById('cmTitle').textContent = title;
      this.g.setState('comic'); UI.setLang(UI.lang);
      this.showPanel();
    }
    showPanel() {
      const p = this.panels[0], isAr = UI.lang === 'ar';
      const el = document.getElementById('cmPanel');
      el.className = 'cm-panel' + (p.who === 'jiddo' || this.sepiaAll ? ' sepia' : '');
      el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
      el.innerHTML = `<div class="cm-scene" style="${this.comicBg ? '--cbg:' + this.comicBg : ''}">${p.scene ? `<span class="cm-emoji">${p.scene}</span>` : ''}${face(p.who, p.mood)}</div>
        <div class="cm-cap"><b>${this.who(p.who)}</b>${isAr ? p.ar : p.en}</div>`;
      const idx = this.panelN - this.panels.length;
      document.getElementById('cmDots').innerHTML = Array.from({ length: this.panelN }, (_, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('');
      document.getElementById('cmNext').textContent = this.panels.length === 1 ? UI.t('start') : UI.t('next');
      VR.Audio.play(p.who === 'goat' ? 'baa' : 'whoosh');
    }
    nextPanel() {
      if (!this.panels || !this.panels.length) return;
      this.panels.shift();
      if (this.panels.length) this.showPanel();
      else { const f = this.afterComic; this.afterComic = null; if (f) f(); }
    }

    // ------------------------------------------------------------ dialogue then the run
    pick(i) {
      const lv = LEVELS[i], ch = CHAPTERS[lv.ch - 1];
      this.level = lv;
      const talk = () => { this.lines = lv.intro.slice(); this.afterDialog = () => this.play(lv); this.g.setState('dialog'); this.showLine(); };
      if (!this.save.seen['c' + ch.n]) {
        this.save.seen['c' + ch.n] = 1; this.persist();
        this.comic(ch.intro, `${ch.e} ${UI.t('chapter')} ${ch.n} · ${this.tr(ch)}`, talk, { bg: chBg(ch) });
      } else talk();
    }
    showLine() {
      const l = this.lines[0], isAr = UI.lang === 'ar';
      const f = document.getElementById('dlgFace');
      f.innerHTML = face(l.who, l.mood); f.style.animation = 'none'; void f.offsetWidth; f.style.animation = '';
      document.getElementById('dlgWho').textContent = this.who(l.who);
      document.getElementById('dlgText').textContent = isAr ? l.ar : l.en;
      const last = this.lines.length === 1;
      document.getElementById('dlgGoal').textContent = last ? '🎯 ' + this.objText(this.level.obj) + ' · ' + UI.fmt(this.level.goal) + ' ' + UI.t('m2') : '';
      document.getElementById('dlgNext').textContent = last ? UI.t('start') : UI.t('next');
      VR.Audio.play(l.who === 'goat' ? 'baa' : 'click');
    }
    nextLine() {
      this.lines.shift();
      if (this.lines.length) this.showLine();
      else { const f = this.afterDialog; this.afterDialog = null; if (f) f(); }
    }
    play(lv) {
      this.level = lv;
      this.g.start({ mode: 'story', level: lv.id, seed: lv.seed, biomes: lv.biomes, styles: lv.styles, forks: false, weather: lv.weather,
        thief: lv.thief || lv.ally, thiefSkin: lv.thiefSkin, thiefMode: lv.ally ? 'ally' : null, lemonMul: lv.lemonMul });
    }

    // ------------------------------------------------------------ the run
    runStart(opts) {
      this.active = opts.mode === 'story';
      this.hideRadio(); this.bossEl.hidden = true; this.dozer.visible = false;
      if (!this.active) return;
      this.level = LEVELS.find(l => l.id === opts.level);
      const lv = this.level, [base, ramp] = lv.diff;
      this.g.diffFn = (d) => Math.min(0.95, base + d / ramp * 0.5);
      this.caught = false; this.gatePlaced = false; this.done = false;
      this.evs = (lv.ev || []).slice().sort((a, b) => a[0] - b[0]);
      this.radioQ = []; this.radioT = 0;
      this.letterObj = null; this.letterPlaced = !lv.letter; this.letterGot = false;
      this.dz = lv.boss === 'dozer' ? { gap: 13, on: false, lunges: 0, st: 0, t: 0, horn: 0, dust: 0, revived: false, warned: false } : null;
      if (this.dz) { this.bossEl.hidden = false; this.bossEl.querySelector('em').textContent = UI.t('dozer'); this.bossEl.querySelector('b').style.width = '0%'; }
      UI.toast(this.tr(lv) + ' · ' + this.objText(lv.obj), 2200, true);
    }
    leaveRun() { this.active = false; this.hideRadio(); this.bossEl.hidden = true; this.dozer.visible = false; }
    runEnd() { this.bossEl.hidden = true; }
    thiefCaught() { this.caught = true; }
    shift() { /* the letter and gate live in chunk.extras, which the world shifts for us */ }

    chunk(chunk) {
      if (!this.active) return;
      const g = this.g, lv = this.level;
      const zOf = (m) => g.player.z - (m - g.distance);
      const inChunk = (z) => z <= chunk.z0 && z > chunk.z0 - C.CHUNK_LENGTH;
      if (!this.gatePlaced) {
        const zGoal = zOf(lv.goal);
        if (inChunk(zGoal)) {
          const gate = finishGate(UI.lang === 'ar'); gate.position.set(0, 0, zGoal);
          g.scene.add(gate); (chunk.extras || (chunk.extras = [])).push(gate);
          this.gatePlaced = true;
        }
      }
      if (!this.letterPlaced) {
        const zL = zOf(lv.letter);
        if (inChunk(zL)) {
          this.letterPlaced = true;
          // the free-est lane: no walls around it, no train rolling into it later; a parked train roof is fine
          let best = null;
          for (const lane of [0, -1, 1]) {
            let score = 0, h = 0;
            for (const o of g.world.obstacles) {
              if (o.lane !== lane) continue;
              if (o.moving && o.z - o.len < zL + 6 && o.z > zL - 160) { score += 1000; continue; }
              if (o.z - o.len - 2 < zL && o.z + 2 > zL && !o.standable && !o.ramp) score += 100;
            }
            h = g.world.surfaceAt(lane * LW, zL, 99, 0.3).h; score += h;
            if (!best || score < best.score) best = { lane, score, h };
          }
          const L = buildLetter(); L.position.set(best.lane * LW, best.h + 1.25, zL);
          L.userData.baseY = best.h + 1.25;
          g.scene.add(L); (chunk.extras || (chunk.extras = [])).push(L);
          this.letterObj = L;
        }
      }
    }

    update(dt) {
      if (!this.active || this.done) return;
      const g = this.g, p = g.player, lv = this.level;
      // radio calls
      while (this.evs.length && g.distance >= this.evs[0][0]) {
        const [, line, fx] = this.evs.shift();
        this.radioQ.push(line);
        if (fx === 'sandstorm' && g.S.weather) { g.S.weather.forced = 'sandstorm'; g.S.weather.start('sandstorm'); }
      }
      this.updateRadio(dt);
      // Grandpa's letter
      const L = this.letterObj;
      if (L && !this.letterGot && L.parent) {
        const U = L.userData, t = g.elapsed || 0;
        U.spin.rotation.y += dt * 2.2; U.halo.rotation.z += dt * 1.4;
        L.position.y = U.baseY + Math.sin(t * 3) * 0.12;
        U.glow.lookAt(g.camera.position);
        const mag = g.powerups && g.powerups.active && g.powerups.active('magnet');
        const dz = p.z - L.position.z, dx = p.x - L.position.x, dy = p.y + 0.9 - L.position.y;
        if (mag && dz > -1 && dz < 14) { L.position.x += dx * Math.min(1, dt * 6); L.position.z += dz * Math.min(1, dt * 6); U.baseY += dy * Math.min(1, dt * 6); }
        if (Math.abs(dz) < 1.3 && Math.abs(dx) < 1.15 && Math.abs(dy) < 1.7) this.takeLetter();
      }
      if (this.dz) this.updateDozer(dt);
      if (g.distance >= lv.goal) this.finish();
    }
    takeLetter() {
      const g = this.g, L = this.letterObj;
      this.letterGot = true; L.visible = false;
      g.fx.ring(L.position.x, L.position.y, L.position.z, 0xffd23f, 26, 6);
      g.fx.confetti(L.position.x, L.position.y, L.position.z, 50);
      VR.Audio.play('gem'); VR.Audio.play('ding'); g.vibrate(30);
      UI.toast(UI.t('letterFound'), 1800, true);
      this.newLetter = !this.save.letters[this.level.id];
      if (this.newLetter) { this.save.letters[this.level.id] = 1; this.persist(); }
    }

    // bulldozer chase: it creeps back when you run clean; a stumble makes it lunge,
    // and a stumble while it is still close means it catches you.
    updateDozer(dt) {
      const g = this.g, p = g.player, d = this.dz;
      d.t += dt;
      if (!d.on) { if (g.distance > 12) { d.on = true; d.gap = 4.5; d.st = g.stumbles; VR.Audio.play('trainHorn', { pan: 0 }); g.shake = Math.max(g.shake, 0.3); } else return; }
      if (g.revived && !d.revived) { d.revived = true; d.gap = 13; }
      if (g.stumbles > d.st) {
        d.st = g.stumbles;
        if (d.gap < 7.5) { this.caughtByDozer(); return; }
        d.gap = 4.6; d.lunges++;
        VR.Audio.play('trainHorn', { pan: 0 }); g.shake = Math.max(g.shake, 0.35);
        UI.toast(UI.t('dozerLunge'), 1100);
      }
      d.gap = Math.min(13, d.gap + dt * 0.95);
      const vis = d.gap < 7.4 && g.state === 'playing';
      this.dozer.visible = vis;
      if (vis) {
        const z = p.z + d.gap;
        this.dozer.position.x += (p.x - this.dozer.position.x) * Math.min(1, dt * 2.5);
        this.dozer.position.set(this.dozer.position.x, 0, z);
        const U = this.dozer.userData;
        U.body.position.y = Math.abs(Math.sin(d.t * 18)) * 0.05; U.body.rotation.x = Math.sin(d.t * 9) * 0.015;
        d.dust -= dt;
        if (d.dust <= 0) { d.dust = 0.08; g.fx.dust(this.dozer.position.x + (Math.random() - 0.5) * 2.4, 0.2, z - 1.7, 3, 0xcbb89a, 1.3); }
        if (d.gap < 6) g.shake = Math.max(g.shake, 0.06);
        d.horn -= dt;
        if (d.gap < 5.5 && d.horn <= 0) { d.horn = 3.5; VR.Audio.play('trainHorn', { pan: 0 }); }
      }
      const threat = Math.max(0, Math.min(1, (13 - d.gap) / (13 - 4.5)));
      this.bossEl.querySelector('b').style.width = (threat * 100).toFixed(1) + '%';
      this.bossEl.classList.toggle('hot', d.gap < 7.5);
      if (d.gap < 7.5 && !d.warned) { d.warned = true; UI.toast(UI.t('dozerNear'), 1200); }
      if (d.gap >= 9) d.warned = false;
    }
    caughtByDozer() {
      const g = this.g;
      this.dz.caught = true; this.dz.gap = 2;
      this.dozer.position.z = g.player.z + 2; this.dozer.visible = true;
      UI.toast(UI.t('caughtByDozer'), 1600, true);
      g.gameOver();
    }

    // ------------------------------------------------------------ radio bubble
    updateRadio(dt) {
      if (this.radioT > 0) { this.radioT -= dt; if (this.radioT <= 0) this.hideRadio(); return; }
      if (!this.radioQ.length) return;
      const l = this.radioQ.shift(), isAr = UI.lang === 'ar', el = this.radioEl;
      el.className = 'radio on ' + l.who; el.dir = isAr ? 'rtl' : 'ltr';
      el.querySelector('.rd-face').innerHTML = face(l.who, l.mood);
      el.querySelector('b').textContent = this.who(l.who);
      el.querySelector('p').textContent = isAr ? l.ar : l.en;
      this.radioT = Math.max(3.2, (isAr ? l.ar : l.en).length * 0.065);
      VR.Audio.play(l.who === 'goat' ? 'baa' : 'tick');
    }
    hideRadio() { if (this.radioEl) this.radioEl.className = 'radio'; this.radioT = 0; }

    // ------------------------------------------------------------ results
    objDone() {
      const o = this.level.obj, g = this.g;
      if (!o) return true;
      switch (o.type) {
        case 'lemons': return g.lemonsRun >= o.n;
        case 'coins': return g.coins >= o.n;
        case 'thief': case 'drone': return this.caught;
        case 'dozer': return !!this.dz && this.dz.lunges === 0 && !this.dz.caught;
        case 'flawless': return g.stumbles === 0 && !g.revived;
      }
      return true;
    }
    finish() {
      const g = this.g, lv = this.level, isAr = UI.lang === 'ar';
      this.done = true; this.hideRadio(); this.dozer.visible = false; this.bossEl.hidden = true;
      // on 'flawless' levels the third star is Grandpa's letter instead
      const third = lv.obj.type === 'flawless' ? [this.letterGot, UI.t('objLetter')] : [g.stumbles === 0 && !g.revived, UI.t('objFlawless')];
      const got = [true, this.objDone(), third[0]];
      const stars = got.filter(Boolean).length;
      const prev = this.stars[lv.id] || 0;
      const reward = stars > prev ? Math.round(lv.reward * (stars - prev) / 3) : 0;
      if (stars > prev) { this.stars[lv.id] = stars; this.persist(); }
      g.bank += g.coins + reward; UI.store.set('bank', g.bank);
      g.missions.endRun({ dist: g.distance, coins: g.coins }); g.missions.bump('storyStars', Math.max(0, stars - prev));
      VR.Audio.jet(false); VR.Audio.play('fanfare'); VR.Audio.setMusicVolume(0.5);
      g.fx.confetti(g.player.x, g.player.y + 2, g.player.z, 140);
      this.finT = 0; this.fireT = 0;
      g.setState('levelDone');
      document.getElementById('ldStars').innerHTML = [0, 1, 2].map(i => `<span class="${i < stars ? 'on' : ''}" style="animation-delay:${0.15 + i * 0.25}s">★</span>`).join('');
      const rows = [[got[0], UI.t('objFinish')], [got[1], this.objText(lv.obj)], [got[2], third[1]]];
      document.getElementById('ldObjs').innerHTML = rows.map(([ok, t]) => `<div class="${ok ? 'ok' : ''}">${ok ? '✔' : '✖'} ${t}</div>`).join('');
      document.getElementById('ldReward').innerHTML = reward ? `+${UI.fmt(reward)} <svg class="coin" style="width:20px;height:20px;display:inline"><use href="#i-coin"/></svg>` : '';
      const o = lv.outro;
      document.getElementById('ldSay').innerHTML = `${face(o.who, o.mood)}<p><b>${this.who(o.who)}</b>${isAr ? o.ar : o.en}</p>`;
      document.getElementById('ldLetter').innerHTML = this.letterGot
        ? `<b>✉️ ${UI.t(this.newLetter ? 'letterNew' : 'letters')} · ${this.letterCount()}/16</b>${LETTERS[lv.id - 1][isAr ? 0 : 1]}` : '';
      document.getElementById('ldTease').innerHTML = lv.teaser ? `<b>${UI.t('nextTime')}</b> ${lv.teaser[isAr ? 0 : 1]}` : '';
      const last = LEVELS.indexOf(lv) === LEVELS.length - 1;
      document.getElementById('ldNext').innerHTML = last ? `<span>${UI.t('storyDone')}</span>` : `<svg><use href="#i-play"/></svg><span>${UI.t('nextLevel')}</span>`;
    }
    // after the results: chapter-ending comic (first time), the true ending (all 16 letters), then the next level
    afterLevel() {
      const lv = this.level, i = LEVELS.indexOf(lv), ch = CHAPTERS[lv.ch - 1];
      const chapterEnd = i === LEVELS.length - 1 || LEVELS[i + 1].ch !== lv.ch;
      const steps = [];
      if (chapterEnd && !this.save.seen['o' + ch.n]) steps.push(() => { this.save.seen['o' + ch.n] = 1; this.persist(); this.comic(ch.outro, `${ch.e} ${this.tr(ch)}`, next, { bg: chBg(ch) }); });
      if (this.letterCount() >= 16 && !this.save.seen.trueEnd) steps.push(() => { this.save.seen.trueEnd = 1; this.persist(); this.comic(TRUE_END, '🌱 ' + UI.t('trueEnd'), next, { sepia: true, bg: 'linear-gradient(160deg,#fff1d6,#e9c98f)' }); });
      steps.push(() => { if (i < LEVELS.length - 1) this.pick(i + 1); else { this.g.toMenu(); this.open(); } });
      const next = () => { const f = steps.shift(); if (f) f(); };
      if (steps.length > 1) this.g.toMenu();     // leave the run world before the comic
      next();
    }

    // victory lap: the hero slows down and cheers, the camera swings round to the front
    finishUpdate(dt) {
      const g = this.g, p = g.player;
      this.finT += dt; this.fireT -= dt;
      const t = this.finT;
      if (t < 1.2) { const v = g.speed * Math.max(0, 1 - t / 1.2); p.z -= v * dt; p.animate(dt, v, g); }
      else { if (!(p.cheer > 0) && (t % 2.4) < dt * 1.5) p.cheer = 1; p.animateIdle(dt, t, 0, 0); p.object.rotation.y = Math.PI; p.object.position.set(p.x, p.y, p.z); }
      if (this.fireT <= 0) { this.fireT = 0.5; g.fx.ring(p.x + (Math.random() - 0.5) * 8, 6 + Math.random() * 3, p.z - 8 - Math.random() * 6, [0xffd23f, 0xe8433a, 0x3ec1ff, 0x7bc86c][(Math.random() * 4) | 0], 28, 7); VR.Audio.play('pop', { pan: (Math.random() - 0.5) * 1.2 }); }
      const e = Math.min(1, t / 2.2), k = e * e * (3 - 2 * e);
      const ang = k * Math.PI * 0.85;
      const cam = g.camera.position;
      cam.lerp(g._v.set(p.x + Math.sin(ang) * 5.5, p.y + 2.1 - k * 0.6, p.z + Math.cos(ang) * 5.5), 1 - Math.exp(-dt * 3));
      g.camLook.lerp(g._v2.set(p.x, p.y + 1.1, p.z), 1 - Math.exp(-dt * 4));
      g.camera.lookAt(g.camLook);
      g.fx.update(dt); g.collect.update(dt, p, null);
    }
  }
  (VR.SYSTEMS = VR.SYSTEMS || []).push(Story);
})();

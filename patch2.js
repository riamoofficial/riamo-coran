const fs = require('fs');

// ---------- reciters.js : nouvelle liste ----------
const L = [
  ['khalil-didi', 'Khalil Didi', 'خليل ديدي', 'Contemporains', '🔥 Très écouté', ['ديدي']],
  ['omar-al-qazabri', 'Omar Al-Qazabri', 'عمر القزابري', 'Contemporains', '🔥 Très écouté', ['قزابري', 'كزابري', 'قزابرى']],
  ['laayoun-el-kouchi', 'Laayoun El Kouchi', 'العيون الكوشي', 'Contemporains', '🔥 Très écouté', ['كوشي']],
  ['younes-souilass', 'Younes Souilass', 'يونس اسويلص', 'Nouvelle génération', '🌟 Nouvelle voix', ['سويلص', 'سويلس']],
  ['hicham-el-haraz', 'Hicham El Haraz', 'هشام الهراز', 'Nouvelle génération', '🌟 Nouvelle voix', ['هراز']],
  ['mustapha-gharbi', 'Mustapha Gharbi', 'مصطفى غربي', 'Anciens Maîtres', '👑 Grand Maître', ['مصطفى غربي', 'مصطفى الغربي']],
  ['abdelhamid-hssain', 'Abdelhamid Hssain', 'عبد الحميد احساين', 'Anciens Maîtres', '👑 Grand Maître', ['احساين', 'حميد حسين', 'حميد احسين']],
  ['abderrahmane-benmoussa', 'Abderrahmane Benmoussa', 'عبد الرحمن بنموسى', 'Anciens Maîtres', '👑 Grand Maître', ['بنموسى', 'بن موسى']],
  ['mohamed-el-kantaoui', 'Mohamed El Kantaoui', 'محمد الكنتاوي', 'Anciens Maîtres', '👑 Grand Maître', ['كنتاوي']],
  ['mohamed-aljabery-al-heyani', 'Mohamed Aljabery Al Heyani', 'محمد الجابري الحياني', 'Anciens Maîtres', '👑 Grand Maître', ['حياني']],
  ['mohamed-al-tayeb-hamdan', 'Mohamed Al Tayeb Hamdan', 'محمد الطيب حمدان', 'Anciens Maîtres', '👑 Grand Maître', ['طيب حمدان', 'محمد حمدان']],
  ['abdelmoujib-benkirane', 'Abdelmoujib Benkirane', 'عبد المجيب بن كيران', 'Anciens Maîtres', '👑 Grand Maître', ['بن كيران', 'بنكيران']],
  ['mohamed-el-iraki', 'Mohamed El Iraki', 'محمد العراقي', 'Anciens Maîtres', '👑 Grand Maître', ['محمد العراقي']],
  ['abdelkabir-el-hadidi', 'Abdelkabir El Hadidi', 'عبد الكبير الحديدي', 'Contemporains', '🎙️ Warsh', ['كبير حديدي', 'كبير حداوي', 'حديدي', 'حداوي']],
  ['rachid-belalya', 'Rachid Belaachya', 'رشيد بلعشية', 'Contemporains', '🎙️ Warsh', ['رشيد بلعشية', 'رشيد بلعالية', 'رشيد بلعالي']],
  ['samir-belaachya', 'Samir Belaachya', 'سمير بلعشية', 'Contemporains', '🎙️ Warsh', ['سمير بلعشية', 'سمير بلعالية']],
  ['youssef-edghouch', 'Youssef Edghouch', 'يوسف الدغوش', 'Contemporains', '🎙️ Warsh', ['يوسف دغوش']],
  ['abdelkarim-edghouch', 'Abdelkarim Edghouch', 'عبد الكريم الدغوش', 'Contemporains', '🎙️ Warsh', ['كريم دغوش']],
  ['mohamed-sayed', 'Mohamed Sayed', 'محمد سايد', 'Contemporains', '🎙️ Warsh', ['محمد سايد']],
  ['mohamed-el-iraoui', 'Mohamed El Iraoui', 'محمد الإيراوي', 'Contemporains', '🎙️ Warsh', ['محمد ايراوي', 'محمد عراوي']],
  ['hassan-el-fadili', 'Hassan El Fadili', 'حسن الفاضلي', 'Contemporains', '🎙️ Warsh', ['حسن فاضلي']],
  ['taoufik-nouri', 'Taoufik Nouri', 'توفيق النوري', 'Contemporains', '🎙️ Warsh', ['توفيق نوري']],
  ['abdulaziz-al-karrani', 'Abdulaziz Al-Karrani', 'عبد العزيز الكراني', 'Contemporains', '🎙️ Warsh', ['كراني']],
  ['hamza-boudib', 'Hamza Boudib', 'حمزة بوديب', 'Nouvelle génération', '🌟 Nouvelle voix', ['حمزة بوديب']],
  ['anas-bourak', 'Anas Bourak', 'أنس براق', 'Nouvelle génération', '🌟 Nouvelle voix', ['انس براق']],
  ['ilyas-hajri', 'Ilyas Hajri', 'إلياس حجري', 'Nouvelle génération', '🌟 Nouvelle voix', ['الياس حجري']],
  ['mouad-el-kholti', 'Mouad El Kholti', 'معاذ الخلطي', 'Nouvelle génération', '🌟 Nouvelle voix', ['معاذ خلطي']],
  ['jaafar-al-saadi', 'Jaafar Al Saadi', 'جعفر السعدي', 'Nouvelle génération', '🌟 Nouvelle voix', ['جعفر سعدي']],
  ['abdulaziz-al-qwry', 'Abdul-Aziz Al-Qwry', 'عبد العزيز القوري', 'Nouvelle génération', '🌟 Nouvelle voix', ['عزيز قوري']],
  ['abdelmoughit-maarouf', 'Abdelmoughit Maarouf', 'عبد المغيث معروف', 'Nouvelle génération', '🌟 Nouvelle voix', ['مغيث معروف', 'عبد المغيث']],
  ['abdeladim-ikhribich', 'Abdeladim Ikhribich', 'عبد العظيم اخريبش', 'Nouvelle génération', '🌟 Nouvelle voix', ['اخريبش']],
];

let r = fs.readFileSync('reciters.js', 'utf8');
fs.writeFileSync('reciters.js.bak2', r);
const list =
  'export const MAROC_RECITERS = [\n' +
  L.map((x) => '  ' + JSON.stringify({ id: x[0], name: x[1], arabicName: x[2], category: x[3], tag: x[4], keywords: x[5], server: null, image: null })).join(',\n') +
  ',\n];';
const r2 = r.replace(/export const MAROC_RECITERS = \[[\s\S]*?\n\];/, () => list);
console.log(r2 === r ? 'NON TROUVE' : 'OK        ', 'liste de ' + L.length + ' récitateurs');
fs.writeFileSync('reciters.js', r2);

// ---------- App.js ----------
let s = fs.readFileSync('App.js', 'utf8');
fs.writeFileSync('App.js.bak2', s);
function rep(find, to, label) {
  const before = s;
  s = s.replace(find, () => to);
  console.log(before === s ? 'NON TROUVE' : 'OK        ', label);
}

rep(/const CATEGORIES = \[[^\]]*\];/,
    "const CATEGORIES = ['Tous', 'Anciens Maîtres', 'Contemporains', 'Nouvelle génération'];",
    'catégories');

rep('async function loadReciters() {',
`const tokMatch = (name, kw) => {
  const n = norm(name);
  return norm(kw).split(' ').filter(Boolean).every((t) => n.includes(t));
};
async function loadReciters() {`, 'reconnaissance des noms (1/2)');

rep('warsh.find((w) => def.keywords.some((k) => norm(w.apiName).includes(norm(k))));',
    'warsh.find((w) => !used.has(w.apiName) && def.keywords.some((k) => tokMatch(w.apiName, k)));',
    'reconnaissance des noms (2/2)');

rep('function Player({ now, status, loading, onToggle, onNext, onPrev, onSeek }) {',
    'function Player({ now, status, loading, onToggle, onNext, onPrev, onSeek, onStop }) {',
    'lecteur : paramètre');

rep('<TouchableOpacity onPress={onNext} style={styles.ctrl}><Text style={styles.ctrlTxt}>⏭</Text></TouchableOpacity>',
    '<TouchableOpacity onPress={onNext} style={styles.ctrl}><Text style={styles.ctrlTxt}>⏭</Text></TouchableOpacity>\n        <TouchableOpacity onPress={onStop} style={styles.ctrl}><Text style={[styles.ctrlTxt, { color: COLORS.danger }]}>✕</Text></TouchableOpacity>',
    'lecteur : bouton ✕');

rep('const toggle = () => {',
`const stopAll = () => {
    tokenRef.current++;
    if (soundRef.current) {
      try { soundRef.current.pause(); soundRef.current.remove(); } catch (e) {}
      soundRef.current = null;
    }
    nowRef.current = null;
    setNow(null);
    setStatus(null);
    setLoadingAudio(false);
  };
  const toggle = () => {`, 'fonction arrêter');

rep('onSeek={seek} />', 'onSeek={seek} onStop={stopAll} />', 'lecteur : branchement');

fs.writeFileSync('App.js', s);

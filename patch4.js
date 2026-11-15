const fs = require('fs');

if (!fs.existsSync('custom.js')) {
  fs.writeFileSync('custom.js', `// Récitateurs hors MP3Quran.
// server  = adresse du dossier qui contient les fichiers (finit par /)
// pattern = nom des fichiers : {nnn} = 001, {n} = 1
// surahs  = null si les 114 sourates existent, sinon la liste des numéros disponibles
export default [
  // {
  //   id: 'khalil-didi', name: 'Khalil Didi', arabicName: 'خليل ديدي',
  //   category: 'Contemporains', tag: '🔥 Très écouté',
  //   server: 'https://archive.org/download/IDENTIFIANT/',
  //   pattern: '{nnn}.mp3', surahs: null, image: null,
  // },
];
`);
  console.log('OK         custom.js créé');
} else console.log('déjà       custom.js existe');

let s = fs.readFileSync('App.js', 'utf8');
fs.writeFileSync('App.js.bak4', s);
function rep(find, to, label) {
  const before = s;
  s = s.replace(find, () => to);
  console.log(before === s ? 'NON TROUVE' : 'OK        ', label);
}

rep("import { MAROC_RECITERS, SURAHS } from './reciters';",
    "import { MAROC_RECITERS, SURAHS } from './reciters';\nimport CUSTOM from './custom';",
    'import de custom.js');

rep('return { maroc, others };',
    'return { maroc: [...CUSTOM.map((c) => ({ ...c, image: c.image || PHOTOS[c.id] || null })), ...maroc], others };',
    'liste personnalisée');

rep("const uri = reciter.server + String(surah.number).padStart(3, '0') + '.mp3';",
    "const uri = reciter.pattern ? reciter.server + reciter.pattern.replace('{nnn}', String(surah.number).padStart(3, '0')).replace('{n}', String(surah.number)) : reciter.server + String(surah.number).padStart(3, '0') + '.mp3';",
    'adresse avec modèle de nom');

fs.writeFileSync('App.js', s);

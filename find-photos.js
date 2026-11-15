const people = [
  ['khalil-didi', 'خليل ديدي', 'ديدي'],
  ['omar-al-qazabri', 'عمر القزابري', 'قزابري'],
  ['laayoun-el-kouchi', 'العيون الكوشي', 'كوشي'],
  ['younes-souilass', 'يونس اسويلص', 'سويلص'],
  ['abderrahmane-benmoussa', 'عبد الرحمن بنموسى', 'بنموسى'],
  ['rachid-belalya', 'رشيد بلعالية', 'بلعالي'],
  ['abdelkebir-el-hadaoui', 'عبد الكبير الحداوي', 'حداوي'],
  ['hicham-el-haraz', 'هشام الهراز', 'هراز'],
  ['mustapha-gharbi', 'مصطفى غربي', 'غربي'],
  ['abdulaziz-al-karrani', 'عبد العزيز الكراني', 'كراني'],
  ['abdelhamid-hssain', 'عبد الحميد حسين', 'حميد حسين'],
  ['mohamed-aljabery-al-heyani', 'محمد الجابري الحياني', 'حياني'],
  ['mohamed-el-kantaoui', 'محمد الكنتاوي', 'كنتاوي'],
  ['mohamed-el-iraki', 'محمد العراقي', 'محمد العراقي'],
];

const norm = (s) =>
  String(s).replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

async function find(name, kw) {
  const url =
    'https://ar.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' +
    encodeURIComponent(name) +
    '&gsrlimit=5&prop=pageimages&piprop=thumbnail&pithumbsize=500&format=json';
  const r = await fetch(url, { headers: { 'User-Agent': 'RiamoQuranApp/1.0' } });
  const j = await r.json();
  const pages = Object.values((j.query && j.query.pages) || {});
  for (const p of pages) {
    if (p.thumbnail && norm(p.title).includes(norm(kw))) return { title: p.title, src: p.thumbnail.source };
  }
  return null;
}

(async () => {
  const out = {};
  for (const [id, ar, kw] of people) {
    let hit = null;
    try { hit = await find(ar, kw); } catch (e) {}
    if (hit) { out[id] = hit.src; console.log('OK  ', id, '->', hit.title); }
    else console.log('--  ', id, ': pas de photo trouvée');
  }
  require('fs').writeFileSync('photos.js', 'export default ' + JSON.stringify(out, null, 2) + ';\n');
  console.log('\nphotos.js créé.');
})();

const fs = require('fs');
const H = { headers: { 'User-Agent': 'RiamoQuranApp/1.0' } };
const norm = (s) => String(s).replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
const has = (title, alts) => { const t = norm(title); return alts.some((a) => t.includes(norm(a))); };
const getJSON = async (u) => (await fetch(u, H)).json();

const P = [
  ['khalil-didi', 'خليل ديدي', 'Khalil Didi', ['ديدي', 'didi']],
  ['omar-al-qazabri', 'عمر القزابري', 'Omar Al Kazabri', ['القزابري', 'kazabri', 'qazabri']],
  ['laayoun-el-kouchi', 'العيون الكوشي', 'Laayoun El Kouchi', ['الكوشي', 'kouchi', 'koushi']],
  ['younes-souilass', 'يونس اسويلص', 'Younes Souilass', ['اسويلص', 'souilass', 'souilas']],
  ['hicham-el-haraz', 'هشام الهراز', 'Hicham El Haraz', ['الهراز', 'haraz']],
  ['mustapha-gharbi', 'مصطفى غربي', 'Mustapha Gharbi', ['مصطفى غربي', 'mustapha gharbi', 'moustapha gharbi']],
  ['abdelhamid-hssain', 'عبد الحميد احساين', 'Abdelhamid Hssain', ['احساين', 'hssain', 'hsain']],
  ['abderrahmane-benmoussa', 'عبد الرحمن بنموسى', 'Abderrahmane Benmoussa', ['بنموسى', 'benmoussa']],
  ['mohamed-el-kantaoui', 'محمد الكنتاوي', 'Mohamed El Kantaoui', ['الكنتاوي', 'kantaoui']],
  ['mohamed-aljabery-al-heyani', 'محمد الجابري الحياني', 'Mohamed Al Jabery Al Heyani', ['الحياني', 'heyani']],
  ['mohamed-al-tayeb-hamdan', 'محمد الطيب حمدان', 'Mohamed Al Tayeb Hamdan', ['الطيب حمدان', 'tayeb hamdan']],
  ['abdelmoujib-benkirane', 'عبد المجيب بن كيران', 'Abdelmoujib Benkirane', ['المجيب بن كيران', 'abdelmoujib benkirane', 'abdelmajid benkirane']],
  ['mohamed-el-iraki', 'محمد العراقي', 'Mohamed El Iraki', ['محمد العراقي', 'mohamed el iraki']],
  ['abdelkabir-el-hadidi', 'عبد الكبير الحديدي', 'Abdelkabir El Hadidi', ['الكبير الحديدي', 'kabir el hadidi', 'kebir el hadidi', 'الكبير الحداوي']],
  ['rachid-belalya', 'رشيد بلعشية', 'Rachid Belaachya', ['رشيد بلعشية', 'rachid belaachya', 'rachid belalya']],
  ['samir-belaachya', 'سمير بلعشية', 'Samir Belaachya', ['سمير بلعشية', 'samir belaachya']],
  ['youssef-edghouch', 'يوسف الدغوش', 'Youssef Edghouch', ['يوسف الدغوش', 'youssef edghouch', 'youssef daghouch']],
  ['abdelkarim-edghouch', 'عبد الكريم الدغوش', 'Abdelkarim Edghouch', ['عبد الكريم الدغوش', 'abdelkarim edghouch', 'abdelkrim edghouch']],
  ['mohamed-sayed', 'محمد سايد', 'Mohamed Sayed', ['محمد سايد']],
  ['mohamed-el-iraoui', 'محمد الإيراوي', 'Mohamed El Iraoui', ['محمد الايراوي', 'el iraoui']],
  ['hassan-el-fadili', 'حسن الفاضلي', 'Hassan El Fadili', ['حسن الفاضلي', 'hassan el fadili']],
  ['taoufik-nouri', 'توفيق النوري', 'Taoufik Nouri', ['توفيق النوري', 'taoufik nouri']],
  ['abdulaziz-al-karrani', 'عبد العزيز الكراني', 'Abdelaziz Al Karrani', ['الكراني', 'karrani']],
  ['hamza-boudib', 'حمزة بوديب', 'Hamza Boudib', ['بوديب', 'boudib']],
  ['anas-bourak', 'أنس براق', 'Anas Bourak', ['انس براق', 'anas bourak']],
  ['ilyas-hajri', 'إلياس حجري', 'Ilyas Hajri', ['الياس حجري', 'ilyas hajri', 'elias hajri']],
  ['mouad-el-kholti', 'معاذ الخلطي', 'Mouad El Kholti', ['معاذ الخلطي', 'mouad el kholti']],
  ['jaafar-al-saadi', 'جعفر السعدي', 'Jaafar Al Saadi', ['جعفر السعدي', 'jaafar al saadi']],
  ['abdulaziz-al-qwry', 'عبد العزيز القوري', 'Abdelaziz Al Qwry', ['عبد العزيز القوري', 'abdelaziz al qwry']],
  ['abdelmoughit-maarouf', 'عبد المغيث معروف', 'Abdelmoughit Maarouf', ['المغيث معروف', 'abdelmoughit maarouf']],
  ['abdeladim-ikhribich', 'عبد العظيم اخريبش', 'Abdeladim Ikhribich', ['اخريبش', 'ikhribich']],
];

async function commons(q, alts) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=' + encodeURIComponent(q) +
    '&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=500&format=json';
  const j = await getJSON(u);
  for (const p of Object.values((j.query && j.query.pages) || {})) {
    const ii = p.imageinfo && p.imageinfo[0];
    if (ii && /\.(jpe?g|png|webp)$/i.test(p.title) && has(p.title, alts)) {
      const m = ii.extmetadata || {};
      return { src: ii.thumburl || ii.url, from: 'commons: ' + p.title, page: ii.descriptionurl, license: (m.LicenseShortName && m.LicenseShortName.value) || 'inconnue' };
    }
  }
  return null;
}

async function wiki(lang, q, alts) {
  const u = 'https://' + lang + '.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(q) +
    '&gsrlimit=5&prop=pageimages&piprop=thumbnail&pithumbsize=500&format=json';
  const j = await getJSON(u);
  for (const p of Object.values((j.query && j.query.pages) || {})) {
    if (p.thumbnail && has(p.title, alts)) {
      return { src: p.thumbnail.source, from: lang + '.wikipedia: ' + p.title, page: 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(p.title.replace(/ /g, '_')), license: 'à vérifier sur la page' };
    }
  }
  return null;
}

(async () => {
  let out = {};
  try { out = JSON.parse(fs.readFileSync('photos.js', 'utf8').replace(/^export default /, '').replace(/;\s*$/, '')); } catch (e) {}
  const notes = [];
  for (const [id, ar, lat, alts] of P) {
    if (out[id]) { console.log('déjà  ', id); continue; }
    const tries = [() => commons(lat, alts), () => commons(ar, alts), () => wiki('ar', ar, alts), () => wiki('en', lat, alts), () => wiki('fr', lat, alts)];
    let hit = null;
    for (const t of tries) { try { hit = await t(); } catch (e) {} if (hit) break; }
    if (hit) {
      out[id] = hit.src;
      console.log('OK    ', id, '|', hit.from, '|', hit.license);
      notes.push(id + ' | ' + hit.src + ' | ' + hit.page + ' | licence: ' + hit.license);
    } else console.log('--    ', id, ': rien trouvé');
  }
  fs.writeFileSync('photos.js', 'export default ' + JSON.stringify(out, null, 2) + ';\n');
  fs.writeFileSync('photos-sources.txt', notes.join('\n') + '\n');
  console.log('\nphotos.js et photos-sources.txt mis à jour.');
})();

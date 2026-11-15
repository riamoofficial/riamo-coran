const fs = require('fs');
const [item, rid, name, ar, cat, tag] = process.argv.slice(2);
if (!item || !rid) {
  console.log('Usage: node archive2custom.js IDENTIFIANT id-recitateur "Nom" "Nom arabe" "Catégorie" "Étiquette"');
  process.exit(1);
}
(async () => {
  const j = await (await fetch('https://archive.org/metadata/' + item)).json();
  let mp3 = (j.files || []).filter((f) => /\.mp3$/i.test(f.name));
  const orig = mp3.filter((f) => f.source === 'original');
  if (orig.length) mp3 = orig;
  console.log('Fichiers mp3 trouvés :', mp3.length);
  if (!mp3.length) { console.log('Rien trouvé : vérifie l\'identifiant.'); process.exit(1); }
  const pick = (mode) => {
    const map = {}; let dup = 0;
    for (const f of mp3) {
      const base = f.name.split('/').pop().replace(/\.mp3$/i, '');
      const nums = (base.match(/\d+/g) || []).map((x) => parseInt(x, 10)).filter((x) => x >= 1 && x <= 114);
      if (!nums.length) continue;
      const n = mode === 'first' ? nums[0] : nums[nums.length - 1];
      if (map[n]) dup++; else map[n] = f.name;
    }
    return { map, dup, count: Object.keys(map).length };
  };
  const a = pick('first'), b = pick('last');
  const best = (b.count - b.dup * 2) > (a.count - a.dup * 2) ? b : a;
  const nums = Object.keys(best.map).map(Number).sort((x, y) => x - y);
  const missing = []; for (let i = 1; i <= 114; i++) if (!best.map[i]) missing.push(i);
  console.log('Sourates reconnues :', nums.length, '/ 114', best.dup ? '(doublons : ' + best.dup + ')' : '');
  if (missing.length) console.log('Manquantes :', missing.join(', '));
  [1, 2, 114].forEach((n) => { if (best.map[n]) console.log('  ' + n + ' ->', best.map[n]); });
  const entry = {
    id: rid, name: name || rid, arabicName: ar || '', category: cat || 'Contemporains', tag: tag || '🎙️ Warsh',
    server: 'https://archive.org/download/' + item + '/', files: best.map,
    surahs: nums.length === 114 ? null : nums, image: null,
  };
  let all = [];
  try { all = JSON.parse(fs.readFileSync('custom-data.json', 'utf8')); } catch (e) {}
  all = all.filter((x) => x.id !== rid); all.unshift(entry);
  fs.writeFileSync('custom-data.json', JSON.stringify(all, null, 2));
  fs.writeFileSync('custom.js', "import data from './custom-data.json';\nexport default data;\n");
  console.log('OK : ' + rid + ' ajouté. Appuie sur r dans le serveur Expo.');
})();

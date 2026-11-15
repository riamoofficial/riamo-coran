const fs = require('fs');
const norm = (s) => String(s).replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
const tok = (name, kw) => { const n = norm(name); return norm(kw).split(' ').filter(Boolean).every((t) => n.includes(t)); };
const count = (mo) => String(mo.surah_list || '').split(',').filter(Boolean).length;
const isW = (mo) => norm(mo.name).includes('ورش');

(async () => {
  const src = fs.readFileSync('reciters.js', 'utf8');
  const m = src.match(/export const MAROC_RECITERS = (\[[\s\S]*?\n\]);/);
  const defs = JSON.parse(m[1].replace(/,\s*\]$/, ']'));
  const json = await (await fetch('https://mp3quran.net/api/v3/reciters?language=ar')).json();
  const all = json.reciters || [];

  let ok = 0;
  const used = new Set();
  for (const d of defs) {
    const hits = all.filter((r) => d.keywords.some((k) => tok(r.name, k)));
    const good = hits.find((r) => (r.moshaf || []).some((mo) => isW(mo) && count(mo) >= 114));
    if (good) { ok++; used.add(good.name); continue; }
    if (!hits.length) { console.log('X introuvable :', d.id); continue; }
    console.log('! trouvé mais pas Warsh complet :', d.id);
    for (const r of hits.slice(0, 2)) {
      console.log('   nom API :', r.name);
      for (const mo of (r.moshaf || []).slice(0, 4)) console.log('     -', mo.name, '(' + count(mo) + ' sourates)');
    }
  }
  console.log('\nOK :', ok, 'sur', defs.length);

  const warsh = all.filter((r) => (r.moshaf || []).some((mo) => isW(mo) && count(mo) >= 114)).map((r) => r.name);
  fs.writeFileSync('warsh-api.txt', warsh.join('\n') + '\n');
  console.log('Récitateurs Warsh complets dans MP3Quran :', warsh.length, '(liste dans warsh-api.txt)');
})();

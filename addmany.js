const fs = require('fs');
const lines = fs.readFileSync(0, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const txt = fs.readFileSync('photos.js', 'utf8');
const obj = JSON.parse(txt.replace(/^export default /, '').replace(/;\s*$/, ''));
for (const l of lines) {
  const [id, url] = l.split(/\s+/);
  if (id && /^https?:\/\//.test(url || '')) { obj[id] = url; console.log('OK  ', id); }
  else console.log('--   ligne ignorée :', l);
}
fs.writeFileSync('photos.js', 'export default ' + JSON.stringify(obj, null, 2) + ';\n');

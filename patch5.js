const fs = require('fs');
let s = fs.readFileSync('App.js', 'utf8');
function rep(find, to, label) {
  const before = s;
  s = s.replace(find, () => to);
  console.log(before === s ? 'NON TROUVE' : 'OK        ', label);
}
rep('const buildUri = (reciter, surah) => {',
`const buildUri = (reciter, surah) => {
  if (reciter.files && reciter.files[surah.number]) {
    return reciter.server + String(reciter.files[surah.number]).split('/').map(encodeURIComponent).join('/');
  }`, 'fichiers nommés');
rep('return reciter.server + encodeURIComponent(file);',
    "return reciter.server + file.split('/').map(encodeURIComponent).join('/');", 'adresses avec dossiers');
fs.writeFileSync('App.js', s);

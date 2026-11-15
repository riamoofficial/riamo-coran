const fs = require('fs');
const [id, url] = process.argv.slice(2);
const txt = fs.readFileSync('photos.js', 'utf8');
const obj = JSON.parse(txt.replace(/^export default /, '').replace(/;\s*$/, ''));
obj[id] = url;
fs.writeFileSync('photos.js', 'export default ' + JSON.stringify(obj, null, 2) + ';\n');
console.log('OK', id);

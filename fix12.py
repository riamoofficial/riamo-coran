import os, re, json, subprocess, time, urllib.request, urllib.parse
os.chdir(os.path.expanduser('~/riamo-coran'))
def run(c, out=False):
    r = subprocess.run(c, shell=True, capture_output=out, text=True)
    return r.stdout if out else r.returncode
def watch(rid):
    return run('gh run watch %s --interval 30 --exit-status > /dev/null 2>&1' % rid)
def clean(l):
    return re.sub(r'^\S+Z\s', '', l.split('\t', 2)[-1])[:150]
def whatwrong(txt):
    ls = [clean(l) for l in txt.splitlines()]
    for i, l in enumerate(ls):
        if 'What went wrong' in l:
            for x in ls[i:i + 9]:
                if x.strip():
                    print('  >', x)
            return
    for x in ls[-6:]:
        print('  >', x)
def riamolog(cid):
    log = run('gh run view %s --log 2>&1' % cid, True)
    seen = []
    for l in log.splitlines():
        if 'RIAMOLOG:' in l:
            t = l.split('RIAMOLOG:', 1)[1].strip()
            if t and t not in seen and '$' not in t:
                seen.append(t)
    return seen
def ascii_only(s):
    return re.sub(r'[^\x00-\x7f]+', '<ar>', s)
def http(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return urllib.request.urlopen(req, timeout=40).read().decode('utf-8', 'replace')

print('=== 0. ATTENTE DE fix11 ===')
p = os.path.expanduser('~/fix11.txt')
for _ in range(90):
    if not os.path.exists(p) or '=== FIN ===' in open(p, errors='ignore').read():
        break
    if time.time() - os.path.getmtime(p) > 1500:
        break
    time.sleep(30)
run('git tag -f sauvegarde-avant-recitateur')
print('Pret')

print('=== 1. RECHERCHE DU DOSSIER ARCHIVE.ORG ===')
meta = None
ident = None
for n in range(4, 41):
    cand = 'z50928' + 'x' * n + 'aaa'
    try:
        m = json.loads(http('https://archive.org/metadata/' + cand))
        if m.get('files'):
            meta, ident = m, cand
            break
    except Exception:
        pass
if not meta:
    try:
        qs = urllib.parse.urlencode([('q', 'identifier:z50928*aaa'), ('fl[]', 'identifier'), ('rows', '5'), ('output', 'json')])
        docs = json.loads(http('https://archive.org/advancedsearch.php?' + qs))['response']['docs']
        if docs:
            ident = docs[0]['identifier']
            meta = json.loads(http('https://archive.org/metadata/' + urllib.parse.quote(ident)))
    except Exception as ex:
        print('Recherche impossible :', ascii_only(str(ex))[:90])
if not meta:
    print('ARRET : dossier introuvable ou archive.org injoignable. Rien modifie.')
    print('=== FIN ===')
    raise SystemExit
print('Dossier trouve, %d x dans le nom' % (len(ident) - 9))
md = meta.get('metadata', {})
print('Titre  :', str(md.get('title', ''))[:70])
print('Auteur :', str(md.get('creator', ''))[:70])
txt = ' '.join(str(md.get(k, '')) for k in ('title', 'creator', 'description', 'subject'))
print('Nom Al-Faqih dans la fiche :', 'OUI' if re.search(r'الفقيه|faq?ih|fakih', txt, re.I) else 'NON (verifie que c est le bon recitateur)')
suras = {}
for f in meta.get('files', []):
    nme = f.get('name', '')
    if nme.lower().endswith('.mp3') and 'spectrogram' not in nme.lower():
        mm = re.search(r'(?<!\d)(\d{3})(?!\d)', nme)
        if mm and 1 <= int(mm.group(1)) <= 114:
            suras.setdefault(int(mm.group(1)), nme)
print('Sourates trouvees : %d sur 114' % len(suras))
if len(suras) < 20:
    print('ARRET : trop peu de fichiers mp3. Rien modifie.')
    print('=== FIN ===')
    raise SystemExit
for k in (1, 2, 114):
    print('Exemple %d : %s' % (k, ascii_only(suras.get(k, '(absent)'))))
data = [{'id': 'faqih', 'name': 'محمد الفقيه', 'latin': 'Mohammed Al-Faqih', 'base': 'https://archive.org/download/%s/' % ident, 'files': {str(k): v for k, v in sorted(suras.items())}}]
open('extra-reciters.js', 'w', encoding='utf-8').write('module.exports = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n')
print('extra-reciters.js ecrit')

print('=== 2. ECRAN RECITATEURS + ===')
EXTRA = r"""import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const DATA = require('./extra-reciters');
const GOLD = '#d4af37';
const BG = '#0b0f14';
const CARD = '#141a22';

function suraName(file) {
  const m = String(file).match(/^\s*\d{1,3}\s*[-–_.]?\s*(.*?)\.mp3$/i);
  return m && m[1] ? m[1].trim() : '';
}
const pad = n => (n < 10 ? '00' : n < 100 ? '0' : '') + n;

export default function ExtraReciters({ onClose }) {
  const [rec, setRec] = useState(null);
  const [cur, setCur] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [msg, setMsg] = useState('');
  const playerRef = useRef(null);
  const subRef = useRef(null);
  const goRef = useRef(() => {});
  const nums = rec ? Object.keys(rec.files).map(Number).sort((a, b) => a - b) : [];

  const stop = () => {
    try { if (subRef.current) subRef.current.remove(); } catch (e) {}
    try { if (playerRef.current) { playerRef.current.pause(); playerRef.current.remove(); } } catch (e) {}
    subRef.current = null;
    playerRef.current = null;
    setCur(null);
    setPlaying(false);
  };

  const play = async (r, n) => {
    try {
      stop();
      setMsg('Connexion…');
      try { await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }); } catch (e) {}
      const url = r.base + encodeURIComponent(r.files[String(n)]);
      const p = createAudioPlayer({ uri: url });
      playerRef.current = p;
      subRef.current = p.addListener('playbackStatusUpdate', st => {
        if (!st) return;
        if (st.playing) setMsg('');
        setPlaying(!!st.playing);
        if (st.didJustFinish) goRef.current(1);
      });
      p.play();
      setCur(n);
      setPlaying(true);
      setTimeout(() => {
        if (playerRef.current === p && !p.playing && !p.isLoaded) setMsg('Ce fichier ne répond pas. Essaie une autre sourate.');
      }, 20000);
    } catch (e) {
      setMsg('Lecture impossible : ' + String(e && e.message ? e.message : e));
    }
  };

  goRef.current = d => {
    if (!rec || cur == null) return;
    const i = nums.indexOf(cur);
    const nx = nums[i + d];
    if (nx != null) play(rec, nx); else stop();
  };

  const toggle = () => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (p.playing) { p.pause(); setPlaying(false); } else { p.play(); setPlaying(true); }
    } catch (e) {}
  };

  useEffect(() => () => {
    try { if (subRef.current) subRef.current.remove(); } catch (e) {}
    try { if (playerRef.current) playerRef.current.remove(); } catch (e) {}
  }, []);

  const back = rec ? () => setRec(null) : () => { stop(); onClose(); };
  const circle = { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: GOLD, alignItems: 'center', justifyContent: 'center' };

  return (
    <View style={{ flex: 1, backgroundColor: BG, padding: 16, paddingTop: 50, paddingBottom: 56 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <TouchableOpacity onPress={back} style={circle}><Text style={{ color: GOLD, fontSize: 20 }}>←</Text></TouchableOpacity>
        <Text style={{ color: GOLD, fontSize: 20, fontWeight: 'bold', marginLeft: 14, flex: 1 }} numberOfLines={1}>
          {rec ? rec.name + ' · ' + rec.latin : 'Récitateurs +'}
        </Text>
      </View>
      {!rec ? (
        <FlatList data={DATA} keyExtractor={r => r.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setRec(item)}
              style={{ padding: 16, marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: GOLD, backgroundColor: CARD }}>
              <Text style={{ color: '#fff', fontSize: 22 }}>{item.name}</Text>
              <Text style={{ color: '#aaa', marginTop: 4 }}>{item.latin} · {Object.keys(item.files).length} sourates</Text>
            </TouchableOpacity>
          )} />
      ) : (
        <FlatList style={{ flex: 1 }} data={nums} keyExtractor={n => String(n)}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => play(rec, item)}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: cur === item ? GOLD : '#333', backgroundColor: cur === item ? '#1c242e' : CARD }}>
              <Text style={{ color: GOLD, width: 50, fontSize: 16 }}>{pad(item)}</Text>
              <Text style={{ color: '#fff', fontSize: 20, flex: 1 }}>{(cur === item ? '▶ ' : '') + suraName(rec.files[String(item)])}</Text>
            </TouchableOpacity>
          )} />
      )}
      {msg ? <Text style={{ color: '#fff', marginVertical: 8 }}>{msg}</Text> : null}
      {rec && cur != null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: GOLD, padding: 10, marginTop: 8 }}>
          <Text style={{ color: '#fff', flex: 1, fontSize: 16 }} numberOfLines={1}>{pad(cur) + '  ' + suraName(rec.files[String(cur)])}</Text>
          <TouchableOpacity onPress={() => goRef.current(-1)} style={{ padding: 10 }}><Text style={{ color: GOLD, fontSize: 22 }}>⏮</Text></TouchableOpacity>
          <TouchableOpacity onPress={toggle} style={{ padding: 10 }}><Text style={{ color: GOLD, fontSize: 24 }}>{playing ? '⏸' : '▶'}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goRef.current(1)} style={{ padding: 10 }}><Text style={{ color: GOLD, fontSize: 22 }}>⏭</Text></TouchableOpacity>
          <TouchableOpacity onPress={stop} style={{ padding: 10 }}><Text style={{ color: '#ff8a80', fontSize: 22 }}>⏹</Text></TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
"""
open('ExtraReciters.js', 'w', encoding='utf-8').write(EXTRA)
print('ExtraReciters.js ecrit')

s = open('App.js', encoding='utf-8').read()
if 'ExtraReciters' in s:
    print('App.js deja modifie')
else:
    reps = [
        ("if (name === 'prayer') return { C: require('./PrayerTimes').default };", "if (name === 'prayer') return { C: require('./PrayerTimes').default };\n    if (name === 'extra') return { C: require('./ExtraReciters').default };"),
        ("width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: GOLD, alignItems: 'center', justifyContent: 'center', marginLeft: 8 };", "width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: GOLD, alignItems: 'center', justifyContent: 'center', marginLeft: 6 };"),
        ("fontSize: 20, fontWeight: 'bold', marginLeft: 10, flex: 1 }}>RIAMO Coran</Text>", "fontSize: 17, fontWeight: 'bold', marginLeft: 10, flex: 1 }} numberOfLines={1}>RIAMO Coran</Text>"),
        ("<TouchableOpacity onPress={() => setPanel('radio')} style={circ}><Text style={{ fontSize: 20 }}>📻</Text></TouchableOpacity>", "<TouchableOpacity onPress={() => setPanel('radio')} style={circ}><Text style={{ fontSize: 20 }}>📻</Text></TouchableOpacity>\n        <TouchableOpacity onPress={() => setPanel('extra')} style={circ}><Text style={{ fontSize: 20 }}>🎙️</Text></TouchableOpacity>"),
    ]
    for old, new in reps:
        if s.count(old) != 1:
            print('ARRET : App.js ne correspond pas a ce que j attendais (', old[:50], '). Rien envoye.')
            print('=== FIN ===')
            raise SystemExit
        s = s.replace(old, new, 1)
    open('App.js', 'w', encoding='utf-8').write(s)
    print('App.js modifie (bouton 🎙️)')

print('=== 3. VERIFICATION DE LA SYNTAXE ===')
SYN = """const babel = require('@babel/core');
const fs = require('fs');
for (const f of ['App.js', 'ExtraReciters.js', 'extra-reciters.js']) {
  try {
    babel.transformSync(fs.readFileSync(f, 'utf8'), { filename: f, presets: [require.resolve('babel-preset-expo')], babelrc: false, configFile: false });
    console.log('OK ' + f);
  } catch (e) { console.log('ERR ' + f + ' ' + String(e.message).split('\\n')[0]); }
}
"""
open('_syn.js', 'w', encoding='utf-8').write(SYN)
syn = run('node _syn.js 2>&1', True)
os.remove('_syn.js')
print(syn.strip()[-300:])
if re.search(r'ERR .*(Unexpected|Unterminated|Missing|Expected|Identifier)', syn):
    run('git checkout App.js')
    print('ARRET : erreur de syntaxe, App.js remis comme avant. Rien envoye. Envoie-moi cette capture.')
    print('=== FIN ===')
    raise SystemExit

print('=== 4. COMPILATION (environ 8 min) ===')
run('git add -A && git commit -m "Recitateurs + : Mohammed Al-Faqih (archive.org)" && git push')
time.sleep(25)
rid = run('gh run list --workflow build.yml --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
ok = watch(rid) == 0
for essai in (1, 2, 3):
    if ok:
        break
    log = run('gh run view %s --log-failed 2>&1' % rid, True)
    if re.search(r'InstallFailedException|ndk;', log, re.I):
        print('Panne de telechargement chez GitHub, nouvel essai', essai)
        run('gh run rerun %s --failed' % rid)
        time.sleep(40)
        ok = watch(rid) == 0
    else:
        print('ERREUR DE COMPILATION :')
        whatwrong(log)
        break
if not ok:
    print('COMPILATION NON REUSSIE. Envoie-moi cette capture.')
    print('=== FIN ===')
    raise SystemExit
print('Compilation OK')

print('=== 5. TEST DE DEMARRAGE (environ 10 min) ===')
run('gh workflow run crash.yml')
time.sleep(25)
cid = run('gh run list --workflow crash.yml --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
watch(cid)
seen = riamolog(cid)
print('=== RESULTAT ===')
for t in seen:
    if re.search(r'APP |install:|paquet|FATAL|Caused by|UnsatisfiedLink|Invariant|Unable', t):
        print(t[:200])
if any('VIVANTE' in t for t in seen):
    print('=> BONNE NOUVELLE : GitHub > Releases > dernier APK. Installe-le par-dessus.')
else:
    print('=> L application plante au demarrage. Envoie-moi cette capture.')
print('=== FIN ===')

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
summary = []
def say(t):
    t = str(t)[:140]
    print(t)
    summary.append(t)
def ascii_only(s):
    return re.sub(r'[^\x00-\x7f]+', '<ar>', s)

print('=== 0. ATTENTE DE fix10 ===')
p = os.path.expanduser('~/fix10.txt')
for _ in range(90):
    if not os.path.exists(p) or '=== FIN ===' in open(p, errors='ignore').read():
        break
    if time.time() - os.path.getmtime(p) > 1500:
        break
    time.sleep(30)
run('git tag -f sauvegarde-avant-gps')
print('Pret')

print('=== 1. RECITATEUR SUR ARCHIVE.ORG ===')
def http(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return urllib.request.urlopen(req, timeout=40).read().decode('utf-8', 'replace')
best = None
try:
    qs = urllib.parse.urlencode([('q', 'identifier:z50928*'), ('fl[]', 'identifier'), ('fl[]', 'title'), ('fl[]', 'creator'), ('rows', '20'), ('output', 'json')])
    docs = json.loads(http('https://archive.org/advancedsearch.php?' + qs))['response']['docs']
    say('Elements trouves : %d' % len(docs))
    for doc in docs:
        ident = doc.get('identifier', '')
        try:
            meta = json.loads(http('https://archive.org/metadata/' + urllib.parse.quote(ident)))
        except Exception as ex:
            say('  metadata KO : ' + ascii_only(ident)[:60]); continue
        suras = {}
        for f in meta.get('files', []):
            n = f.get('name', '')
            if n.lower().endswith('.mp3'):
                m = re.search(r'(?<!\d)(\d{3})(?!\d)', n)
                if m and 1 <= int(m.group(1)) <= 114:
                    suras.setdefault(int(m.group(1)), n)
        md = meta.get('metadata', {})
        txt = str(md.get('title', '')) + ' ' + str(md.get('creator', '')) + ' ' + ident
        flag = ('الفقيه' in txt) or bool(re.search(r'faq?ih|fakih|fakeeh', txt, re.I))
        say('  id=%s | sourates=%d | Faqih=%s' % (ascii_only(ident)[:48], len(suras), 'OUI' if flag else 'non'))
        say('  titre=%s | auteur=%s' % (ascii_only(str(md.get('title', '')))[:40], ascii_only(str(md.get('creator', '')))[:30]))
        if len(suras) >= 100 and (best is None or flag or len(suras) > best['n']):
            best = {'id': ident, 'n': len(suras), 'map': suras, 'flag': flag}
    if best:
        say('Retenu : %s (%d sourates)' % (ascii_only(best['id'])[:60], best['n']))
        say('Exemple 1   : ' + ascii_only(best['map'].get(1, '?')))
        say('Exemple 114 : ' + ascii_only(best['map'].get(114, '?')))
        json.dump({'id': best['id'], 'map': {str(k): v for k, v in best['map'].items()}}, open(os.path.expanduser('~/faqih-info.json'), 'w'), ensure_ascii=False)
        say('Liste enregistree dans ~/faqih-info.json')
    else:
        say('Aucun element avec au moins 100 sourates. Envoie-moi le lien complet de la page.')
except Exception as ex:
    say('archive.org injoignable : ' + ascii_only(str(ex))[:90])
    say('Envoie-moi le lien complet de la page archive.org.')

print('=== 2. COMMENT TON APPLICATION LIT LES RECITATEURS ===')
say('Fichiers : ' + ' '.join(sorted(f for f in os.listdir('.') if f.endswith('.js'))))
if os.path.exists('reciters.js'):
    for l in open('reciters.js', encoding='utf-8', errors='ignore').read().splitlines()[:16]:
        say('R| ' + ascii_only(l)[:110])
if os.path.exists('MainApp.js'):
    hits = [l.strip() for l in open('MainApp.js', encoding='utf-8', errors='ignore').read().splitlines() if re.search(r'mp3|\.uri|uri:|url|server|padStart|reciter', l, re.I)]
    for l in hits[:18]:
        say('A| ' + ascii_only(l)[:110])

print('=== 3. LOCALISATION AUTOMATIQUE (horaires de priere) ===')
s = open('PrayerTimes.js', encoding='utf-8').read()
if 'gpsFix' in s:
    print('Deja modifie')
else:
    orig = s
    def sub1(old, new, regex=False):
        global s
        if regex:
            s2, n = re.subn(old, lambda m: new, s, count=1, flags=re.S)
        else:
            n = s.count(old)
            s2 = s.replace(old, new, 1) if n == 1 else s
            n = 1 if n == 1 else 0
        if n != 1:
            print('ARRET : motif introuvable :', old[:60].replace('\n', ' '))
            print('=== FIN ===')
            raise SystemExit
        s = s2
    sub1("const KEY = 'riamo.prayer.v1';", "const KEY = 'riamo.prayer.v1';\nlet userPicked = false;")
    sub1("const DEFAULT = { city: 'Paris|France', gps: null, method: 'AUTO', asr: 1, h24: true };", "const DEFAULT = { city: 'Paris|France', gps: null, method: 'AUTO', asr: 1, h24: true, auto: true };")
    sub1("function norm(s) {", """function nearest(lat, lng) {
  let best = LIST[0];
  let bk = 1e9;
  const rad = x => (x * Math.PI) / 180;
  for (let i = 0; i < LIST.length; i++) {
    const c = LIST[i];
    const a = Math.pow(Math.sin(rad(c.lat - lat) / 2), 2) + Math.cos(rad(lat)) * Math.cos(rad(c.lat)) * Math.pow(Math.sin(rad(c.lng - lng) / 2), 2);
    const k = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
    if (k < bk) { bk = k; best = c; }
  }
  return { c: best, km: bk };
}
function norm(s) {""")
    sub1("  useEffect(() => { readCfg().then(c => { if (c) setCfg({ ...DEFAULT, ...c }); }); }, []);", """  useEffect(() => {
    userPicked = false;
    readCfg().then(c => {
      const n = { ...DEFAULT, ...(c || {}) };
      setCfg(n);
      if (n.auto !== false) gpsFix(n, false);
    });
  }, []);""")
    sub1(r"    if \(cfg\.gps\) \{\n      return \{ key: 'gps'.*?\};\n    \}\n", """    if (cfg.gps) {
      const nb = nearest(cfg.gps.lat, cfg.gps.lng);
      const near = nb.km <= 80;
      return { key: 'gps', name: 'Ma position', country: near ? 'Près de ' + nb.c.name + ', ' + nb.c.country : cfg.gps.lat.toFixed(2) + ', ' + cfg.gps.lng.toFixed(2), lat: cfg.gps.lat, lng: cfg.gps.lng, tz: null, std: -new Date().getTimezoneOffset() / 60, def: nb.km <= 700 ? nb.c.def : 'MWL' };
    }
""", True)
    sub1(r"  const useGps = async \(\) => \{.*?setBusy\(false\);\n  \};\n", """  const gpsFix = async (baseCfg, loud) => {
    if (loud) { setBusy(true); setMsg(''); }
    try {
      const Location = require('expo-location');
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setMsg('Localisation refusée : les horaires utilisent la ville choisie. Active la localisation dans les réglages du téléphone pour plus de précision.');
        return;
      }
      let pos = null;
      try { pos = await Location.getLastKnownPositionAsync(); } catch (e) {}
      if (pos && !loud && !userPicked) setCfg({ ...baseCfg, gps: { lat: pos.coords.latitude, lng: pos.coords.longitude }, auto: true });
      try { pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); } catch (e) {}
      if (!pos) { if (loud || !baseCfg.gps) setMsg('Position introuvable. Active le GPS puis réessaie.'); return; }
      if (!loud && userPicked) return;
      const n = { ...baseCfg, gps: { lat: pos.coords.latitude, lng: pos.coords.longitude }, auto: true };
      setCfg(n);
      writeCfg(n);
      setMsg('');
    } catch (e) {
      setMsg('Localisation : ' + String(e && e.message ? e.message : e));
    } finally {
      if (loud) setBusy(false);
    }
  };
  const useGps = () => gpsFix(cfg, true);
""", True)
    sub1("update({ city: item.key, gps: null });", "userPicked = true; update({ city: item.key, gps: null, auto: false });")
    open('PrayerTimes.js', 'w', encoding='utf-8').write(s)
    print('PrayerTimes.js modifie (localisation automatique)')

print('=== 4. VERIFICATION DE LA SYNTAXE ===')
SYN = """const babel = require('@babel/core');
const fs = require('fs');
for (const f of ['PrayerTimes.js']) {
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
    run('git checkout PrayerTimes.js')
    print('ARRET : erreur de syntaxe, ancienne version remise. Rien envoye. Envoie-moi cette capture.')
    print('=== FIN ===')
    raise SystemExit

print('=== 5. COMPILATION (environ 8 min) ===')
run('git add -A && git commit -m "Horaires : localisation automatique" && git push')
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
else:
    print('Compilation OK')
    print('=== 6. TEST DE DEMARRAGE (environ 10 min) ===')
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
print('=== RESUME RECITATEUR (a m envoyer) ===')
for t in summary:
    print(t)
print('=== FIN ===')

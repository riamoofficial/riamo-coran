import os, re, json, glob, shutil, subprocess, time
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
    return re.sub(r'[^\x00-\x7f]+', '<ar>', str(s))

print('=== 1. TON ADHAN DANS TELECHARGEMENTS ===')
dirs = [os.path.expanduser('~/storage/downloads'), '/storage/emulated/0/Download', '/sdcard/Download']
src = None
cands = []
for d in dirs:
    if not os.path.isdir(d):
        continue
    for f in os.listdir(d):
        if not f.lower().endswith('.mp3'):
            continue
        p = os.path.join(d, f)
        try:
            size = os.path.getsize(p)
        except Exception:
            continue
        cands.append((p, size))
        if ('السقاف' in f or 'هاشم' in f) and 3000000 < size < 5000000:
            if src is None or os.path.getmtime(p) > os.path.getmtime(src):
                src = p
if not src:
    for p, size in cands:
        if 3600000 < size < 4100000 and os.path.basename(p).startswith('أذان'):
            src = p
            break
if not src:
    print('ARRET : fichier introuvable. Lance termux-setup-storage (accepte), puis relance.')
    print('mp3 vus dans Telechargements :', len(cands))
    for p, size in cands[:8]:
        print('  ', ascii_only(os.path.basename(p))[:60], size // 1024, 'Ko')
    print('=== FIN ===')
    raise SystemExit
data = open(src, 'rb').read()
print('Trouve :', ascii_only(os.path.basename(src))[:70], '|', len(data) // 1024, 'Ko')
if not (data[:3] == b'ID3' or (data[0] == 0xFF and (data[1] & 0xE0) == 0xE0)):
    print('ARRET : ce fichier ne ressemble pas a un mp3. Rien modifie.')
    print('=== FIN ===')
    raise SystemExit

print('=== 2. ATTENTE DE fix13 ET fix14 ===')
for f in ('~/fix13.txt', '~/fix14.txt'):
    p = os.path.expanduser(f)
    for i in range(0):
        if os.path.exists(p) and '=== FIN ===' in open(p, errors='ignore').read():
            break
        if os.path.exists(p) and time.time() - os.path.getmtime(p) > 1500:
            break
        if not os.path.exists(p) and i > 4:
            break
        time.sleep(30)
t13 = open(os.path.expanduser('~/fix13.txt'), errors='ignore').read() if os.path.exists(os.path.expanduser('~/fix13.txt')) else ''
t14 = open(os.path.expanduser('~/fix14.txt'), errors='ignore').read() if os.path.exists(os.path.expanduser('~/fix14.txt')) else ''
if False:
    print('ARRET : le script des villes (fix13) n a pas reussi, donc l ecran Adhan n existe pas encore. Envoie-moi la capture de ~/fix13.txt.')
    print('=== FIN ===')
    raise SystemExit
if False:
    print('ARRET : le script adhan (fix14) a un probleme de compilation. Envoie-moi la capture de ~/fix14.txt.')
    print('=== FIN ===')
    raise SystemExit
run('git tag -f sauvegarde-avant-saqqaf')
r = subprocess.run('git pull --rebase --autostash', shell=True, capture_output=True, text=True)
if r.returncode != 0:
    run('git rebase --abort')
    print('ARRET : conflit git. Rien change.')
    print('=== FIN ===')
    raise SystemExit
print('Pret')

print('=== 3. AJOUT DE TON ADHAN ===')
os.makedirs('assets/adhan', exist_ok=True)
open('assets/adhan/saqqaf.mp3', 'wb').write(data)
opts = [{'id': 'saqqaf', 'label': 'La Mecque (historique) · Cheikh Hachem As-Saqqaf', 'file': 'saqqaf'}]
if os.path.exists('adhan-core.js'):
    old = open('adhan-core.js', encoding='utf-8').read()
    for m in re.finditer(r"\{ id: (\"[^\"]+\"), label: (\"(?:[^\"\\]|\\.)*\"), src: require\('\./assets/adhan/([a-z0-9_]+)\.mp3'\) \}", old):
        oid = json.loads(m.group(1))
        if oid != 'saqqaf':
            opts.append({'id': oid, 'label': json.loads(m.group(2)), 'file': m.group(3)})
print('Adhans proposes :', ', '.join(o['id'] for o in opts))
OPTS = ',\n  '.join("{ id: %s, label: %s, src: require('./assets/adhan/%s.mp3') }" % (json.dumps(o['id']), json.dumps(o['label'], ensure_ascii=False), o['file']) for o in opts)
CORE = r"""const { Platform } = require('react-native');
const { createAudioPlayer, setAudioModeAsync } = require('expo-audio');

const OPTIONS = [
  __OPTS__
];

let N = null;
let handlerSet = false;
let player = null;

function notif() {
  if (!N) N = require('expo-notifications');
  if (!handlerSet) {
    N.setNotificationHandler({
      handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    handlerSet = true;
  }
  return N;
}
function find(id) { return OPTIONS.find(o => o.id === id) || OPTIONS[0]; }

async function ensureChannel(opt) {
  const Notifications = notif();
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('adhan_' + opt.id, {
    name: 'Adhan : ' + opt.label,
    importance: Notifications.AndroidImportance.HIGH,
    sound: opt.id + '.mp3',
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function ensurePermission() {
  try {
    const Notifications = notif();
    let p = await Notifications.getPermissionsAsync();
    if (!(p.granted || p.status === 'granted')) p = await Notifications.requestPermissionsAsync();
    return !!(p.granted || p.status === 'granted');
  } catch (e) { return false; }
}

function trig(Notifications, date, channelId) {
  const T = Notifications.SchedulableTriggerInputTypes;
  return T ? { type: T.DATE, date, channelId } : { date, channelId };
}

async function schedule(items, id) {
  try {
    const Notifications = notif();
    const opt = find(id);
    await ensureChannel(opt);
    await Notifications.cancelAllScheduledNotificationsAsync();
    let n = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.at < Date.now() + 3000) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: it.title, body: it.body, sound: opt.id + '.mp3' },
        trigger: trig(Notifications, new Date(it.at), 'adhan_' + opt.id),
      });
      n++;
    }
    return n;
  } catch (e) { return 0; }
}

async function cancel() {
  try { await notif().cancelAllScheduledNotificationsAsync(); } catch (e) {}
}

function stopPreview() {
  try { if (player) { player.pause(); player.remove(); } } catch (e) {}
  player = null;
}
async function preview(id) {
  try {
    stopPreview();
    try { await setAudioModeAsync({ playsInSilentMode: true }); } catch (e) {}
    player = createAudioPlayer(find(id).src);
    player.play();
  } catch (e) {}
}

async function testIn(sec, id) {
  try {
    if (!(await ensurePermission())) return false;
    const Notifications = notif();
    const opt = find(id);
    await ensureChannel(opt);
    await Notifications.scheduleNotificationAsync({
      content: { title: "Test de l'adhan", body: "Si tu entends l'adhan, tout fonctionne.", sound: opt.id + '.mp3' },
      trigger: trig(Notifications, new Date(Date.now() + sec * 1000), 'adhan_' + opt.id),
    });
    return true;
  } catch (e) { return false; }
}

module.exports = {
  available: true,
  options: OPTIONS.map(o => ({ id: o.id, label: o.label })),
  ensurePermission, schedule, cancel, preview, stopPreview, testIn,
};
"""
open('adhan-core.js', 'w', encoding='utf-8').write(CORE.replace('__OPTS__', OPTS))
print('adhan-core.js ecrit')

pk = json.load(open('package.json', encoding='utf-8'))
if 'expo-notifications' not in pk.get('dependencies', {}):
    run('npx expo install expo-notifications')
    pk = json.load(open('package.json', encoding='utf-8'))
    if 'expo-notifications' not in pk.get('dependencies', {}):
        run('git checkout package.json package-lock.json adhan-core.js')
        print('ARRET : expo-notifications non installe. Rien envoye.')
        print('=== FIN ===')
        raise SystemExit
a = json.load(open('app.json', encoding='utf-8'))
e = a.get('expo', a)
e['plugins'] = [pl for pl in e.get('plugins', []) if (pl[0] if isinstance(pl, list) else pl) != 'expo-notifications']
sounds = sorted(glob.glob('assets/adhan/*.mp3'))
e['plugins'].append(['expo-notifications', {'sounds': ['./' + s for s in sounds]}])
json.dump(a, open('app.json', 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
print('app.json : %d sons declares' % len(sounds))

print('=== 4. VERIFICATION DE LA SYNTAXE ===')
SYN = """const babel = require('@babel/core');
const fs = require('fs');
for (const f of ['adhan-core.js']) {
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
    run('git checkout adhan-core.js app.json')
    print('ARRET : erreur de syntaxe. Rien envoye. Envoie-moi cette capture.')
    print('=== FIN ===')
    raise SystemExit

print('=== 5. COMPILATION (environ 10 min) ===')
run('git add -A && git commit -m "Adhan historique de La Mecque (Cheikh Hachem As-Saqqaf)" && git push')
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
print('=== FIN ===')

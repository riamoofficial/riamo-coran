import os, re, json, subprocess, time
os.chdir(os.path.expanduser('~/riamo-coran'))
def run(c, out=False):
    r = subprocess.run(c, shell=True, capture_output=out, text=True)
    return r.stdout if out else r.returncode
def watch(rid):
    return run('gh run watch %s --interval 30 --exit-status > /dev/null 2>&1' % rid)
def errlines(txt, n=15):
    keep = [l for l in txt.splitlines() if re.search(r'error|failed|went wrong|unable|cannot|not found', l, re.I)]
    for l in keep[-n:]:
        print('  >', re.sub(r'^\S+\s+\S+\s+\d{4}-\d\d-\d\dT\S+\s*', '', l)[:115])
def riamolog(cid):
    log = run('gh run view %s --log 2>&1' % cid, True)
    seen = []
    for l in log.splitlines():
        if 'RIAMOLOG:' in l:
            t = l.split('RIAMOLOG:', 1)[1].strip()
            if t and t not in seen and '$' not in t:
                seen.append(t)
    return seen

print('=== 1. UTILISATION DU SON DANS extras.js ===')
for i, l in enumerate(open('extras.js', encoding='utf-8', errors='ignore').read().splitlines(), 1):
    if re.search(r'Audio\.|expo-av|Sound', l):
        print('  ', i, l.strip()[:85])

print('=== 2. MODULE DE REMPLACEMENT ===')
SHIM = r"""import { createAudioPlayer, setAudioModeAsync as _setMode } from 'expo-audio';

function status(p, extra) {
  const base = {
    isLoaded: !!(p && p.isLoaded),
    isPlaying: !!(p && p.playing),
    isBuffering: !!(p && p.isBuffering),
    positionMillis: Math.round(((p && p.currentTime) || 0) * 1000),
    durationMillis: Math.round(((p && p.duration) || 0) * 1000),
    didJustFinish: false,
    isLooping: !!(p && p.loop),
    rate: (p && p.playbackRate) || 1,
    volume: p && typeof p.volume === 'number' ? p.volume : 1,
    shouldPlay: !!(p && p.playing),
    isMuted: !!(p && p.muted),
  };
  return Object.assign(base, extra || {});
}

class Sound {
  constructor() { this.p = null; this.cb = null; this.sub = null; }

  static async createAsync(source, initial, onUpdate) {
    const s = new Sound();
    await s.loadAsync(source, initial, onUpdate);
    return { sound: s, status: s.snap() };
  }

  snap(extra) { return status(this.p, extra); }

  async loadAsync(source, initial, onUpdate) {
    let src = source;
    if (source && typeof source === 'object' && source.uri) src = { uri: source.uri, headers: source.headers };
    this.p = createAudioPlayer(src, { updateInterval: 500 });
    if (onUpdate) this.cb = onUpdate;
    this.sub = this.p.addListener('playbackStatusUpdate', st => {
      if (this.cb) this.cb(this.snap({ didJustFinish: !!(st && st.didJustFinish) }));
    });
    await this.setStatusAsync(initial || {});
    return this.snap();
  }

  async setStatusAsync(st) {
    const p = this.p;
    if (!p) return this.snap();
    try {
      if (typeof st.volume === 'number') p.volume = st.volume;
      if (typeof st.isMuted === 'boolean') p.muted = st.isMuted;
      if (typeof st.isLooping === 'boolean') p.loop = st.isLooping;
      if (typeof st.rate === 'number') p.setPlaybackRate(st.rate);
      if (typeof st.positionMillis === 'number') await p.seekTo(st.positionMillis / 1000);
      if (st.shouldPlay === true) p.play();
      if (st.shouldPlay === false) p.pause();
    } catch (e) {}
    return this.snap();
  }
  async playAsync() { try { this.p.play(); } catch (e) {} return this.snap({ isPlaying: true }); }
  async pauseAsync() { try { this.p.pause(); } catch (e) {} return this.snap({ isPlaying: false }); }
  async stopAsync() { try { this.p.pause(); await this.p.seekTo(0); } catch (e) {} return this.snap({ isPlaying: false, positionMillis: 0 }); }
  async setPositionAsync(ms) { try { await this.p.seekTo(ms / 1000); } catch (e) {} return this.snap({ positionMillis: ms }); }
  async setVolumeAsync(v) { try { this.p.volume = v; } catch (e) {} return this.snap(); }
  async setIsMutedAsync(m) { try { this.p.muted = m; } catch (e) {} return this.snap(); }
  async setIsLoopingAsync(l) { try { this.p.loop = l; } catch (e) {} return this.snap(); }
  async setRateAsync(r) { try { this.p.setPlaybackRate(r); } catch (e) {} return this.snap(); }
  async getStatusAsync() { return this.snap(); }
  setOnPlaybackStatusUpdate(cb) { this.cb = cb; }
  async unloadAsync() {
    try { if (this.sub) this.sub.remove(); if (this.p) this.p.remove(); } catch (e) {}
    this.p = null;
    return { isLoaded: false };
  }
}

async function setAudioModeAsync(mode) {
  const m = mode || {};
  try {
    await _setMode({
      playsInSilentMode: m.playsInSilentModeIOS !== false,
      shouldPlayInBackground: !!m.staysActiveInBackground,
    });
  } catch (e) {}
}

export const InterruptionModeIOS = { DoNotMix: 0, DuckOthers: 1, MixWithOthers: 2 };
export const InterruptionModeAndroid = { DoNotMix: 1, DuckOthers: 2 };
export const Audio = { Sound, setAudioModeAsync, InterruptionModeIOS, InterruptionModeAndroid };
export default { Audio };
"""
open('av-shim.js', 'w', encoding='utf-8').write(SHIM)
print('av-shim.js cree')

print('=== 3. METRO : expo-av redirige vers le module ===')
SNIP = """
// RIAMO_ALIAS
{
  const __p = require('path');
  const __orig = VAR.resolver.resolveRequest;
  VAR.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'expo-av') return { type: 'sourceFile', filePath: __p.resolve(__dirname, 'av-shim.js') };
    return __orig ? __orig(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
  };
}
"""
if not os.path.exists('metro.config.js'):
    open('metro.config.js', 'w', encoding='utf-8').write(
        "const { getDefaultConfig } = require('expo/metro-config');\nconst config = getDefaultConfig(__dirname);\n"
        + SNIP.replace('VAR', 'config') + "\nmodule.exports = config;\n")
    print('metro.config.js cree')
else:
    t = open('metro.config.js', encoding='utf-8').read()
    if 'RIAMO_ALIAS' in t:
        print('metro.config.js deja modifie')
    else:
        m = list(re.finditer(r'module\.exports\s*=\s*(\w+)\s*;?', t))
        if not m:
            print('ARRET : metro.config.js au format inconnu. Contenu :'); print(t[:700]); raise SystemExit
        m = m[-1]
        t = t[:m.start()] + SNIP.replace('VAR', m.group(1)) + '\n' + t[m.start():]
        open('metro.config.js', 'w', encoding='utf-8').write(t)
        print('metro.config.js modifie')

print('=== 4. SUPPRESSION DE EXPO-AV ===')
run('npm uninstall expo-av')
pk = json.load(open('package.json', encoding='utf-8'))
if 'expo-av' in pk.get('dependencies', {}):
    del pk['dependencies']['expo-av']
    json.dump(pk, open('package.json', 'w', encoding='utf-8'), indent=2)
    run('npm install --package-lock-only --no-audit --no-fund')
pk = json.load(open('package.json', encoding='utf-8'))
print('expo-av dans package.json :', 'OUI (probleme)' if 'expo-av' in pk.get('dependencies', {}) else 'non, supprime')
try:
    a = json.load(open('app.json', encoding='utf-8'))
    e = a.get('expo', a)
    e['plugins'] = [p for p in e.get('plugins', []) if (p[0] if isinstance(p, list) else p) != 'expo-av']
    json.dump(a, open('app.json', 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
except Exception as ex:
    print('app.json :', ex)

print('=== 5. COMPILATION (environ 8 min) ===')
run('git add -A && git commit -m "expo-av remplace par un module expo-audio" && git push')
time.sleep(25)
rid = run('gh run list --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
if watch(rid) != 0:
    print('LA COMPILATION A ECHOUE. Erreur :')
    errlines(run('gh run view %s --log-failed 2>&1' % rid, True))
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
        print(t[:230])
if any('VIVANTE' in t for t in seen):
    print('=> BONNE NOUVELLE : GitHub > Releases, telecharge le dernier APK, supprime l ancienne appli et installe-le.')
else:
    print('=== 7. INSPECTION (encore un plantage) ===')
    run('gh workflow run inspect.yml')
    time.sleep(25)
    iid = run('gh run list --workflow inspect.yml --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
    watch(iid)
    for t in riamolog(iid):
        if re.search(r'version|BESOIN|FOURNIT', t):
            print(t[:200])
print('=== FIN ===')

import os, re, subprocess, time
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

print('=== 0. SAUVEGARDE DE LA VERSION QUI MARCHE ===')
run('git tag -f sauvegarde-v13')
dl = os.path.expanduser('~/storage/downloads')
if os.path.isdir(dl):
    run('git archive --format=zip HEAD -o "%s/riamo-coran-code-v13.zip"' % dl)
    run('gh release download -p "*.apk" -O "%s/RIAMO-Coran-v13-SAUVEGARDE.apk" --clobber' % dl)
    for f in ('riamo-coran-code-v13.zip', 'RIAMO-Coran-v13-SAUVEGARDE.apk'):
        print(('OK  ' if os.path.exists(dl + '/' + f) else 'MANQUE ') + 'Telechargements/' + f)
else:
    print('Dossier Telechargements introuvable : lance termux-setup-storage puis relance')
print('Les versions v1 a v13 restent aussi sur GitHub > Releases (ne les supprime pas)')

print('=== 1. MODULE BOUSSOLE ===')
run('npx expo install expo-sensors')

QIBLA = r"""import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Vibration } from 'react-native';
import * as Location from 'expo-location';
import { Magnetometer, Accelerometer } from 'expo-sensors';

const GOLD = '#d4af37';
const BG = '#0b0f14';
const toRad = d => (d * Math.PI) / 180;
const toDeg = r => (r * 180) / Math.PI;

function qiblaBearing(lat, lon) {
  const kLat = toRad(21.4225), kLon = toRad(39.8262);
  const p = toRad(lat), dL = kLon - toRad(lon);
  const y = Math.sin(dL) * Math.cos(kLat);
  const x = Math.cos(p) * Math.sin(kLat) - Math.sin(p) * Math.cos(kLat) * Math.cos(dL);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function azimuth(a, m) {
  let Hx = m.y * a.z - m.z * a.y;
  let Hy = m.z * a.x - m.x * a.z;
  let Hz = m.x * a.y - m.y * a.x;
  const nH = Math.sqrt(Hx * Hx + Hy * Hy + Hz * Hz);
  if (nH < 0.1) return null;
  Hx /= nH; Hy /= nH; Hz /= nH;
  const nA = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  if (!nA) return null;
  const ax = a.x / nA, az = a.z / nA;
  const My = az * Hx - ax * Hz;
  return (toDeg(Math.atan2(Hy, My)) + 360) % 360;
}

export default function Qibla({ onClose }) {
  const [bearing, setBearing] = useState(null);
  const [heading, setHeading] = useState(null);
  const [err, setErr] = useState('');
  const acc = useRef(null);
  const sign = useRef(null);
  const sm = useRef(null);
  const wasAligned = useRef(false);

  useEffect(() => {
    let alive = true;
    const subs = [];
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErr('Autorise la localisation pour trouver la Qibla.');
        } else {
          let pos = null;
          try { pos = await Location.getLastKnownPositionAsync(); } catch (e) {}
          if (pos && alive) setBearing(qiblaBearing(pos.coords.latitude, pos.coords.longitude));
          try {
            const p2 = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            if (alive) setBearing(qiblaBearing(p2.coords.latitude, p2.coords.longitude));
          } catch (e) {
            if (!pos && alive) setErr('Position introuvable. Active le GPS puis rouvre la Qibla.');
          }
        }
      } catch (e) {
        setErr('Localisation : ' + String(e && e.message ? e.message : e));
      }
      try {
        const okM = await Magnetometer.isAvailableAsync();
        const okA = await Accelerometer.isAvailableAsync();
        if (!okM || !okA) { setErr('Boussole indisponible sur ce téléphone.'); return; }
        Magnetometer.setUpdateInterval(120);
        Accelerometer.setUpdateInterval(120);
        subs.push(Accelerometer.addListener(d => { acc.current = d; }));
        subs.push(Magnetometer.addListener(m => {
          const a = acc.current;
          if (!a) return;
          if (sign.current === null) {
            if (Math.abs(a.z) > 0.6) sign.current = a.z > 0 ? 1 : -1; else return;
          }
          const s = sign.current;
          const az = azimuth({ x: a.x * s, y: a.y * s, z: a.z * s }, m);
          if (az == null) return;
          const r = toRad(az);
          const v = sm.current
            ? { x: 0.8 * sm.current.x + 0.2 * Math.cos(r), y: 0.8 * sm.current.y + 0.2 * Math.sin(r) }
            : { x: Math.cos(r), y: Math.sin(r) };
          sm.current = v;
          setHeading((toDeg(Math.atan2(v.y, v.x)) + 360) % 360);
        }));
      } catch (e) {
        setErr('Boussole : ' + String(e && e.message ? e.message : e));
      }
    })();
    return () => { alive = false; subs.forEach(s => { try { s.remove(); } catch (e) {} }); };
  }, []);

  const ready = bearing !== null && heading !== null;
  const diff = ready ? ((bearing - heading + 540) % 360) - 180 : null;
  const rotation = ready ? (bearing - heading + 360) % 360 : 0;
  const isAligned = diff !== null && Math.abs(diff) <= 5;

  useEffect(() => {
    if (isAligned && !wasAligned.current) Vibration.vibrate(60);
    wasAligned.current = isAligned;
  }, [isAligned]);

  return (
    <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', paddingBottom: 56 }}>
      <Text style={{ color: GOLD, fontSize: 22, marginBottom: 26 }}>Direction de la Qibla</Text>
      <View style={{ width: 260, height: 260, borderRadius: 130, borderWidth: 3, borderColor: isAligned ? '#3ddc84' : GOLD, alignItems: 'center', justifyContent: 'center' }}>
        {heading !== null && (
          <View style={{ position: 'absolute', width: 254, height: 254, alignItems: 'center', transform: [{ rotate: (-heading) + 'deg' }] }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, marginTop: 4 }}>N</Text>
          </View>
        )}
        <View style={{ position: 'absolute', width: 254, height: 254, alignItems: 'center', transform: [{ rotate: rotation + 'deg' }] }}>
          <Text style={{ fontSize: 56, color: GOLD, marginTop: 26 }}>▲</Text>
          <Text style={{ fontSize: 28 }}>🕋</Text>
        </View>
      </View>
      <Text style={{ color: isAligned ? '#3ddc84' : '#fff', marginTop: 24, fontSize: 16 }}>
        {isAligned ? '✓ Tu fais face à la Qibla' : bearing === null ? 'Recherche de ta position…' : 'Qibla : ' + Math.round(bearing) + '° depuis le nord'}
      </Text>
      <Text style={{ color: '#aaa', marginTop: 6 }}>
        {heading === null ? 'Pose le téléphone à plat et bouge-le doucement' : 'Ton cap : ' + Math.round(heading) + '°'}
      </Text>
      {err ? <Text style={{ color: '#ff8a80', marginTop: 10, textAlign: 'center', paddingHorizontal: 20 }}>{err}</Text> : null}
      <Text style={{ color: '#777', marginTop: 10, textAlign: 'center', paddingHorizontal: 24, fontSize: 12 }}>
        Tiens le téléphone à plat, loin des aimants et du métal. Tourne-toi jusqu'à ce que la flèche pointe vers le haut.
      </Text>
      <TouchableOpacity onPress={onClose} style={{ marginTop: 28, paddingVertical: 14, paddingHorizontal: 40, backgroundColor: GOLD, borderRadius: 12 }}>
        <Text style={{ fontWeight: 'bold' }}>Fermer</Text>
      </TouchableOpacity>
    </View>
  );
}
"""

RADIO = r"""import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const GOLD = '#d4af37';
const BG = '#0b0f14';

const SURES = [
  { name: 'Radio Coran – Mix', url: 'https://backup.qurango.net/radio/mix', sub: 'Qurango' },
  { name: 'Radio Coran – Tarateel', url: 'https://backup.qurango.net/radio/tarateel', sub: 'Qurango' },
];

const MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://fi1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
];

const CHIPS = [
  { id: 'fav', label: '⭐ Sûres' },
  { id: 'm6', label: '🇲🇦 Mohammed VI', queries: ['countrycode=MA&name=mohammed', 'countrycode=MA&name=mohammed%20vi', 'name=mohammed%20vi&tag=quran'] },
  { id: 'ma', label: '🇲🇦 Maroc', queries: ['countrycode=MA&tag=quran', 'countrycode=MA&name=coran', 'countrycode=MA&name=quran'] },
  { id: 'sa', label: '🇸🇦 Arabie saoudite', queries: ['countrycode=SA&tag=quran', 'countrycode=SA&name=quran'] },
  { id: 'eg', label: '🇪🇬 Égypte', queries: ['countrycode=EG&tag=quran', 'countrycode=EG&name=quran'] },
  { id: 'kw', label: '🇰🇼 Koweït', queries: ['countrycode=KW&tag=quran', 'countrycode=KW&name=quran'] },
  { id: 'fr', label: '🇫🇷 France', queries: ['countrycode=FR&tag=quran', 'countrycode=FR&name=coran'] },
  { id: 'world', label: '🌍 Monde', queries: ['tag=quran', 'name=quran', 'name=coran'] },
];

async function api(query) {
  for (const base of MIRRORS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(base + '/json/stations/search?' + query + '&hidebroken=true&order=clickcount&reverse=true&limit=40', { signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) return await r.json();
    } catch (e) {}
  }
  return [];
}

export default function Radio({ onClose }) {
  const playerRef = useRef(null);
  const [tab, setTab] = useState('fav');
  const [stations, setStations] = useState(SURES);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(null);
  const [msg, setMsg] = useState('');

  const stop = () => {
    try { if (playerRef.current) { playerRef.current.pause(); playerRef.current.remove(); } } catch (e) {}
    playerRef.current = null;
    setCurrent(null);
  };

  const choose = async chip => {
    setTab(chip.id);
    setMsg('');
    if (!chip.queries) { setStations(SURES); return; }
    setLoading(true);
    setStations([]);
    const seen = {};
    const out = [];
    for (const q of chip.queries) {
      const list = await api(q);
      for (const s of list) {
        const url = s.url_resolved || s.url || '';
        const name = (s.name || '').trim();
        if (!name || !url.startsWith('https') || seen[url]) continue;
        seen[url] = 1;
        out.push({ name, url, sub: s.country || '' });
      }
    }
    setStations(out.slice(0, 60));
    setLoading(false);
    if (!out.length) setMsg('Aucune radio trouvée ici. Vérifie ta connexion Internet.');
  };

  const play = async s => {
    try {
      stop();
      setMsg('Connexion…');
      try { await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }); } catch (e) {}
      const p = createAudioPlayer({ uri: s.url });
      playerRef.current = p;
      p.addListener('playbackStatusUpdate', st => { if (st && st.playing) setMsg(''); });
      p.play();
      setCurrent(s.url);
      setTimeout(() => {
        if (playerRef.current === p && !p.playing) setMsg('Cette radio ne répond pas. Essaies-en une autre.');
      }, 15000);
    } catch (e) {
      setMsg('Cette radio ne répond pas. Essaies-en une autre.');
    }
  };

  useEffect(() => () => { try { playerRef.current && playerRef.current.remove(); } catch (e) {} }, []);

  return (
    <View style={{ flex: 1, backgroundColor: BG, padding: 16, paddingTop: 50, paddingBottom: 56 }}>
      <Text style={{ color: GOLD, fontSize: 22, marginBottom: 14 }}>Radio Coran</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 14 }}>
        {CHIPS.map(c => (
          <TouchableOpacity key={c.id} onPress={() => choose(c)}
            style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: GOLD, marginRight: 8, backgroundColor: tab === c.id ? GOLD : 'transparent' }}>
            <Text style={{ color: tab === c.id ? '#000' : GOLD, fontWeight: 'bold' }}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {loading ? <ActivityIndicator color={GOLD} style={{ marginVertical: 12 }} /> : null}
      <FlatList
        style={{ flex: 1 }}
        data={stations}
        keyExtractor={s => s.url}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => play(item)}
            style={{ padding: 14, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: GOLD, backgroundColor: current === item.url ? '#1c242e' : 'transparent' }}>
            <Text style={{ color: '#fff', fontSize: 16 }}>{current === item.url ? '▶ ' : ''}{item.name}</Text>
            {item.sub ? <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{item.sub}</Text> : null}
          </TouchableOpacity>
        )}
      />
      {msg ? <Text style={{ color: '#fff', marginVertical: 8 }}>{msg}</Text> : null}
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        <TouchableOpacity onPress={stop} style={{ flex: 1, padding: 14, backgroundColor: '#8b2c2c', borderRadius: 10, marginRight: 10 }}>
          <Text style={{ color: '#fff', textAlign: 'center' }}>Arrêter</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { stop(); onClose(); }} style={{ flex: 1, padding: 14, backgroundColor: GOLD, borderRadius: 10 }}>
          <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>Fermer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
"""
open('Qibla.js', 'w', encoding='utf-8').write(QIBLA)
open('Radio.js', 'w', encoding='utf-8').write(RADIO)
print('Qibla.js et Radio.js ecrits')

print('=== 2. COMPILATION (environ 8 min) ===')
run('git add -A && git commit -m "Qibla avec capteurs, Radio par pays, boutons visibles" && git push')
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

print('=== 3. TEST DE DEMARRAGE (environ 10 min) ===')
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
    print('=> BONNE NOUVELLE : GitHub > Releases > dernier APK. Installe-le par-dessus ; si le telephone refuse, desinstalle l ancienne appli d abord.')
else:
    print('=> L application plante au demarrage. Envoie-moi cette capture.')
print('=== FIN ===')

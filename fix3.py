import os, re, subprocess, time, glob
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

print('=== 1. SUPPRESSION DE EXPO-AV ===')
others = [f for f in glob.glob('*.js') if f != 'Radio.js' and 'expo-av' in open(f, encoding='utf-8', errors='ignore').read()]
if others:
    print('ATTENTION : expo-av est utilise aussi dans', others, '- non supprime')
else:
    run('npm uninstall expo-av')
    print('expo-av supprime')

print('=== 2. RADIO AVEC EXPO-AUDIO ===')
RADIO = r"""import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// Si un flux ne marche pas, remplace son lien par un lien de mp3quran.net (rubrique Radio).
const STATIONS = [
  { name: 'Radio Coran – Le Caire', url: 'https://stream.radiojar.com/8s5u5tpdtwzuv' },
  { name: 'Radio Coran – Mix', url: 'https://backup.qurango.net/radio/mix' },
  { name: 'Radio Coran – Tarateel', url: 'https://backup.qurango.net/radio/tarateel' },
];

export default function Radio({ onClose }) {
  const playerRef = useRef(null);
  const [current, setCurrent] = useState(null);
  const [msg, setMsg] = useState('');

  const stop = () => {
    try {
      if (playerRef.current) { playerRef.current.pause(); playerRef.current.remove(); }
    } catch (e) {}
    playerRef.current = null;
    setCurrent(null);
  };

  const play = async s => {
    try {
      stop();
      setMsg('Connexion…');
      try { await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }); } catch (e) {}
      const p = createAudioPlayer({ uri: s.url });
      playerRef.current = p;
      p.addListener('playbackStatusUpdate', st => { if (st && (st.playing || st.isLoaded)) setMsg(''); });
      p.play();
      setCurrent(s.name);
      setTimeout(() => {
        if (playerRef.current === p && !p.isLoaded) setMsg('Ce flux ne répond pas. Essaie une autre radio.');
      }, 15000);
    } catch (e) {
      setMsg('Ce flux ne répond pas. Essaie une autre radio.');
    }
  };

  useEffect(() => () => { try { playerRef.current && playerRef.current.remove(); } catch (e) {} }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0b0f14', padding: 20, paddingTop: 50 }}>
      <Text style={{ color: '#d4af37', fontSize: 22, marginBottom: 20 }}>Radio Coran</Text>
      <FlatList
        data={STATIONS}
        keyExtractor={s => s.name}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => play(item)}
            style={{ padding: 16, marginBottom: 10, borderRadius: 10, borderWidth: 1, borderColor: '#d4af37',
                     backgroundColor: current === item.name ? '#1c242e' : 'transparent' }}>
            <Text style={{ color: '#fff', fontSize: 16 }}>{current === item.name ? '▶ ' : ''}{item.name}</Text>
          </TouchableOpacity>
        )}
      />
      {msg ? <Text style={{ color: '#fff' }}>{msg}</Text> : null}
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <TouchableOpacity onPress={stop} style={{ flex: 1, padding: 14, backgroundColor: '#8b2c2c', borderRadius: 10, marginRight: 10 }}>
          <Text style={{ color: '#fff', textAlign: 'center' }}>Arrêter</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { stop(); onClose(); }} style={{ flex: 1, padding: 14, backgroundColor: '#d4af37', borderRadius: 10 }}>
          <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>Fermer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
"""
open('Radio.js', 'w', encoding='utf-8').write(RADIO)
print('Radio.js reecrit')

print('=== 3. COMPILATION (environ 8 min) ===')
run('git add -A && git commit -m "Radio avec expo-audio, suppression expo-av" && git push')
time.sleep(25)
rid = run('gh run list --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
if watch(rid) != 0:
    print('LA COMPILATION A ECHOUE. Erreur :')
    errlines(run('gh run view %s --log-failed 2>&1' % rid, True))
    raise SystemExit
print('Compilation OK')

print('=== 4. TEST SUR TELEPHONE VIRTUEL (environ 10 min) ===')
run('gh workflow run crash.yml')
time.sleep(25)
cid = run('gh run list --workflow crash.yml --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
watch(cid)
log = run('gh run view %s --log 2>&1' % cid, True)
seen = []
for l in log.splitlines():
    if 'RIAMOLOG:' in l:
        t = l.split('RIAMOLOG:', 1)[1].strip()
        if re.search(r'APP |install:|paquet|FATAL|Caused by|UnsatisfiedLink|Exception', t) and t not in seen:
            seen.append(t)
print('=== RESULTAT ===')
for t in seen[:12]:
    print(t[:115])
if any('VIVANTE' in t for t in seen):
    print('=> BONNE NOUVELLE : GitHub > Releases, telecharge le dernier APK et installe-le.')
elif not seen:
    print('Le test n a pas pu tourner. Erreur :')
    errlines(run('gh run view %s --log-failed 2>&1' % cid, True))
print('=== FIN ===')

import os, re, json, sys, shlex, subprocess
HOME = os.path.expanduser('~')
os.chdir(HOME + '/riamo-coran')
os.makedirs('assets', exist_ok=True)

def sh(c):
    return subprocess.run(c, shell=True).returncode

def find(name):
    for d, dirs, files in os.walk(HOME + '/storage/shared', followlinks=True):
        dirs[:] = [x for x in dirs if x != 'Android']
        for f in files:
            if name in f:
                return os.path.join(d, f)
    return None

logo = sys.argv[1] if len(sys.argv) > 1 else find('1794780242179')
photo = sys.argv[2] if len(sys.argv) > 2 else find('1794780995144')
converted = False
if logo and photo and os.path.exists(logo) and os.path.exists(photo):
    L, P = shlex.quote(logo), shlex.quote(photo)
    BG = "'#0b0f14'"
    sh("convert %s -gravity center -crop 768x768+0+0 +repage -resize 1024x1024 assets/icon.png" % L)
    sh("cp assets/icon.png assets/logo.png")
    sh("convert assets/icon.png -resize 680x680 -background %s -gravity center -extent 1024x1024 assets/adaptive-icon.png" % BG)
    sh("cp assets/adaptive-icon.png assets/android-icon-foreground.png")
    sh("convert %s -resize 1284x -background %s -gravity center -extent 1284x2778 assets/splash.png" % (P, BG))
    converted = os.path.exists('assets/splash.png') and os.path.exists('assets/icon.png')
    print('IMAGES OK' if converted else 'IMAGES : echec de convert')
else:
    print('IMAGES : fichiers introuvables. Images recentes du telephone :')
    allf = []
    for d, dirs, files in os.walk(HOME + '/storage/shared', followlinks=True):
        dirs[:] = [x for x in dirs if x != 'Android']
        for f in files:
            if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                p = os.path.join(d, f)
                allf.append((os.path.getmtime(p), p))
    for _, p in sorted(allf, reverse=True)[:8]:
        print('  ', p)
    print('Puis relance : python tout.py "CHEMIN_LOGO" "CHEMIN_PHOTO"')

QIBLA = r"""import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';

const toRad = d => (d * Math.PI) / 180;
const toDeg = r => (r * 180) / Math.PI;

function qiblaBearing(lat, lon) {
  const kLat = toRad(21.4225), kLon = toRad(39.8262);
  const p = toRad(lat), dL = kLon - toRad(lon);
  const y = Math.sin(dL) * Math.cos(kLat);
  const x = Math.cos(p) * Math.sin(kLat) - Math.sin(p) * Math.cos(kLat) * Math.cos(dL);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export default function Qibla({ onClose }) {
  const [bearing, setBearing] = useState(null);
  const [heading, setHeading] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    let sub;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return setErr('Autorise la localisation pour la Qibla.');
      const pos = await Location.getCurrentPositionAsync({});
      setBearing(qiblaBearing(pos.coords.latitude, pos.coords.longitude));
      sub = await Location.watchHeadingAsync(h =>
        setHeading(h.trueHeading >= 0 ? h.trueHeading : h.magHeading)
      );
    })().catch(e => setErr(String(e)));
    return () => sub && sub.remove();
  }, []);

  const rotation = bearing == null ? 0 : (bearing - heading + 360) % 360;

  return (
    <View style={{ flex: 1, backgroundColor: '#0b0f14', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#d4af37', fontSize: 22, marginBottom: 30 }}>Direction de la Qibla</Text>
      {err ? <Text style={{ color: '#fff', padding: 20 }}>{err}</Text> : (
        <>
          <View style={{ width: 240, height: 240, borderRadius: 120, borderWidth: 3, borderColor: '#d4af37', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ transform: [{ rotate: rotation + 'deg' }], alignItems: 'center' }}>
              <Text style={{ fontSize: 70, color: '#d4af37' }}>▲</Text>
              <Text style={{ fontSize: 30 }}>🕋</Text>
            </View>
          </View>
          <Text style={{ color: '#fff', marginTop: 24 }}>
            {bearing == null ? 'Recherche de position…' : 'Qibla : ' + Math.round(bearing) + '° depuis le nord'}
          </Text>
          <Text style={{ color: '#aaa', marginTop: 8, textAlign: 'center', padding: 10 }}>
            Tiens le téléphone à plat et tourne-toi jusqu'à ce que la flèche pointe vers le haut.
          </Text>
        </>
      )}
      <TouchableOpacity onPress={onClose} style={{ marginTop: 40, padding: 14, backgroundColor: '#d4af37', borderRadius: 10 }}>
        <Text style={{ fontWeight: 'bold' }}>Fermer</Text>
      </TouchableOpacity>
    </View>
  );
}
"""

RADIO = r"""import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Audio } from 'expo-av';

// Si un flux ne marche pas, remplace son lien par un lien de mp3quran.net (rubrique Radio).
const STATIONS = [
  { name: 'Radio Coran – Le Caire', url: 'https://stream.radiojar.com/8s5u5tpdtwzuv' },
  { name: 'Radio Coran – Mix', url: 'https://backup.qurango.net/radio/mix' },
  { name: 'Radio Coran – Tarateel', url: 'https://backup.qurango.net/radio/tarateel' },
];

export default function Radio({ onClose }) {
  const sound = useRef(null);
  const [current, setCurrent] = useState(null);
  const [msg, setMsg] = useState('');

  const stop = async () => {
    if (sound.current) { await sound.current.unloadAsync(); sound.current = null; }
    setCurrent(null);
  };

  const play = async s => {
    try {
      setMsg('Connexion…');
      await stop();
      await Audio.setAudioModeAsync({ staysActiveInBackground: true, playsInSilentModeIOS: true });
      const { sound: snd } = await Audio.Sound.createAsync({ uri: s.url }, { shouldPlay: true });
      sound.current = snd;
      setCurrent(s.name);
      setMsg('');
    } catch (e) {
      setMsg('Ce flux ne répond pas. Essaie une autre radio.');
    }
  };

  useEffect(() => () => { sound.current && sound.current.unloadAsync(); }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0b0f14', padding: 20, paddingTop: 50 }}>
      <Text style={{ color: '#d4af37', fontSize: 22, marginBottom: 20 }}>Radio Coran</Text>
      <FlatList
        data={STATIONS}
        keyExtractor={s => s.name}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => play(item)}
            style={{ padding: 16, marginBottom: 10, borderRadius: 10, borderWidth: 1, borderColor: '#d4af37',
                     backgroundColor: current === item.name ? '#1d3b2f' : 'transparent' }}>
            <Text style={{ color: '#fff', fontSize: 16 }}>{current === item.name ? '▶ ' : ''}{item.name}</Text>
          </TouchableOpacity>
        )}
      />
      {msg ? <Text style={{ color: '#fff' }}>{msg}</Text> : null}
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <TouchableOpacity onPress={stop} style={{ flex: 1, padding: 14, backgroundColor: '#8b2c2c', borderRadius: 10, marginRight: 10 }}>
          <Text style={{ color: '#fff', textAlign: 'center' }}>Arrêter</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={{ flex: 1, padding: 14, backgroundColor: '#d4af37', borderRadius: 10 }}>
          <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>Fermer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
"""

open('Qibla.js', 'w', encoding='utf-8').write(QIBLA)
open('Radio.js', 'w', encoding='utf-8').write(RADIO)
print('Qibla.js et Radio.js crees')

sh('npx expo install expo-location')

# app.json
if converted:
    try:
        a = json.load(open('app.json', encoding='utf-8'))
        e = a['expo'] if 'expo' in a else a
        e['icon'] = './assets/icon.png'
        e['splash'] = {'image': './assets/splash.png', 'resizeMode': 'cover', 'backgroundColor': '#0b0f14'}
        e.setdefault('android', {})['adaptiveIcon'] = {
            'foregroundImage': './assets/adaptive-icon.png', 'backgroundColor': '#0b0f14'}
        pl = e.get('plugins', [])
        for i, p in enumerate(pl):
            name = p[0] if isinstance(p, list) else p
            if name == 'expo-splash-screen':
                props = p[1] if isinstance(p, list) and len(p) > 1 else {}
                props.update({'image': './assets/splash.png', 'resizeMode': 'cover', 'backgroundColor': '#0b0f14'})
                pl[i] = ['expo-splash-screen', props]
        json.dump(a, open('app.json', 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
        print('app.json OK')
    except Exception as ex:
        print('app.json ECHEC :', ex)

# App.js
s = open('App.js', encoding='utf-8').read()
if 'RIAMO_PANEL' in s:
    print('App.js deja modifie')
else:
    idx = s.rfind('\n  );')
    j = s.rfind('</', 0, idx) if idx >= 0 else -1
    m = (re.search(r'function App\s*\([^)]*\)\s*\{', s)
         or re.search(r'const App\s*=\s*\([^)]*\)\s*=>\s*\{', s))
    if j < 0 or not m:
        print('App.js ECHEC : structure non reconnue, fichier NON modifie')
    else:
        open('App.js.bak', 'w', encoding='utf-8').write(s)
        jsx = """<RImage source={require('./assets/logo.png')} style={{position:'absolute',top:36,left:10,width:48,height:48,borderRadius:10,zIndex:99}} />
<RView style={{position:'absolute',top:40,right:10,flexDirection:'row',zIndex:99}}>
<RTouch onPress={() => setPanel('qibla')} style={{backgroundColor:'#d4af37',padding:10,borderRadius:20,marginRight:8}}><RText>🧭 Qibla</RText></RTouch>
<RTouch onPress={() => setPanel('radio')} style={{backgroundColor:'#d4af37',padding:10,borderRadius:20}}><RText>📻 Radio</RText></RTouch>
</RView>
<RModal visible={panel !== null} animationType="slide" onRequestClose={() => setPanel(null)}>
{panel === 'qibla' && <Qibla onClose={() => setPanel(null)} />}
{panel === 'radio' && <Radio onClose={() => setPanel(null)} />}
</RModal>
"""
        s = s[:j] + jsx + s[j:]
        s = s[:m.end()] + "\n  const [panel, setPanel] = useRState(null); // RIAMO_PANEL" + s[m.end():]
        imp = ("import { Modal as RModal, TouchableOpacity as RTouch, Text as RText, View as RView, Image as RImage } from 'react-native';\n"
               "import { useState as useRState } from 'react';\n"
               "import Qibla from './Qibla';\nimport Radio from './Radio';")
        lines = s.split('\n')
        last = max([i for i, l in enumerate(lines) if l.startswith('import ') or l.startswith('} from ')] or [-1])
        lines.insert(last + 1, imp)
        open('App.js', 'w', encoding='utf-8').write('\n'.join(lines))
        print('App.js OK (sauvegarde : App.js.bak)')
print('TERMINE')

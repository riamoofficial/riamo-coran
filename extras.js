import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';

const VERT = '#0f7a57', OR = '#c9a96a', NUIT = '#0d2e22';

/* ---------- Idriss Abkar (via l'API MP3Quran) ---------- */
export async function getIdrissAbkar() {
  try {
    const r = await fetch('https://www.mp3quran.net/api/v3/reciters?language=ar');
    const j = await r.json();
    const hit = j.reciters.find(x => /ادريس|إدريس/.test(x.name) && /ابكر|أبكر/.test(x.name));
    if (!hit) return null;
    const m = hit.moshaf[0];
    return { id: 'idriss-abkar', name: 'إدريس أبكر', nameFr: 'Idriss Abkar',
             server: m.server.endsWith('/') ? m.server : m.server + '/', riwaya: m.name };
  } catch (e) { return null; }
}

/* ---------- Tout lire + Tout télécharger ---------- */
const url = (server, n) => server + String(n).padStart(3, '0') + '.mp3';

export function ReciterActions({ reciter }) {
  const sound = useRef(null);
  const stop = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [dl, setDl] = useState(0);
  const [busy, setBusy] = useState(false);

  const playAll = async () => {
    if (playing) {
      stop.current = true;
      if (sound.current) await sound.current.unloadAsync();
      setPlaying(false); return;
    }
    stop.current = false; setPlaying(true);
    await Audio.setAudioModeAsync({ staysActiveInBackground: true, playsInSilentModeIOS: true });
    for (let n = 1; n <= 114 && !stop.current; n++) {
      await new Promise(async (done) => {
        let s;
        try {
          ({ sound: s } = await Audio.Sound.createAsync(
            { uri: url(reciter.server, n) }, { shouldPlay: true }));
        } catch (e) { done(); return; }
        sound.current = s;
        s.setOnPlaybackStatusUpdate(st => { if (st.didJustFinish) { s.unloadAsync(); done(); } });
        const t = setInterval(() => { if (stop.current) { clearInterval(t); done(); } }, 500);
      });
    }
    setPlaying(false);
  };

  const downloadAll = async () => {
    if (busy) return;
    setBusy(true); setDl(0);
    const dir = FileSystem.documentDirectory + 'coran/' + reciter.id + '/';
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    try {
      for (let n = 1; n <= 114; n++) {
        const f = dir + String(n).padStart(3, '0') + '.mp3';
        const info = await FileSystem.getInfoAsync(f);
        if (!info.exists) { try { const r = await FileSystem.downloadAsync(url(reciter.server, n), f); if (r.status !== 200) await FileSystem.deleteAsync(f, { idempotent: true }); } catch (e) {} }
        setDl(n);
      }
      Alert.alert('Terminé', '114 sourates téléchargées');
    } catch (e) { Alert.alert('Erreur', 'Vérifie ta connexion'); }
    setBusy(false);
  };

  const Btn = ({ t, onPress, bg, c }) => (
    <TouchableOpacity onPress={onPress} style={{ flex: 1, backgroundColor: bg, padding: 14,
      borderRadius: 26, alignItems: 'center', marginHorizontal: 4 }}>
      <Text style={{ color: c, fontWeight: 'bold' }}>{t}</Text>
    </TouchableOpacity>);

  return (
    <View style={{ flexDirection: 'row', padding: 12 }}>
      <Btn t={playing ? '⏹ إيقاف' : '▶ تشغيل الكل'} onPress={playAll} bg={VERT} c="#fff" />
      <Btn t={busy ? `⬇ ${dl}/114` : '⬇ تنزيل الكل'} onPress={downloadAll} bg={OR} c="#000" />
    </View>);
}

/* ---------- Radio ---------- */
export function RadioScreen({ onBack }) {
  const [list, setList] = useState([]);
  const [cur, setCur] = useState(null);
  const snd = useRef(null);

  useEffect(() => {
    fetch('https://www.mp3quran.net/api/v3/radios?language=ar')
      .then(r => r.json()).then(j => setList(j.radios || [])).catch(() => {});
    return () => { if (snd.current) snd.current.unloadAsync(); };
  }, []);

  const play = async (r) => {
    if (snd.current) await snd.current.unloadAsync();
    await Audio.setAudioModeAsync({ staysActiveInBackground: true });
    const { sound } = await Audio.Sound.createAsync({ uri: r.url }, { shouldPlay: true });
    snd.current = sound; setCur(r.id);
  };
  const stopRadio = async () => { if (snd.current) await snd.current.unloadAsync(); setCur(null); };

  return (
    <View style={{ flex: 1, backgroundColor: NUIT }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, paddingTop: 40 }}>
        <TouchableOpacity onPress={onBack}><Text style={{ color: OR, fontSize: 18 }}>←</Text></TouchableOpacity>
        <Text style={{ color: OR, fontSize: 20, fontWeight: 'bold' }}>إذاعة القرآن الكريم 🔴</Text>
        <TouchableOpacity onPress={stopRadio}><Text style={{ color: '#fff' }}>⏹</Text></TouchableOpacity>
      </View>
      {list.length === 0 && <ActivityIndicator color={OR} style={{ marginTop: 30 }} />}
      <ScrollView>
        {list.map(r => (
          <TouchableOpacity key={r.id} onPress={() => play(r)}
            style={{ padding: 16, marginHorizontal: 12, marginVertical: 4, borderRadius: 14,
                     backgroundColor: cur === r.id ? VERT : '#14412f' }}>
            <Text style={{ color: '#fff', fontSize: 16, textAlign: 'right' }}>
              {cur === r.id ? '🔊 ' : ''}{r.name}</Text>
          </TouchableOpacity>))}
      </ScrollView>
    </View>);
}

/* ---------- Qibla ---------- */
const KAABA = { lat: 21.4225, lon: 39.8262 };
const rad = d => d * Math.PI / 180;
function qiblaBearing(lat, lon) {
  const dl = rad(KAABA.lon - lon);
  const y = Math.sin(dl) * Math.cos(rad(KAABA.lat));
  const x = Math.cos(rad(lat)) * Math.sin(rad(KAABA.lat)) -
            Math.sin(rad(lat)) * Math.cos(rad(KAABA.lat)) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function QiblaScreen({ onBack }) {
  const [q, setQ] = useState(null);
  const [head, setHead] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    let sub;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setErr('Autorise la localisation'); return; }
      const p = await Location.getCurrentPositionAsync({});
      setQ(qiblaBearing(p.coords.latitude, p.coords.longitude));
      sub = await Location.watchHeadingAsync(h => setHead(h.trueHeading >= 0 ? h.trueHeading : h.magHeading));
    })();
    return () => sub && sub.remove();
  }, []);

  const angle = q === null ? 0 : (q - head + 360) % 360;
  const ok = q !== null && (angle < 5 || angle > 355);

  return (
    <View style={{ flex: 1, backgroundColor: NUIT, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', padding: 16, paddingTop: 40 }}>
        <TouchableOpacity onPress={onBack}><Text style={{ color: OR, fontSize: 18 }}>←</Text></TouchableOpacity>
        <Text style={{ color: OR, fontSize: 20, fontWeight: 'bold' }}>اتجاه القبلة</Text>
        <View style={{ width: 20 }} />
      </View>
      {err ? <Text style={{ color: '#fff', marginTop: 40 }}>{err}</Text> :
      q === null ? <ActivityIndicator color={OR} style={{ marginTop: 60 }} /> : (
        <>
          <View style={{ width: 260, height: 260, borderRadius: 130, borderWidth: 4,
                         borderColor: ok ? '#2ecc71' : OR, marginTop: 60,
                         alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ transform: [{ rotate: angle + 'deg' }], alignItems: 'center' }}>
              <Text style={{ fontSize: 70 }}>🕋</Text>
              <Text style={{ color: OR, fontSize: 60, marginTop: -10 }}>↑</Text>
            </View>
          </View>
          <Text style={{ color: '#fff', fontSize: 18, marginTop: 30 }}>
            {ok ? '✅ Tu es face à la Qibla' : 'Tourne le téléphone vers la flèche'}</Text>
          <Text style={{ color: OR, marginTop: 8 }}>Qibla : {Math.round(q)}°</Text>
        </>)}
    </View>);
}

export const IDRISS = {
  id: 'idriss-abkar',
  name: 'إدريس أبكر',
  nameFr: 'Idriss Abkar',
  server: 'https://archive.org/download/www.elahmad.com_17/',
};

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const GOLD = '#d4af37';
const BG = '#0b0f14';

const LIVE = [
  { name: 'Radio Mohammed VI du Saint Coran (Assadissa)', url: 'https://cdn.live.easybroadcast.io/abr_corp/73_assadissa_7b7u5n1/playlist_dvr.m3u8', sub: 'SNRT · Maroc' },
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
  { id: 'ma', label: '🇲🇦 Maroc', queries: ['countrycode=MA&tag=quran', 'countrycode=MA&name=coran', 'countrycode=MA&name=quran'] },
  { id: 'sa', label: '🇸🇦 Arabie saoudite', queries: ['countrycode=SA&tag=quran', 'countrycode=SA&name=quran'] },
  { id: 'eg', label: '🇪🇬 Égypte', queries: ['countrycode=EG&tag=quran', 'countrycode=EG&name=quran'] },
  { id: 'kw', label: '🇰🇼 Koweït', queries: ['countrycode=KW&tag=quran', 'countrycode=KW&name=quran'] },
  { id: 'fr', label: '🇫🇷 France', queries: ['countrycode=FR&tag=quran', 'countrycode=FR&name=coran'] },
  { id: 'world', label: '🌍 Monde', queries: ['tag=quran', 'name=quran', 'name=coran'] },
];

async function getJson(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 9000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function loadMp3Quran() {
  for (const u of ['https://www.mp3quran.net/api/v3/radios?language=fr', 'https://mp3quran.net/api/v3/radios?language=fr']) {
    const d = await getJson(u, 12000);
    if (d && Array.isArray(d.radios)) {
      return d.radios
        .filter(r => r && r.url && r.name)
        .map(r => ({ name: String(r.name).trim(), url: r.url, sub: 'MP3Quran' }));
    }
  }
  return [];
}

async function searchCountry(queries) {
  const seen = {};
  const out = [];
  for (const q of queries) {
    let list = null;
    for (const base of MIRRORS) {
      list = await getJson(base + '/json/stations/search?' + q + '&hidebroken=true&order=clickcount&reverse=true&limit=40', 8000);
      if (list) break;
    }
    for (const s of list || []) {
      const url = s.url_resolved || s.url || '';
      const name = (s.name || '').trim();
      if (!name || !url.startsWith('https') || seen[url]) continue;
      seen[url] = 1;
      out.push({ name, url, sub: s.country || '' });
    }
  }
  return out.slice(0, 60);
}

export default function Radio({ onClose }) {
  const playerRef = useRef(null);
  const [tab, setTab] = useState('live');
  const [apiList, setApiList] = useState(null);
  const [paysList, setPaysList] = useState([]);
  const [chip, setChip] = useState(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(null);
  const [msg, setMsg] = useState('');

  const stop = () => {
    try { if (playerRef.current) { playerRef.current.pause(); playerRef.current.remove(); } } catch (e) {}
    playerRef.current = null;
    setCurrent(null);
  };

  const pickChip = async c => {
    setChip(c.id);
    setMsg('');
    setLoading(true);
    setPaysList([]);
    const list = await searchCountry(c.queries);
    setPaysList(list);
    setLoading(false);
    if (!list.length) setMsg('Aucune radio trouvée ici. Vérifie ta connexion Internet.');
  };

  const openTab = async t => {
    setTab(t);
    setMsg('');
    setQ('');
    if (t === 'api' && apiList === null) {
      setLoading(true);
      const list = await loadMp3Quran();
      setApiList(list);
      setLoading(false);
      if (!list.length) setMsg('Bibliothèque MP3Quran indisponible. Vérifie ta connexion Internet.');
    }
    if (t === 'pays' && !chip) pickChip(CHIPS[0]);
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
      }, 20000);
    } catch (e) {
      setMsg('Cette radio ne répond pas. Essaies-en une autre.');
    }
  };

  useEffect(() => () => { try { playerRef.current && playerRef.current.remove(); } catch (e) {} }, []);

  const data = tab === 'live'
    ? LIVE
    : tab === 'api'
      ? (apiList || []).filter(s => s.name.toLowerCase().includes(q.trim().toLowerCase()))
      : paysList;

  const TABS = [['live', 'Live directs'], ['api', 'Bibliothèque'], ['pays', 'Par pays']];

  return (
    <View style={{ flex: 1, backgroundColor: BG, padding: 16, paddingTop: 50, paddingBottom: 56 }}>
      <Text style={{ color: GOLD, fontSize: 22, marginBottom: 12 }}>Radio du Coran</Text>
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        {TABS.map(([id, label]) => (
          <TouchableOpacity key={id} onPress={() => openTab(id)}
            style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === id ? GOLD : '#333' }}>
            <Text style={{ color: tab === id ? GOLD : '#888', fontWeight: 'bold' }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'pays' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
          {CHIPS.map(c => (
            <TouchableOpacity key={c.id} onPress={() => pickChip(c)}
              style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: GOLD, marginRight: 8, backgroundColor: chip === c.id ? GOLD : 'transparent' }}>
              <Text style={{ color: chip === c.id ? '#000' : GOLD, fontWeight: 'bold' }}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
      {tab === 'api' ? (
        <TextInput value={q} onChangeText={setQ} placeholder="Rechercher une radio…" placeholderTextColor="#777"
          style={{ color: '#fff', borderWidth: 1, borderColor: '#333', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 }} />
      ) : null}
      {loading ? <ActivityIndicator color={GOLD} style={{ marginVertical: 12 }} /> : null}
      <FlatList
        style={{ flex: 1 }}
        data={data}
        keyExtractor={(s, i) => s.url + i}
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

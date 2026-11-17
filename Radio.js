import React, { useEffect, useRef, useState } from 'react';
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

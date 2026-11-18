import React, { useEffect, useRef, useState } from 'react';
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

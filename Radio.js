import React, { useEffect, useRef, useState } from 'react';
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

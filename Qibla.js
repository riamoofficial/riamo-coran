import React, { useEffect, useState } from 'react';
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

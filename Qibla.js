import React, { useEffect, useRef, useState } from 'react';
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

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Vibration } from 'react-native';
import * as Location from 'expo-location';
import { Magnetometer, Accelerometer, DeviceMotion } from 'expo-sensors';

const GOLD = '#d4af37';
const BG = '#0b0f14';
const toRad = d => (d * Math.PI) / 180;
const toDeg = r => (r * 180) / Math.PI;
const NAMES = { A: 'A : aimant + accéléromètre', B: 'B : rotation du téléphone', C: 'C : cap Android' };

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
  const [mode, setMode] = useState('A');
  const [mag, setMag] = useState(null);
  const [err, setErr] = useState('');
  const modeRef = useRef('A');
  const acc = useRef(null);
  const sign = useRef(null);
  const sm = useRef(null);
  const wasAligned = useRef(false);

  const push = deg => {
    const r = toRad(deg);
    const v = sm.current
      ? { x: 0.8 * sm.current.x + 0.2 * Math.cos(r), y: 0.8 * sm.current.y + 0.2 * Math.sin(r) }
      : { x: Math.cos(r), y: Math.sin(r) };
    sm.current = v;
    setHeading((toDeg(Math.atan2(v.y, v.x)) + 360) % 360);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setErr('Autorise la localisation pour trouver la Qibla.'); return; }
        let pos = null;
        try { pos = await Location.getLastKnownPositionAsync(); } catch (e) {}
        if (pos && alive) setBearing(qiblaBearing(pos.coords.latitude, pos.coords.longitude));
        try {
          const p2 = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (alive) setBearing(qiblaBearing(p2.coords.latitude, p2.coords.longitude));
        } catch (e) {
          if (!pos && alive) setErr('Position introuvable. Active le GPS puis rouvre la Qibla.');
        }
      } catch (e) { setErr('Localisation : ' + String(e && e.message ? e.message : e)); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const subs = [];
    try {
      Magnetometer.setUpdateInterval(120);
      Accelerometer.setUpdateInterval(120);
      subs.push(Accelerometer.addListener(d => { acc.current = d; }));
      subs.push(Magnetometer.addListener(m => {
        setMag(Math.round(Math.sqrt(m.x * m.x + m.y * m.y + m.z * m.z)));
        if (modeRef.current !== 'A') return;
        const a = acc.current;
        if (!a) return;
        if (sign.current === null) {
          if (Math.abs(a.z) > 0.6) sign.current = a.z > 0 ? 1 : -1; else return;
        }
        const s = sign.current;
        const az = azimuth({ x: a.x * s, y: a.y * s, z: a.z * s }, m);
        if (az != null) push(az);
      }));
    } catch (e) { setErr('Capteurs : ' + String(e && e.message ? e.message : e)); }
    return () => subs.forEach(s => { try { s.remove(); } catch (e) {} });
  }, []);

  useEffect(() => {
    modeRef.current = mode;
    sm.current = null;
    setHeading(null);
    let sub = null;
    let alive = true;
    try {
      if (mode === 'B') {
        DeviceMotion.setUpdateInterval(100);
        sub = DeviceMotion.addListener(d => {
          const al = d && d.rotation ? d.rotation.alpha : null;
          if (typeof al === 'number') push(((360 - toDeg(al)) % 360 + 360) % 360);
        });
      } else if (mode === 'C') {
        Location.watchHeadingAsync(h => {
          const v = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (v >= 0) push(v);
        }).then(s => { if (alive) sub = s; else s.remove(); })
          .catch(e => setErr('Cap : ' + String(e && e.message ? e.message : e)));
      }
    } catch (e) { setErr('Méthode ' + mode + ' : ' + String(e && e.message ? e.message : e)); }
    return () => { alive = false; try { sub && sub.remove(); } catch (e) {} };
  }, [mode]);

  const ready = bearing !== null && heading !== null;
  const diff = ready ? ((bearing - heading + 540) % 360) - 180 : null;
  const rotation = ready ? (bearing - heading + 360) % 360 : 0;
  const isAligned = diff !== null && Math.abs(diff) <= 5;

  useEffect(() => {
    if (isAligned && !wasAligned.current) Vibration.vibrate(60);
    wasAligned.current = isAligned;
  }, [isAligned]);

  const next = () => setMode(m => (m === 'A' ? 'B' : m === 'B' ? 'C' : 'A'));

  return (
    <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', paddingBottom: 56 }}>
      <Text style={{ color: GOLD, fontSize: 22, marginBottom: 20 }}>Direction de la Qibla</Text>
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
      <Text style={{ color: isAligned ? '#3ddc84' : '#fff', marginTop: 20, fontSize: 16 }}>
        {isAligned ? '✓ Tu fais face à la Qibla' : bearing === null ? 'Recherche de ta position…' : 'Qibla : ' + Math.round(bearing) + '° depuis le nord'}
      </Text>
      <Text style={{ color: '#aaa', marginTop: 4 }}>
        {heading === null ? 'Pose le téléphone à plat et bouge-le doucement' : 'Ton cap : ' + Math.round(heading) + '°'}
      </Text>
      <Text style={{ color: '#666', marginTop: 4, fontSize: 12 }}>
        Aimant : {mag === null ? 'aucun signal' : mag + ' µT'}
      </Text>
      {mag !== null && (mag < 15 || mag > 90) ? (
        <Text style={{ color: '#ff8a80', marginTop: 4, fontSize: 12, textAlign: 'center', paddingHorizontal: 20 }}>
          Aimant perturbé : éloigne-toi du métal et fais des 8 avec le téléphone.
        </Text>
      ) : null}
      {err ? <Text style={{ color: '#ff8a80', marginTop: 8, textAlign: 'center', paddingHorizontal: 20 }}>{err}</Text> : null}
      <TouchableOpacity onPress={next} style={{ marginTop: 16, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1, borderColor: GOLD }}>
        <Text style={{ color: GOLD }}>Méthode {NAMES[mode]} (touche pour changer)</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onClose} style={{ marginTop: 18, paddingVertical: 14, paddingHorizontal: 40, backgroundColor: GOLD, borderRadius: 12 }}>
        <Text style={{ fontWeight: 'bold' }}>Fermer</Text>
      </TouchableOpacity>
    </View>
  );
}

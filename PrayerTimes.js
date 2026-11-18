import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList, TextInput } from 'react-native';

const core = require('./prayer-core');
const CITIES = require('./prayer-cities');

const GOLD = '#d4af37';
const BG = '#0b0f14';
const CARD = '#141a22';
const KEY = 'riamo.prayer.v1';
let userPicked = false;
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DEFAULT = { city: 'Paris|France', gps: null, method: 'AUTO', asr: 1, h24: true, auto: true };
const LIST = CITIES.map(c => ({ key: c[0] + '|' + c[1], name: c[0], country: c[1], lat: c[2], lng: c[3], tz: c[4], std: c[5], def: c[6] }));

async function readCfg() {
  try {
    const AS = require('@react-native-async-storage/async-storage').default;
    const s = await AS.getItem(KEY);
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}
async function writeCfg(v) {
  try {
    const AS = require('@react-native-async-storage/async-storage').default;
    await AS.setItem(KEY, JSON.stringify(v));
  } catch (e) {}
}
function nearest(lat, lng) {
  let best = LIST[0];
  let bk = 1e9;
  const rad = x => (x * Math.PI) / 180;
  for (let i = 0; i < LIST.length; i++) {
    const c = LIST[i];
    const a = Math.pow(Math.sin(rad(c.lat - lat) / 2), 2) + Math.cos(rad(lat)) * Math.cos(rad(c.lat)) * Math.pow(Math.sin(rad(c.lng - lng) / 2), 2);
    const k = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
    if (k < bk) { bk = k; best = c; }
  }
  return { c: best, km: bk };
}
function norm(s) {
  let t = String(s).toLowerCase();
  try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
  return t;
}
function fmt(h, h24) {
  if (h == null || isNaN(h)) return '--:--';
  const tot = ((Math.floor(h * 60 + 0.5) % 1440) + 1440) % 1440;
  const hh = Math.floor(tot / 60);
  const mm = tot % 60;
  const p = n => (n < 10 ? '0' : '') + n;
  if (h24) return p(hh) + ':' + p(mm);
  return (hh % 12 === 0 ? 12 : hh % 12) + ':' + p(mm) + ' ' + (hh >= 12 ? 'PM' : 'AM');
}
function countdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm ' + (s % 60) + 's';
}

export default function PrayerTimes({ onClose }) {
  const [cfg, setCfg] = useState(DEFAULT);
  const [view, setView] = useState('main');
  const [q, setQ] = useState('');
  const [now, setNow] = useState(Date.now());
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    userPicked = false;
    readCfg().then(c => {
      const n = { ...DEFAULT, ...(c || {}) };
      setCfg(n);
      if (n.auto !== false) gpsFix(n, false);
    });
  }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const update = patch => { const n = { ...cfg, ...patch }; setCfg(n); writeCfg(n); };

  const place = useMemo(() => {
    if (cfg.gps) {
      const nb = nearest(cfg.gps.lat, cfg.gps.lng);
      const near = nb.km <= 80;
      return { key: 'gps', name: 'Ma position', country: near ? 'Près de ' + nb.c.name + ', ' + nb.c.country : cfg.gps.lat.toFixed(2) + ', ' + cfg.gps.lng.toFixed(2), lat: cfg.gps.lat, lng: cfg.gps.lng, tz: null, std: -new Date().getTimezoneOffset() / 60, def: nb.km <= 700 ? nb.c.def : 'MWL' };
    }
    return LIST.find(c => c.key === cfg.city) || LIST[0];
  }, [cfg.city, cfg.gps]);

  const minuteKey = Math.floor(now / 60000);
  const offMin = useMemo(() => {
    const dt = new Date(minuteKey * 60000);
    return place.tz ? core.tzOffsetMin(place.tz, place.std, dt) : -dt.getTimezoneOffset();
  }, [place, minuteKey]);

  const methodKey = cfg.method === 'AUTO' ? place.def : cfg.method;
  const L = new Date(now + offMin * 60000);
  const y = L.getUTCFullYear();
  const m = L.getUTCMonth() + 1;
  const d = L.getUTCDate();
  const dateKey = y + '-' + m + '-' + d;

  const day = useMemo(
    () => core.prayerDay(y, m, d, place.lat, place.lng, offMin / 60, methodKey, cfg.asr),
    [dateKey, place, offMin, methodKey, cfg.asr]
  );

  const base = Date.UTC(y, m - 1, d) - offMin * 60000;
  const inst = h => base + h * 3600000;
  const order = [['fajr', 'Fajr'], ['dhuhr', 'Dhouhr'], ['asr', 'Asr'], ['maghrib', 'Maghreb'], ['isha', 'Icha']];
  let next = null;
  for (let i = 0; i < order.length; i++) {
    const k = order[i][0];
    if (!isNaN(day[k]) && inst(day[k]) > now) { next = { k, label: order[i][1], at: inst(day[k]), h: day[k] }; break; }
  }
  if (!next) {
    const t = new Date(Date.UTC(y, m - 1, d + 1));
    const nd = core.prayerDay(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), place.lat, place.lng, offMin / 60, methodKey, cfg.asr);
    next = { k: 'tomorrow', label: 'Fajr', at: Date.UTC(y, m - 1, d + 1) - offMin * 60000 + nd.fajr * 3600000, h: nd.fajr };
  }

  const gpsFix = async (baseCfg, loud) => {
    if (loud) { setBusy(true); setMsg(''); }
    try {
      const Location = require('expo-location');
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setMsg('Localisation refusée : les horaires utilisent la ville choisie. Active la localisation dans les réglages du téléphone pour plus de précision.');
        return;
      }
      let pos = null;
      try { pos = await Location.getLastKnownPositionAsync(); } catch (e) {}
      if (pos && !loud && !userPicked) setCfg({ ...baseCfg, gps: { lat: pos.coords.latitude, lng: pos.coords.longitude }, auto: true });
      try { pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); } catch (e) {}
      if (!pos) { if (loud || !baseCfg.gps) setMsg('Position introuvable. Active le GPS puis réessaie.'); return; }
      if (!loud && userPicked) return;
      const n = { ...baseCfg, gps: { lat: pos.coords.latitude, lng: pos.coords.longitude }, auto: true };
      setCfg(n);
      writeCfg(n);
      setMsg('');
    } catch (e) {
      setMsg('Localisation : ' + String(e && e.message ? e.message : e));
    } finally {
      if (loud) setBusy(false);
    }
  };
  const useGps = () => gpsFix(cfg, true);

  const Header = ({ title, back }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
      <TouchableOpacity onPress={back} style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: GOLD, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: GOLD, fontSize: 20 }}>←</Text>
      </TouchableOpacity>
      <Text style={{ color: GOLD, fontSize: 20, fontWeight: 'bold', marginLeft: 14 }}>{title}</Text>
    </View>
  );

  if (view === 'cities') {
    const f = LIST.filter(c => norm(c.name + ' ' + c.country).includes(norm(q.trim())));
    return (
      <View style={{ flex: 1, backgroundColor: BG, padding: 16, paddingTop: 50, paddingBottom: 56 }}>
        <Header title="Changer de ville" back={() => { setView('main'); setQ(''); }} />
        <TextInput value={q} onChangeText={setQ} placeholder="Rechercher une ville ou un pays…" placeholderTextColor="#777"
          style={{ color: '#fff', borderWidth: 1, borderColor: '#333', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 }} />
        <FlatList data={f} keyExtractor={c => c.key}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => { userPicked = true; update({ city: item.key, gps: null, auto: false }); setView('main'); setQ(''); }}
              style={{ padding: 14, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: item.key === cfg.city && !cfg.gps ? GOLD : '#333', backgroundColor: CARD }}>
              <Text style={{ color: '#fff', fontSize: 16 }}>{item.name}</Text>
              <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{item.country}</Text>
            </TouchableOpacity>
          )} />
      </View>
    );
  }

  if (view === 'settings') {
    const opt = (label, on, onPress) => (
      <TouchableOpacity key={label} onPress={onPress}
        style={{ padding: 14, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: on ? GOLD : '#333', backgroundColor: CARD }}>
        <Text style={{ color: on ? GOLD : '#fff' }}>{on ? '✓ ' : ''}{label}</Text>
      </TouchableOpacity>
    );
    return (
      <View style={{ flex: 1, backgroundColor: BG, padding: 16, paddingTop: 50, paddingBottom: 56 }}>
        <Header title="Réglages" back={() => setView('main')} />
        <ScrollView>
          <Text style={{ color: '#aaa', marginBottom: 8 }}>MÉTHODE DE CALCUL</Text>
          {opt('Automatique (selon la ville) : ' + core.METHODS[place.def].label, cfg.method === 'AUTO', () => update({ method: 'AUTO' }))}
          {Object.keys(core.METHODS).map(k => opt(core.METHODS[k].label, cfg.method === k, () => update({ method: k })))}
          <Text style={{ color: '#aaa', marginVertical: 8 }}>ASR</Text>
          {opt('Standard (chaféite, malékite, hanbalite)', cfg.asr === 1, () => update({ asr: 1 }))}
          {opt('Hanafite', cfg.asr === 2, () => update({ asr: 2 }))}
          <Text style={{ color: '#aaa', marginVertical: 8 }}>FORMAT DE L'HEURE</Text>
          {opt('24 heures (17:38)', cfg.h24, () => update({ h24: true }))}
          {opt('12 heures (5:38 PM)', !cfg.h24, () => update({ h24: false }))}
          <Text style={{ color: '#777', fontSize: 12, marginTop: 8, marginBottom: 30 }}>
            Les horaires sont calculés sur ton téléphone, hors ligne. Ils peuvent différer de 1 à 3 minutes de ta mosquée ou du calendrier officiel : vérifie-les avec eux.
          </Text>
        </ScrollView>
      </View>
    );
  }

  const rows = [['fajr', 'Fajr', false], ['sunrise', 'Lever du soleil', true], ['dhuhr', 'Dhouhr', false], ['asr', 'Asr', false], ['maghrib', 'Maghreb', false], ['isha', 'Icha', false]];
  const nextKey = next.k === 'tomorrow' ? 'fajr' : next.k;
  const circle = { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: GOLD, alignItems: 'center', justifyContent: 'center', marginLeft: 8 };

  return (
    <View style={{ flex: 1, backgroundColor: BG, padding: 16, paddingTop: 50, paddingBottom: 56 }}>
      <Header title="Heures de prière" back={onClose} />
      <ScrollView>
        <View style={{ backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: GOLD, padding: 18 }}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#9c8a4a', fontSize: 12, letterSpacing: 1 }}>HEURES DE PRIÈRE</Text>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 4 }}>{place.name}</Text>
              <Text style={{ color: '#ccc', marginTop: 2 }}>{place.country}</Text>
              <Text style={{ color: '#ccc', marginTop: 10 }}>{DAYS[L.getUTCDay()] + ' ' + d + ' ' + MONTHS[m - 1] + ' ' + y}</Text>
              <Text style={{ color: GOLD, marginTop: 2 }}>{core.hijri(y, m, d)}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 14, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setView('cities')} style={{ borderWidth: 1, borderColor: GOLD, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16 }}>
              <Text style={{ color: GOLD, fontWeight: 'bold' }}>Changer de ville</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={useGps} style={circle}><Text style={{ fontSize: 18 }}>{busy ? '…' : '📍'}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setView('settings')} style={circle}><Text style={{ fontSize: 18 }}>⚙️</Text></TouchableOpacity>
          </View>
          <View style={{ height: 1, backgroundColor: '#2a313b', marginVertical: 16 }} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#9c8a4a', fontSize: 12, letterSpacing: 1 }}>PROCHAINE PRIÈRE</Text>
              <Text style={{ color: GOLD, fontSize: 30, fontWeight: 'bold', marginTop: 4 }}>{next.label}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: 'bold' }}>{fmt(next.h, cfg.h24)}</Text>
              <Text style={{ color: '#ccc', marginTop: 2 }}>dans {countdown(next.at - now)}</Text>
            </View>
          </View>
        </View>
        {msg ? <Text style={{ color: '#ff8a80', marginTop: 10 }}>{msg}</Text> : null}
        <View style={{ backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: '#333', padding: 16, marginTop: 16 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 6 }}>Horaires du jour</Text>
          {rows.map(r => {
            const isNext = r[0] === nextKey && !r[2];
            return (
              <View key={r[0]} style={{ flexDirection: 'row', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#2a313b' }}>
                <Text style={{ flex: 1, fontSize: 18, color: r[2] ? '#777' : isNext ? GOLD : '#fff', fontWeight: isNext ? 'bold' : 'normal' }}>
                  {r[1]}{r[2] ? '  · INFO' : ''}
                </Text>
                <Text style={{ fontSize: 18, color: r[2] ? '#777' : isNext ? GOLD : '#fff', fontWeight: isNext ? 'bold' : 'normal' }}>{fmt(day[r[0]], cfg.h24)}</Text>
              </View>
            );
          })}
        </View>
        <Text style={{ color: '#777', textAlign: 'center', marginTop: 14, marginBottom: 30, fontSize: 12 }}>
          {LIST.length} villes · calcul local, hors ligne · {core.METHODS[methodKey].label}
        </Text>
      </ScrollView>
    </View>
  );
}

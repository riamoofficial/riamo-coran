import React, { useEffect, useRef, useState, useMemo, useContext, createContext } from 'react';
import {
  View, Text, Image, TextInput, FlatList, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet, StatusBar, BackHandler, Alert, Switch,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import PHOTOS_URL from './photos';
import LOCAL from './photos-local';
import CUSTOM from './custom';
import { MAROC_RECITERS, SURAHS } from './reciters';
let FS = null;
try { FS = require('expo-file-system'); } catch (e) {}

const PHOTOS = { ...PHOTOS_URL, ...LOCAL };

const MONETAG_LINK = 'https://uplcm.com/4/12294886';
const ouvrirPub = () => Linking.openURL(MONETAG_LINK).catch(() => {});
const SoutenirBouton = () => (
  <TouchableOpacity onPress={ouvrirPub} style={{ padding: 10, alignItems: 'center' }}>
    <Text style={{ fontSize: 13, opacity: 0.7 }}>Soutenir l'application</Text>
  </TouchableOpacity>
);

// ===== COULEURS (modifie ici) =====
const LIGHT = { bg: '#F3F4EF', card: '#FFFFFF', hero: '#141a22', heroSoft: '#141a22', green: '#1c242e', greenSoft: '#E3F1EA', gold: '#C9A646', goldSoft: '#F6EDD0', goldText: '#7A5F12', text: '#0b0f14', dim: '#6B7A72', line: '#E4E8E2', danger: '#D8573C', white: '#FFFFFF' };
const DARK = { bg: '#0b0f14', card: '#0b0f14', hero: '#141a22', heroSoft: '#141a22', green: '#d4af37', greenSoft: '#141a22', gold: '#D4AF37', goldSoft: '#3A3213', goldText: '#F1D98A', text: '#EEF3EF', dim: '#98ADA2', line: '#0b0f14', danger: '#E8735A', white: '#FFFFFF' };

// ===== TEXTES (français / arabe / anglais) =====
const T = {
  fr: { tagline: 'Les plus belles voix du Maroc • Riwaya Warsh', browse: 'Parcourir les récitateurs', searchPh: 'Rechercher un récitateur ou une sourate…', statRec: 'récitateurs', statSur: 'sourates', statHeard: 'écoutées', resume: 'REPRENDRE LA LECTURE', khatma: 'Ma khatma', khatmaSub: (n) => n + ' sur 114 sourates écoutées', topRec: 'Récitateurs marocains', seeAll: 'Tout voir', verse: 'VERSET DU JOUR', verseN: 'Verset', favs: 'Mes favoris', recents: 'Récemment écoutés', others: 'Autres récitateurs Warsh', tabHome: 'Accueil', tabRec: 'Récitateurs', tabSur: 'Sourates', tabMore: 'Plus', offBanner: 'Mode hors connexion', language: 'Langue', dark: 'Mode sombre', offMode: 'Mode hors connexion', offSub: 'Écouter uniquement les sourates téléchargées', downloads: 'Téléchargements', noDl: "Aucun téléchargement. Appuie sur ⬇ à côté d'une sourate.", noFav: "Appuie sur ♡ à côté d'un récitateur pour l'ajouter ici.", notAvail: 'Non disponible', notDl: 'Non téléchargée', playAll: 'Tout écouter', back: 'Retour', verses: 'versets', dlAsk: 'Télécharger cette sourate ?', delAsk: 'Supprimer ce téléchargement ?', delOk: 'Supprimer', cancel: 'Annuler', ok: 'Télécharger', dlFail: 'Téléchargement impossible.', dlNeedFS: "Le téléchargement n'est pas disponible sur cette version.", playFail: 'Ce fichier audio ne répond pas. Réessaie ou choisis un autre récitateur.', loadErr: 'Impossible de charger les récitateurs. Vérifie ta connexion.', retry: 'Réessayer', noResult: 'Aucun résultat.', reciter: 'Récitateur', change: 'Changer', about: 'À propos', aboutTxt: 'RIAMO Coran — récitations du Coran en Warsh. Les photos et les enregistrements appartiennent à leurs auteurs.', resetKh: 'Réinitialiser la khatma', favTitle: 'Favoris', cat_all: 'Tous', cat_old: 'Anciens Maîtres', cat_con: 'Contemporains', cat_new: 'Nouvelle génération', cat_oth: 'Autres Warsh' },
  ar: { tagline: 'أجمل أصوات المغرب • برواية ورش عن نافع', browse: 'تصفّح القرّاء', searchPh: 'ابحث عن قارئ أو سورة…', statRec: 'قارئ', statSur: 'سورة', statHeard: 'تم سماعها', resume: 'متابعة الاستماع', khatma: 'ختمتي', khatmaSub: (n) => n + ' من 114 سورة', topRec: 'القرّاء المغاربة', seeAll: 'عرض الكل', verse: 'آية اليوم', verseN: 'الآية', favs: 'مفضلتي', recents: 'استمعت مؤخرًا', others: 'قرّاء آخرون بورش', tabHome: 'الرئيسية', tabRec: 'القرّاء', tabSur: 'السور', tabMore: 'المزيد', offBanner: 'وضع بدون اتصال', language: 'اللغة', dark: 'الوضع الداكن', offMode: 'وضع بدون اتصال', offSub: 'الاستماع إلى السور المحمّلة فقط', downloads: 'التحميلات', noDl: 'لا توجد تحميلات. اضغط ⬇ بجانب السورة.', noFav: 'اضغط ♡ بجانب القارئ لإضافته هنا.', notAvail: 'غير متوفرة', notDl: 'غير محمّلة', playAll: 'استمع للكل', back: 'رجوع', verses: 'آية', dlAsk: 'تحميل هذه السورة؟', delAsk: 'حذف هذا التحميل؟', delOk: 'حذف', cancel: 'إلغاء', ok: 'تحميل', dlFail: 'تعذّر التحميل.', dlNeedFS: 'التحميل غير متاح في هذا الإصدار.', playFail: 'تعذّر تشغيل هذا الملف. حاول مرة أخرى أو اختر قارئًا آخر.', loadErr: 'تعذّر تحميل القرّاء. تحقق من الاتصال.', retry: 'إعادة المحاولة', noResult: 'لا توجد نتائج.', reciter: 'القارئ', change: 'تغيير', about: 'حول', aboutTxt: 'RIAMO Coran — تلاوات القرآن برواية ورش. الصور والتسجيلات ملك لأصحابها.', resetKh: 'إعادة ضبط الختمة', favTitle: 'المفضلة', cat_all: 'الكل', cat_old: 'كبار القرّاء', cat_con: 'معاصرون', cat_new: 'جيل جديد', cat_oth: 'قرّاء آخرون' },
  en: { tagline: 'The finest voices of Morocco • Warsh riwaya', browse: 'Browse reciters', searchPh: 'Search a reciter or a surah…', statRec: 'reciters', statSur: 'surahs', statHeard: 'heard', resume: 'CONTINUE LISTENING', khatma: 'My khatma', khatmaSub: (n) => n + ' of 114 surahs heard', topRec: 'Moroccan reciters', seeAll: 'See all', verse: 'VERSE OF THE DAY', verseN: 'Verse', favs: 'My favorites', recents: 'Recently played', others: 'Other Warsh reciters', tabHome: 'Home', tabRec: 'Reciters', tabSur: 'Surahs', tabMore: 'More', offBanner: 'Offline mode', language: 'Language', dark: 'Dark mode', offMode: 'Offline mode', offSub: 'Play downloaded surahs only', downloads: 'Downloads', noDl: 'No downloads yet. Tap ⬇ next to a surah.', noFav: 'Tap ♡ next to a reciter to add it here.', notAvail: 'Not available', notDl: 'Not downloaded', playAll: 'Play all', back: 'Back', verses: 'verses', dlAsk: 'Download this surah?', delAsk: 'Delete this download?', delOk: 'Delete', cancel: 'Cancel', ok: 'Download', dlFail: 'Download failed.', dlNeedFS: 'Downloads are not available in this version.', playFail: 'This audio file does not respond. Try again or pick another reciter.', loadErr: 'Could not load reciters. Check your connection.', retry: 'Retry', noResult: 'No results.', reciter: 'Reciter', change: 'Change', about: 'About', aboutTxt: 'RIAMO Coran — Quran recitations in Warsh. Photos and recordings belong to their authors.', resetKh: 'Reset khatma', favTitle: 'Favorites', cat_all: 'All', cat_old: 'Legends', cat_con: 'Contemporary', cat_new: 'New generation', cat_oth: 'Other Warsh' },
};
const CATS = [['Tous', 'cat_all'], ['Anciens Maîtres', 'cat_old'], ['Contemporains', 'cat_con'], ['Nouvelle génération', 'cat_new'], ['Autres Warsh', 'cat_oth']];

const API_WARSH = 'https://mp3quran.net/api/v3/reciters?language=ar&rewaya=2';
const API_ALL = 'https://mp3quran.net/api/v3/reciters?language=ar';
const KEY = 'riamo-coran-v2';
const CACHE = 'riamo-reciters-v2';
const TAB_H = 64;
const TOP = StatusBar.currentHeight || 30;

const norm = (s) =>
  String(s || '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .toLowerCase().trim();
const tokMatch = (name, kw) => {
  const n = norm(name);
  return norm(kw).split(' ').filter(Boolean).every((t) => n.includes(t));
};
const fmt = (ms) => {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
const initials = (name) =>
  String(name).split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

const remoteUri = (reciter, surah) => {
  const nnn = String(surah.number).padStart(3, '0');
  const enc = (f) => f.split('/').map(encodeURIComponent).join('/');
  if (reciter.files && reciter.files[surah.number]) return reciter.server + enc(String(reciter.files[surah.number]));
  if (reciter.pattern) {
    const file = reciter.pattern.replace(/\{nnn\}/g, nnn).replace(/\{n\}/g, String(surah.number)).replace(/\{ar\}/g, surah.nameAr);
    return reciter.server + enc(file);
  }
  return reciter.server + nnn + '.mp3';
};

// ===== Fichiers (téléchargements) =====
const fsOK = () => !!FS && (!!FS.File || !!FS.downloadAsync);
async function fsDownload(url, name) {
  if (FS.File && FS.Directory && FS.Paths) {
    const dir = new FS.Directory(FS.Paths.document, 'riamo');
    try { dir.create({ intermediates: true, idempotent: true }); } catch (e) {}
    const file = new FS.File(dir, name);
    try { if (file.exists) file.delete(); } catch (e) {}
    const out = await FS.File.downloadFileAsync(url, file);
    return (out && out.uri) || file.uri;
  }
  const uri = FS.documentDirectory + name;
  const r = await FS.downloadAsync(url, uri);
  return r.uri;
}
async function fsExists(uri) {
  if (!FS || !uri) return false;
  try {
    if (FS.File) return !!new FS.File(uri).exists;
    const i = await FS.getInfoAsync(uri);
    return !!i.exists;
  } catch (e) { return false; }
}
async function fsDelete(uri) {
  try {
    if (FS.File) { new FS.File(uri).delete(); return; }
    await FS.deleteAsync(uri, { idempotent: true });
  } catch (e) {}
}
async function sizeOf(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return parseInt(r.headers.get('content-length') || '0', 10);
  } catch (e) { return 0; }
}

// ===== Récitateurs Warsh depuis MP3Quran =====
async function fetchWarsh(url) {
  const res = await fetch(url);
  const json = await res.json();
  const out = [];
  for (const r of json.reciters || []) {
    let best = null;
    for (const x of r.moshaf || []) {
      if (!x.server || !norm(x.name).includes('ورش')) continue;
      const list = String(x.surah_list || '').split(',').map((n) => parseInt(n, 10)).filter(Boolean);
      if (list.length >= 20 && (!best || list.length > best.list.length)) best = { x, list };
    }
    if (best) {
      out.push({
        apiName: r.name,
        server: best.x.server.endsWith('/') ? best.x.server : best.x.server + '/',
        surahs: best.list.length >= 114 ? null : best.list,
      });
    }
  }
  return out;
}
async function loadReciters() {
  let warsh = [];
  try { warsh = await fetchWarsh(API_WARSH); } catch (e) {}
  if (warsh.length === 0) warsh = await fetchWarsh(API_ALL);
  const used = new Set();
  const found = [];
  for (const def of MAROC_RECITERS) {
    const hit = warsh.find((w) => !used.has(w.apiName) && def.keywords.some((k) => tokMatch(w.apiName, k)));
    if (hit) {
      found.push({ ...def, server: hit.server, surahs: hit.surahs, image: null });
      used.add(hit.apiName);
    }
  }
  const custom = CUSTOM.filter((c) => c.server);
  const customIds = new Set(custom.map((c) => c.id));
  const maroc = [...custom, ...found.filter((f) => !customIds.has(f.id))];
  const others = warsh
    .filter((w) => !used.has(w.apiName))
    .map((w, i) => ({ id: 'other-' + i, name: w.apiName, arabicName: w.apiName, category: 'Autres Warsh', tag: '🎙️ Warsh', server: w.server, surahs: w.surahs, image: null }));
  return { maroc, others };
}
const fixImgs = (d) => ({
  maroc: d.maroc.map((r) => ({ ...r, image: PHOTOS[r.id] || (typeof r.image === 'string' ? r.image : null) })),
  others: d.others.map((r) => ({ ...r, image: PHOTOS[r.id] || (typeof r.image === 'string' ? r.image : null) })),
});

// ===== Styles =====
const makeStyles = (C, rtl) => {
  const row = rtl ? 'row-reverse' : 'row';
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    hero: { backgroundColor: C.hero, paddingTop: TOP + 12, paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    heroTop: { flexDirection: row, justifyContent: 'flex-end', marginBottom: 14 },
    pill: { backgroundColor: C.heroSoft, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18, marginHorizontal: 4 },
    pillTxt: { color: C.white, fontWeight: '800', fontSize: 13 },
    heroTitle: { color: C.gold, fontSize: 32, fontWeight: '900', textAlign: rtl ? 'right' : 'left' },
    heroSub: { color: '#BFD6CB', marginTop: 4, fontSize: 13, lineHeight: 20, textAlign: rtl ? 'right' : 'left' },
    heroBtn: { backgroundColor: C.gold, alignSelf: 'center', paddingHorizontal: 26, paddingVertical: 13, borderRadius: 28, marginTop: 18 },
    heroBtnTxt: { color: '#0b0f14', fontWeight: '900', fontSize: 15 },
    offPill: { alignSelf: 'center', marginTop: 12, backgroundColor: '#141a22', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
    heroSearch: { backgroundColor: C.heroSoft, color: C.white, marginTop: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, textAlign: rtl ? 'right' : 'left' },
    stats: { flexDirection: row, marginTop: 16 },
    stat: { flex: 1, backgroundColor: C.heroSoft, borderRadius: 16, paddingVertical: 12, marginHorizontal: 4, alignItems: 'center' },
    statNum: { color: C.gold, fontSize: 20, fontWeight: '900' },
    statLbl: { color: '#BFD6CB', fontSize: 11, marginTop: 2 },
    card: { backgroundColor: C.card, borderRadius: 24, marginHorizontal: 16, marginTop: 16, paddingVertical: 16, elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
    secRow: { flexDirection: row, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14 },
    secTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
    secAction: { color: C.green, fontWeight: '700' },
    kicker: { color: C.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    hItem: { width: 96, alignItems: 'center', marginHorizontal: 4 },
    hName: { color: C.text, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 8 },
    playDot: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
    verse: { color: C.white, fontSize: 22, lineHeight: 40, textAlign: 'center', marginVertical: 14 },
    recent: { flexDirection: row, alignItems: 'center', paddingVertical: 8 },
    footer: { textAlign: 'center', color: C.dim, marginTop: 24, fontSize: 12 },
    pageTitle: { color: C.text, fontSize: 28, fontWeight: '900', paddingHorizontal: 16, marginBottom: 6, textAlign: rtl ? 'right' : 'left' },
    search: { backgroundColor: C.card, color: C.text, marginHorizontal: 16, marginVertical: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: C.line, textAlign: rtl ? 'right' : 'left' },
    chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: C.card, marginHorizontal: 4, borderWidth: 1, borderColor: C.line },
    chipOn: { backgroundColor: C.green, borderColor: C.green },
    chipTxt: { color: C.text, fontWeight: '700' },
    row: { flexDirection: row, alignItems: 'center', backgroundColor: C.card, marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: C.line },
    rowName: { color: C.text, fontWeight: '700', fontSize: 15 },
    rowSub: { color: C.dim, marginTop: 2, fontSize: 12 },
    surahAr: { color: C.green, fontSize: 20, fontWeight: '700' },
    num: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' },
    numTxt: { color: C.green, fontWeight: '800' },
    bannerName: { color: C.text, fontSize: 22, fontWeight: '900', marginTop: 14 },
    bannerAr: { color: C.gold, fontSize: 18, marginTop: 4 },
    badge: { backgroundColor: C.goldSoft, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 10 },
    badgeTxt: { color: C.goldText, fontSize: 11, fontWeight: '700' },
    btn: { backgroundColor: C.green, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 26 },
    btnTxt: { color: C.white, fontWeight: '800' },
    empty: { color: C.dim, textAlign: 'center', marginTop: 30, paddingHorizontal: 30 },
    setRow: { flexDirection: row, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
    langBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: C.line, marginHorizontal: 4 },
    player: { position: 'absolute', left: 8, right: 8, bottom: TAB_H + 6, backgroundColor: C.card, padding: 12, borderRadius: 22, borderWidth: 1, borderColor: C.line, elevation: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12 },
    playerTitle: { color: C.text, fontWeight: '800', fontSize: 14 },
    playerSub: { color: C.dim, fontSize: 12, marginTop: 2 },
    ctrl: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    ctrlMain: { backgroundColor: C.green, borderRadius: 18, marginHorizontal: 4 },
    ctrlTxt: { color: C.text, fontSize: 17 },
    barHit: { paddingVertical: 10 },
    barBg: { height: 5, borderRadius: 3, backgroundColor: C.line },
    barFill: { height: 5, borderRadius: 3, backgroundColor: C.green },
    time: { color: C.dim, fontSize: 11 },
    tabbar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: TAB_H, backgroundColor: C.card, flexDirection: row, borderTopWidth: 2, borderTopColor: C.gold, elevation: 20 },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    tabTxt: { color: C.dim, fontSize: 11, marginTop: 2 },
  });
};

const Ctx = createContext(null);
const useX = () => useContext(Ctx);

// ===== Composants =====
function Avatar({ reciter, size = 64, ring }) {
  const { C } = useX();
  const [failed, setFailed] = useState(false);
  const outer = size + 10;
  const img = reciter.image;
  const src = typeof img === 'string' ? { uri: img } : img;
  return (
    <View style={{ width: outer, height: outer, borderRadius: outer / 2, borderWidth: 2.5, borderColor: ring || C.green, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card }}>
      {src && !failed ? (
        <Image source={src} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.green, fontWeight: '800', fontSize: size * 0.36 }}>{initials(reciter.name)}</Text>
        </View>
      )}
    </View>
  );
}

function SectionHeader({ title, action, onAction }) {
  const { S } = useX();
  return (
    <View style={S.secRow}>
      <Text style={S.secTitle}>{title}</Text>
      {action ? <TouchableOpacity onPress={onAction}><Text style={S.secAction}>{action}</Text></TouchableOpacity> : null}
    </View>
  );
}

function ReciterRow({ r }) {
  const { C, S, dn, saved, toggleFav, openReciter } = useX();
  const fav = saved.favs.includes(r.id);
  return (
    <TouchableOpacity onPress={() => openReciter(r)} style={S.row} activeOpacity={0.85}>
      <Avatar reciter={r} size={46} ring={C.gold} />
      <View style={{ flex: 1, marginHorizontal: 14 }}>
        <Text numberOfLines={1} style={S.rowName}>{dn(r)}</Text>
        <Text numberOfLines={1} style={S.rowSub}>{r.tag}</Text>
      </View>
      <TouchableOpacity onPress={() => toggleFav(r.id)} style={{ padding: 8 }}>
        <Text style={{ fontSize: 20, color: fav ? C.danger : C.dim }}>{fav ? '♥' : '♡'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function SurahRow({ reciter, s }) {
  const { C, S, t, lang, sn, saved, busy, download, removeDl, playSurah, now } = useX();
  const key = reciter.id + '-' + s.number;
  const off = saved.offline[key];
  const missing = reciter.surahs && !reciter.surahs.includes(s.number);
  const blocked = missing || (saved.offlineMode && !off);
  const active = now && now.surah.number === s.number && now.reciter.id === reciter.id;
  const done = saved.done.includes(s.number);
  return (
    <TouchableOpacity onPress={() => { if (!blocked) playSurah(reciter, s); }} style={[S.row, blocked && { opacity: 0.35 }, active && { borderColor: C.green, borderWidth: 1.5 }]} activeOpacity={0.85}>
      <View style={S.num}><Text style={S.numTxt}>{s.number}</Text></View>
      <View style={{ flex: 1, marginHorizontal: 14 }}>
        <Text style={S.rowName}>{sn(s)}{done ? '  ✓' : ''}</Text>
        <Text style={S.rowSub}>{missing ? t.notAvail : (saved.offlineMode && !off) ? t.notDl : s.verses + ' ' + t.verses}</Text>
      </View>
      {!missing ? (
        <TouchableOpacity onPress={() => (off ? removeDl(reciter, s) : download(reciter, s))} style={{ padding: 8 }}>
          {busy[key] ? <ActivityIndicator color={C.green} /> : <Text style={{ fontSize: 18, color: off ? C.green : C.dim }}>{off ? '✓' : '⬇'}</Text>}
        </TouchableOpacity>
      ) : null}
      {lang !== 'ar' ? <Text style={S.surahAr}>{s.nameAr}</Text> : null}
    </TouchableOpacity>
  );
}

function Player({ now, status, loading, onToggle, onNext, onPrev, onSeek, onStop }) {
  const { C, S, dn, sn } = useX();
  const [w, setW] = useState(1);
  if (!now) return null;
  const pos = (status && status.positionMillis) || 0;
  const dur = (status && status.durationMillis) || 0;
  const pct = dur ? Math.min(1, pos / dur) : 0;
  const playing = status && status.isPlaying;
  return (
    <View style={S.player}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar reciter={now.reciter} size={36} ring={C.gold} />
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text numberOfLines={1} style={S.playerTitle}>{now.surah.number}. {sn(now.surah)}</Text>
          <Text numberOfLines={1} style={S.playerSub}>{dn(now.reciter)}</Text>
        </View>
        <TouchableOpacity onPress={onPrev} style={S.ctrl}><Text style={S.ctrlTxt}>⏮</Text></TouchableOpacity>
        <TouchableOpacity onPress={onToggle} style={[S.ctrl, S.ctrlMain]}>
          {loading ? <ActivityIndicator color={C.white} /> : <Text style={[S.ctrlTxt, { color: C.white }]}>{playing ? '⏸' : '▶'}</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} style={S.ctrl}><Text style={S.ctrlTxt}>⏭</Text></TouchableOpacity>
        <TouchableOpacity onPress={onStop} style={S.ctrl}><Text style={[S.ctrlTxt, { color: C.danger }]}>✕</Text></TouchableOpacity>
      </View>
      <TouchableOpacity activeOpacity={1} onLayout={(e) => setW(e.nativeEvent.layout.width || 1)} onPress={(e) => onSeek(e.nativeEvent.locationX / w)} style={S.barHit}>
        <View style={S.barBg}><View style={[S.barFill, { width: pct * 100 + '%' }]} /></View>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={S.time}>{fmt(pos)}</Text>
        <Text style={S.time}>-{fmt(dur - pos)}</Text>
      </View>
    </View>
  );
}

function TabBar({ tab, onTab }) {
  const { C, S, t } = useX();
  const items = [['home', '🏠', t.tabHome], ['reciters', '🎙️', t.tabRec], ['surahs', '📖', t.tabSur], ['more', '☰', t.tabMore]];
  return (
    <View style={S.tabbar}>
      {items.map((it) => (
        <TouchableOpacity key={it[0]} style={S.tab} onPress={() => onTab(it[0])}>
          <Text style={{ fontSize: 20, opacity: tab === it[0] ? 1 : 0.45 }}>{it[1]}</Text>
          <Text style={[S.tabTxt, tab === it[0] && { color: C.green, fontWeight: '800' }]}>{it[2]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ===== Application =====
export default function App() {
  const [data, setData] = useState({ maroc: [], others: [] });
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('home');
  const [selected, setSelected] = useState(null);
  const [pickedId, setPickedId] = useState(null);
  const [category, setCategory] = useState('Tous');
  const [query, setQuery] = useState('');
  const [surahQuery, setSurahQuery] = useState('');
  const [now, setNow] = useState(null);
  const [status, setStatus] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [saved, setSaved] = useState({ favs: [], recents: [], done: [], last: null, offline: {}, lang: 'fr', dark: false, offlineMode: false });
  const [ready, setReady] = useState(false);
  const [verse, setVerse] = useState(null);
  const [busy, setBusy] = useState({});

  const soundRef = useRef(null);
  const nowRef = useRef(null);
  const tokenRef = useRef(0);
  const playRef = useRef(null);
  const savedRef = useRef(saved);
  savedRef.current = saved;

  const lang = saved.lang || 'fr';
  const rtl = lang === 'ar';
  const t = T[lang] || T.fr;
  const C = saved.dark ? DARK : LIGHT;
  const S = useMemo(() => makeStyles(C, rtl), [saved.dark, rtl]);
  const dn = (r) => (lang === 'ar' && r.arabicName ? r.arabicName : r.name);
  const sn = (s) => (lang === 'ar' ? s.nameAr : s.nameFr);

  const fetchList = async () => {
    setLoadingList(true);
    setError(null);
    let cached = null;
    try { const c = await AsyncStorage.getItem(CACHE); if (c) cached = JSON.parse(c); } catch (e) {}
    if (savedRef.current.offlineMode && cached) { setData(fixImgs(cached)); setLoadingList(false); return; }
    try {
      const d = await loadReciters();
      const withImg = fixImgs(d);
      setData(withImg);
      AsyncStorage.setItem(CACHE, JSON.stringify(withImg)).catch(() => {});
    } catch (e) {
      if (cached) setData(fixImgs(cached)); else setError(true);
    }
    setLoadingList(false);
  };

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
    AsyncStorage.getItem(KEY).then((s) => {
      let o = {};
      try { o = s ? JSON.parse(s) : {}; } catch (e) {}
      setSaved((p) => ({ ...p, ...o }));
      setReady(true);
    }).catch(() => setReady(true));
    return () => { if (soundRef.current) { try { soundRef.current.remove(); } catch (e) {} } };
  }, []);

  useEffect(() => {
    if (!ready) return;
    fetchList();
    if (!savedRef.current.offlineMode) {
      const d = new Date();
      const day = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
      const n = ((day * 37 + d.getFullYear()) % 6236) + 1;
      fetch('https://api.alquran.cloud/v1/ayah/' + n + '/quran-uthmani')
        .then((r) => r.json())
        .then((j) => { if (j && j.data) setVerse({ text: j.data.text, surah: j.data.surah, num: j.data.numberInSurah }); })
        .catch(() => {});
    }
  }, [ready]);

  useEffect(() => { if (ready) AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {}); }, [saved, ready]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selected) { setSelected(null); return true; }
      if (tab !== 'home') { setTab('home'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [selected, tab]);

  const playable = (r, n) => (!r.surahs || r.surahs.includes(n)) && (!savedRef.current.offlineMode || !!savedRef.current.offline[r.id + '-' + n]);
  const nextPlayable = (r, from, d) => {
    for (let n = from + d; n >= 1 && n <= 114; n += d) if (playable(r, n)) return SURAHS[n - 1];
    return null;
  };

  const playSurah = async (reciter, surah) => {
    const sv = savedRef.current;
    const key = reciter.id + '-' + surah.number;
    let uri = remoteUri(reciter, surah);
    const off = sv.offline[key];
    const local = off ? await fsExists(off) : false;
    if (local) uri = off;
    else if (sv.offlineMode) { Alert.alert(t.offBanner, t.notDl); return; }
    const token = ++tokenRef.current;
    setLoadingAudio(true);
    nowRef.current = { reciter, surah };
    setNow({ reciter, surah });
    setStatus(null);
    setPickedId(reciter.id);
    setSaved((p) => ({
      ...p,
      last: { rid: reciter.id, n: surah.number },
      recents: [{ rid: reciter.id, n: surah.number }, ...p.recents.filter((x) => !(x.rid === reciter.id && x.n === surah.number))].slice(0, 8),
    }));
    try {
      if (soundRef.current) { try { soundRef.current.remove(); } catch (e) {} soundRef.current = null; }
      const player = createAudioPlayer({ uri });
      soundRef.current = player;
      player.addListener('playbackStatusUpdate', (st) => {
        if (token !== tokenRef.current) return;
        if (st.isLoaded) setLoadingAudio(false);
        setStatus({ isLoaded: st.isLoaded, isPlaying: st.playing, positionMillis: (st.currentTime || 0) * 1000, durationMillis: (st.duration || 0) * 1000 });
        if (st.didJustFinish) {
          const cur = nowRef.current;
          if (cur) {
            const num = cur.surah.number;
            setSaved((p) => (p.done.includes(num) ? p : { ...p, done: [...p.done, num] }));
            const nx = nextPlayable(cur.reciter, num, 1);
            if (nx) playRef.current(cur.reciter, nx);
          }
        }
      });
      player.play();
    } catch (e) {
      if (token === tokenRef.current) { setLoadingAudio(false); Alert.alert(t.reciter, t.playFail); }
    }
  };
  playRef.current = playSurah;

  const stopAll = () => {
    tokenRef.current++;
    if (soundRef.current) { try { soundRef.current.pause(); soundRef.current.remove(); } catch (e) {} soundRef.current = null; }
    nowRef.current = null;
    setNow(null);
    setStatus(null);
    setLoadingAudio(false);
  };
  const toggle = () => {
    const p = soundRef.current;
    if (!p) return;
    if (p.playing) p.pause(); else p.play();
  };
  const step = (d) => {
    const cur = nowRef.current;
    if (!cur) return;
    const nx = nextPlayable(cur.reciter, cur.surah.number, d);
    if (nx) playSurah(cur.reciter, nx);
  };
  const seek = (ratio) => {
    const p = soundRef.current;
    if (!p || !status || !status.durationMillis) return;
    p.seekTo((Math.max(0, Math.min(1, ratio)) * status.durationMillis) / 1000);
  };

  const download = async (reciter, surah) => {
    if (!fsOK()) { Alert.alert(t.downloads, t.dlNeedFS); return; }
    const key = reciter.id + '-' + surah.number;
    if (busy[key]) return;
    const url = remoteUri(reciter, surah);
    const n = await sizeOf(url);
    const msg = (n ? Math.round(n / 1048576) + ' MB\n' : '') + t.dlAsk;
    const go = await new Promise((res) =>
      Alert.alert(t.downloads, msg, [
        { text: t.cancel, style: 'cancel', onPress: () => res(false) },
        { text: t.ok, onPress: () => res(true) },
      ], { cancelable: true, onDismiss: () => res(false) })
    );
    if (!go) return;
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      const uri = await fsDownload(url, reciter.id + '_' + String(surah.number).padStart(3, '0') + '.mp3');
      setSaved((p) => ({ ...p, offline: { ...p.offline, [key]: uri } }));
    } catch (e) { Alert.alert(t.downloads, t.dlFail); }
    setBusy((b) => { const c = { ...b }; delete c[key]; return c; });
  };
  const removeDl = (reciter, surah) => {
    const key = reciter.id + '-' + surah.number;
    const uri = savedRef.current.offline[key];
    Alert.alert(t.downloads, t.delAsk, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delOk, style: 'destructive', onPress: async () => {
        if (uri) await fsDelete(uri);
        setSaved((p) => { const o = { ...p.offline }; delete o[key]; return { ...p, offline: o }; });
      } },
    ]);
  };

  const toggleFav = (id) => setSaved((p) => ({ ...p, favs: p.favs.includes(id) ? p.favs.filter((x) => x !== id) : [...p.favs, id] }));
  const openReciter = (r) => { setSelected(r); setPickedId(r.id); setSurahQuery(''); };
  const goTab = (x) => { setSelected(null); setQuery(''); setTab(x); };
  const cycleLang = () => setSaved((p) => ({ ...p, lang: p.lang === 'fr' ? 'ar' : p.lang === 'ar' ? 'en' : 'fr' }));
  const setLang = (l) => setSaved((p) => ({ ...p, lang: l }));

  // ----- Données -----
  const everyone = useMemo(() => [...data.maroc, ...data.others], [data]);
  const byId = useMemo(() => { const m = {}; everyone.forEach((r) => { m[r.id] = r; }); return m; }, [everyone]);
  const lastR = saved.last ? byId[saved.last.rid] : null;
  const lastS = saved.last ? SURAHS[saved.last.n - 1] : null;
  const curReciter = byId[pickedId] || lastR || data.maroc[0] || data.others[0] || null;
  const pctDone = Math.round((saved.done.length / 114) * 100);
  const favList = saved.favs.map((id) => byId[id]).filter(Boolean);
  const recentItems = saved.recents.map((x) => ({ r: byId[x.rid], s: SURAHS[x.n - 1] })).filter((x) => x.r && x.s).slice(0, 5);

  const q = norm(query);
  const searchReciters = useMemo(() => (q ? everyone.filter((r) => norm(r.name).includes(q) || norm(r.arabicName).includes(q)) : []), [everyone, q]);
  const searchSurahs = useMemo(() => (q ? SURAHS.filter((s) => String(s.number) === q || norm(s.nameFr).includes(q) || norm(s.nameAr).includes(q)).slice(0, 8) : []), [q]);
  const listFiltered = useMemo(() => everyone.filter((r) => (category === 'Tous' || r.category === category) && (!q || norm(r.name).includes(q) || norm(r.arabicName).includes(q))), [everyone, category, q]);
  const sq = norm(surahQuery);
  const filteredSurahs = useMemo(() => (sq ? SURAHS.filter((s) => String(s.number) === sq || norm(s.nameFr).includes(sq) || norm(s.nameAr).includes(sq)) : SURAHS), [sq]);

  const pad = (now ? 150 : 20) + TAB_H;
  const X = { C, S, t, lang, dn, sn, saved, busy, download, removeDl, playSurah, toggleFav, openReciter, now };

  const hRow = (list) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
      {list.map((r) => (
        <TouchableOpacity key={r.id} onPress={() => openReciter(r)} style={S.hItem} activeOpacity={0.8}>
          <Avatar reciter={r} size={72} />
          <Text numberOfLines={2} style={S.hName}>{dn(r)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // ----- Accueil -----
  const hero = (
    <View style={S.hero}>
      <View style={S.heroTop}>
        <TouchableOpacity style={S.pill} onPress={cycleLang}><Text style={S.pillTxt}>{lang === 'fr' ? 'FR' : lang === 'ar' ? 'عربي' : 'EN'}</Text></TouchableOpacity>
        <TouchableOpacity style={S.pill} onPress={() => setSaved((p) => ({ ...p, dark: !p.dark }))}><Text style={S.pillTxt}>{saved.dark ? '☀️' : '🌙'}</Text></TouchableOpacity>
        <TouchableOpacity style={S.pill} onPress={() => setSaved((p) => ({ ...p, offlineMode: !p.offlineMode }))}><Text style={S.pillTxt}>{saved.offlineMode ? '✈️' : '☁️'}</Text></TouchableOpacity>
      </View>
      <Text style={S.heroTitle}>RIAMO Coran</Text>
      <Text style={S.heroSub}>{t.tagline}</Text>
      <TouchableOpacity style={S.heroBtn} onPress={() => goTab('reciters')}><Text style={S.heroBtnTxt}>{t.browse}</Text></TouchableOpacity>
      {saved.offlineMode ? <View style={S.offPill}><Text style={S.pillTxt}>✈️ {t.offBanner}</Text></View> : null}
      <TextInput value={query} onChangeText={setQuery} placeholder={t.searchPh} placeholderTextColor="#9FB8AD" style={S.heroSearch} />
      <View style={S.stats}>
        <View style={S.stat}><Text style={S.statNum}>{everyone.length}</Text><Text style={S.statLbl}>{t.statRec}</Text></View>
        <View style={S.stat}><Text style={S.statNum}>114</Text><Text style={S.statLbl}>{t.statSur}</Text></View>
        <View style={S.stat}><Text style={S.statNum}>{saved.done.length}</Text><Text style={S.statLbl}>{t.statHeard}</Text></View>
      </View>
    </View>
  );

  const sections = (
    <View>
      {loadingList ? <ActivityIndicator color={C.green} style={{ marginTop: 30 }} /> : null}
      {error ? (
        <View style={[S.card, { alignItems: 'center' }]}>
          <Text style={{ color: C.danger, marginBottom: 12, textAlign: 'center', paddingHorizontal: 16 }}>{t.loadErr}</Text>
          <TouchableOpacity onPress={fetchList} style={S.btn}><Text style={S.btnTxt}>{t.retry}</Text></TouchableOpacity>
        </View>
      ) : null}

      {lastR && lastS ? (
        <TouchableOpacity style={[S.card, { flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', paddingHorizontal: 16 }]} activeOpacity={0.85} onPress={() => playSurah(lastR, lastS)}>
          <Avatar reciter={lastR} size={50} ring={C.gold} />
          <View style={{ flex: 1, marginHorizontal: 14 }}>
            <Text style={S.kicker}>{t.resume}</Text>
            <Text numberOfLines={1} style={S.rowName}>{lastS.number}. {sn(lastS)}</Text>
            <Text numberOfLines={1} style={S.rowSub}>{dn(lastR)}</Text>
          </View>
          <View style={S.playDot}><Text style={{ color: C.white, fontSize: 18 }}>▶</Text></View>
        </TouchableOpacity>
      ) : null}

      <View style={[S.card, { paddingHorizontal: 16 }]}>
        <Text style={[S.secTitle, { textAlign: rtl ? 'right' : 'left' }]}>{t.khatma}</Text>
        <View style={[S.barBg, { marginTop: 12, height: 10, borderRadius: 5 }]}>
          <View style={[S.barFill, { width: pctDone + '%', height: 10, borderRadius: 5 }]} />
        </View>
        <Text style={[S.rowSub, { marginTop: 8, textAlign: rtl ? 'right' : 'left' }]}><Text style={{ color: C.green, fontWeight: '800' }}>{pctDone}%</Text>  {t.khatmaSub(saved.done.length)}</Text>
      </View>

      {data.maroc.length > 0 ? (
        <View style={S.card}>
          <SectionHeader title={t.topRec} action={t.seeAll} onAction={() => goTab('reciters')} />
          {hRow(data.maroc.slice(0, 12))}
        </View>
      ) : null}

      {verse ? (
        <View style={[S.card, { backgroundColor: C.hero, paddingHorizontal: 18 }]}>
          <Text style={[S.kicker, { color: C.gold, textAlign: 'center' }]}>{t.verse}</Text>
          <Text style={S.verse}>{verse.text}</Text>
          <Text style={[S.rowSub, { color: C.gold, textAlign: 'center' }]}>{verse.surah ? verse.surah.englishName : ''} · {t.verseN} {verse.num}</Text>
        </View>
      ) : null}

      {favList.length > 0 ? (
        <View style={S.card}>
          <SectionHeader title={t.favs} action={t.seeAll} onAction={() => goTab('more')} />
          {hRow(favList)}
        </View>
      ) : null}

      {recentItems.length > 0 ? (
        <View style={[S.card, { paddingHorizontal: 16 }]}>
          <Text style={[S.secTitle, { marginBottom: 8, textAlign: rtl ? 'right' : 'left' }]}>{t.recents}</Text>
          {recentItems.map((x, i) => (
            <TouchableOpacity key={x.r.id + '-' + x.s.number + '-' + i} onPress={() => playSurah(x.r, x.s)} style={S.recent}>
              <View style={S.num}><Text style={S.numTxt}>{x.s.number}</Text></View>
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text numberOfLines={1} style={S.rowName}>{sn(x.s)}</Text>
                <Text numberOfLines={1} style={S.rowSub}>{dn(x.r)}</Text>
              </View>
              <Text style={{ color: C.green, fontSize: 18 }}>▶</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {data.others.length > 0 ? (
        <View style={S.card}>
          <SectionHeader title={t.others} action={t.seeAll} onAction={() => { setCategory('Autres Warsh'); goTab('reciters'); }} />
          {hRow(data.others.slice(0, 12))}
        </View>
      ) : null}
      <Text style={S.footer}>© RIAMO Coran</Text>
    </View>
  );

  const searchBlock = (
    <View style={{ paddingTop: 8 }}>
      {searchReciters.length === 0 && searchSurahs.length === 0 ? <Text style={S.empty}>{t.noResult}</Text> : null}
      {searchReciters.map((r) => <ReciterRow key={r.id} r={r} />)}
      {curReciter && searchSurahs.length > 0 ? (
        <View>
          <Text style={[S.rowSub, { marginHorizontal: 20, marginTop: 14 }]}>{t.reciter} : {dn(curReciter)}</Text>
          {searchSurahs.map((s) => <SurahRow key={s.number} reciter={curReciter} s={s} />)}
        </View>
      ) : null}
    </View>
  );

  const homeScreen = (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: pad }}>
      {hero}
      {query.trim() ? searchBlock : sections}
    </ScrollView>
  );

  // ----- Récitateurs -----
  const recitersScreen = (
    <FlatList
      data={listFiltered} keyExtractor={(r) => r.id} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: pad }}
      ListHeaderComponent={
        <View style={{ paddingTop: TOP + 12 }}>
          <Text style={S.pageTitle}>{t.tabRec}</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder={t.searchPh} placeholderTextColor={C.dim} style={S.search} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}>
            {CATS.map((c) => (
              <TouchableOpacity key={c[0]} onPress={() => setCategory(c[0])} style={[S.chip, category === c[0] && S.chipOn]}>
                <Text style={[S.chipTxt, category === c[0] && { color: C.white }]}>{t[c[1]]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={loadingList ? <ActivityIndicator color={C.green} style={{ marginTop: 30 }} /> : <Text style={S.empty}>{t.noResult}</Text>}
      renderItem={({ item }) => <ReciterRow r={item} />}
    />
  );

  // ----- Sourates -----
  const surahsScreen = (
    <FlatList
      data={filteredSurahs} keyExtractor={(s) => String(s.number)} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: pad }}
      ListHeaderComponent={
        <View style={{ paddingTop: TOP + 12 }}>
          <Text style={S.pageTitle}>{t.tabSur}</Text>
          {curReciter ? (
            <TouchableOpacity onPress={() => goTab('reciters')} style={S.row} activeOpacity={0.85}>
              <Avatar reciter={curReciter} size={40} ring={C.gold} />
              <View style={{ flex: 1, marginHorizontal: 14 }}>
                <Text style={S.rowSub}>{t.reciter}</Text>
                <Text numberOfLines={1} style={S.rowName}>{dn(curReciter)}</Text>
              </View>
              <Text style={S.secAction}>{t.change}</Text>
            </TouchableOpacity>
          ) : <ActivityIndicator color={C.green} style={{ marginTop: 20 }} />}
          <TextInput value={surahQuery} onChangeText={setSurahQuery} placeholder={t.searchPh} placeholderTextColor={C.dim} style={S.search} />
        </View>
      }
      renderItem={({ item }) => (curReciter ? <SurahRow reciter={curReciter} s={item} /> : null)}
    />
  );

  // ----- Plus -----
  const dlItems = Object.keys(saved.offline).map((key) => {
    const i = key.lastIndexOf('-');
    return { key, r: byId[key.slice(0, i)], s: SURAHS[Number(key.slice(i + 1)) - 1] };
  }).filter((x) => x.r && x.s);

  const moreScreen = (
    <ScrollView contentContainerStyle={{ paddingBottom: pad }}>
      <Text style={[S.pageTitle, { paddingTop: TOP + 12 }]}>{t.tabMore}</Text>
      <View style={[S.card, { paddingHorizontal: 16 }]}>
        <Text style={[S.secTitle, { marginBottom: 10, textAlign: rtl ? 'right' : 'left' }]}>{t.language}</Text>
        <View style={{ flexDirection: 'row' }}>
          {[['fr', 'Français'], ['ar', 'العربية'], ['en', 'English']].map((l) => (
            <TouchableOpacity key={l[0]} onPress={() => setLang(l[0])} style={[S.langBtn, lang === l[0] && { backgroundColor: C.green, borderColor: C.green }]}>
              <Text style={{ color: lang === l[0] ? C.white : C.text, fontWeight: '700' }}>{l[1]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={[S.setRow, { marginTop: 14 }]}>
          <Text style={S.rowName}>🌙 {t.dark}</Text>
          <Switch value={!!saved.dark} onValueChange={(v) => setSaved((p) => ({ ...p, dark: v }))} trackColor={{ true: C.green }} />
        </View>
        <View style={S.setRow}>
          <View style={{ flex: 1, marginHorizontal: 4 }}>
            <Text style={S.rowName}>✈️ {t.offMode}</Text>
            <Text style={S.rowSub}>{t.offSub}</Text>
          </View>
          <Switch value={!!saved.offlineMode} onValueChange={(v) => setSaved((p) => ({ ...p, offlineMode: v }))} trackColor={{ true: C.green }} />
        </View>
      </View>

      <View style={S.card}>
        <SectionHeader title={t.favTitle} />
        {favList.length === 0 ? <Text style={[S.rowSub, { paddingHorizontal: 16 }]}>{t.noFav}</Text> : hRow(favList)}
      </View>

      <View style={[S.card, { paddingHorizontal: 16 }]}>
        <Text style={[S.secTitle, { marginBottom: 8, textAlign: rtl ? 'right' : 'left' }]}>{t.downloads}</Text>
        {dlItems.length === 0 ? <Text style={S.rowSub}>{t.noDl}</Text> : dlItems.map((x) => (
          <View key={x.key} style={S.recent}>
            <TouchableOpacity style={{ flex: 1, flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center' }} onPress={() => playSurah(x.r, x.s)}>
              <View style={S.num}><Text style={S.numTxt}>{x.s.number}</Text></View>
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text numberOfLines={1} style={S.rowName}>{sn(x.s)}</Text>
                <Text numberOfLines={1} style={S.rowSub}>{dn(x.r)}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeDl(x.r, x.s)} style={{ padding: 8 }}><Text style={{ color: C.danger, fontSize: 18 }}>🗑</Text></TouchableOpacity>
          </View>
        ))}
      </View>
      <SoutenirBouton />

      <View style={[S.card, { paddingHorizontal: 16 }]}>
        <Text style={[S.secTitle, { marginBottom: 8, textAlign: rtl ? 'right' : 'left' }]}>{t.about}</Text>
        <Text style={[S.rowSub, { lineHeight: 20, textAlign: rtl ? 'right' : 'left' }]}>{t.aboutTxt}</Text>
        <TouchableOpacity onPress={() => setSaved((p) => ({ ...p, done: [] }))} style={{ marginTop: 14 }}>
          <Text style={S.secAction}>{t.resetKh}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // ----- Détail récitateur -----
  const firstSurah = selected ? nextPlayable(selected, 0, 1) : null;
  const detailScreen = selected && (
    <FlatList
      data={SURAHS.filter((s) => !sq || String(s.number) === sq || norm(s.nameFr).includes(sq) || norm(s.nameAr).includes(sq))}
      keyExtractor={(s) => String(s.number)} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: pad }}
      ListHeaderComponent={
        <View style={{ paddingTop: TOP + 8 }}>
          <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 16 }}>
            <Text style={{ color: C.green, fontSize: 16, fontWeight: '700', textAlign: rtl ? 'right' : 'left' }}>{rtl ? '→' : '←'} {t.back}</Text>
          </TouchableOpacity>
          <View style={[S.card, { alignItems: 'center', marginTop: 0, paddingHorizontal: 16 }]}>
            <Avatar reciter={selected} size={110} ring={C.gold} />
            <Text style={S.bannerName}>{dn(selected)}</Text>
            <Text style={S.bannerAr}>{lang === 'ar' ? selected.name : selected.arabicName}</Text>
            <View style={S.badge}><Text style={S.badgeTxt}>{selected.tag}</Text></View>
            <View style={{ flexDirection: 'row', marginTop: 16, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => firstSurah && playSurah(selected, firstSurah)} style={S.btn}>
                <Text style={S.btnTxt}>▶ {t.playAll}{firstSurah ? ' (' + sn(firstSurah) + ')' : ''}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => toggleFav(selected.id)} style={{ padding: 12 }}>
                <Text style={{ fontSize: 26, color: saved.favs.includes(selected.id) ? C.danger : C.dim }}>{saved.favs.includes(selected.id) ? '♥' : '♡'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TextInput value={surahQuery} onChangeText={setSurahQuery} placeholder={t.searchPh} placeholderTextColor={C.dim} style={S.search} />
        </View>
      }
      renderItem={({ item }) => <SurahRow reciter={selected} s={item} />}
    />
  );

  let body = homeScreen;
  if (selected) body = detailScreen;
  else if (tab === 'reciters') body = recitersScreen;
  else if (tab === 'surahs') body = surahsScreen;
  else if (tab === 'more') body = moreScreen;

  const lightText = saved.dark || (!selected && tab === 'home');

  return (
    <Ctx.Provider value={X}>
      <View style={S.root}>
        <StatusBar barStyle={lightText ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        {body}
        <Player now={now} status={status} loading={loadingAudio} onToggle={toggle} onNext={() => step(1)} onPrev={() => step(-1)} onSeek={seek} onStop={stopAll} />
        <TabBar tab={selected ? '' : tab} onTab={goTab} />
      </View>
    </Ctx.Provider>
  );
}

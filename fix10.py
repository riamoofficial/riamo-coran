import os, re, json, subprocess, time
os.chdir(os.path.expanduser('~/riamo-coran'))
def run(c, out=False):
    r = subprocess.run(c, shell=True, capture_output=out, text=True)
    return r.stdout if out else r.returncode
def watch(rid):
    return run('gh run watch %s --interval 30 --exit-status > /dev/null 2>&1' % rid)
def clean(l):
    return re.sub(r'^\S+Z\s', '', l.split('\t', 2)[-1])[:150]
def whatwrong(txt):
    ls = [clean(l) for l in txt.splitlines()]
    for i, l in enumerate(ls):
        if 'What went wrong' in l:
            for x in ls[i:i + 9]:
                if x.strip():
                    print('  >', x)
            return
    for x in ls[-6:]:
        print('  >', x)
def riamolog(cid):
    log = run('gh run view %s --log 2>&1' % cid, True)
    seen = []
    for l in log.splitlines():
        if 'RIAMOLOG:' in l:
            t = l.split('RIAMOLOG:', 1)[1].strip()
            if t and t not in seen and '$' not in t:
                seen.append(t)
    return seen

print('=== 0. ATTENTE DES SCRIPTS PRECEDENTS ===')
for f in ('~/fix7.txt', '~/fix8.txt', '~/fix9.txt'):
    p = os.path.expanduser(f)
    for _ in range(90):
        if not os.path.exists(p):
            break
        if '=== FIN ===' in open(p, errors='ignore').read():
            break
        if time.time() - os.path.getmtime(p) > 1500:
            break
        time.sleep(30)
run('git tag -f sauvegarde-avant-horaires')
print('Pret')

CORE = r"""const dtr = d => (d * Math.PI) / 180;
const rtd = r => (r * 180) / Math.PI;
const sin = d => Math.sin(dtr(d));
const cos = d => Math.cos(dtr(d));
const tan = d => Math.tan(dtr(d));
const arcsin = x => rtd(Math.asin(x));
const arccos = x => rtd(Math.acos(x));
const arctan2 = (y, x) => rtd(Math.atan2(y, x));
const arccot = x => rtd(Math.atan(1 / x));
const fix = (a, b) => { const r = a - b * Math.floor(a / b); return r < 0 ? r + b : r; };
const fixAngle = a => fix(a, 360);
const fixHour = a => fix(a, 24);

const METHODS = {
  MWL: { label: 'Ligue islamique mondiale (18° / 17°)', fajr: 18, isha: 17 },
  UOIF: { label: 'UOIF, France (12° / 12°)', fajr: 12, isha: 12 },
  MAROC: { label: 'Maroc (19° / 17°)', fajr: 19, isha: 17, adj: { sunrise: -3, dhuhr: 5, maghrib: 5 } },
  UMM: { label: 'Umm al-Qura, Arabie saoudite (18,5° / 90 min)', fajr: 18.5, ishaMin: 90 },
  EGY: { label: 'Égypte (19,5° / 17,5°)', fajr: 19.5, isha: 17.5 },
  KAR: { label: 'Karachi (18° / 18°)', fajr: 18, isha: 18 },
  ISNA: { label: 'Amérique du Nord, ISNA (15° / 15°)', fajr: 15, isha: 15 },
};

function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * sin(g) + 0.020 * sin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = arctan2(cos(e) * sin(L), cos(L)) / 15;
  const eqt = q / 15 - fixHour(RA);
  const decl = arcsin(sin(e) * sin(L));
  return { decl, eqt };
}

function prayerDay(y, m, d, lat, lng, tz, key, asrF) {
  const P = METHODS[key] || METHODS.MWL;
  const adj = P.adj || {};
  const jdate = julian(y, m, d) - lng / (15 * 24);
  const sp = t => sunPosition(jdate + t);
  const midDay = t => fixHour(12 - sp(t).eqt);
  const angleTime = (angle, t, ccw) => {
    const decl = sp(t).decl;
    const x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
    const tt = arccos(x) / 15;
    return midDay(t) + (ccw ? -tt : tt);
  };
  const asrTime = (f, t) => {
    const decl = sp(t).decl;
    const angle = -arccot(f + tan(Math.abs(lat - decl)));
    return angleTime(angle, t, false);
  };
  let fajr = angleTime(P.fajr, 5 / 24, true);
  let sunrise = angleTime(0.833, 6 / 24, true);
  let dhuhr = midDay(12 / 24);
  let asr = asrTime(asrF || 1, 13 / 24);
  let sunset = angleTime(0.833, 18 / 24, false);
  let isha = angleTime(P.isha || 0, 18 / 24, false);
  const shift = tz - lng / 15;
  fajr += shift; sunrise += shift; dhuhr += shift; asr += shift; sunset += shift; isha += shift;
  const night = fixHour(sunrise - sunset);
  const adjHL = (time, base, ccw) => {
    const portion = night / 2;
    const diff = ccw ? fixHour(base - time) : fixHour(time - base);
    if (isNaN(time) || diff > portion) return base + (ccw ? -portion : portion);
    return time;
  };
  fajr = adjHL(fajr, sunrise, true);
  const maghrib = sunset + (adj.maghrib || 0) / 60;
  if (P.ishaMin) isha = maghrib + P.ishaMin / 60; else isha = adjHL(isha, sunset, false);
  sunrise += (adj.sunrise || 0) / 60;
  dhuhr += (adj.dhuhr || 0) / 60;
  return { fajr: fixHour(fajr), sunrise: fixHour(sunrise), dhuhr: fixHour(dhuhr), asr: fixHour(asr), maghrib: fixHour(maghrib), isha: fixHour(isha) };
}

function lastSunday(y, month) {
  const d = new Date(Date.UTC(y, month + 1, 0));
  return d.getUTCDate() - d.getUTCDay();
}
function euDst(date) {
  const y = date.getUTCFullYear();
  const s = Date.UTC(y, 2, lastSunday(y, 2), 1);
  const e = Date.UTC(y, 9, lastSunday(y, 9), 1);
  const t = date.getTime();
  return t >= s && t < e ? 60 : 0;
}
function tzOffsetMin(tz, std, date) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    const o = {};
    dtf.formatToParts(date).forEach(p => { o[p.type] = p.value; });
    const asUTC = Date.UTC(+o.year, +o.month - 1, +o.day, (+o.hour) % 24, +o.minute, +o.second);
    const r = Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
    if (isNaN(r)) throw new Error('nan');
    return r;
  } catch (e) {
    let off = Math.round(std * 60);
    if (/^Europe\//.test(tz) && tz !== 'Europe/Istanbul' && tz !== 'Europe/Moscow') off += euDst(date);
    return off;
  }
}

const HM = ['Mouharram', 'Safar', "Rabi' al-awwal", "Rabi' ath-thani", 'Joumada al-oula', 'Joumada ath-thania', 'Rajab', 'Chaabane', 'Ramadan', 'Chawwal', 'Dhou al-qida', 'Dhou al-hijja'];

function kuwaiti(y, m, d) {
  const a = Math.floor((m - 14) / 12);
  const jd = Math.floor((1461 * (y + 4800 + a)) / 4) + Math.floor((367 * (m - 2 - 12 * a)) / 12) - Math.floor((3 * Math.floor((y + 4900 + a) / 100)) / 4) + d - 32075;
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

function hijri(y, m, d) {
  let h = null;
  try {
    const dtf = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' });
    const o = {};
    dtf.formatToParts(new Date(Date.UTC(y, m - 1, d, 12))).forEach(p => { o[p.type] = p.value; });
    const yy = parseInt(String(o.year).replace(/\D/g, ''), 10);
    const mm = parseInt(o.month, 10);
    const dd = parseInt(o.day, 10);
    if (yy > 1300 && yy < 1700 && mm >= 1 && mm <= 12 && dd >= 1) h = { year: yy, month: mm, day: dd };
  } catch (e) {}
  if (!h) h = kuwaiti(y, m, d);
  return h.day + ' ' + HM[h.month - 1] + ' ' + h.year + ' H';
}

module.exports = { METHODS, prayerDay, tzOffsetMin, hijri };
"""

CITIES = r"""module.exports = [
  ["Casablanca","Maroc",33.5731,-7.5898,"Africa/Casablanca",1,"MAROC"],
  ["Rabat","Maroc",34.0209,-6.8416,"Africa/Casablanca",1,"MAROC"],
  ["Marrakech","Maroc",31.6295,-7.9811,"Africa/Casablanca",1,"MAROC"],
  ["Fès","Maroc",34.0181,-5.0078,"Africa/Casablanca",1,"MAROC"],
  ["Tanger","Maroc",35.7595,-5.8340,"Africa/Casablanca",1,"MAROC"],
  ["Agadir","Maroc",30.4278,-9.5981,"Africa/Casablanca",1,"MAROC"],
  ["Oujda","Maroc",34.6867,-1.9114,"Africa/Casablanca",1,"MAROC"],
  ["Meknès","Maroc",33.8935,-5.5473,"Africa/Casablanca",1,"MAROC"],
  ["Tétouan","Maroc",35.5785,-5.3684,"Africa/Casablanca",1,"MAROC"],
  ["Kénitra","Maroc",34.2610,-6.5802,"Africa/Casablanca",1,"MAROC"],
  ["Nador","Maroc",35.1681,-2.9335,"Africa/Casablanca",1,"MAROC"],
  ["Laâyoune","Maroc",27.1253,-13.1625,"Africa/El_Aaiun",1,"MAROC"],
  ["Dakhla","Maroc",23.6848,-15.9579,"Africa/El_Aaiun",1,"MAROC"],
  ["Paris","France",48.8566,2.3522,"Europe/Paris",1,"UOIF"],
  ["Marseille","France",43.2965,5.3698,"Europe/Paris",1,"UOIF"],
  ["Lyon","France",45.7640,4.8357,"Europe/Paris",1,"UOIF"],
  ["Toulouse","France",43.6047,1.4442,"Europe/Paris",1,"UOIF"],
  ["Nice","France",43.7102,7.2620,"Europe/Paris",1,"UOIF"],
  ["Nantes","France",47.2184,-1.5536,"Europe/Paris",1,"UOIF"],
  ["Strasbourg","France",48.5734,7.7521,"Europe/Paris",1,"UOIF"],
  ["Lille","France",50.6292,3.0573,"Europe/Paris",1,"UOIF"],
  ["Bordeaux","France",44.8378,-0.5792,"Europe/Paris",1,"UOIF"],
  ["Montpellier","France",43.6108,3.8767,"Europe/Paris",1,"UOIF"],
  ["La Mecque","Arabie saoudite",21.3891,39.8579,"Asia/Riyadh",3,"UMM"],
  ["Médine","Arabie saoudite",24.4709,39.6122,"Asia/Riyadh",3,"UMM"],
  ["Riyad","Arabie saoudite",24.7136,46.6753,"Asia/Riyadh",3,"UMM"],
  ["Djeddah","Arabie saoudite",21.4858,39.1925,"Asia/Riyadh",3,"UMM"],
  ["Dubaï","Émirats arabes unis",25.2048,55.2708,"Asia/Dubai",4,"MWL"],
  ["Abou Dabi","Émirats arabes unis",24.4539,54.3773,"Asia/Dubai",4,"MWL"],
  ["Doha","Qatar",25.2854,51.5310,"Asia/Qatar",3,"MWL"],
  ["Koweït","Koweït",29.3759,47.9774,"Asia/Kuwait",3,"MWL"],
  ["Manama","Bahreïn",26.2285,50.5860,"Asia/Bahrain",3,"MWL"],
  ["Mascate","Oman",23.5880,58.3829,"Asia/Muscat",4,"MWL"],
  ["Le Caire","Égypte",30.0444,31.2357,"Africa/Cairo",2,"EGY"],
  ["Alexandrie","Égypte",31.2001,29.9187,"Africa/Cairo",2,"EGY"],
  ["Jérusalem","Palestine",31.7683,35.2137,"Asia/Jerusalem",2,"MWL"],
  ["Amman","Jordanie",31.9454,35.9284,"Asia/Amman",3,"MWL"],
  ["Beyrouth","Liban",33.8938,35.5018,"Asia/Beirut",2,"MWL"],
  ["Damas","Syrie",33.5138,36.2765,"Asia/Damascus",3,"MWL"],
  ["Bagdad","Irak",33.3152,44.3661,"Asia/Baghdad",3,"MWL"],
  ["Téhéran","Iran",35.6892,51.3890,"Asia/Tehran",3.5,"MWL"],
  ["Sanaa","Yémen",15.3694,44.1910,"Asia/Aden",3,"MWL"],
  ["Istanbul","Turquie",41.0082,28.9784,"Europe/Istanbul",3,"MWL"],
  ["Ankara","Turquie",39.9334,32.8597,"Europe/Istanbul",3,"MWL"],
  ["Alger","Algérie",36.7538,3.0588,"Africa/Algiers",1,"MWL"],
  ["Oran","Algérie",35.6971,-0.6308,"Africa/Algiers",1,"MWL"],
  ["Constantine","Algérie",36.3650,6.6147,"Africa/Algiers",1,"MWL"],
  ["Tunis","Tunisie",36.8065,10.1815,"Africa/Tunis",1,"MWL"],
  ["Tripoli","Libye",32.8872,13.1913,"Africa/Tripoli",2,"MWL"],
  ["Khartoum","Soudan",15.5007,32.5599,"Africa/Khartoum",2,"MWL"],
  ["Dakar","Sénégal",14.7167,-17.4677,"Africa/Dakar",0,"MWL"],
  ["Nouakchott","Mauritanie",18.0735,-15.9582,"Africa/Nouakchott",0,"MWL"],
  ["Bamako","Mali",12.6392,-8.0029,"Africa/Bamako",0,"MWL"],
  ["Abidjan","Côte d'Ivoire",5.3600,-4.0083,"Africa/Abidjan",0,"MWL"],
  ["Conakry","Guinée",9.6412,-13.5784,"Africa/Conakry",0,"MWL"],
  ["Niamey","Niger",13.5116,2.1254,"Africa/Niamey",1,"MWL"],
  ["N'Djamena","Tchad",12.1348,15.0557,"Africa/Ndjamena",1,"MWL"],
  ["Lagos","Nigeria",6.5244,3.3792,"Africa/Lagos",1,"MWL"],
  ["Nairobi","Kenya",-1.2921,36.8219,"Africa/Nairobi",3,"MWL"],
  ["Addis-Abeba","Éthiopie",9.0300,38.7400,"Africa/Addis_Ababa",3,"MWL"],
  ["Mogadiscio","Somalie",2.0469,45.3182,"Africa/Mogadishu",3,"MWL"],
  ["Johannesbourg","Afrique du Sud",-26.2041,28.0473,"Africa/Johannesburg",2,"MWL"],
  ["Le Cap","Afrique du Sud",-33.9249,18.4241,"Africa/Johannesburg",2,"MWL"],
  ["Karachi","Pakistan",24.8607,67.0011,"Asia/Karachi",5,"KAR"],
  ["Lahore","Pakistan",31.5204,74.3587,"Asia/Karachi",5,"KAR"],
  ["Islamabad","Pakistan",33.6844,73.0479,"Asia/Karachi",5,"KAR"],
  ["Delhi","Inde",28.6139,77.2090,"Asia/Kolkata",5.5,"KAR"],
  ["Bombay","Inde",19.0760,72.8777,"Asia/Kolkata",5.5,"KAR"],
  ["Dacca","Bangladesh",23.8103,90.4125,"Asia/Dhaka",6,"KAR"],
  ["Jakarta","Indonésie",-6.2088,106.8456,"Asia/Jakarta",7,"MWL"],
  ["Kuala Lumpur","Malaisie",3.1390,101.6869,"Asia/Kuala_Lumpur",8,"MWL"],
  ["Singapour","Singapour",1.3521,103.8198,"Asia/Singapore",8,"MWL"],
  ["Kaboul","Afghanistan",34.5553,69.2075,"Asia/Kabul",4.5,"KAR"],
  ["Tachkent","Ouzbékistan",41.2995,69.2401,"Asia/Tashkent",5,"MWL"],
  ["Bakou","Azerbaïdjan",40.4093,49.8671,"Asia/Baku",4,"MWL"],
  ["Londres","Royaume-Uni",51.5074,-0.1278,"Europe/London",0,"MWL"],
  ["Bruxelles","Belgique",50.8503,4.3517,"Europe/Brussels",1,"MWL"],
  ["Amsterdam","Pays-Bas",52.3676,4.9041,"Europe/Amsterdam",1,"MWL"],
  ["Berlin","Allemagne",52.5200,13.4050,"Europe/Berlin",1,"MWL"],
  ["Madrid","Espagne",40.4168,-3.7038,"Europe/Madrid",1,"MWL"],
  ["Barcelone","Espagne",41.3851,2.1734,"Europe/Madrid",1,"MWL"],
  ["Rome","Italie",41.9028,12.4964,"Europe/Rome",1,"MWL"],
  ["Genève","Suisse",46.2044,6.1432,"Europe/Zurich",1,"MWL"],
  ["Moscou","Russie",55.7558,37.6173,"Europe/Moscow",3,"MWL"],
  ["New York","États-Unis",40.7128,-74.0060,"America/New_York",-5,"ISNA"],
  ["Montréal","Canada",45.5017,-73.5673,"America/Toronto",-5,"ISNA"],
  ["Toronto","Canada",43.6532,-79.3832,"America/Toronto",-5,"ISNA"],
  ["Los Angeles","États-Unis",34.0522,-118.2437,"America/Los_Angeles",-8,"ISNA"],
  ["Chicago","États-Unis",41.8781,-87.6298,"America/Chicago",-6,"ISNA"],
  ["Sydney","Australie",-33.8688,151.2093,"Australia/Sydney",10,"MWL"],
];
"""

PRAYER = r"""import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList, TextInput } from 'react-native';

const core = require('./prayer-core');
const CITIES = require('./prayer-cities');

const GOLD = '#d4af37';
const BG = '#0b0f14';
const CARD = '#141a22';
const KEY = 'riamo.prayer.v1';
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DEFAULT = { city: 'Paris|France', gps: null, method: 'AUTO', asr: 1, h24: true };
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

  useEffect(() => { readCfg().then(c => { if (c) setCfg({ ...DEFAULT, ...c }); }); }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const update = patch => { const n = { ...cfg, ...patch }; setCfg(n); writeCfg(n); };

  const place = useMemo(() => {
    if (cfg.gps) {
      return { key: 'gps', name: 'Ma position', country: cfg.gps.lat.toFixed(2) + ', ' + cfg.gps.lng.toFixed(2), lat: cfg.gps.lat, lng: cfg.gps.lng, tz: null, std: -new Date().getTimezoneOffset() / 60, def: 'MWL' };
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

  const useGps = async () => {
    setBusy(true);
    setMsg('');
    try {
      const Location = require('expo-location');
      const r = await Location.requestForegroundPermissionsAsync();
      if (r.status !== 'granted') { setMsg('Autorise la localisation pour utiliser ta position.'); setBusy(false); return; }
      let pos = null;
      try { pos = await Location.getLastKnownPositionAsync(); } catch (e) {}
      try { pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); } catch (e) {}
      if (!pos) setMsg('Position introuvable. Active le GPS puis réessaie.');
      else update({ gps: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
    } catch (e) { setMsg('Localisation : ' + String(e && e.message ? e.message : e)); }
    setBusy(false);
  };

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
            <TouchableOpacity onPress={() => { update({ city: item.key, gps: null }); setView('main'); setQ(''); }}
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
"""

APP = r"""import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, StatusBar, Platform, ScrollView } from 'react-native';

const GOLD = '#d4af37';
const BG = '#0b0f14';
const TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;

let MainApp = null;
let mainErr = null;
try { MainApp = require('./MainApp').default; } catch (e) { mainErr = e; }

function load(name) {
  try {
    if (name === 'qibla') return { C: require('./Qibla').default };
    if (name === 'prayer') return { C: require('./PrayerTimes').default };
    return { C: require('./Radio').default };
  } catch (e) { return { err: e }; }
}

function ErrBox({ title, err }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: GOLD, fontSize: 18, fontWeight: 'bold' }}>Erreur : {title}</Text>
      <Text selectable style={{ color: '#fff', marginTop: 10 }}>{String(err && err.message ? err.message : err)}</Text>
      <Text selectable style={{ color: '#aaa', marginTop: 10, fontSize: 11 }}>{String(err && err.stack ? err.stack : '').slice(0, 700)}</Text>
    </ScrollView>
  );
}

class Boundary extends React.Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) return <ErrBox title={this.props.title} err={this.state.err} />;
    return this.props.children;
  }
}

function Panel({ which, onClose }) {
  const r = load(which);
  const close = (
    <TouchableOpacity onPress={onClose} style={{ margin: 16, padding: 14, backgroundColor: GOLD, borderRadius: 10 }}>
      <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>Fermer</Text>
    </TouchableOpacity>
  );
  if (r.err) return <View style={{ flex: 1, backgroundColor: BG }}><ErrBox title={which} err={r.err} />{close}</View>;
  const C = r.C;
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <Boundary title={which}><C onClose={onClose} /></Boundary>
    </View>
  );
}

export default function App() {
  const [panel, setPanel] = useState(null);
  const circ = { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: GOLD, alignItems: 'center', justifyContent: 'center', marginLeft: 8 };
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={{ paddingTop: TOP + 6, paddingBottom: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: GOLD, backgroundColor: BG }}>
        <Image source={require('./assets/logo.png')} style={{ width: 44, height: 44, borderRadius: 10 }} />
        <Text style={{ color: GOLD, fontSize: 20, fontWeight: 'bold', marginLeft: 10, flex: 1 }}>RIAMO Coran</Text>
        <TouchableOpacity onPress={() => setPanel('prayer')} style={circ}><Text style={{ fontSize: 20 }}>🕌</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setPanel('qibla')} style={circ}><Text style={{ fontSize: 20 }}>🧭</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setPanel('radio')} style={circ}><Text style={{ fontSize: 20 }}>📻</Text></TouchableOpacity>
      </View>
      <View style={{ flex: 1 }}>
        {mainErr ? <ErrBox title="Application" err={mainErr} /> : (
          <Boundary title="Application"><MainApp /></Boundary>
        )}
      </View>
      <Modal visible={panel !== null} animationType="slide" onRequestClose={() => setPanel(null)}>
        {panel !== null && <Panel which={panel} onClose={() => setPanel(null)} />}
      </Modal>
    </View>
  );
}
"""

print('=== 1. ECRITURE DES FICHIERS ===')
open('prayer-core.js', 'w', encoding='utf-8').write(CORE)
open('prayer-cities.js', 'w', encoding='utf-8').write(CITIES)
open('PrayerTimes.js', 'w', encoding='utf-8').write(PRAYER)
if not os.path.exists('App.js.avant-horaires'):
    run('cp App.js App.js.avant-horaires')
open('App.js', 'w', encoding='utf-8').write(APP)
print('prayer-core.js, prayer-cities.js, PrayerTimes.js, App.js ecrits')

print('=== 2. VERIFICATION DU CALCUL (La Mecque, 18 nov 2026) ===')
TEST = """const c = require('./prayer-core');
const r = c.prayerDay(2026, 11, 18, 21.3891, 39.8579, 3, 'UMM', 1);
const dt = new Date(Date.UTC(2026, 10, 18, 12));
console.log(JSON.stringify({ r: r, riyad: c.tzOffsetMin('Asia/Riyadh', 3, dt), paris: c.tzOffsetMin('Europe/Paris', 1, dt), casa: c.tzOffsetMin('Africa/Casablanca', 1, dt), hijri: c.hijri(2026, 11, 18) }));
"""
open('_ptest.js', 'w', encoding='utf-8').write(TEST)
res = run('node _ptest.js 2>&1', True)
os.remove('_ptest.js')
good = True
try:
    j = json.loads(res.strip().splitlines()[-1])
    exp = {'fajr': 314, 'sunrise': 393, 'dhuhr': 726, 'asr': 915, 'maghrib': 1058, 'isha': 1148}
    for k, e in exp.items():
        v = j['r'][k] * 60
        ecart = v - e
        print('  %-8s calcule %02d:%02d  attendu %02d:%02d  ecart %+.1f min' % (k, int(v // 60), int(v % 60), e // 60, e % 60, ecart))
        if abs(ecart) > 3:
            good = False
    print('  fuseaux : Riyad', j['riyad'], 'min, Paris', j['paris'], 'min, Casablanca', j['casa'], 'min')
    print('  hijri :', j['hijri'])
except Exception as ex:
    print('  Test impossible :', ex, res[-200:])
    good = False
if not good:
    print('ARRET : le calcul ne correspond pas a la capture. RIEN n a ete envoye. Envoie-moi cette capture.')
    print('=== FIN ===')
    raise SystemExit

print('=== 3. VERIFICATION DE LA SYNTAXE ===')
SYN = """const babel = require('@babel/core');
const fs = require('fs');
for (const f of ['App.js', 'PrayerTimes.js', 'prayer-core.js', 'prayer-cities.js']) {
  try {
    babel.transformSync(fs.readFileSync(f, 'utf8'), { filename: f, presets: [require.resolve('babel-preset-expo')], babelrc: false, configFile: false });
    console.log('OK ' + f);
  } catch (e) { console.log('ERR ' + f + ' ' + String(e.message).split('\\n')[0]); }
}
"""
open('_syn.js', 'w', encoding='utf-8').write(SYN)
syn = run('node _syn.js 2>&1', True)
os.remove('_syn.js')
print(syn.strip()[-500:])
if re.search(r'ERR .*(Unexpected|Unterminated|Missing|Expected|Identifier)', syn):
    print('ARRET : erreur de syntaxe. RIEN n a ete envoye. Envoie-moi cette capture.')
    print('=== FIN ===')
    raise SystemExit

print('=== 4. COMPILATION (environ 8 min) ===')
run('git add -A && git commit -m "Heures de priere : calcul local, 90 villes, GPS, reglages" && git push')
time.sleep(25)
rid = run('gh run list --workflow build.yml --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
ok = watch(rid) == 0
for essai in (1, 2, 3):
    if ok:
        break
    log = run('gh run view %s --log-failed 2>&1' % rid, True)
    if re.search(r'InstallFailedException|ndk;', log, re.I):
        print('Panne de telechargement chez GitHub, nouvel essai', essai)
        run('gh run rerun %s --failed' % rid)
        time.sleep(40)
        ok = watch(rid) == 0
    else:
        print('ERREUR DE COMPILATION :')
        whatwrong(log)
        break
if not ok:
    print('COMPILATION NON REUSSIE. Envoie-moi cette capture.')
    print('=== FIN ===')
    raise SystemExit
print('Compilation OK')

print('=== 5. TEST DE DEMARRAGE (environ 10 min) ===')
run('gh workflow run crash.yml')
time.sleep(25)
cid = run('gh run list --workflow crash.yml --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
watch(cid)
seen = riamolog(cid)
print('=== RESULTAT ===')
for t in seen:
    if re.search(r'APP |install:|paquet|FATAL|Caused by|UnsatisfiedLink|Invariant|Unable', t):
        print(t[:230])
if any('VIVANTE' in t for t in seen):
    print('=> BONNE NOUVELLE : GitHub > Releases > dernier APK. Installe-le par-dessus ; si le telephone refuse, desinstalle l ancienne appli d abord.')
else:
    print('=> L application plante au demarrage. Envoie-moi cette capture.')
print('=== FIN ===')

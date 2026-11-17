const dtr = d => (d * Math.PI) / 180;
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

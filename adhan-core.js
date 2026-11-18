const { Platform } = require('react-native');
const { createAudioPlayer, setAudioModeAsync } = require('expo-audio');

const OPTIONS = [
  { id: "saqqaf", label: "La Mecque (historique) · Cheikh Hachem As-Saqqaf", src: require('./assets/adhan/saqqaf.mp3') }
];

let N = null;
let handlerSet = false;
let player = null;

function notif() {
  if (!N) N = require('expo-notifications');
  if (!handlerSet) {
    N.setNotificationHandler({
      handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    handlerSet = true;
  }
  return N;
}
function find(id) { return OPTIONS.find(o => o.id === id) || OPTIONS[0]; }

async function ensureChannel(opt) {
  const Notifications = notif();
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('adhan_' + opt.id, {
    name: 'Adhan : ' + opt.label,
    importance: Notifications.AndroidImportance.HIGH,
    sound: opt.id + '.mp3',
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function ensurePermission() {
  try {
    const Notifications = notif();
    let p = await Notifications.getPermissionsAsync();
    if (!(p.granted || p.status === 'granted')) p = await Notifications.requestPermissionsAsync();
    return !!(p.granted || p.status === 'granted');
  } catch (e) { return false; }
}

function trig(Notifications, date, channelId) {
  const T = Notifications.SchedulableTriggerInputTypes;
  return T ? { type: T.DATE, date, channelId } : { date, channelId };
}

async function schedule(items, id) {
  try {
    const Notifications = notif();
    const opt = find(id);
    await ensureChannel(opt);
    await Notifications.cancelAllScheduledNotificationsAsync();
    let n = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.at < Date.now() + 3000) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: it.title, body: it.body, sound: opt.id + '.mp3' },
        trigger: trig(Notifications, new Date(it.at), 'adhan_' + opt.id),
      });
      n++;
    }
    return n;
  } catch (e) { return 0; }
}

async function cancel() {
  try { await notif().cancelAllScheduledNotificationsAsync(); } catch (e) {}
}

function stopPreview() {
  try { if (player) { player.pause(); player.remove(); } } catch (e) {}
  player = null;
}
async function preview(id) {
  try {
    stopPreview();
    try { await setAudioModeAsync({ playsInSilentMode: true }); } catch (e) {}
    player = createAudioPlayer(find(id).src);
    player.play();
  } catch (e) {}
}

async function testIn(sec, id) {
  try {
    if (!(await ensurePermission())) return false;
    const Notifications = notif();
    const opt = find(id);
    await ensureChannel(opt);
    await Notifications.scheduleNotificationAsync({
      content: { title: "Test de l'adhan", body: "Si tu entends l'adhan, tout fonctionne.", sound: opt.id + '.mp3' },
      trigger: trig(Notifications, new Date(Date.now() + sec * 1000), 'adhan_' + opt.id),
    });
    return true;
  } catch (e) { return false; }
}

module.exports = {
  available: true,
  options: OPTIONS.map(o => ({ id: o.id, label: o.label })),
  ensurePermission, schedule, cancel, preview, stopPreview, testIn,
};

import os, re, json, subprocess, colorsys
os.chdir(os.path.expanduser('~/riamo-coran'))

def run(c, out=False):
    r = subprocess.run(c, shell=True, capture_output=out, text=True)
    return r.stdout if out else r.returncode

def errlines(txt, n=14):
    keep = [l for l in txt.splitlines()
            if re.search(r'error|failed|went wrong|unable|cannot|syntax|not found|unresolved', l, re.I)]
    for l in keep[-n:]:
        print('  >', re.sub(r'^\S+\s+\S+\s+\d{4}-\d\d-\d\dT\S+\s*', '', l)[:115])

print('=== 1. ERREUR DE LA COMPILATION RATEE ===')
old = run('gh run view --log-failed 2>&1', True)
open('err_old.txt', 'w').write(old)
errlines(old)

print('=== 2. RECUPERATION DE TON APP.JS D ORIGINE ===')
if not os.path.exists('MainApp.js'):
    orig = run('git show 8a02e1f:App.js', True)
    if len(orig) < 200:
        orig = open('App.js.bak', encoding='utf-8').read() if os.path.exists('App.js.bak') else ''
    if len(orig) < 200:
        print('ECHEC : App.js d origine introuvable'); raise SystemExit
    open('MainApp.js', 'w', encoding='utf-8').write(orig)
    open('MainApp.js.orig', 'w', encoding='utf-8').write(orig)
    print('MainApp.js cree')
else:
    print('MainApp.js existe deja')

print('=== 3. COULEURS NOIR ET OR ===')
s = open('MainApp.js', encoding='utf-8').read()
def remap(m):
    h = m.group(0); hx = h[1:]
    if len(hx) == 3: hx = ''.join(c * 2 for c in hx)
    r, g, b = [int(hx[i:i+2], 16) / 255 for i in (0, 2, 4)]
    hh, ss, vv = colorsys.rgb_to_hsv(r, g, b)
    if ss > 0.15 and 70 <= hh * 360 <= 190:
        n = '#0b0f14' if vv < 0.22 else '#141a22' if vv < 0.40 else '#1c242e' if vv < 0.60 else '#d4af37'
        return n + hx[6:]
    return h
s2 = re.sub(r'#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b', remap, s)
open('MainApp.js', 'w', encoding='utf-8').write(s2)
print('Couleurs converties :', sum(1 for a, b in zip(re.findall(r'#[0-9a-fA-F]{3,8}\b', s), re.findall(r'#[0-9a-fA-F]{3,8}\b', s2)) if a != b))

print('=== 4. NOUVEAU APP.JS ===')
APP = r"""import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, StatusBar, Platform } from 'react-native';
import MainApp from './MainApp';
import Qibla from './Qibla';
import Radio from './Radio';

const GOLD = '#d4af37';
const BG = '#0b0f14';
const TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;

export default function App() {
  const [panel, setPanel] = useState(null);
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={{ paddingTop: TOP + 6, paddingBottom: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: GOLD, backgroundColor: BG }}>
        <Image source={require('./assets/logo.png')} style={{ width: 44, height: 44, borderRadius: 10 }} />
        <Text style={{ color: GOLD, fontSize: 20, fontWeight: 'bold', marginLeft: 10, flex: 1 }}>RIAMO Coran</Text>
        <TouchableOpacity onPress={() => setPanel('qibla')} style={{ borderWidth: 1, borderColor: GOLD, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, marginRight: 8 }}>
          <Text style={{ color: GOLD, fontWeight: 'bold' }}>🧭 Qibla</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPanel('radio')} style={{ borderWidth: 1, borderColor: GOLD, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 }}>
          <Text style={{ color: GOLD, fontWeight: 'bold' }}>📻 Radio</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1 }}>
        <MainApp />
      </View>
      <Modal visible={panel !== null} animationType="slide" onRequestClose={() => setPanel(null)}>
        {panel === 'qibla' && <Qibla onClose={() => setPanel(null)} />}
        {panel === 'radio' && <Radio onClose={() => setPanel(null)} />}
      </Modal>
    </View>
  );
}
"""
open('App.js', 'w', encoding='utf-8').write(APP)
print('App.js ecrit')

print('=== 5. VERIFICATIONS ===')
pk = open('package.json', encoding='utf-8').read()
for mod in ('expo-location', 'expo-av'):
    if mod not in pk:
        print('Installation de', mod); run('npx expo install ' + mod)
for f in ('assets/logo.png', 'assets/icon.png', 'assets/splash.png', 'assets/adaptive-icon.png', 'Qibla.js', 'Radio.js'):
    print(('OK  ' if os.path.exists(f) else 'MANQUE ') + f)
try:
    json.load(open('app.json', encoding='utf-8')); print('OK  app.json valide')
except Exception as e:
    print('PROBLEME app.json :', e)

print('=== 6. ENVOI ET COMPILATION ===')
run('git add -A && git commit -m "design noir et or, logo, qibla, radio (App.js enveloppe)" && git push')
run('sleep 25')
rid = run('gh run list --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
print('Compilation', rid, 'en cours, patiente environ 7 minutes...')
code = run('gh run watch %s --interval 30 --exit-status > /dev/null 2>&1' % rid)
print(run('gh run list --limit 1', True))
if code == 0:
    print('REUSSI : va dans GitHub > Releases, telecharge et installe le nouvel APK.')
else:
    print('ECHEC. Erreur exacte :')
    errlines(run('gh run view %s --log-failed 2>&1' % rid, True), 20)
    print('Envoie-moi une capture de ces lignes.')

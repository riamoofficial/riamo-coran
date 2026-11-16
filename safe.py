import os, subprocess, re
os.chdir(os.path.expanduser('~/riamo-coran'))
def run(c, out=False):
    r = subprocess.run(c, shell=True, capture_output=out, text=True)
    return r.stdout if out else r.returncode

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
  const btn = { borderWidth: 1, borderColor: GOLD, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 };
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={{ paddingTop: TOP + 6, paddingBottom: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: GOLD, backgroundColor: BG }}>
        <Image source={require('./assets/logo.png')} style={{ width: 44, height: 44, borderRadius: 10 }} />
        <Text style={{ color: GOLD, fontSize: 20, fontWeight: 'bold', marginLeft: 10, flex: 1 }}>RIAMO Coran</Text>
        <TouchableOpacity onPress={() => setPanel('qibla')} style={[btn, { marginRight: 8 }]}>
          <Text style={{ color: GOLD, fontWeight: 'bold' }}>🧭 Qibla</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPanel('radio')} style={btn}>
          <Text style={{ color: GOLD, fontWeight: 'bold' }}>📻 Radio</Text>
        </TouchableOpacity>
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
open('App.js', 'w', encoding='utf-8').write(APP)
print('App.js securise ecrit')

def errlines(txt, n=20):
    keep = [l for l in txt.splitlines() if re.search(r'error|failed|went wrong|unable|cannot|syntax|not found|unresolved', l, re.I)]
    for l in keep[-n:]:
        print('  >', re.sub(r'^\S+\s+\S+\s+\d{4}-\d\d-\d\dT\S+\s*', '', l)[:115])

run('git add -A && git commit -m "App securise : erreurs affichees, Qibla et Radio charges a la demande" && git push')
run('sleep 25')
rid = run('gh run list --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
print('Compilation', rid, 'en cours, environ 7 minutes...')
code = run('gh run watch %s --interval 30 --exit-status > /dev/null 2>&1' % rid)
print(run('gh run list --limit 1', True))
if code == 0:
    print('REUSSI : GitHub > Releases, telecharge et installe le nouvel APK, puis ouvre-le.')
else:
    print('ECHEC. Erreur exacte :')
    errlines(run('gh run view %s --log-failed 2>&1' % rid, True))

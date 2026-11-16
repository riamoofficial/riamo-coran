import React, { useState } from 'react';
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

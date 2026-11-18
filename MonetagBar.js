import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import LIEN from './monetagLien';

export default function MonetagBar() {
  if (!LIEN) return null;
  return (
    <View style={s.wrap}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => Linking.openURL(LIEN)}>
        <Text style={s.txt}>Publicité · Soutenir Riamo Coran ❤</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: '#0b0b0b', paddingVertical: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#d4af37' },
  txt: { color: '#d4af37', fontSize: 13, fontWeight: '700' },
});

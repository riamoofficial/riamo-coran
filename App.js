import React from 'react';
import { View } from 'react-native';
import AppMain from './AppMain';
import MonetagBar from './MonetagBar';

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <AppMain />
      </View>
      <MonetagBar />
    </View>
  );
}

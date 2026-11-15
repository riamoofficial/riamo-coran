import { registerRootComponent } from 'expo';
import React from 'react';
import { ScrollView, Text } from 'react-native';

let App = null;
let loadError = null;
try {
  App = require('./App').default;
} catch (e) {
  loadError = e;
}

const Show = ({ e }) => (
  <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
    <Text selectable style={{ color: 'red', fontSize: 13 }}>
      {String((e && e.stack) || e)}
    </Text>
  </ScrollView>
);

class Boundary extends React.Component {
  state = { e: null };
  static getDerivedStateFromError(e) { return { e }; }
  render() {
    if (this.state.e) return <Show e={this.state.e} />;
    return this.props.children;
  }
}

function Root() {
  if (loadError || !App) return <Show e={loadError || 'App introuvable'} />;
  return (
    <Boundary>
      <App />
    </Boundary>
  );
}

registerRootComponent(Root);

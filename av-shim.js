import { createAudioPlayer, setAudioModeAsync as _setMode } from 'expo-audio';

function status(p, extra) {
  const base = {
    isLoaded: !!(p && p.isLoaded),
    isPlaying: !!(p && p.playing),
    isBuffering: !!(p && p.isBuffering),
    positionMillis: Math.round(((p && p.currentTime) || 0) * 1000),
    durationMillis: Math.round(((p && p.duration) || 0) * 1000),
    didJustFinish: false,
    isLooping: !!(p && p.loop),
    rate: (p && p.playbackRate) || 1,
    volume: p && typeof p.volume === 'number' ? p.volume : 1,
    shouldPlay: !!(p && p.playing),
    isMuted: !!(p && p.muted),
  };
  return Object.assign(base, extra || {});
}

class Sound {
  constructor() { this.p = null; this.cb = null; this.sub = null; }

  static async createAsync(source, initial, onUpdate) {
    const s = new Sound();
    await s.loadAsync(source, initial, onUpdate);
    return { sound: s, status: s.snap() };
  }

  snap(extra) { return status(this.p, extra); }

  async loadAsync(source, initial, onUpdate) {
    let src = source;
    if (source && typeof source === 'object' && source.uri) src = { uri: source.uri, headers: source.headers };
    this.p = createAudioPlayer(src, { updateInterval: 500 });
    if (onUpdate) this.cb = onUpdate;
    this.sub = this.p.addListener('playbackStatusUpdate', st => {
      if (this.cb) this.cb(this.snap({ didJustFinish: !!(st && st.didJustFinish) }));
    });
    await this.setStatusAsync(initial || {});
    return this.snap();
  }

  async setStatusAsync(st) {
    const p = this.p;
    if (!p) return this.snap();
    try {
      if (typeof st.volume === 'number') p.volume = st.volume;
      if (typeof st.isMuted === 'boolean') p.muted = st.isMuted;
      if (typeof st.isLooping === 'boolean') p.loop = st.isLooping;
      if (typeof st.rate === 'number') p.setPlaybackRate(st.rate);
      if (typeof st.positionMillis === 'number') await p.seekTo(st.positionMillis / 1000);
      if (st.shouldPlay === true) p.play();
      if (st.shouldPlay === false) p.pause();
    } catch (e) {}
    return this.snap();
  }
  async playAsync() { try { this.p.play(); } catch (e) {} return this.snap({ isPlaying: true }); }
  async pauseAsync() { try { this.p.pause(); } catch (e) {} return this.snap({ isPlaying: false }); }
  async stopAsync() { try { this.p.pause(); await this.p.seekTo(0); } catch (e) {} return this.snap({ isPlaying: false, positionMillis: 0 }); }
  async setPositionAsync(ms) { try { await this.p.seekTo(ms / 1000); } catch (e) {} return this.snap({ positionMillis: ms }); }
  async setVolumeAsync(v) { try { this.p.volume = v; } catch (e) {} return this.snap(); }
  async setIsMutedAsync(m) { try { this.p.muted = m; } catch (e) {} return this.snap(); }
  async setIsLoopingAsync(l) { try { this.p.loop = l; } catch (e) {} return this.snap(); }
  async setRateAsync(r) { try { this.p.setPlaybackRate(r); } catch (e) {} return this.snap(); }
  async getStatusAsync() { return this.snap(); }
  setOnPlaybackStatusUpdate(cb) { this.cb = cb; }
  async unloadAsync() {
    try { if (this.sub) this.sub.remove(); if (this.p) this.p.remove(); } catch (e) {}
    this.p = null;
    return { isLoaded: false };
  }
}

async function setAudioModeAsync(mode) {
  const m = mode || {};
  try {
    await _setMode({
      playsInSilentMode: m.playsInSilentModeIOS !== false,
      shouldPlayInBackground: !!m.staysActiveInBackground,
    });
  } catch (e) {}
}

export const InterruptionModeIOS = { DoNotMix: 0, DuckOthers: 1, MixWithOthers: 2 };
export const InterruptionModeAndroid = { DoNotMix: 1, DuckOthers: 2 };
export const Audio = { Sound, setAudioModeAsync, InterruptionModeIOS, InterruptionModeAndroid };
export default { Audio };

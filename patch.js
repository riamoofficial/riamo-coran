const fs = require('fs');
let s = fs.readFileSync('App.js', 'utf8');
fs.writeFileSync('App.js.bak', s);

function rep(find, to, label) {
  const before = s;
  s = s.replace(find, () => to);
  console.log(before === s ? 'NON TROUVE' : 'OK        ', label);
}

rep("import { Audio } from 'expo-av';",
    "import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';", 'import');

rep(/Audio\.setAudioModeAsync\(\{[\s\S]*?\}\)\.catch\(\(\) => \{\}\);/,
    "setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});",
    'mode audio');

rep("if (soundRef.current) soundRef.current.unloadAsync().catch(() => {});",
    "if (soundRef.current) { try { soundRef.current.remove(); } catch (e) {} }",
    'nettoyage');

rep(/const playSurah = async \(reciter, surah\) => \{[\s\S]*?playRef\.current = playSurah;/,
`const playSurah = async (reciter, surah) => {
    const token = ++tokenRef.current;
    setLoadingAudio(true);
    nowRef.current = { reciter, surah };
    setNow({ reciter, surah });
    setStatus(null);
    try {
      if (soundRef.current) {
        try { soundRef.current.remove(); } catch (e) {}
        soundRef.current = null;
      }
      const uri = reciter.server + String(surah.number).padStart(3, '0') + '.mp3';
      const player = createAudioPlayer({ uri });
      soundRef.current = player;
      player.addListener('playbackStatusUpdate', (st) => {
        if (token !== tokenRef.current) return;
        if (st.isLoaded) setLoadingAudio(false);
        setStatus({
          isLoaded: st.isLoaded,
          isPlaying: st.playing,
          positionMillis: (st.currentTime || 0) * 1000,
          durationMillis: (st.duration || 0) * 1000,
        });
        if (st.didJustFinish) {
          const cur = nowRef.current;
          if (cur && cur.surah.number < 114) {
            playRef.current(cur.reciter, SURAHS[cur.surah.number]);
          }
        }
      });
      player.play();
    } catch (e) {
      if (token === tokenRef.current) {
        setLoadingAudio(false);
        Alert.alert('Lecture impossible', 'Ce fichier audio ne répond pas. Réessaie ou choisis un autre récitateur.');
      }
    }
  };
  playRef.current = playSurah;`, 'lecture');

rep(/const toggle = async \(\) => \{[\s\S]*?\n  \};/,
`const toggle = () => {
    const p = soundRef.current;
    if (!p) return;
    if (p.playing) p.pause(); else p.play();
  };`, 'pause/lecture');

rep(/const seek = async \(ratio\) => \{[\s\S]*?\n  \};/,
`const seek = (ratio) => {
    const p = soundRef.current;
    if (!p || !status || !status.durationMillis) return;
    p.seekTo((Math.max(0, Math.min(1, ratio)) * status.durationMillis) / 1000);
  };`, 'barre de progression');

fs.writeFileSync('App.js', s);

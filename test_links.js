const host = 'https://' + 'archive.org';
const ids = ['20240229_797', 'A_B_M_SO_2', 'Abdelhamid_Hssain_Warsh', 'Mustapha_Gharbi_Warsh'];
(async () => {
  for (const id of ids) {
    try {
      const res = await fetch(host + '/metadata/' + id);
      const data = await res.json();
      const mp3s = (data.files || []).filter(f => f.name.endsWith('.mp3'));
      console.log(id, '-> fichiers:', mp3s.length, '| ex:', mp3s[0]?.name || 'AUCUN');
    } catch (e) {
      console.log(id, '-> ERREUR');
    }
  }
})();

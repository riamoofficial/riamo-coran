import os, re, json, subprocess, time, glob
os.chdir(os.path.expanduser('~/riamo-coran'))
def run(c, out=False):
    r = subprocess.run(c, shell=True, capture_output=out, text=True)
    return r.stdout if out else r.returncode
def watch(rid):
    return run('gh run watch %s --interval 30 --exit-status > /dev/null 2>&1' % rid)
def errlines(txt, n=15):
    keep = [l for l in txt.splitlines() if re.search(r'error|failed|went wrong|unable|cannot|not found', l, re.I)]
    for l in keep[-n:]:
        print('  >', re.sub(r'^\S+\s+\S+\s+\d{4}-\d\d-\d\dT\S+\s*', '', l)[:115])
def riamolog(cid):
    log = run('gh run view %s --log 2>&1' % cid, True)
    seen = []
    for l in log.splitlines():
        if 'RIAMOLOG:' in l:
            t = l.split('RIAMOLOG:', 1)[1].strip()
            if t and t not in seen and '$' not in t:
                seen.append(t)
    return seen

print('=== 1. OU EST EXPO-AV ===')
files = [f for f in glob.glob('*.js') + glob.glob('src/**/*.js', recursive=True) + glob.glob('*.json')
         if f not in ('package.json', 'package-lock.json')]
blocked = False
for f in files:
    for i, l in enumerate(open(f, encoding='utf-8', errors='ignore').read().splitlines(), 1):
        if 'expo-av' in l:
            print('  ', f, i, l.strip()[:80])
            if f.endswith('.js') and re.search(r'import|require', l):
                blocked = True
if blocked:
    print('ARRET : un fichier importe encore expo-av. Envoie-moi cette capture.'); raise SystemExit

print('=== 2. SUPPRESSION ===')
run('npm uninstall expo-av')
pk = json.load(open('package.json', encoding='utf-8'))
if 'expo-av' in pk.get('dependencies', {}):
    del pk['dependencies']['expo-av']
    json.dump(pk, open('package.json', 'w', encoding='utf-8'), indent=2)
    run('npm install --package-lock-only --no-audit --no-fund')
pk = json.load(open('package.json', encoding='utf-8'))
print('expo-av dans package.json :', 'OUI (probleme)' if 'expo-av' in pk.get('dependencies', {}) else 'non, supprime')
try:
    a = json.load(open('app.json', encoding='utf-8'))
    e = a.get('expo', a)
    pl = e.get('plugins', [])
    e['plugins'] = [p for p in pl if (p[0] if isinstance(p, list) else p) != 'expo-av']
    json.dump(a, open('app.json', 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
except Exception as ex:
    print('app.json :', ex)

print('=== 3. COMPILATION (environ 8 min) ===')
run('git add -A && git commit -m "suppression definitive de expo-av" && git push')
time.sleep(25)
rid = run('gh run list --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
if watch(rid) != 0:
    print('LA COMPILATION A ECHOUE. Erreur :')
    errlines(run('gh run view %s --log-failed 2>&1' % rid, True))
    raise SystemExit
print('Compilation OK')

print('=== 4. TEST DE DEMARRAGE (environ 10 min) ===')
run('gh workflow run crash.yml')
time.sleep(25)
cid = run('gh run list --workflow crash.yml --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
watch(cid)
seen = riamolog(cid)
print('=== RESULTAT ===')
for t in seen:
    if re.search(r'APP |install:|paquet|FATAL|Caused by|UnsatisfiedLink|Invariant|Unable', t):
        print(t[:230])
if any('VIVANTE' in t for t in seen):
    print('=> BONNE NOUVELLE : GitHub > Releases, telecharge le dernier APK, supprime l ancienne appli et installe-le.')
else:
    print('=== 5. INSPECTION (encore un plantage) ===')
    run('gh workflow run inspect.yml')
    time.sleep(25)
    iid = run('gh run list --workflow inspect.yml --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
    watch(iid)
    for t in riamolog(iid):
        if re.search(r'version|BESOIN|FOURNIT', t):
            print(t[:200])
print('=== FIN ===')

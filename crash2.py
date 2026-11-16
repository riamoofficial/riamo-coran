import os, re, subprocess, time, glob
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

print('=== 1. ARCHITECTURE POUR LE TEST ===')
changed = False
for p in glob.glob('.github/workflows/*.y*ml'):
    if p.endswith('crash.yml'):
        continue
    t = open(p, encoding='utf-8').read()
    if 'assembleRelease' in t and 'reactNativeArchitectures' not in t:
        n = re.sub(r'(assembleRelease)', r'\1 -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64', t, count=1)
        open(p, 'w', encoding='utf-8').write(n)
        changed = True
        print('x86_64 ajoute dans', p)
    elif 'assembleRelease' not in t:
        print('(pas de assembleRelease dans', p, ')')

SH = r"""echo "RIAMOLOG: abi=$(adb shell getprop ro.product.cpu.abilist | tr -d '\r')"
adb install -r app.apk 2>&1 | sed 's/^/RIAMOLOG: install: /'
PKG=$(adb shell pm list packages -3 | head -1 | cut -d: -f2 | tr -d '\r')
echo "RIAMOLOG: paquet=$PKG"
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 2>&1 | sed 's/^/RIAMOLOG: /'
sleep 45
if adb shell pidof "$PKG" | grep -q .; then echo "RIAMOLOG: APP VIVANTE apres 45 s"; else echo "RIAMOLOG: APP MORTE apres 45 s"; fi
adb logcat -d -b crash | head -60 | sed 's/^/RIAMOLOG: /'
adb logcat -d | grep -E "AndroidRuntime|FATAL|ReactNativeJS|SoLoader|UnsatisfiedLink|ExpoModules|OutOfMemory|Fatal signal|SIGABRT|NotFound|has died" | head -50 | sed 's/^/RIAMOLOG: /'
exit 0
"""
os.makedirs('.github', exist_ok=True)
open('.github/crash.sh', 'w', encoding='utf-8').write(SH)

if changed:
    print('=== 2. NOUVELLE COMPILATION (environ 8 min) ===')
    run('git add -A && git commit -m "build x86_64 pour le test" && git push')
    time.sleep(25)
    rid = run('gh run list --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
    if watch(rid) != 0:
        print('LA COMPILATION A ECHOUE. Erreur :')
        errlines(run('gh run view %s --log-failed 2>&1' % rid, True))
        raise SystemExit
    print('Compilation OK')
else:
    print('=== 2. Pas de recompilation necessaire, envoi du test ===')
    run('git add -A && git commit -m "test plantage" && git push')
    time.sleep(10)

print('=== 3. TEST SUR TELEPHONE VIRTUEL (environ 10 min) ===')
run('gh workflow run crash.yml')
time.sleep(25)
cid = run('gh run list --workflow crash.yml --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
if not cid:
    print('Le test n a pas demarre.'); raise SystemExit
watch(cid)
log = run('gh run view %s --log 2>&1' % cid, True)
seen = []
for l in log.splitlines():
    if 'RIAMOLOG:' in l:
        t = l.split('RIAMOLOG:', 1)[1].strip()
        if t and t not in seen:
            seen.append(t)
print('=== RESULTAT ===')
if seen:
    for t in seen[:50]:
        print(t[:115])
else:
    print('Le test n a pas pu tourner. Erreur :')
    errlines(run('gh run view %s --log-failed 2>&1' % cid, True))
print('=== FIN ===')

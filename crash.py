import os, re, subprocess, time
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

run('termux-wake-lock')
print('=== 1. ALIGNEMENT DES MODULES ===')
run('npx expo install --fix')

print('=== 2. PREPARATION DU TEST ===')
os.makedirs('.github/workflows', exist_ok=True)
for f in os.listdir('.github/workflows'):
    p = '.github/workflows/' + f
    t = open(p, encoding='utf-8').read()
    n = re.sub(r'(reactNativeArchitectures=)[^\s"\']+', r'\g<1>armeabi-v7a,arm64-v8a,x86_64', t)
    if n != t:
        open(p, 'w', encoding='utf-8').write(n)
        print('x86_64 ajoute dans', f)

YML = r"""name: Crash check
on: workflow_dispatch
permissions:
  contents: read
jobs:
  crash:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - name: Telecharger le dernier APK
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          mkdir dl
          TAG=$(gh release list --repo "${{ github.repository }}" --limit 1 --json tagName -q '.[0].tagName')
          gh release download "$TAG" --repo "${{ github.repository }}" --pattern "*.apk" --dir dl
          cp "$(ls dl/*.apk | head -1)" app.apk
          ls -la app.apk
      - name: KVM
        run: |
          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
          sudo udevadm control --reload-rules
          sudo udevadm trigger --name-match=kvm
      - uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 30
          arch: x86_64
          target: google_apis
          disable-animations: true
          script: bash .github/crash.sh
"""
SH = r"""adb install -r app.apk 2>&1 | sed 's/^/RIAMOLOG: install: /'
PKG=$(adb shell pm list packages -3 | head -1 | cut -d: -f2 | tr -d '\r')
echo "RIAMOLOG: paquet=$PKG"
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 2>&1 | sed 's/^/RIAMOLOG: /'
sleep 40
if adb shell pidof "$PKG" | grep -q .; then echo "RIAMOLOG: APP VIVANTE apres 40 s (pas de plantage au demarrage)"; else echo "RIAMOLOG: APP MORTE apres 40 s"; fi
adb logcat -d -b crash | head -60 | sed 's/^/RIAMOLOG: /'
adb logcat -d | grep -E "AndroidRuntime|FATAL|ReactNativeJS|SoLoader|UnsatisfiedLink|ExpoModules|has died|Force finishing" | head -40 | sed 's/^/RIAMOLOG: /'
exit 0
"""
open('.github/workflows/crash.yml', 'w', encoding='utf-8').write(YML)
open('.github/crash.sh', 'w', encoding='utf-8').write(SH)

print('=== 3. COMPILATION (environ 7 min) ===')
run('git add -A && git commit -m "diagnostic plantage et modules alignes" && git push')
time.sleep(25)
rid = run('gh run list --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
if watch(rid) != 0:
    print('LA COMPILATION A ECHOUE. Erreur :')
    errlines(run('gh run view %s --log-failed 2>&1' % rid, True))
    raise SystemExit
print('Compilation OK')

print('=== 4. TEST DE DEMARRAGE SUR TELEPHONE VIRTUEL (environ 10 min) ===')
run('gh workflow run crash.yml')
time.sleep(20)
cid = run('gh run list --workflow crash.yml --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
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
    for t in seen[:45]:
        print(t[:115])
else:
    print('Le test n a pas pu tourner. Erreur :')
    errlines(run('gh run view %s --log-failed 2>&1' % cid, True))
print('=== FIN : envoie-moi une capture de ce resultat ===')

import os, re, subprocess, time
os.chdir(os.path.expanduser('~/riamo-coran'))
def run(c, out=False):
    r = subprocess.run(c, shell=True, capture_output=out, text=True)
    return r.stdout if out else r.returncode
def watch(rid):
    return run('gh run watch %s --interval 30 --exit-status > /dev/null 2>&1' % rid)
def clean(l):
    return re.sub(r'^\S+Z\s', '', l.split('\t', 2)[-1])[:150]
def whatwrong(txt):
    ls = [clean(l) for l in txt.splitlines()]
    for i, l in enumerate(ls):
        if 'What went wrong' in l:
            for x in ls[i:i + 9]:
                if x.strip():
                    print('  >', x)
            return
    for x in ls[-6:]:
        print('  >', x)
def riamolog(cid):
    log = run('gh run view %s --log 2>&1' % cid, True)
    seen = []
    for l in log.splitlines():
        if 'RIAMOLOG:' in l:
            t = l.split('RIAMOLOG:', 1)[1].strip()
            if t and t not in seen and '$' not in t:
                seen.append(t)
    return seen

print('=== 1. NOUVEL ESSAI DE COMPILATION ===')
rid = run('gh run list --workflow build.yml --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
ok = False
for essai in (1, 2, 3):
    print('Essai', essai, '(environ 8 min)')
    run('gh run rerun %s --failed' % rid)
    time.sleep(40)
    if watch(rid) == 0:
        ok = True
        break
    log = run('gh run view %s --log-failed 2>&1' % rid, True)
    if re.search(r'InstallFailedException|ndk;', log, re.I):
        print('Meme panne de telechargement, nouvel essai...')
        continue
    print('AUTRE ERREUR :')
    whatwrong(log)
    break
if not ok:
    print('COMPILATION NON REUSSIE. Envoie-moi cette capture.')
    print('=== FIN ===')
    raise SystemExit
print('Compilation OK')

print('=== 2. TEST DE DEMARRAGE (environ 10 min) ===')
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
    print('=== 3. INSPECTION (encore un plantage) ===')
    run('gh workflow run inspect.yml')
    time.sleep(25)
    iid = run('gh run list --workflow inspect.yml --limit 1 --json databaseId -q ".[0].databaseId"', True).strip()
    watch(iid)
    for t in riamolog(iid):
        if re.search(r'version|BESOIN|FOURNIT', t):
            print(t[:200])
print('=== FIN ===')

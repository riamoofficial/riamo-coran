echo "RIAMOLOG: abi=$(adb shell getprop ro.product.cpu.abilist | tr -d '\r')"
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

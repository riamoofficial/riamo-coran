adb install -r app.apk 2>&1 | sed 's/^/RIAMOLOG: install: /'
PKG=$(adb shell pm list packages -3 | head -1 | cut -d: -f2 | tr -d '\r')
echo "RIAMOLOG: paquet=$PKG"
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
sleep 45
if adb shell pidof "$PKG" | grep -q .; then echo "RIAMOLOG: APP VIVANTE apres 45 s"; else echo "RIAMOLOG: APP MORTE apres 45 s"; fi
adb logcat -d | grep -E "FATAL EXCEPTION|UnsatisfiedLinkError|Caused by|Unable to load script|Invariant|SoLoader|ReactNativeJS" | sed 's/^/RIAMOLOG: /' | head -30
exit 0

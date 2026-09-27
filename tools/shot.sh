#!/bin/sh
CHROME="C:/Users/nrfra/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe"
timeout 60 "$CHROME" --headless=old --disable-gpu --no-sandbox --hide-scrollbars \
 --no-first-run --disable-extensions --disable-background-networking \
 --disable-lcd-text --font-render-hinting=none \
 --user-data-dir="d:/_work/SpamGen/.chrome" --force-device-scale-factor=3 \
 --window-size=390,844 --screenshot="$2" "file:///$1" >/dev/null 2>&1

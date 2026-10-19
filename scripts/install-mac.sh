#!/bin/bash
# Builds Dev Copilot from this checkout and installs it into /Applications.
# Usage: bash scripts/install-mac.sh   (or: npm run install:mac)
set -euo pipefail
cd "$(dirname "$0")/.."

# Node may live in ~/.local when there is no Homebrew.
for dir in "$HOME"/.local/node-*/bin; do
  if [ -d "$dir" ]; then PATH="$dir:$PATH"; fi
done
export PATH

if [ "$(uname -m)" = "arm64" ]; then ARCH=arm64; OUT="dist/mac-arm64"; else ARCH=x64; OUT="dist/mac"; fi
BUILT="$OUT/Dev Copilot.app"
APP="/Applications/Dev Copilot.app"

echo "==> Building"
npm run build
npx electron-builder --mac dir --"$ARCH" --publish never

echo "==> Signing (ad hoc)"
codesign --force --deep -s - "$BUILT"

echo "==> Installing to /Applications"
pkill -f "Dev Copilot.app" || true
# A rebuilt app has a new signature, so the old Screen Recording grant no longer applies.
tccutil reset ScreenCapture dev.copilot.desktop || true
# Copy first, then swap, so a failed copy never leaves you without the app.
rm -rf "$APP.new"
ditto "$BUILT" "$APP.new"
xattr -cr "$APP.new"
rm -rf "$APP"
mv "$APP.new" "$APP"

echo "==> Opening Dev Copilot"
# Open by path: `open -a` can pick another copy of the app with the same bundle id.
open "$APP"
echo "Done. Press Cmd+Shift+S once and turn Screen Recording on for Dev Copilot when macOS asks."

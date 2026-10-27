#!/bin/sh
# LE KIOSQUE — lance l'installateur avec le Node livré dans le kit (hors ligne).
DIR=$(cd "$(dirname "$0")" && pwd)
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)  N="$DIR/outils/node-linux-x64/node" ;;
  Linux-aarch64) N="$DIR/outils/node-linux-arm64/node" ;;
  Darwin-arm64)  N="$DIR/outils/node-darwin-arm64/node" ;;
  Darwin-x86_64) N="$DIR/outils/node-darwin-x64/node" ;;
esac
if [ -z "$N" ] || [ ! -x "$N" ]; then
  N=$(command -v node) || { echo "Aucun Node pour cette machine. Installez Node 22 (nodejs.org) puis relancez."; exit 1; }
fi
exec "$N" "$DIR/outils/installer.mjs" "$@"

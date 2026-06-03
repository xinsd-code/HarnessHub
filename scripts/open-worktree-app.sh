#!/bin/sh
set -e

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
case "${1:-}" in
  -h|--help)
    echo "Usage: npm run desktop:open [path-to-app-bundle]"
    echo "Default: $ROOT_DIR/target/release/bundle/macos/HarnessKit.app"
    exit 0
    ;;
esac

APP_PATH="${1:-$ROOT_DIR/target/release/bundle/macos/HarnessKit.app}"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: app bundle not found at $APP_PATH"
  echo "Build it first from the worktree root:"
  echo "  cargo tauri build --config crates/hk-desktop/tauri.conf.json"
  exit 1
fi

echo "Opening $APP_PATH"
open "$APP_PATH"

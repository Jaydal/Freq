#!/usr/bin/env bash
# Build (if needed) and run the LVGL kiosk terminal simulator.
#
#   ./run.sh          build if needed, then run
#   ./run.sh --clean  wipe build/ and rebuild from scratch, then run
#   ./run.sh --build  build only, don't run
set -euo pipefail

cd "$(dirname "$0")"

CLEAN=0
RUN=1
SIM_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=1 ;;
    --build) RUN=0 ;;
    --mock)  SIM_ARGS+=(--mock) ;;
    -h|--help)
      echo "usage: ./run.sh [--clean] [--build] [--mock]"
      echo "  --clean  remove build/ and rebuild from scratch"
      echo "  --build  build only (do not launch the simulator)"
      echo "  --mock   run with offline mock data (no MQTT/REST, no setup needed)"
      exit 0
      ;;
    *) echo "unknown option: $arg" >&2; exit 1 ;;
  esac
done

if ! command -v cmake >/dev/null 2>&1; then
  echo "error: cmake not found. Install it (e.g. 'brew install cmake')." >&2
  exit 1
fi
if ! pkg-config --exists sdl2 2>/dev/null; then
  echo "error: SDL2 not found. Install it (e.g. 'brew install sdl2')." >&2
  exit 1
fi

if [ "$CLEAN" -eq 1 ]; then
  echo "[run.sh] cleaning build/"
  rm -rf build
fi

echo "[run.sh] configuring (fetches LVGL + lv_drivers on first run)…"
cmake -B build -S .

echo "[run.sh] building…"
cmake --build build -j

if [ "$RUN" -eq 1 ]; then
  echo "[run.sh] launching kiosk_sim (close the window to quit)"
  # Empty-array-safe expansion (macOS bash 3.2 + `set -u` errors on "${arr[@]}" when empty)
  exec ./build/kiosk_sim ${SIM_ARGS[@]+"${SIM_ARGS[@]}"}
fi

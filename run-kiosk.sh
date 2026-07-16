#!/usr/bin/env bash
set -e

echo "Starting Kiosk Terminal Simulator..."

cd "$(dirname "$0")/kiosk-terminal"

# Configure and build
cmake -B build -S .
cmake --build build -j

# Run the simulator
./build/kiosk_sim

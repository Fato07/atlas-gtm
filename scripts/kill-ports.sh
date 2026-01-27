#!/usr/bin/env bash
# Kill processes on all Atlas GTM dev ports
# Usage: ./scripts/kill-ports.sh

PORTS=(8100 4001 4002 4003 4004 4006 5173)

for port in "${PORTS[@]}"; do
  pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "Killing process on port $port (PID: $pid)"
    kill -9 $pid 2>/dev/null
  fi
done

echo "✓ All dev ports cleared"

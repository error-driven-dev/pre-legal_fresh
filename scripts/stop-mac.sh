#!/usr/bin/env bash
# Stop Prelegal and remove its container.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose down

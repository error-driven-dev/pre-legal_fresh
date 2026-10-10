#!/usr/bin/env bash
# Build and start Prelegal at http://localhost:8000 (database is recreated on every start).
set -euo pipefail
cd "$(dirname "$0")/.."

docker info >/dev/null 2>&1 || { echo "Docker is not running. Start Docker and try again." >&2; exit 1; }
docker compose up -d --build

for _ in $(seq 1 30); do
  if curl -fs http://localhost:8000/api/health >/dev/null; then
    echo "Prelegal is running at http://localhost:8000"
    exit 0
  fi
  sleep 1
done
echo "Prelegal did not become healthy. Run: docker compose logs" >&2
exit 1

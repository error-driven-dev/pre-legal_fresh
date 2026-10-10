#!/usr/bin/env bash
# Run every lint, type, test and build check. Run this before declaring any change done.
set -euo pipefail
cd "$(dirname "$0")/.."

(cd backend && uv run ruff check . && uv run mypy app tests && uv run pytest -q)
(cd frontend && npm run gen:api:check && npm run lint && npm run typecheck && npm test && npm run build)
echo "All checks passed."

# Prelegal: guide for AI agents

SaaS for drafting legal agreements from templates in `templates/` (catalog in `catalog.json`).
Product background and the required development process are in `.CLAUDE.md`.

## Verify every change

Run `scripts/check-windows.ps1` (Windows) or `scripts/check-mac.sh` (Mac). It runs, for both sides:
ruff, mypy (strict), pytest, API-types freshness, eslint, tsc, vitest, and the production build.
**A change is not done until it passes.** Add a test for every behavior you add or change.

## Run

`scripts/start-windows.ps1` / `start-mac.sh` builds one Docker image and serves everything at
http://localhost:8000. `stop-*` tears it down. SQLite is recreated on every start.

## Architecture

```
backend/   FastAPI + SQLAlchemy + SQLite, a uv project (Python 3.13)
  app/main.py            app factory: mounts routers, serves the built frontend (frontend/out locally,
                         /app/backend/static in Docker) as static files at "/"
  app/config.py          settings (env vars prefixed PRELEGAL_)
  app/db.py              engine, Base, get_session, reset_database()
  app/features/<name>/   one folder per feature: router.py, models.py, schemas, service
                         users/ is the table only; sign-up/sign-in endpoints are not built yet
                         (they need password hashing and routes under /api/auth)
  tests/                 pytest, throwaway DB per run (see conftest.py)
frontend/  Next.js (static export, output: "export") + TypeScript strict
  src/api/schema.d.ts    GENERATED from the backend OpenAPI schema. Never edit by hand.
  src/api/client.ts      typed fetch client; use it for every backend call
  src/lib/               pure logic with unit tests (nda.ts builds the document, pdf.ts renders it)
  src/components/        UI
scripts/   start/stop/check scripts. Dockerfile + compose.yaml at the repo root.
```

## Conventions

- **Add a backend feature** by creating `app/features/<name>/`, registering its router in
  `app/main.py` and its models in `init_models()` in `app/db.py`.
- **Change an API** by editing the backend, then run `npm run gen:api` in `frontend/`. The
  TypeScript compiler then flags every frontend call that no longer matches. `gen:api:check`
  (part of the check script) fails if you forget.
- All API routes live under `/api` so they never collide with the static frontend.
- Frontend: no `any`; brand colors come from the CSS variables in `src/app/globals.css`
  (accent #BAFF39, primary #209dd7, navy #032147, muted #6E6E6E).
- Backend: full type hints (mypy strict), pydantic models for every request/response.
- Secrets live in `.env` (gitignored, passed to the container). Never print or commit them.
- Keep files small and single-purpose; prefer adding a new file over growing a large one.
- Next.js here is a newer version than most training data: see `frontend/AGENTS.md`.

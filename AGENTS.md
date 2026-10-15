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
  app/features/documents/ the document catalog. parser.py turns a template in templates/ into
                         clause blocks + fields (one per named term, e.g. "Provider"); hints.py
                         holds hand-written guidance per term; registry.py loads catalog.json.
                         GET /api/documents, GET /api/documents/{id}. Adding a template =
                         add the .md file and a catalog.json entry; fields are extracted for you.
  app/features/chat/     POST /api/chat: AI assistant (OpenRouter, structured output). It picks
                         the document from the catalog (or explains it cannot draft it and offers
                         the closest one), then fills the NDA `fields` or a generic document's
                         `values`. llm.py = HTTP client, service.py = prompt + parsing (+1 retry)
                         + sanitize(), router.py = endpoint. Stateless: client sends whole chat.
  app/features/<name>/   one folder per feature: router.py, models.py, schemas, service
                         users/ is the table only; sign-up/sign-in endpoints are not built yet
                         (they need password hashing and routes under /api/auth)
  tests/                 pytest, throwaway DB per run (see conftest.py)
frontend/  Next.js (static export, output: "export") + TypeScript strict
  src/api/schema.d.ts    GENERATED from the backend OpenAPI schema. Never edit by hand.
  src/api/client.ts      typed fetch client; use it for every backend call
  src/lib/               pure logic with unit tests (nda.ts builds the document, pdf.ts renders it,
                         chat.ts merges AI-returned NDA fields, generic.ts builds generic documents
                         (Key Terms table + standard terms) and merges AI-returned values; both
                         ignore invalid or blank values)
  src/components/        UI. DocumentCreator holds the state: a document picker, a Chat/Form toggle
                         (default Chat); ChatPanel, NdaForm (the NDA), GenericForm (any other
                         document, generated from its fields) and DocumentPreview are the pieces
scripts/   start/stop/check scripts. Dockerfile + compose.yaml at the repo root.
```

## Conventions

- **Add a backend feature** by creating `app/features/<name>/`, registering its router in
  `app/main.py` and its models in `init_models()` in `app/db.py`.
- **Change an API** by editing the backend, then run `npm run gen:api` in `frontend/`. The
  TypeScript compiler then flags every frontend call that no longer matches. `gen:api:check`
  (part of the check script) fails if you forget.
- The Mutual NDA keeps its own cover page and form (`kind: "nda"`); all other documents are
  `kind: "generic"`: their values appear in a Key Terms table, and the template body keeps the
  defined terms by name.
- All API routes live under `/api` so they never collide with the static frontend.
- Frontend: no `any`; brand colors come from the CSS variables in `src/app/globals.css`
  (accent #BAFF39, primary #209dd7, navy #032147, muted #6E6E6E).
- Backend: full type hints (mypy strict), pydantic models for every request/response.
- AI: calls go through OpenRouter from the backend only. Model is `PRELEGAL_MODEL` (default
  `nvidia/nemotron-3-super-120b-a12b:free`; `openrouter/free` was less reliable at following the
  schema). Free models are flaky, so always validate model output (see `chat.ts`, `service.py`).
- Secrets live in `.env` (gitignored, passed to the container). Never print or commit them.
- Keep files small and single-purpose; prefer adding a new file over growing a large one.
- Next.js here is a newer version than most training data: see `frontend/AGENTS.md`.

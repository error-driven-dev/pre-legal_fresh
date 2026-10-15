# Prelegal

Draft legal agreements from templates (Mutual NDA, Cloud Service Agreement, DPA, and more) by
chatting with an AI assistant or filling in a form. Documents download as PDF.

- **Backend:** FastAPI + SQLAlchemy + SQLite (uv project, Python 3.13) in `backend/`
- **Frontend:** Next.js static export + TypeScript in `frontend/`, served by FastAPI
- **AI:** OpenRouter, called from the backend only

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running) — needed to build and run the app
- An [OpenRouter](https://openrouter.ai/) API key — needed for the AI chat (the form works without it)

For local development and checks you also need [uv](https://docs.astral.sh/uv/) and Node.js.

## Configure

Create a `.env` file in the repo root (it is gitignored and passed to the container):

```
OPENROUTER_API_KEY=your-key-here
```

Optional settings (prefixed `PRELEGAL_`), e.g. `PRELEGAL_MODEL` to choose the model
(default `nvidia/nemotron-3-super-120b-a12b:free`).

## Build and run

Windows (PowerShell):

```powershell
scripts/start-windows.ps1   # build the image and start
scripts/stop-windows.ps1    # stop and tear down
```

Mac:

```bash
scripts/start-mac.sh
scripts/stop-mac.sh
```

The start script builds a single Docker image and serves the app at
**http://localhost:8000** (API under `/api`, health check at `/api/health`).
The SQLite database is recreated on every start. If startup fails, run `docker compose logs`.

## Test and verify

```powershell
scripts/check-windows.ps1   # Windows
```

```bash
scripts/check-mac.sh        # Mac
```

This runs ruff, mypy (strict), pytest, API-types freshness, eslint, tsc, vitest and the
production build for both backend and frontend.

## Develop without Docker

```bash
# Backend (http://localhost:8000)
cd backend
uv sync
uv run uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

After changing a backend API, regenerate the frontend types with `npm run gen:api` in `frontend/`.

## Project layout

| Path | Purpose |
| --- | --- |
| `templates/`, `catalog.json` | Legal document templates and their catalog |
| `backend/` | FastAPI app (`app/features/documents`, `app/features/chat`, ...) |
| `frontend/` | Next.js UI (`src/components`, `src/lib`, `src/api`) |
| `scripts/` | start, stop and check scripts |

See `AGENTS.md` for architecture details and conventions.

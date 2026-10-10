# Stage 1: statically build the Next.js frontend (reads ../templates at build time).
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY templates/ /app/templates/
RUN npm run build

# Stage 2: FastAPI serves the API and the static frontend on port 8000.
FROM python:3.13-slim
RUN pip install --no-cache-dir uv
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev
COPY backend/app ./app
COPY --from=frontend /app/frontend/out ./static
ENV PRELEGAL_DATABASE_PATH=/tmp/prelegal.db \
    PRELEGAL_STATIC_DIR=/app/backend/static
EXPOSE 8000
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

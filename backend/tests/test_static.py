from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import create_app


def test_serves_static_frontend_and_api(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / "index.html").write_text("<h1>hello</h1>")
    monkeypatch.setattr(settings, "static_dir", tmp_path)
    with TestClient(create_app()) as client:
        assert "hello" in client.get("/").text
        assert client.get("/api/health").json()["status"] == "ok"

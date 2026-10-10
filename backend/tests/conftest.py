import os
import tempfile
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

# Tests use a throwaway database; set before the app modules read settings.
os.environ["PRELEGAL_DATABASE_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")

from app.main import create_app  # noqa: E402


@pytest.fixture
def client() -> Iterator[TestClient]:
    # Entering the context runs the lifespan, which resets the database.
    with TestClient(create_app()) as test_client:
        yield test_client

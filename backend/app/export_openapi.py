"""Print the OpenAPI schema as JSON. The frontend generates its API types from this."""

import json

from app.main import create_app

if __name__ == "__main__":
    print(json.dumps(create_app().openapi(), indent=2))

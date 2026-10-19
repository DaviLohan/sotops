from fastapi.testclient import TestClient

from app import __version__
from app.main import app

client = TestClient(app)


def test_health_reports_status_and_version() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == __version__
    assert body["uptimeSeconds"] >= 0


def test_interactive_docs_are_disabled() -> None:
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_no_recognition_endpoints_exist_yet() -> None:
    routes = {route.path for route in app.routes}
    assert routes == {"/health"}

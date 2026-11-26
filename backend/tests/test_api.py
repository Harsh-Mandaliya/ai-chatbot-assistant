import json
import os

# Use a throwaway database and force demo mode before the app is imported.
os.environ["DATABASE_URL"] = "sqlite:///./test_chat.db"
os.environ["LLM_API_KEY"] = ""
os.environ["LLM_BASE_URL"] = ""
os.environ["RATE_LIMIT_PER_MINUTE"] = "3"

import pytest
from fastapi.testclient import TestClient

from app.db import Base, engine
from app.main import app
from app.routes.chat import limiter

HEADERS = {"X-Client-Id": "test-client-123"}


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    limiter.reset()
    with TestClient(app) as c:
        yield c


def _events(text: str) -> list[dict]:
    return [json.loads(line[6:]) for line in text.splitlines() if line.startswith("data: ")]


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["demo"] is True


def test_requires_client_id(client):
    res = client.get("/api/conversations")
    assert res.status_code == 400
    assert "X-Client-Id" in res.json()["error"]["message"]


def test_conversation_lifecycle(client):
    convo = client.post("/api/conversations", headers=HEADERS).json()
    assert convo["title"] == "New chat"

    res = client.post(f"/api/conversations/{convo['id']}/messages", json={"content": "Plan me a weekend in Goa"}, headers=HEADERS)
    assert res.status_code == 200
    events = _events(res.text)
    assert events[0]["type"] == "start"
    assert events[0]["title"] == "Plan me a weekend in Goa"
    assert any(e["type"] == "token" for e in events)
    assert events[-1]["type"] == "done"

    detail = client.get(f"/api/conversations/{convo['id']}", headers=HEADERS).json()
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant"]

    renamed = client.patch(f"/api/conversations/{convo['id']}", json={"title": "  Goa   trip "}, headers=HEADERS)
    assert renamed.json()["title"] == "Goa trip"

    assert client.delete(f"/api/conversations/{convo['id']}", headers=HEADERS).status_code == 204
    assert client.get(f"/api/conversations/{convo['id']}", headers=HEADERS).status_code == 404


def test_other_clients_cannot_read(client):
    convo = client.post("/api/conversations", headers=HEADERS).json()
    res = client.get(f"/api/conversations/{convo['id']}", headers={"X-Client-Id": "someone-else-456"})
    assert res.status_code == 404


def test_rejects_blank_and_long_messages(client):
    convo = client.post("/api/conversations", headers=HEADERS).json()
    url = f"/api/conversations/{convo['id']}/messages"
    assert client.post(url, json={"content": "   "}, headers=HEADERS).status_code == 422
    assert client.post(url, json={"content": "x" * 4001}, headers=HEADERS).status_code == 422


def test_rate_limit(client):
    convo = client.post("/api/conversations", headers=HEADERS).json()
    url = f"/api/conversations/{convo['id']}/messages"
    for _ in range(3):
        assert client.post(url, json={"content": "hi"}, headers=HEADERS).status_code == 200
    res = client.post(url, json={"content": "hi"}, headers=HEADERS)
    assert res.status_code == 429
    assert "Retry-After" in res.headers

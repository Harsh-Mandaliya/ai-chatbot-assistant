import json
import os
import shutil

# Use a throwaway database and force demo mode before the app is imported.
os.environ["DATABASE_URL"] = "sqlite:///./test_chat.db"
os.environ["LLM_API_KEY"] = ""
os.environ["LLM_BASE_URL"] = ""
os.environ["RATE_LIMIT_PER_MINUTE"] = "3"
os.environ["ONLINE_IMAGES_PER_DAY"] = "2"
os.environ["UPLOAD_DIR"] = "test_uploads"
# Nothing listens on port 9, so offline mode behaves like "Ollama not installed".
os.environ["OFFLINE_BASE_URL"] = "http://127.0.0.1:9/v1"

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import Base, engine
from app.main import app
from app.routes.chat import limiter

HEADERS = {"X-Client-Id": "test-client-123"}


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    limiter.reset()
    shutil.rmtree(get_settings().upload_dir, ignore_errors=True)
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


def test_subjects(client):
    subjects = client.get("/api/subjects").json()
    ids = [s["id"] for s in subjects]
    assert ids[0] == "general"
    assert {"python", "cloud", "ai", "dsa"} <= set(ids)
    assert all(len(s["starters"]) >= 3 for s in subjects)


def test_study_options_are_validated(client):
    convo = client.post("/api/conversations", headers=HEADERS).json()
    url = f"/api/conversations/{convo['id']}/messages"
    ok = client.post(url, json={"content": "hi", "subject": "python", "level": "advanced", "mode": "quiz"}, headers=HEADERS)
    assert ok.status_code == 200
    bad = client.post(url, json={"content": "hi", "level": "expert"}, headers=HEADERS)
    assert bad.status_code == 422


def test_system_prompt_follows_subject_level_and_mode():
    from app.persona import system_prompt

    prompt = system_prompt("Nova", subject="cloud", level="advanced", mode="quiz")
    assert "Cloud & DevOps" in prompt
    assert "trade-offs" in prompt
    assert "Quiz mode is on" in prompt
    assert "only this" in system_prompt("Nova")


def test_define_validates_term(client):
    assert client.get("/api/define", params={"term": "x"}).status_code == 422


# A 1x1 transparent PNG.
PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


def _new_chat(client, engine="online"):
    return client.post("/api/conversations", json={"engine": engine}, headers=HEADERS).json()["id"]


def test_engines_report_limits_and_offline_status(client):
    data = client.get("/api/engines", headers=HEADERS).json()
    assert data["online"]["limits"]["images_per_day"] == 2
    assert data["online"]["limits"]["levels"] == ["beginner", "advanced"]
    assert data["offline"]["limits"] is None
    assert "deep" in data["offline"]["levels"]
    assert data["offline"]["running"] is False


def test_image_upload_is_saved_and_served(client):
    cid = _new_chat(client)
    res = client.post(f"/api/conversations/{cid}/messages", json={"content": "", "images": [PNG]}, headers=HEADERS)
    assert res.status_code == 200
    start = _events(res.text)[0]
    assert start["title"] == "Screenshot question"
    url = start["userMessage"]["images"][0]
    img = client.get(url)
    assert img.status_code == 200
    assert img.content.startswith(b"\x89PNG")


def test_rejects_fake_images(client):
    cid = _new_chat(client)
    fake = "data:image/png;base64,aGVsbG8gd29ybGQ="  # "hello world"
    res = client.post(f"/api/conversations/{cid}/messages", json={"content": "hi", "images": [fake]}, headers=HEADERS)
    assert res.status_code == 422


def test_online_image_limit_per_day(client):
    cid = _new_chat(client)
    url = f"/api/conversations/{cid}/messages"
    assert client.post(url, json={"content": "a", "images": [PNG, PNG]}, headers=HEADERS).status_code == 200
    res = client.post(url, json={"content": "b", "images": [PNG]}, headers=HEADERS)
    assert res.status_code == 429
    assert "Offline" in res.json()["error"]["message"]


def test_offline_has_no_limits(client):
    cid = _new_chat(client, "offline")
    url = f"/api/conversations/{cid}/messages"
    body = {"content": "explain transformers", "engine": "offline", "level": "deep", "images": [PNG, PNG, PNG]}
    # More messages and images than online allows, all accepted.
    for _ in range(4):
        res = client.post(url, json=body, headers=HEADERS)
        assert res.status_code == 200
        # Ollama isn't running in tests, so the stream ends with a helpful error.
        last = _events(res.text)[-1]
        assert last["type"] == "error"
        assert "Ollama" in last["message"]


def test_deep_dive_is_offline_only(client):
    cid = _new_chat(client)
    res = client.post(
        f"/api/conversations/{cid}/messages", json={"content": "hi", "level": "deep"}, headers=HEADERS
    )
    assert res.status_code == 403


def test_deep_dive_prompt():
    from app.persona import system_prompt

    assert "Deep dive" in system_prompt("Nova", level="deep")


def test_online_and_offline_histories_are_separate(client):
    online_id = _new_chat(client, "online")
    offline_id = _new_chat(client, "offline")

    online = client.get("/api/conversations", params={"engine": "online"}, headers=HEADERS).json()
    offline = client.get("/api/conversations", params={"engine": "offline"}, headers=HEADERS).json()
    assert [c["id"] for c in online] == [online_id]
    assert [c["id"] for c in offline] == [offline_id]
    assert offline[0]["engine"] == "offline"

    # A chat can't be continued from the other mode.
    res = client.post(f"/api/conversations/{offline_id}/messages", json={"content": "hi"}, headers=HEADERS)
    assert res.status_code == 409
    assert "Offline" in res.json()["error"]["message"]

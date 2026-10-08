"""test_auth.py -- the optional staff login used on public deployments (STAFF_PASSWORD)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "api"))
from app import create_app  # noqa: E402


def make(monkeypatch, password):
    if password:
        monkeypatch.setenv("STAFF_PASSWORD", password)
    else:
        monkeypatch.delenv("STAFF_PASSWORD", raising=False)
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    return create_app().test_client()


def test_open_when_no_password_is_set(monkeypatch):
    c = make(monkeypatch, None)
    assert c.get("/api/session").get_json() == {"auth_required": False, "authenticated": True}
    assert c.get("/api/guests").status_code == 200


def test_locked_until_signed_in(monkeypatch):
    c = make(monkeypatch, "club-1926")
    assert c.get("/api/session").get_json() == {"auth_required": True, "authenticated": False}
    r = c.get("/api/guests")
    assert r.status_code == 401 and r.get_json()["error"] == "login"
    assert c.post("/api/reservations", json={}).status_code == 401
    assert c.get("/api/health").status_code == 200            # health stays open for the host's checks

    bad = c.post("/api/login", json={"password": "wrong"})
    assert bad.status_code == 401 and bad.get_json()["error"] == "login"
    assert c.get("/api/guests").status_code == 401

    assert c.post("/api/login", json={"password": "club-1926"}).status_code == 200
    assert c.get("/api/session").get_json()["authenticated"] is True
    assert c.get("/api/guests").status_code == 200

    c.post("/api/logout")
    assert c.get("/api/guests").status_code == 401

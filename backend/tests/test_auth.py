from fastapi.testclient import TestClient
import app.main as auth

client = TestClient(auth.app)

def setup_function():
    auth._users.clear()
    auth._codes.clear()
    auth._attempts.clear()
    auth._send_code = lambda email, code: auth._codes.__setitem__("captured-test-code", {"code": code, "email": email})

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_registration_verify_login_and_me(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code: sent.update(email=email, code=code))
    payload = {"username": "runner_01", "email": "runner@example.com", "password": "StrongPass!123"}
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 202
    assert "code" not in response.json()
    verified = client.post("/api/auth/verify", json={"email": payload["email"], "code": sent["code"]})
    assert verified.status_code == 200
    token = verified.json()["access_token"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["user"]["username"] == "runner_01"
    login = client.post("/api/auth/login", json={"identifier": payload["email"], "password": payload["password"]})
    assert login.status_code == 200

def test_wrong_verification_code(monkeypatch):
    monkeypatch.setattr(auth, "_send_code", lambda email, code: None)
    client.post("/api/auth/register", json={"username":"runner_02","email":"runner2@example.com","password":"StrongPass!123"})
    response = client.post("/api/auth/verify", json={"email":"runner2@example.com","code":"111111"})
    assert response.status_code == 400

def test_duplicate_email_rejected(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code: sent.update(code=code))
    body = {"username":"runner_03","email":"runner3@example.com","password":"StrongPass!123"}
    client.post("/api/auth/register", json=body)
    client.post("/api/auth/verify", json={"email":body["email"],"code":sent["code"]})
    response = client.post("/api/auth/register", json={"username":"runner_04","email":body["email"],"password":"StrongPass!123"})
    assert response.status_code == 409

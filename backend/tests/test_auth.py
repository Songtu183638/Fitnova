from fastapi.testclient import TestClient
import app.main as auth

client = TestClient(auth.app)

def setup_function():
    auth._users.clear()
    auth._codes.clear()
    auth._attempts.clear()
    auth._login_codes.clear()
    auth._posts.clear()
    auth._post_comments.clear()
    auth._post_likes.clear()
    auth._post_seq = 0
    auth._comment_seq = 0
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
    assert login.status_code == 202
    assert login.json()["email"] == payload["email"]
    login_code = sent["code"]
    completed = client.post("/api/auth/login/verify", json={"email": payload["email"], "code": login_code})
    assert completed.status_code == 200
    login_token = completed.json()["access_token"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {login_token}"}).status_code == 200

def test_posts_likes_comments_and_delete(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code: sent.update(email=email, code=code))
    body = {"username":"poster_01","email":"poster@example.com","password":"StrongPass!123"}
    client.post("/api/auth/register", json=body)
    verified = client.post("/api/auth/verify", json={"email":body["email"],"code":sent["code"]})
    token = verified.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post("/api/posts", json={"content":"첫 FITNOVA 게시물"}, headers=headers)
    assert created.status_code == 201
    post_id = created.json()["post"]["id"]
    assert client.get("/api/posts", headers=headers).json()["posts"][0]["content"] == "첫 FITNOVA 게시물"
    assert client.post(f"/api/posts/{post_id}/like", headers=headers).json()["liked"] is True
    comment = client.post(f"/api/posts/{post_id}/comments", json={"content":"멋져요!"}, headers=headers)
    assert comment.status_code == 201
    feed_post = client.get("/api/posts", headers=headers).json()["posts"][0]
    assert feed_post["like_count"] == 1
    assert feed_post["liked_by_me"] is True
    assert feed_post["comments"][0]["content"] == "멋져요!"
    assert client.delete(f"/api/posts/{post_id}", headers=headers).json()["deleted"] is True

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

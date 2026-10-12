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
    auth._follows.clear()
    auth._messages.clear()
    auth._saved_posts.clear()
    auth._user_settings.clear()
    auth._account_codes.clear()
    auth._message_seq = 0
    auth._post_seq = 0
    auth._comment_seq = 0
    auth._send_code = lambda email, code, purpose='': auth._codes.__setitem__("captured-test-code", {"code": code, "email": email})

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_registration_verify_login_and_me(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': sent.update(email=email, code=code))
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
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': sent.update(email=email, code=code))
    body = {"username":"poster_01","email":"poster@example.com","password":"StrongPass!123"}
    client.post("/api/auth/register", json=body)
    verified = client.post("/api/auth/verify", json={"email":body["email"],"code":sent["code"]})
    token = verified.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post("/api/posts", json={"title":"첫 FITNOVA 게시물","content":"오늘의 운동 기록","media_type":"image","media_data":"data:image/png;base64,aGVsbG8gd29ybGQ=","hashtags":["#운동기록"],"weight":68.5,"sets_count":4,"exercise_name":"벤치프레스","reps":"10회 × 60kg","duration_minutes":45,"workout_notes":"마지막 세트까지 완료"}, headers=headers)
    assert created.status_code == 201
    post_id = created.json()["post"]["id"]
    listed_post = client.get("/api/posts", headers=headers).json()["posts"][0]
    assert listed_post["content"] == "오늘의 운동 기록"
    assert listed_post["media_type"] == "image"
    assert listed_post["title"] == "첫 FITNOVA 게시물"
    assert listed_post["weight"] == 68.5
    assert listed_post["sets_count"] == 4
    assert listed_post["hashtags"] == ["운동기록"]
    assert client.post(f"/api/posts/{post_id}/like", headers=headers).json()["liked"] is True
    comment = client.post(f"/api/posts/{post_id}/comments", json={"content":"멋져요!"}, headers=headers)
    assert comment.status_code == 201
    feed_post = client.get("/api/posts", headers=headers).json()["posts"][0]
    assert feed_post["like_count"] == 1
    assert feed_post["liked_by_me"] is True
    assert feed_post["comments"][0]["content"] == "멋져요!"
    assert client.delete(f"/api/posts/{post_id}", headers=headers).json()["deleted"] is True

def test_wrong_verification_code(monkeypatch):
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': None)
    client.post("/api/auth/register", json={"username":"runner_02","email":"runner2@example.com","password":"StrongPass!123"})
    response = client.post("/api/auth/verify", json={"email":"runner2@example.com","code":"111111"})
    assert response.status_code == 400

def test_duplicate_email_rejected(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': sent.update(code=code))
    body = {"username":"runner_03","email":"runner3@example.com","password":"StrongPass!123"}
    client.post("/api/auth/register", json=body)
    client.post("/api/auth/verify", json={"email":body["email"],"code":sent["code"]})
    response = client.post("/api/auth/register", json={"username":"runner_04","email":body["email"],"password":"StrongPass!123"})
    assert response.status_code == 409


def _verified_user(username, email, sent):
    body = {"username": username, "email": email, "password": "StrongPass!123"}
    registered = client.post("/api/auth/register", json=body)
    assert registered.status_code == 202
    verified = client.post("/api/auth/verify", json={"email": email, "code": sent["code"]})
    assert verified.status_code == 200
    return verified.json()["access_token"]

def test_hashtag_search_follow_profile_and_direct_messages(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': sent.update(email=email, code=code))
    token_a = _verified_user("member_a", "membera@example.com", sent)
    token_b = _verified_user("member_b", "memberb@example.com", sent)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    created = client.post("/api/posts", headers=headers_b, json={
        "title": "오늘의 하체 운동", "content": "스쿼트 기록", "media_type": "image",
        "media_data": "data:image/png;base64,aGVsbG8gd29ybGQ=", "hashtags": ["#하체", "#스쿼트"]
    })
    assert created.status_code == 201
    searched = client.get("/api/posts?hashtag=%23%ED%95%98%EC%B2%B4", headers=headers_a)
    assert searched.status_code == 200
    assert len(searched.json()["posts"]) == 1
    assert searched.json()["posts"][0]["author_username"] == "member_b"

    profile = client.get("/api/users/member_b", headers=headers_a)
    assert profile.status_code == 200
    assert profile.json()["profile"]["following_by_me"] is False
    followed = client.post("/api/users/member_b/follow", headers=headers_a)
    assert followed.status_code == 200
    assert followed.json()["following"] is True
    assert followed.json()["profile"]["follower_count"] == 1
    unfollowed = client.post("/api/users/member_b/follow", headers=headers_a)
    assert unfollowed.json()["following"] is False

    sent_message = client.post("/api/messages/member_b", headers=headers_a, json={"content": "오늘 운동 멋져요!"})
    assert sent_message.status_code == 201
    assert sent_message.json()["message"]["content"] == "오늘 운동 멋져요!"
    conversation = client.get("/api/messages/member_a", headers=headers_b)
    assert conversation.status_code == 200
    assert conversation.json()["messages"][0]["sender_username"] == "member_a"
    threads = client.get("/api/messages", headers=headers_b)
    assert threads.status_code == 200
    assert threads.json()["threads"][0]["username"] == "member_a"

def test_auth_token_is_persistent_for_one_year(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': sent.update(email=email, code=code))
    token = _verified_user("long_session", "longsession@example.com", sent)
    payload = auth.jwt.decode(token, auth._SECRET, algorithms=["HS256"])
    assert payload["exp"] - payload["iat"] >= 364 * 24 * 60 * 60


def test_saved_posts_account_settings_email_password_and_message_privacy(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': sent.update(email=email, code=code))
    token_a = _verified_user("settings_a", "settingsa@example.com", sent)
    token_b = _verified_user("settings_b", "settingsb@example.com", sent)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    post = client.post("/api/posts", headers=headers_a, json={
        "title":"저장 테스트", "content":"저장할 게시물", "media_type":"image",
        "media_data":"data:image/png;base64,aGVsbG8gd29ybGQ=", "hashtags":["#저장"]
    })
    assert post.status_code == 201
    pid = post.json()["post"]["id"]
    assert client.post(f"/api/posts/{pid}/save", headers=headers_b).json()["saved"] is True
    assert client.get("/api/saved-posts", headers=headers_b).json()["posts"][0]["id"] == pid
    prefs = client.patch("/api/account/settings", headers=headers_b, json={
        "private_account": True, "allow_messages_from": "following",
        "show_activity": False, "show_workout_details": False
    })
    assert prefs.status_code == 200
    assert prefs.json()["settings"]["allow_messages_from"] == "following"
    blocked = client.post("/api/messages/settings_b", headers=headers_a, json={"content":"안녕하세요"})
    assert blocked.status_code == 403
    client.post("/api/users/settings_a/follow", headers=headers_b)
    allowed = client.post("/api/messages/settings_b", headers=headers_a, json={"content":"이제 보낼 수 있나요?"})
    assert allowed.status_code == 201

    requested = client.post("/api/account/password/request-code", headers=headers_a)
    assert requested.status_code == 202
    changed = client.post("/api/account/password/confirm", headers=headers_a, json={
        "code": sent["code"], "new_password":"NewStrongPass!456"
    })
    assert changed.status_code == 200
    assert auth._password_hash.verify("NewStrongPass!456", auth._users["settings_a"]["password_hash"])

    requested_email = client.post("/api/account/email/request-code", headers=headers_a, json={"email":"newsettingsa@example.com"})
    assert requested_email.status_code == 202
    changed_email = client.post("/api/account/email/confirm", headers=headers_a, json={
        "email":"newsettingsa@example.com", "code":sent["code"]
    })
    assert changed_email.status_code == 200
    assert client.get("/api/account/settings", headers=headers_a).json()["email"] == "newsettingsa@example.com"


def test_account_deletion_deactivates_account_for_grace_period(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': sent.update(email=email, code=code))
    token = _verified_user("delete_me", "deleteme@example.com", sent)
    headers = {"Authorization": f"Bearer {token}"}
    response = client.delete("/api/account", headers=headers)
    assert response.status_code == 200
    assert response.json()["deleted"] is False
    assert client.get("/api/account/settings", headers=headers).status_code == 401
    assert "delete_me" in auth._users
    auth._users["delete_me"]["deletion_requested_at"] = (auth.datetime.now(auth.timezone.utc) - auth.timedelta(days=31)).isoformat()
    auth._purge_expired_accounts()
    assert "delete_me" not in auth._users


def test_branded_security_email_template():
    html = auth._verification_email_html("482913")
    plain = auth._verification_email_text("482913")
    assert "FITNOVA" in html
    assert "#b7ff36" in html
    assert "482913" in html
    assert "10분 동안" in html
    assert "482913" in plain
    assert "10분 동안 유효합니다." in plain


def test_hashtag_search_matches_visible_caption_and_video_and_normalizes_case(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': sent.update(email=email, code=code))
    token_a = _verified_user("search_viewer", "searchviewer@example.com", sent)
    token_b = _verified_user("search_creator", "searchcreator@example.com", sent)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    created = client.post("/api/posts", headers=headers_b, json={
        "title": "저녁 러닝",
        "content": "오늘은 #러닝 기록! 다음에는 #하체운동, 도 할 예정.",
        "media_type": "video",
        "media_data": "data:video/mp4;base64,aGVsbG8=",
        "media_duration_seconds": 60,
        "hashtags": []
    })
    assert created.status_code == 201
    post = created.json()["post"]
    assert "러닝" in post["hashtags"]
    assert "하체운동" in post["hashtags"]

    search_caption = client.get("/api/posts?hashtag=%23%EB%9F%AC%EB%8B%9D", headers=headers_a)
    assert search_caption.status_code == 200
    assert any(p["id"] == post["id"] and p["media_type"] == "video" for p in search_caption.json()["posts"])

    search_tag = client.get("/api/posts?hashtag=%23%ED%95%98%EC%B2%B4%EC%9A%B4%EB%8F%99", headers=headers_a)
    assert search_tag.status_code == 200
    assert any(p["id"] == post["id"] for p in search_tag.json()["posts"])


def test_video_post_requires_duration_and_rejects_over_one_minute(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': sent.update(email=email, code=code))
    token = _verified_user("video_user", "videouser@example.com", sent)
    headers = {"Authorization": f"Bearer {token}"}
    base = {"title": "운동 영상", "content": "오늘 운동", "media_type": "video", "media_data": "data:video/mp4;base64,aGVsbG8="}
    missing = client.post("/api/posts", headers=headers, json=base)
    assert missing.status_code == 422
    too_long = client.post("/api/posts", headers=headers, json={**base, "media_duration_seconds": 61})
    assert too_long.status_code == 422
    valid = client.post("/api/posts", headers=headers, json={**base, "media_duration_seconds": 60})
    assert valid.status_code == 201
    assert valid.json()["post"]["media_duration_seconds"] == 60



def test_in_memory_hashtag_search_paginates_after_filtering(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': sent.update(email=email, code=code))
    token = _verified_user("search_page_user", "searchpage@example.com", sent)
    headers = {"Authorization": f"Bearer {token}"}
    # Put the matching post behind a full page of newer, unrelated posts.
    matching = client.post("/api/posts", headers=headers, json={
        "title": "오래된 러닝 기록", "content": "아침 #러닝", "media_type": "image",
        "media_data": "data:image/png;base64,aGVsbG8gd29ybGQ=", "hashtags": ["러닝"]
    })
    assert matching.status_code == 201
    matching_id = matching.json()["post"]["id"]
    for index in range(18):
        created = client.post("/api/posts", headers=headers, json={
            "title": f"일반 기록 {index}", "content": "일반 운동 기록", "media_type": "image",
            "media_data": "data:image/png;base64,aGVsbG8gd29ybGQ=", "hashtags": []
        })
        assert created.status_code == 201
    first_page = client.get("/api/posts?hashtag=러닝&limit=15&offset=0", headers=headers)
    assert first_page.status_code == 200
    assert any(post["id"] == matching_id for post in first_page.json()["posts"])


def test_comment_delete_requires_author_and_removes_comment(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': sent.update(email=email, code=code))
    token_a = _verified_user("comment_owner", "commentowner@example.com", sent)
    token_b = _verified_user("comment_other", "commentother@example.com", sent)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    post = client.post("/api/posts", headers=headers_a, json={
        "title": "운동 기록", "content": "오늘 운동 완료", "media_type": "image",
        "media_data": "data:image/png;base64,aGVsbG8gd29ybGQ=", "hashtags": []
    }).json()["post"]
    comment = client.post(f"/api/posts/{post['id']}/comments", headers=headers_b, json={"content": "좋은 기록!"}).json()["comment"]
    forbidden = client.delete(f"/api/posts/{post['id']}/comments/{comment['id']}", headers=headers_a)
    assert forbidden.status_code == 403
    deleted = client.delete(f"/api/posts/{post['id']}/comments/{comment['id']}", headers=headers_b)
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True
    comments = client.get("/api/posts", headers=headers_a).json()["posts"][0]["comments"]
    assert all(item["id"] != comment["id"] for item in comments)


def test_profanity_and_sexual_content_blocked_server_side(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': sent.update(email=email, code=code))
    token = _verified_user("safe_user", "safeuser@example.com", sent)
    headers = {"Authorization": f"Bearer {token}"}
    base = {"title": "운동 기록", "content": "오늘 운동 완료", "media_type": "image",
            "media_data": "data:image/png;base64,aGVsbG8gd29ybGQ=", "hashtags": []}
    bad_post = client.post("/api/posts", headers=headers, json={**base, "content": "씨 발 진짜"})
    assert bad_post.status_code == 422
    post = client.post("/api/posts", headers=headers, json=base)
    assert post.status_code == 201
    bad_comment = client.post(f"/api/posts/{post.json()['post']['id']}/comments", headers=headers, json={"content": "야동 보고 싶다"})
    assert bad_comment.status_code == 422
    assert auth._moderation_normalize("씨 발") == "씨발"


def test_post_feed_defers_media_payload_until_media_endpoint(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': sent.update(email=email, code=code))
    token = _verified_user("media_user", "mediauser@example.com", sent)
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post("/api/posts", headers=headers, json={
        "title": "미디어 지연 로딩", "content": "게시물 본문", "media_type": "image",
        "media_data": "data:image/png;base64,aGVsbG8gd29ybGQ=", "hashtags": []
    })
    pid = created.json()["post"]["id"]
    feed = client.get("/api/posts", headers=headers).json()["posts"][0]
    assert "media_data" not in feed
    assert client.get(f"/api/posts/{pid}/media", headers=headers).json()["media_data"].startswith("data:image/png")

def test_duplicate_display_names_are_allowed_but_usernames_are_unique(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': sent.update(email=email, code=code))

    first = {"name": "민준", "username": "minjun_01", "email": "minjun01@example.com", "password": "StrongPass!123"}
    first_response = client.post("/api/auth/register", json=first)
    assert first_response.status_code == 202
    first_verified = client.post("/api/auth/verify", json={"email": first["email"], "code": sent["code"]})
    assert first_verified.status_code == 200
    assert first_verified.json()["user"]["name"] == "민준"

    second = {"name": "민준", "username": "minjun_02", "email": "minjun02@example.com", "password": "StrongPass!123"}
    second_response = client.post("/api/auth/register", json=second)
    assert second_response.status_code == 202
    second_verified = client.post("/api/auth/verify", json={"email": second["email"], "code": sent["code"]})
    assert second_verified.status_code == 200
    assert second_verified.json()["user"]["name"] == "민준"

    duplicate_username = client.post("/api/auth/register", json={
        "name": "다른 이름", "username": "minjun_01", "email": "minjun03@example.com",
        "password": "StrongPass!123"
    })
    assert duplicate_username.status_code == 409



def test_binary_video_upload_and_raw_media_delivery(monkeypatch):
    sent = {}
    monkeypatch.setattr(auth, "_send_code", lambda email, code, purpose='': sent.update(email=email, code=code))
    body = {"username":"video_user","email":"video@example.com","password":"StrongPass!123"}
    registered = client.post("/api/auth/register", json=body)
    assert registered.status_code == 202
    verified = client.post("/api/auth/verify", json={"email":body["email"],"code":sent["code"]})
    assert verified.status_code == 200
    headers = {"Authorization": f"Bearer {verified.json()['access_token']}"}
    created = client.post(
        "/api/posts/upload",
        headers=headers,
        data={
            "title":"테스트 영상",
            "content":"바이너리 업로드 확인",
            "media_type":"video",
            "media_duration_seconds":"5",
            "hashtags":"[\"운동\"]",
        },
        files={"media":("sample.mp4", b"fake-mp4-content", "video/mp4")},
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["post"]["id"]
    raw = client.get(f"/api/posts/{post_id}/media/file", headers=headers)
    assert raw.status_code == 200
    assert raw.headers["content-type"].startswith("video/mp4")
    assert raw.content == b"fake-mp4-content"
    playback = client.get(f"/api/posts/{post_id}/media/playback", headers=headers)
    assert playback.status_code == 200
    stream = client.get(playback.json()["url"], headers={"Range":"bytes=0-4"})
    assert stream.status_code == 206
    assert stream.content == b"fake-"
    assert stream.headers["content-range"].startswith("bytes 0-4/")
    assert stream.headers["accept-ranges"] == "bytes"

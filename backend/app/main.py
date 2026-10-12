import os, secrets, hashlib, hmac, time, json, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from threading import Lock
from email.message import EmailMessage
import smtplib

import jwt
import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash

app = FastAPI(title="FITNOVA API", version="0.2.0")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:4173,capacitor://localhost,http://localhost").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["GET","POST","DELETE","OPTIONS"], allow_headers=["Authorization","Content-Type"])

_password_hash = PasswordHash.recommended()
_lock = Lock()
_users = {}  # in-memory adapter used only for local tests/development without DATABASE_URL
_codes = {}
_login_codes = {}
_posts = {}
_post_comments = {}
_post_likes = set()
_post_seq = 0
_comment_seq = 0
_attempts = defaultdict(list)
_DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
_SECRET = os.getenv("JWT_SECRET")
if not _SECRET:
    if os.getenv("APP_ENV") == "production":
        raise RuntimeError("JWT_SECRET must be configured in production.")
    _SECRET = secrets.token_urlsafe(48)
    print("WARNING: JWT_SECRET is unset; sessions will be invalidated on restart.")
_CODE_SECRET = os.getenv("VERIFICATION_CODE_SECRET", _SECRET)

class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=24, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)

class VerifyIn(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")

class LoginIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)

class LoginVerifyIn(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\\d{6}$")

class PostIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

class CommentIn(BaseModel):
    content: str = Field(min_length=1, max_length=500)

def _db():
    if not _DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    return psycopg.connect(_DATABASE_URL, row_factory=dict_row, connect_timeout=10)

def _init_db():
    if not _DATABASE_URL:
        if os.getenv("APP_ENV") == "production":
            raise RuntimeError("DATABASE_URL must be configured in production.")
        return
    with _db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id BIGSERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                username_key TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                verified BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS login_challenges (
                email TEXT PRIMARY KEY,
                code_hash TEXT NOT NULL,
                expires_at DOUBLE PRECISION NOT NULL,
                tries INTEGER NOT NULL DEFAULT 0,
                identifier TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS posts (
                id BIGSERIAL PRIMARY KEY,
                author_username TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS post_likes (
                post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                username TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY(post_id, username)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS post_comments (
                id BIGSERIAL PRIMARY KEY,
                post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                author_username TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS pending_registrations (
                email TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                username_key TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                code_hash TEXT NOT NULL,
                expires_at DOUBLE PRECISION NOT NULL,
                tries INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)

@app.on_event("startup")
def startup():
    _init_db()

def _hash_code(email: str, code: str) -> str:
    return hmac.new(_CODE_SECRET.encode(), f"{email.lower()}:{code}".encode(), hashlib.sha256).hexdigest()

def _send_code(email: str, code: str):
    # Preferred provider: a Google Apps Script Web App. The shared secret is
    # sent in the request body and must match the script's Script Property.
    script_url = os.getenv("GOOGLE_APPS_SCRIPT_URL", "").strip()
    script_secret = os.getenv("GOOGLE_APPS_SCRIPT_SECRET", "").strip()
    if script_url:
        if not script_secret:
            raise HTTPException(status_code=503, detail="Google 이메일 발송 보안 설정이 완료되지 않았습니다.")
        payload = json.dumps({"to": email, "code": code, "secret": script_secret}).encode("utf-8")
        req = urllib.request.Request(script_url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                result = json.loads(response.read().decode("utf-8"))
            if not result.get("ok"):
                raise RuntimeError("Google Apps Script rejected the request")
            return
        except Exception:
            raise HTTPException(status_code=503, detail="Google 이메일 발송에 실패했습니다. Apps Script 배포와 설정을 확인해 주세요.")

    # Optional SMTP fallback for deployments that still use SMTP.
    host = os.getenv("SMTP_HOST")
    if not host:
        if os.getenv("APP_ENV", "development") != "production":
            print(f"[DEV ONLY] FITNOVA verification code for {email}: {code}")
            return
        raise HTTPException(status_code=503, detail="이메일 발송 설정이 완료되지 않았습니다.")
    msg = EmailMessage()
    msg["Subject"] = "FITNOVA 이메일 인증 코드"
    msg["From"] = os.getenv("SMTP_FROM", os.getenv("SMTP_USER", ""))
    msg["To"] = email
    msg.set_content(f"FITNOVA 가입 인증 코드: {code}\\n이 코드는 10분 후 만료됩니다. 본인이 요청하지 않았다면 이 메일을 무시하세요.")
    try:
        with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587")), timeout=10) as server:
            server.starttls()
            user, password = os.getenv("SMTP_USER"), os.getenv("SMTP_PASSWORD")
            if user and password: server.login(user, password)
            server.send_message(msg)
    except Exception:
        raise HTTPException(status_code=503, detail="인증 이메일을 발송하지 못했습니다. 잠시 후 다시 시도해 주세요.")

def _rate_limit(key: str, limit: int = 8, window: int = 900):
    now = time.time()
    with _lock:
        _attempts[key] = [t for t in _attempts[key] if now - t < window]
        if len(_attempts[key]) >= limit:
            raise HTTPException(status_code=429, detail="요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.")
        _attempts[key].append(now)

def _find_user(identifier: str):
    key = identifier.lower()
    if _DATABASE_URL:
        with _db() as conn:
            return conn.execute(
                "SELECT username, email, password_hash, verified FROM users WHERE username_key=%s OR lower(email)=%s LIMIT 1",
                (key, key)
            ).fetchone()
    return next((u for u in _users.values() if u["username"].lower() == key or u["email"].lower() == key), None)

def _find_email(email: str):
    if _DATABASE_URL:
        with _db() as conn:
            return conn.execute("SELECT username, email, password_hash, verified FROM users WHERE lower(email)=%s LIMIT 1", (email.lower(),)).fetchone()
    return next((u for u in _users.values() if u["email"].lower() == email.lower()), None)

def _find_username(username: str):
    if _DATABASE_URL:
        with _db() as conn:
            return conn.execute("SELECT username, email, password_hash, verified FROM users WHERE username_key=%s LIMIT 1", (username.lower(),)).fetchone()
    return next((u for u in _users.values() if u["username"].lower() == username.lower()), None)

def _get_pending(email: str):
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute("SELECT username, password_hash, code_hash, expires_at AS expires, tries FROM pending_registrations WHERE email=%s", (email.lower(),)).fetchone()
            return dict(row) if row else None
    return _codes.get(email.lower())

def _save_pending(email: str, record: dict):
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("""
                INSERT INTO pending_registrations(email, username, username_key, password_hash, code_hash, expires_at, tries)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT(email) DO UPDATE SET username=EXCLUDED.username, username_key=EXCLUDED.username_key,
                    password_hash=EXCLUDED.password_hash, code_hash=EXCLUDED.code_hash, expires_at=EXCLUDED.expires_at, tries=0
            """, (email.lower(), record["username"], record["username"].lower(), record["password_hash"], record["code_hash"], record["expires"], 0))
    else:
        _codes[email.lower()] = record

def _delete_pending(email: str):
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("DELETE FROM pending_registrations WHERE email=%s", (email.lower(),))
    else:
        _codes.pop(email.lower(), None)

def _increment_pending_tries(email: str):
    record = _get_pending(email)
    if not record:
        return None
    record["tries"] += 1
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("UPDATE pending_registrations SET tries=%s WHERE email=%s", (record["tries"], email.lower()))
    else:
        _codes[email.lower()] = record
    return record

def _create_user(user: dict):
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("""
                INSERT INTO users(username, username_key, email, password_hash, verified)
                VALUES (%s,%s,%s,%s,%s)
            """, (user["username"], user["username"].lower(), user["email"].lower(), user["password_hash"], True))
    else:
        _users[user["username"]] = user

def _token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user["username"], "iat": now, "exp": now + timedelta(hours=12)}, _SECRET, algorithm="HS256")

def _public(user: dict) -> dict:
    return {"username": user["username"], "email": user["email"], "verified": user["verified"]}

def _current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    try:
        data = jwt.decode(authorization[7:], _SECRET, algorithms=["HS256"])
        user = _find_username(data["sub"])
        if not user:
            raise ValueError()
        return dict(user)
    except Exception:
        raise HTTPException(status_code=401, detail="세션이 만료되었거나 유효하지 않습니다.")

@app.get("/health")
def health():
    db_status = "configured" if _DATABASE_URL else "development-memory"
    return {"status": "ok", "service": "fitnova-api", "database": db_status}

@app.post("/api/auth/register", status_code=202)
def register(payload: RegisterIn, request: Request):
    email = str(payload.email).lower()
    _rate_limit("register:" + (request.client.host if request.client else "unknown"), 5)
    if _find_username(payload.username) or _find_email(email):
        raise HTTPException(status_code=409, detail="이미 사용 중인 아이디 또는 이메일입니다.")
    code = f"{secrets.randbelow(1_000_000):06d}"
    _send_code(email, code)
    _save_pending(email, {"username": payload.username, "password_hash": _password_hash.hash(payload.password), "code_hash": _hash_code(email, code), "expires": time.time()+600, "tries": 0})
    return {"message": "인증 코드를 이메일로 발송했습니다. 10분 안에 인증해 주세요.", "email": email}

@app.post("/api/auth/verify")
def verify(payload: VerifyIn, request: Request):
    email = str(payload.email).lower()
    _rate_limit("verify:" + (request.client.host if request.client else "unknown"), 15)
    record = _increment_pending_tries(email)
    if not record or record["expires"] < time.time():
        _delete_pending(email)
        raise HTTPException(status_code=400, detail="인증 코드가 만료되었거나 요청 내역이 없습니다.")
    if record["tries"] > 5:
        _delete_pending(email)
        raise HTTPException(status_code=429, detail="인증 시도 횟수를 초과했습니다. 다시 가입해 주세요.")
    if not hmac.compare_digest(record["code_hash"], _hash_code(email, payload.code)):
        raise HTTPException(status_code=400, detail="인증 코드가 올바르지 않습니다.")
    username = record["username"]
    if _find_username(username) or _find_email(email):
        _delete_pending(email)
        raise HTTPException(status_code=409, detail="이미 사용 중인 아이디 또는 이메일입니다.")
    user = {"username": username, "email": email, "password_hash": record["password_hash"], "verified": True}
    try:
        _create_user(user)
    except psycopg.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="이미 사용 중인 아이디 또는 이메일입니다.")
    _delete_pending(email)
    return {"message": "이메일 인증과 회원가입이 완료되었습니다.", "user": _public(user), "access_token": _token(user), "token_type": "bearer"}

def _save_login_challenge(email: str, identifier: str, code: str):
    record = {"code_hash": _hash_code(email, code), "expires": time.time()+600, "tries": 0, "identifier": identifier}
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("""INSERT INTO login_challenges(email,code_hash,expires_at,tries,identifier)
                VALUES (%s,%s,%s,0,%s) ON CONFLICT(email) DO UPDATE SET code_hash=EXCLUDED.code_hash,
                expires_at=EXCLUDED.expires_at,tries=0,identifier=EXCLUDED.identifier""",
                (email.lower(), record["code_hash"], record["expires"], identifier))
    else:
        _login_codes[email.lower()] = record

def _get_login_challenge(email: str):
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute("SELECT code_hash, expires_at AS expires, tries, identifier FROM login_challenges WHERE email=%s", (email.lower(),)).fetchone()
            return dict(row) if row else None
    return _login_codes.get(email.lower())

def _delete_login_challenge(email: str):
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("DELETE FROM login_challenges WHERE email=%s", (email.lower(),))
    else:
        _login_codes.pop(email.lower(), None)

@app.post("/api/auth/login", status_code=202)
def login(payload: LoginIn, request: Request):
    _rate_limit("login:" + (request.client.host if request.client else "unknown"), 12)
    user = _find_user(payload.identifier.strip())
    if not user or not _password_hash.verify(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="아이디/이메일 또는 비밀번호를 확인해 주세요.")
    if not user["verified"]:
        raise HTTPException(status_code=403, detail="이메일 인증을 완료해 주세요.")
    code = f"{secrets.randbelow(1_000_000):06d}"
    _send_code(user["email"], code)
    _save_login_challenge(user["email"], payload.identifier.strip(), code)
    return {"message": "로그인 보안 코드를 이메일로 발송했습니다.", "email": user["email"]}

@app.post("/api/auth/login/verify")
def verify_login(payload: LoginVerifyIn, request: Request):
    email = str(payload.email).lower()
    _rate_limit("login-verify:" + (request.client.host if request.client else "unknown"), 15)
    record = _get_login_challenge(email)
    if not record or record["expires"] < time.time():
        _delete_login_challenge(email)
        raise HTTPException(status_code=400, detail="보안 코드가 만료되었거나 요청 내역이 없습니다.")
    if record["tries"] >= 5:
        _delete_login_challenge(email)
        raise HTTPException(status_code=429, detail="보안 코드 입력 횟수를 초과했습니다. 다시 로그인해 주세요.")
    record["tries"] += 1
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("UPDATE login_challenges SET tries=%s WHERE email=%s", (record["tries"], email))
    else:
        _login_codes[email] = record
    if not hmac.compare_digest(record["code_hash"], _hash_code(email, payload.code)):
        raise HTTPException(status_code=400, detail="보안 코드가 올바르지 않습니다.")
    _delete_login_challenge(email)
    user = _find_email(email)
    if not user or not user["verified"]:
        raise HTTPException(status_code=401, detail="계정을 확인할 수 없습니다. 다시 로그인해 주세요.")
    return {"user": _public(user), "access_token": _token(user), "token_type": "bearer"}

@app.get("/api/auth/me")
def me(user: dict = Depends(_current_user)):
    return {"user": _public(user)}

def _post_dict(row: dict, username: str, comments=None):
    created = row["created_at"]
    return {"id": row["id"], "author_username": row["author_username"], "content": row["content"],
            "created_at": created.isoformat() if hasattr(created, "isoformat") else created,
            "like_count": row.get("like_count", 0), "liked_by_me": bool(row.get("liked_by_me", False)),
            "comments": comments or []}

@app.get("/api/posts")
def list_posts(user: dict = Depends(_current_user)):
    if _DATABASE_URL:
        with _db() as conn:
            rows = conn.execute("""SELECT p.id,p.author_username,p.content,p.created_at,
                COUNT(DISTINCT l.username)::int AS like_count,
                COALESCE(BOOL_OR(l.username=%s),FALSE) AS liked_by_me
                FROM posts p LEFT JOIN post_likes l ON l.post_id=p.id
                GROUP BY p.id ORDER BY p.created_at DESC LIMIT 100""", (user["username"],)).fetchall()
            result = []
            for row in rows:
                comments = conn.execute("""SELECT id,author_username,content,created_at FROM post_comments
                    WHERE post_id=%s ORDER BY created_at ASC""", (row["id"],)).fetchall()
                result.append(_post_dict(dict(row), user["username"], [dict(c) for c in comments]))
            return {"posts": result}
    result = []
    for p in sorted(_posts.values(), key=lambda x: x["created_at"], reverse=True):
        row = dict(p)
        row["like_count"] = sum(1 for pid, _ in _post_likes if pid == row["id"])
        row["liked_by_me"] = (row["id"], user["username"]) in _post_likes
        result.append(_post_dict(row, user["username"], _post_comments.get(row["id"], [])))
    return {"posts": result}

@app.post("/api/posts", status_code=201)
def create_post(payload: PostIn, user: dict = Depends(_current_user)):
    global _post_seq
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="게시물 내용을 입력해 주세요.")
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute("""INSERT INTO posts(author_username,content) VALUES (%s,%s)
                RETURNING id,author_username,content,created_at""", (user["username"], content)).fetchone()
            return {"post": _post_dict(dict(row), user["username"], [])}
    with _lock:
        _post_seq += 1
        post = {"id": _post_seq, "author_username": user["username"], "content": content, "created_at": datetime.now(timezone.utc).isoformat(), "like_count": 0, "liked_by_me": False}
        _posts[post["id"]] = post
        _post_comments[post["id"]] = []
    return {"post": _post_dict(post, user["username"], [])}

@app.post("/api/posts/{post_id}/like")
def toggle_like(post_id: int, user: dict = Depends(_current_user)):
    if _DATABASE_URL:
        with _db() as conn:
            if not conn.execute("SELECT id FROM posts WHERE id=%s", (post_id,)).fetchone():
                raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
            liked = conn.execute("SELECT 1 FROM post_likes WHERE post_id=%s AND username=%s", (post_id,user["username"])).fetchone()
            if liked:
                conn.execute("DELETE FROM post_likes WHERE post_id=%s AND username=%s", (post_id,user["username"]))
                return {"liked": False}
            conn.execute("INSERT INTO post_likes(post_id,username) VALUES (%s,%s) ON CONFLICT DO NOTHING", (post_id,user["username"]))
            return {"liked": True}
    if post_id not in _posts: raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
    key = (post_id, user["username"])
    if key in _post_likes:
        _post_likes.remove(key)
        return {"liked": False}
    _post_likes.add(key)
    return {"liked": True}

@app.post("/api/posts/{post_id}/comments", status_code=201)
def create_comment(post_id: int, payload: CommentIn, user: dict = Depends(_current_user)):
    global _comment_seq
    content = payload.content.strip()
    if not content: raise HTTPException(status_code=422, detail="댓글 내용을 입력해 주세요.")
    if _DATABASE_URL:
        with _db() as conn:
            if not conn.execute("SELECT id FROM posts WHERE id=%s", (post_id,)).fetchone():
                raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
            row = conn.execute("""INSERT INTO post_comments(post_id,author_username,content)
                VALUES (%s,%s,%s) RETURNING id,author_username,content,created_at""", (post_id,user["username"],content)).fetchone()
            c = dict(row); c["created_at"] = c["created_at"].isoformat()
            return {"comment": c}
    if post_id not in _posts: raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
    with _lock:
        _comment_seq += 1
        comment = {"id": _comment_seq, "author_username": user["username"], "content": content, "created_at": datetime.now(timezone.utc).isoformat()}
        _post_comments.setdefault(post_id, []).append(comment)
    return {"comment": comment}

@app.delete("/api/posts/{post_id}")
def delete_post(post_id: int, user: dict = Depends(_current_user)):
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute("SELECT author_username FROM posts WHERE id=%s", (post_id,)).fetchone()
            if not row: raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
            if row["author_username"] != user["username"]: raise HTTPException(status_code=403, detail="본인의 게시물만 삭제할 수 있습니다.")
            conn.execute("DELETE FROM posts WHERE id=%s", (post_id,))
    else:
        row = _posts.get(post_id)
        if not row: raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
        if row["author_username"] != user["username"]: raise HTTPException(status_code=403, detail="본인의 게시물만 삭제할 수 있습니다.")
        _posts.pop(post_id, None)
        _post_comments.pop(post_id, None)
        for key in list(_post_likes):
            if key[0] == post_id: _post_likes.remove(key)
    return {"deleted": True}

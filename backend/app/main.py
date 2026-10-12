import os, secrets, hashlib, hmac, time
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from threading import Lock
from email.message import EmailMessage
import smtplib

import jwt
from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash

app = FastAPI(title="FITNOVA API", version="0.1.0")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:4173,capacitor://localhost,http://localhost").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["GET","POST","OPTIONS"], allow_headers=["Authorization","Content-Type"])

_password_hash = PasswordHash.recommended()
_lock = Lock()
_users = {}  # demo/dev adapter only; use PostgreSQL before production
_codes = {}
_attempts = defaultdict(list)
_SECRET = os.getenv("JWT_SECRET")
if not _SECRET:
    # A process-local secret is intentionally unsuitable for multi-worker/production use.
    _SECRET = secrets.token_urlsafe(48)
    print("WARNING: JWT_SECRET is unset; sessions will be invalidated on restart. Configure a stable secret in deployment.")
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

def _hash_code(email: str, code: str) -> str:
    return hmac.new(_CODE_SECRET.encode(), f"{email.lower()}:{code}".encode(), hashlib.sha256).hexdigest()

def _send_code(email: str, code: str):
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
    msg.set_content(f"FITNOVA 가입 인증 코드: {code}\n이 코드는 10분 후 만료됩니다. 본인이 요청하지 않았다면 이 메일을 무시하세요.")
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
        user = _users.get(data["sub"])
        if not user: raise ValueError()
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="세션이 만료되었거나 유효하지 않습니다.")

@app.get("/health")
def health():
    return {"status": "ok", "service": "fitnova-api"}

@app.post("/api/auth/register", status_code=202)
def register(payload: RegisterIn, request: Request):
    email = str(payload.email).lower()
    _rate_limit("register:" + (request.client.host if request.client else "unknown"), 5)
    with _lock:
        if payload.username.lower() in _users or any(u["email"] == email for u in _users.values()):
            raise HTTPException(status_code=409, detail="이미 사용 중인 아이디 또는 이메일입니다.")
    code = f"{secrets.randbelow(1_000_000):06d}"
    _send_code(email, code)
    with _lock:
        _codes[email] = {"username": payload.username, "password_hash": _password_hash.hash(payload.password), "code_hash": _hash_code(email, code), "expires": time.time()+600, "tries": 0}
    return {"message": "인증 코드를 이메일로 발송했습니다. 10분 안에 인증해 주세요.", "email": email}

@app.post("/api/auth/verify")
def verify(payload: VerifyIn, request: Request):
    email = str(payload.email).lower()
    _rate_limit("verify:" + (request.client.host if request.client else "unknown"), 15)
    with _lock:
        record = _codes.get(email)
        if not record or record["expires"] < time.time():
            _codes.pop(email, None)
            raise HTTPException(status_code=400, detail="인증 코드가 만료되었거나 요청 내역이 없습니다.")
        record["tries"] += 1
        if record["tries"] > 5:
            _codes.pop(email, None)
            raise HTTPException(status_code=429, detail="인증 시도 횟수를 초과했습니다. 다시 가입해 주세요.")
        if not hmac.compare_digest(record["code_hash"], _hash_code(email, payload.code)):
            raise HTTPException(status_code=400, detail="인증 코드가 올바르지 않습니다.")
        username = record["username"]
        if username.lower() in _users or any(u["email"] == email for u in _users.values()):
            _codes.pop(email, None)
            raise HTTPException(status_code=409, detail="이미 사용 중인 아이디 또는 이메일입니다.")
        user = {"username": username, "email": email, "password_hash": record["password_hash"], "verified": True}
        _users[username] = user
        _codes.pop(email, None)
    return {"message": "이메일 인증과 회원가입이 완료되었습니다.", "user": _public(user), "access_token": _token(user), "token_type": "bearer"}

@app.post("/api/auth/login")
def login(payload: LoginIn, request: Request):
    _rate_limit("login:" + (request.client.host if request.client else "unknown"), 12)
    identifier = payload.identifier.strip().lower()
    with _lock:
        user = next((u for u in _users.values() if u["username"].lower() == identifier or u["email"] == identifier), None)
    if not user or not _password_hash.verify(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="아이디/이메일 또는 비밀번호를 확인해 주세요.")
    if not user["verified"]:
        raise HTTPException(status_code=403, detail="이메일 인증을 완료해 주세요.")
    return {"user": _public(user), "access_token": _token(user), "token_type": "bearer"}

@app.get("/api/auth/me")
def me(user: dict = Depends(_current_user)):
    return {"user": _public(user)}

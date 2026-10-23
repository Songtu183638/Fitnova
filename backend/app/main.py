import os, secrets, hashlib, hmac, time, json, re, base64, mimetypes, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone
from collections import defaultdict, OrderedDict
from threading import Lock, Thread
from email.message import EmailMessage
import smtplib

import jwt
import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, HTTPException, Depends, Header, Request, Query, File, Form, UploadFile, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash

app = FastAPI(title="FITNOVA API", version="0.2.0")
origins = list(dict.fromkeys([x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:4173,capacitor://localhost,https://localhost,http://localhost").split(",") if x.strip()] + ["https://localhost", "capacitor://localhost"]))
app.add_middleware(CORSMiddleware, allow_origins=origins + ["https://fitnova-songtu183638.vercel.app", "https://fitnova-iota.vercel.app"], allow_origin_regex=r"https://fitnova(?:-[a-z0-9-]+)*\.vercel\.app", allow_credentials=True, allow_methods=["GET","POST","PATCH","PUT","DELETE","OPTIONS"], allow_headers=["Authorization","Content-Type"])

_password_hash = PasswordHash.recommended()
_lock = Lock()
_users = {}  # in-memory adapter used only for local tests/development without DATABASE_URL
_codes = {}
_login_codes = {}
_password_reset_codes = {}
_posts = {}
_post_comments = {}
_post_likes = set()
_follows = set()
_messages = []
_saved_posts = set()
_workout_records = defaultdict(list)
_workout_record_seq = 0
_notifications = []
_blocks = set()
_suspended_users = set()
_mutes = set()
_reports = []
_report_alerted_users = set()
_report_alert_lock = Lock()
_notification_seq = 0
_report_seq = 0
_user_settings = {}
_account_codes = {}
_message_seq = 0
_post_seq = 0
_comment_seq = 0
_video_cache = OrderedDict()  # decoded media bytes for recent video Range requests
_video_cache_lock = Lock()
_VIDEO_CACHE_MAX_ITEMS = 2
_attempts = defaultdict(list)
_DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
_SECRET = os.getenv("JWT_SECRET")
if not _SECRET:
    if os.getenv("APP_ENV") == "production":
        raise RuntimeError("JWT_SECRET must be configured in production.")
    _SECRET = secrets.token_urlsafe(48)
    print("WARNING: JWT_SECRET is unset; sessions will be invalidated on restart.")
_CODE_SECRET = os.getenv("VERIFICATION_CODE_SECRET", _SECRET)

_MODERATION_TERMS = (
    "씨발", "시발", "ㅅㅂ", "씨바", "병신", "븅신", "개새끼", "씹새끼",
    "좆같", "좆", "지랄", "염병", "애미뒤", "애비뒤", "개자식", "개같",
    "섹스", "야동", "야사", "딸딸이", "딸치", "후장", "강간", "성폭행",
    "성관계", "꼴려", "유두", "젖꼭지", "오럴섹스", "보짓물", "자지빨", "보지빨",
)

def _moderation_normalize(value: str) -> str:
    import unicodedata
    value = unicodedata.normalize("NFKC", str(value or "")).casefold()
    value = re.sub(r"[\u200b-\u200f\uFEFF]", "", value)
    return re.sub(r"[^0-9a-z가-힣]", "", value)

def _validate_community_text(*values: str) -> None:
    normalized = _moderation_normalize(" ".join(str(value or "") for value in values))
    if any(term in normalized for term in _MODERATION_TERMS):
        raise HTTPException(status_code=422, detail="욕설이나 성적으로 부적절한 표현은 사용할 수 없습니다. 내용을 수정해 주세요.")

class RegisterIn(BaseModel):
    name: str | None = Field(default=None, max_length=40)
    username: str = Field(min_length=3, max_length=24, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    age_confirmed: bool = False

class VerifyIn(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")

class LoginIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)

class LoginVerifyIn(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")

class PasswordResetRequestIn(BaseModel):
    email: EmailStr

class PasswordResetConfirmIn(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")
    new_password: str = Field(min_length=10, max_length=128)

class PostIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=2000)
    media_type: str = Field(pattern=r"^(image|video)$")
    media_data: str = Field(min_length=20, max_length=56_000_000)
    media_duration_seconds: int | None = Field(default=None, ge=1, le=60)
    hashtags: list[str] = Field(default_factory=list, max_length=20)
    weight: float | None = Field(default=None, ge=1, le=500)
    sets_count: int | None = Field(default=None, ge=0, le=500)
    exercise_name: str = Field(default="", max_length=100)
    reps: str = Field(default="", max_length=100)
    duration_minutes: int | None = Field(default=None, ge=0, le=1440)
    workout_notes: str = Field(default="", max_length=1000)

class WorkoutExerciseIn(BaseModel):
    category: str = Field(min_length=1, max_length=30)
    exercise_name: str = Field(min_length=1, max_length=100)
    weight_kg: float = Field(default=0, ge=0, le=1000)
    sets: int = Field(ge=1, le=100)
    reps: int = Field(ge=1, le=1000)

class WorkoutRecordIn(BaseModel):
    exercises: list[WorkoutExerciseIn] = Field(min_length=1, max_length=30)
    note: str = Field(default="", max_length=500)

class CommentIn(BaseModel):
    content: str = Field(min_length=1, max_length=500)

class PostEditIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=2000)
    hashtags: list[str] = Field(default_factory=list, max_length=20)

class MessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

class PushDeviceIn(BaseModel):
    token: str = Field(min_length=20, max_length=4096)
    platform: str = Field(default="android", pattern=r"^android$")

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
                name TEXT NOT NULL DEFAULT '',
                username TEXT NOT NULL,
                username_key TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                verified BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT FALSE")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0")
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
            CREATE TABLE IF NOT EXISTS password_reset_challenges (
                email TEXT PRIMARY KEY, code_hash TEXT NOT NULL,
                expires_at DOUBLE PRECISION NOT NULL, tries INTEGER NOT NULL DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS posts (
                id BIGSERIAL PRIMARY KEY,
                author_username TEXT NOT NULL,
                content TEXT NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                media_type TEXT NOT NULL DEFAULT 'text',
                media_data TEXT NOT NULL DEFAULT '',
                media_duration_seconds INTEGER,
                hashtags TEXT[] NOT NULL DEFAULT '{}',
                weight DOUBLE PRECISION,
                sets_count INTEGER,
                exercise_name TEXT NOT NULL DEFAULT '',
                reps TEXT NOT NULL DEFAULT '',
                duration_minutes INTEGER,
                workout_notes TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''")
        conn.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'text'")
        conn.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_data TEXT NOT NULL DEFAULT ''")
        conn.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_duration_seconds INTEGER")
        conn.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtags TEXT[] NOT NULL DEFAULT '{}'")
        conn.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS weight DOUBLE PRECISION")
        conn.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS sets_count INTEGER")
        conn.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS exercise_name TEXT NOT NULL DEFAULT ''")
        conn.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS reps TEXT NOT NULL DEFAULT ''")
        conn.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS duration_minutes INTEGER")
        conn.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS workout_notes TEXT NOT NULL DEFAULT ''")
        conn.execute("ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE")
        conn.execute("CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS workout_analysis_sessions (
                id BIGSERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
                total_volume_kg DOUBLE PRECISION NOT NULL DEFAULT 0,
                total_sets INTEGER NOT NULL DEFAULT 0,
                total_reps INTEGER NOT NULL DEFAULT 0,
                note TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS workout_analysis_sessions_user_created_idx ON workout_analysis_sessions(username, created_at DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS posts_author_created_idx ON posts(author_username, created_at DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS posts_hashtags_gin_idx ON posts USING GIN (hashtags)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS post_likes (
                post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                username TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY(post_id, username)
            )
        """)
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''")
        conn.execute("UPDATE users SET name=username WHERE name='' OR name IS NULL")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_settings (
                username TEXT PRIMARY KEY, private_account BOOLEAN NOT NULL DEFAULT FALSE,
                allow_messages_from TEXT NOT NULL DEFAULT 'everyone',
                show_activity BOOLEAN NOT NULL DEFAULT TRUE, show_workout_details BOOLEAN NOT NULL DEFAULT TRUE,
                notify_messages BOOLEAN NOT NULL DEFAULT TRUE, notify_comments BOOLEAN NOT NULL DEFAULT TRUE,
                notify_likes BOOLEAN NOT NULL DEFAULT TRUE, notify_follows BOOLEAN NOT NULL DEFAULT TRUE,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_messages BOOLEAN NOT NULL DEFAULT TRUE")
        conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_comments BOOLEAN NOT NULL DEFAULT TRUE")
        conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_likes BOOLEAN NOT NULL DEFAULT TRUE")
        conn.execute("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notify_follows BOOLEAN NOT NULL DEFAULT TRUE")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS saved_posts (
                username TEXT NOT NULL, post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(username, post_id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS account_security_codes (
                username TEXT NOT NULL, purpose TEXT NOT NULL, target_email TEXT NOT NULL,
                code_hash TEXT NOT NULL, expires_at DOUBLE PRECISION NOT NULL, tries INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(username, purpose)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_follows (
                follower_username TEXT NOT NULL,
                followed_username TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY(follower_username, followed_username),
                CHECK(follower_username <> followed_username)
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS user_follows_followed_idx ON user_follows(followed_username, created_at DESC)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_blocks (
                blocker_username TEXT NOT NULL, blocked_username TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY(blocker_username, blocked_username),
                CHECK(blocker_username <> blocked_username)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_mutes (
                muter_username TEXT NOT NULL, muted_username TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY(muter_username, muted_username),
                CHECK(muter_username <> muted_username)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS content_reports (
                id BIGSERIAL PRIMARY KEY, reporter_username TEXT NOT NULL,
                target_type TEXT NOT NULL, target_id TEXT NOT NULL,
                reason TEXT NOT NULL, details TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS content_reports_status_idx ON content_reports(status, created_at DESC)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS account_report_alerts (
                target_username TEXT PRIMARY KEY,
                report_count INTEGER NOT NULL DEFAULT 5,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id BIGSERIAL PRIMARY KEY, recipient_username TEXT NOT NULL,
                actor_username TEXT NOT NULL, kind TEXT NOT NULL, message TEXT NOT NULL,
                post_id BIGINT, read BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications(recipient_username, created_at DESC)")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS direct_messages (
                id BIGSERIAL PRIMARY KEY,
                sender_username TEXT NOT NULL,
                recipient_username TEXT NOT NULL,
                content TEXT NOT NULL,
                read_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ")
        conn.execute("CREATE INDEX IF NOT EXISTS direct_messages_pair_idx ON direct_messages(sender_username, recipient_username, created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS direct_messages_recipient_idx ON direct_messages(recipient_username, created_at DESC)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS push_devices (
                token TEXT PRIMARY KEY, username TEXT NOT NULL,
                platform TEXT NOT NULL DEFAULT 'android', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS push_devices_username_idx ON push_devices(username)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS post_comments (
                id BIGSERIAL PRIMARY KEY,
                post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                author_username TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE")
        conn.execute("CREATE INDEX IF NOT EXISTS post_comments_post_created_idx ON post_comments(post_id, pinned DESC, created_at)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS pending_registrations (
                email TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                username TEXT NOT NULL,
                username_key TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                code_hash TEXT NOT NULL,
                expires_at DOUBLE PRECISION NOT NULL,
                tries INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''")

def _deletion_purge_worker():
    while True:
        time.sleep(3600)
        try:
            _purge_expired_accounts()
        except Exception as exc:
            print(f"Account deletion cleanup failed: {type(exc).__name__}")

@app.on_event("startup")
def startup():
    _init_db()
    Thread(target=_deletion_purge_worker, daemon=True, name="fitnova-account-purge").start()

def _hash_code(email: str, code: str) -> str:
    return hmac.new(_CODE_SECRET.encode(), f"{email.lower()}:{code}".encode(), hashlib.sha256).hexdigest()

def _verification_email_html(code: str, purpose: str = "계정 보안") -> str:
    """Responsive, branded HTML email for verification and account-security codes."""
    safe_purpose = (purpose or "계정 보안").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    safe_code = "".join(ch for ch in str(code) if ch.isdigit())[:6]
    return f'''<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>FITNOVA 인증 코드</title>
</head>
<body style="margin:0;padding:0;background-color:#080b09;font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#f2f5ee">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">FITNOVA {safe_purpose} 인증 코드입니다. 10분 안에 입력해 주세요.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#080b09">
    <tr><td align="center" style="padding:30px 12px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:540px;background-color:#111611;border:1px solid #2a3428;border-radius:22px;overflow:hidden">
        <tr><td style="padding:25px 27px 23px;border-bottom:1px solid #293326;background-color:#141a13">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td valign="middle" style="width:42px;height:42px;background-color:#b7ff36;border-radius:13px;text-align:center;color:#10160a;font-size:22px;font-weight:900">F</td>
            <td valign="middle" style="padding-left:12px;color:#f4f7f1;font-size:20px;font-weight:900;letter-spacing:-.7px">FIT<span style="color:#b7ff36">NOVA</span><div style="margin-top:4px;color:#899584;font-size:11px;font-weight:400;letter-spacing:0">운동을 기록하고 함께 성장해요</div></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:30px 27px 28px">
          <div style="display:inline-block;padding:7px 10px;border:1px solid #34432b;border-radius:999px;background-color:#1a2415;color:#b7ff36;font-size:11px;font-weight:700">계정 보안 확인</div>
          <h1 style="margin:17px 0 10px;font-size:25px;line-height:1.4;letter-spacing:-.7px;color:#f5f7f1">{safe_purpose} 인증 코드</h1>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.8;color:#b8c2b2">FITNOVA에서 요청한 절차를 완료하려면 아래 인증 코드를 입력해 주세요.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%">
            <tr><td align="center" style="padding:24px 12px 22px;background-color:#090d09;border:1px solid #3a4b30;border-radius:16px">
              <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#9aa890">인증 코드</div>
              <div style="margin-top:12px;font-family:Arial,sans-serif;font-size:36px;line-height:1.25;font-weight:800;letter-spacing:9px;color:#b7ff36">{safe_code}</div>
              <div style="margin-top:13px;font-size:11px;color:#8c9884">숫자 6자리 · 10분 동안 유효</div>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;width:100%">
            <tr><td valign="top" style="width:25px;padding-top:2px;color:#b7ff36;font-size:16px">●</td><td style="font-size:12px;line-height:1.8;color:#aab5a3">인증 코드는 발송 후 <strong style="color:#f0f4eb">10분 동안</strong> 사용할 수 있습니다.</td></tr>
            <tr><td valign="top" style="width:25px;padding-top:8px;color:#b7ff36;font-size:16px">●</td><td style="padding-top:6px;font-size:12px;line-height:1.8;color:#aab5a3">본인이 요청하지 않았다면 코드를 입력하거나 다른 사람에게 전달하지 말고 이 메일을 무시해 주세요.</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:17px 27px;background-color:#0b0f0b;border-top:1px solid #293326">
          <div style="font-size:11px;line-height:1.7;color:#879281">이 메일은 FITNOVA 계정 보안을 위해 자동으로 발송되었습니다.</div>
          <div style="margin-top:7px;font-size:10px;color:#626e5d">© 2026 FITNOVA</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>'''


def _verification_email_text(code: str, purpose: str = "계정 보안") -> str:
    return (
        f"FITNOVA | {purpose} 인증\n\n"
        f"인증 코드: {code}\n\n"
        "이 코드는 발송 후 10분 동안 유효합니다.\n"
        "보안을 위해 다른 사람과 공유하지 마세요.\n"
        "본인이 요청하지 않았다면 이 메일을 무시해도 됩니다."
    )


def _send_code(email: str, code: str, purpose: str = "계정 보안"):
    subject = f"FITNOVA | {purpose} 인증 코드"
    html_body = _verification_email_html(code, purpose)
    text_body = _verification_email_text(code, purpose)
    # Fast path: Resend HTTPS API. No SMTP handshake or Apps Script relay is needed.
    # Configure RESEND_API_KEY and a verified RESEND_FROM sender in the hosting environment.
    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
    resend_from = os.getenv("RESEND_FROM", "").strip()
    if resend_api_key:
        if not resend_from:
            raise HTTPException(status_code=503, detail="RESEND_FROM 이메일 발신 주소 설정이 필요합니다.")
        payload = json.dumps({
            "from": resend_from,
            "to": [email],
            "subject": subject,
            "html": html_body,
            "text": text_body,
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                result = json.loads(response.read().decode("utf-8"))
            if not result.get("id"):
                raise RuntimeError("Resend returned no email ID")
            return
        except urllib.error.HTTPError as exc:
            # Do not silently fall back after a provider error: a timeout/retry
            # can otherwise send the same verification code twice.
            try:
                detail = exc.read().decode("utf-8", errors="replace")[:300]
            except Exception:
                detail = ""
            print(f"Resend email API failed ({exc.code}): {detail}")
            raise HTTPException(status_code=503, detail="인증 이메일 발송에 실패했습니다. 이메일 발신 주소와 Resend 설정을 확인해 주세요.")
        except Exception as exc:
            print(f"Resend email API request failed: {type(exc).__name__}")
            raise HTTPException(status_code=503, detail="인증 이메일 발송 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.")

    # Compatibility fallback: Google Apps Script receives both MIME variants.
    # Resend is used automatically when RESEND_API_KEY is configured.
    script_url = os.getenv("GOOGLE_APPS_SCRIPT_URL", "").strip()
    script_secret = os.getenv("GOOGLE_APPS_SCRIPT_SECRET", "").strip()
    if script_url:
        if not script_secret:
            raise HTTPException(status_code=503, detail="Google 이메일 발송 보안 설정이 완료되지 않았습니다.")
        payload = json.dumps({
            "to": email, "code": code, "secret": script_secret,
            "subject": subject, "body": text_body, "htmlBody": html_body
        }).encode("utf-8")
        req = urllib.request.Request(script_url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                result = json.loads(response.read().decode("utf-8"))
            if not result.get("ok"):
                raise RuntimeError("Google Apps Script rejected the request")
            return
        except Exception:
            raise HTTPException(status_code=503, detail="Google 이메일 발송에 실패했습니다. Apps Script 배포와 설정을 확인해 주세요.")

    # Optional SMTP fallback sends a plain-text alternative for clients that
    # cannot display HTML, plus the branded HTML version for modern clients.
    host = os.getenv("SMTP_HOST")
    if not host:
        raise HTTPException(status_code=503, detail="이메일 발송 설정이 없습니다. SMTP_HOST 또는 GOOGLE_APPS_SCRIPT_URL을 설정해 주세요.")
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = os.getenv("SMTP_FROM", os.getenv("SMTP_USER", ""))
    msg["To"] = email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")
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
                "SELECT name, username, email, password_hash, verified, suspended, token_version FROM users WHERE username_key=%s OR lower(email)=%s LIMIT 1",
                (key, key)
            ).fetchone()
    return next((u for u in _users.values() if u["username"].lower() == key or u["email"].lower() == key), None)

def _find_email(email: str):
    if _DATABASE_URL:
        with _db() as conn:
            return conn.execute("SELECT username, email, password_hash, verified, suspended, token_version FROM users WHERE lower(email)=%s LIMIT 1", (email.lower(),)).fetchone()
    return next((u for u in _users.values() if u["email"].lower() == email.lower()), None)

def _find_username(username: str):
    if _DATABASE_URL:
        with _db() as conn:
            return conn.execute("SELECT name,username,email,password_hash,verified,deletion_requested_at,suspended,token_version FROM users WHERE username_key=%s AND deletion_requested_at IS NULL LIMIT 1", (username.lower(),)).fetchone()
    return next((u for u in _users.values() if u["username"].lower() == username.lower() and not u.get("deletion_requested_at")), None)

def _get_pending(email: str):
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute("SELECT name, username, password_hash, code_hash, expires_at AS expires, tries FROM pending_registrations WHERE email=%s", (email.lower(),)).fetchone()
            return dict(row) if row else None
    return _codes.get(email.lower())

def _save_pending(email: str, record: dict):
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("""
                INSERT INTO pending_registrations(email, name, username, username_key, password_hash, code_hash, expires_at, tries)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name, username=EXCLUDED.username, username_key=EXCLUDED.username_key,
                    password_hash=EXCLUDED.password_hash, code_hash=EXCLUDED.code_hash, expires_at=EXCLUDED.expires_at, tries=0
            """, (email.lower(), record.get("name", record["username"]), record["username"], record["username"].lower(), record["password_hash"], record["code_hash"], record["expires"], 0))
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
                INSERT INTO users(name, username, username_key, email, password_hash, verified)
                VALUES (%s,%s,%s,%s,%s,%s)
            """, (user.get("name", user["username"]), user["username"], user["username"].lower(), user["email"].lower(), user["password_hash"], True))
    else:
        _users[user["username"]] = user

def _token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user["username"], "ver": int(user.get("token_version", 0)), "iat": now, "exp": now + timedelta(days=365)}, _SECRET, algorithm="HS256")

def _public(user: dict) -> dict:
    return {"name": user.get("name") or user["username"], "username": user["username"], "email": user["email"], "verified": user["verified"], "is_master": _is_master(user)}

def _is_master(user: dict) -> bool:
    return bool(user.get("verified") and str(user.get("email") or "").strip().casefold() == "fitnova@naver.com")

def _current_user(authorization: str | None = Header(default=None)) -> dict:
    _purge_expired_accounts()
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    try:
        data = jwt.decode(authorization[7:], _SECRET, algorithms=["HS256"])
        user = _find_username(data["sub"])
        if not user:
            raise ValueError()
        if int(data.get("ver", 0)) != int(user.get("token_version", 0)):
            raise ValueError()
        if user.get("suspended") or user.get("username", "").lower() in _suspended_users:
            raise HTTPException(status_code=403, detail="계정 이용이 정지되었습니다.")
        return dict(user)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="세션이 만료되었거나 유효하지 않습니다.")

@app.get("/health")
def health():
    db_status = "configured" if _DATABASE_URL else "development-memory"
    return {"status": "ok", "service": "fitnova-api", "database": db_status}

@app.post("/api/auth/register", status_code=202)
def register(payload: RegisterIn, request: Request):
    if not payload.age_confirmed:
        raise HTTPException(status_code=422, detail="FITNOVA 가입은 만 14세 이상이며 연령 확인이 필요합니다.")
    email = str(payload.email).lower()
    _rate_limit("register:" + (request.client.host if request.client else "unknown"), 5)
    display_name = payload.name.strip() if payload.name is not None else payload.username
    if not display_name:
        raise HTTPException(status_code=422, detail="이름을 입력해 주세요.")
    if len(display_name) > 40:
        raise HTTPException(status_code=422, detail="이름은 40자 이하로 입력해 주세요.")
    if _find_username(payload.username) or _find_email(email):
        raise HTTPException(status_code=409, detail="이미 사용 중인 아이디 또는 이메일입니다.")
    code = f"{secrets.randbelow(1_000_000):06d}"
    _send_code(email, code)
    _save_pending(email, {"name": display_name, "username": payload.username, "password_hash": _password_hash.hash(payload.password), "code_hash": _hash_code(email, code), "expires": time.time()+600, "tries": 0})
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
    user = {"name": record.get("name") or username, "username": username, "email": email, "password_hash": record["password_hash"], "verified": True}
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
    if user.get("suspended") or user["username"].lower() in _suspended_users:
        raise HTTPException(status_code=403, detail="계정 이용이 정지되었습니다.")
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
    if user.get("suspended") or user["username"].lower() in _suspended_users:
        raise HTTPException(status_code=403, detail="계정 이용이 정지되었습니다.")
    return {"user": _public(user), "access_token": _token(user), "token_type": "bearer"}

def _save_password_reset(email: str, code: str):
    record = {"code_hash": _hash_code("password-reset:" + email, code), "expires_at": time.time() + 600, "tries": 0}
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("""INSERT INTO password_reset_challenges(email,code_hash,expires_at,tries)
                VALUES (%s,%s,%s,0) ON CONFLICT(email) DO UPDATE SET code_hash=EXCLUDED.code_hash,
                expires_at=EXCLUDED.expires_at,tries=0""", (email, record["code_hash"], record["expires_at"]))
    else:
        _password_reset_codes[email] = record

@app.post("/api/auth/password/reset/request", status_code=202)
def request_password_reset(payload: PasswordResetRequestIn, request: Request):
    email = str(payload.email).strip().lower()
    host = request.client.host if request.client else "unknown"
    _rate_limit("password-reset-email:" + email, 3, 3600)
    _rate_limit("password-reset-ip:" + host, 10, 3600)
    account = _find_email(email)
    if account and account["verified"]:
        code = f"{secrets.randbelow(1_000_000):06d}"
        try:
            _send_code(email, code, "비밀번호 재설정")
            _save_password_reset(email, code)
        except Exception as exc:
            # Keep the response indistinguishable for known and unknown email addresses.
            print(f"Password reset delivery failed: {type(exc).__name__}")
    return {"message": "계정이 있다면 비밀번호 재설정 코드를 이메일로 발송했습니다."}

@app.post("/api/auth/password/reset/confirm")
def confirm_password_reset(payload: PasswordResetConfirmIn, request: Request):
    email = str(payload.email).strip().lower()
    host = request.client.host if request.client else "unknown"
    _rate_limit("password-reset-confirm:" + host, 20, 3600)
    digest = _hash_code("password-reset:" + email, payload.code)
    if _DATABASE_URL:
        failure = None
        with _db() as conn:
            record = conn.execute("SELECT code_hash,expires_at,tries FROM password_reset_challenges WHERE email=%s FOR UPDATE", (email,)).fetchone()
            if not record or record["expires_at"] < time.time():
                conn.execute("DELETE FROM password_reset_challenges WHERE email=%s", (email,))
                failure = (400, "재설정 코드가 만료되었거나 올바르지 않습니다.")
            elif record["tries"] >= 5:
                conn.execute("DELETE FROM password_reset_challenges WHERE email=%s", (email,))
                failure = (429, "코드 입력 횟수를 초과했습니다. 다시 요청해 주세요.")
            else:
                conn.execute("UPDATE password_reset_challenges SET tries=tries+1 WHERE email=%s", (email,))
                if not hmac.compare_digest(record["code_hash"], digest):
                    failure = (400, "재설정 코드가 만료되었거나 올바르지 않습니다.")
                else:
                    updated = conn.execute("UPDATE users SET password_hash=%s,token_version=token_version+1 WHERE lower(email)=%s AND verified=TRUE RETURNING username",
                        (_password_hash.hash(payload.new_password), email)).fetchone()
                    conn.execute("DELETE FROM password_reset_challenges WHERE email=%s", (email,))
                    if not updated:
                        failure = (400, "계정을 확인할 수 없습니다. 다시 요청해 주세요.")
        if failure:
            raise HTTPException(status_code=failure[0], detail=failure[1])
    else:
        record = _password_reset_codes.get(email)
        if not record or record["expires_at"] < time.time():
            _password_reset_codes.pop(email, None)
            raise HTTPException(status_code=400, detail="재설정 코드가 만료되었거나 올바르지 않습니다.")
        if record["tries"] >= 5:
            _password_reset_codes.pop(email, None)
            raise HTTPException(status_code=429, detail="코드 입력 횟수를 초과했습니다. 다시 요청해 주세요.")
        record["tries"] += 1
        if not hmac.compare_digest(record["code_hash"], digest):
            raise HTTPException(status_code=400, detail="재설정 코드가 만료되었거나 올바르지 않습니다.")
        account = _find_email(email)
        if not account or not account["verified"]:
            _password_reset_codes.pop(email, None)
            raise HTTPException(status_code=400, detail="계정을 확인할 수 없습니다. 다시 요청해 주세요.")
        stored_user = _users[account["username"]]
        stored_user["password_hash"] = _password_hash.hash(payload.new_password)
        stored_user["token_version"] = int(stored_user.get("token_version", 0)) + 1
        _password_reset_codes.pop(email, None)
    return {"changed": True, "message": "비밀번호를 변경했습니다. 보안을 위해 모든 기기에서 로그아웃되었습니다."}

@app.get("/api/auth/me")
def me(user: dict = Depends(_current_user)):
    return {"user": _public(user)}

def _post_dict(row: dict, username: str, comments=None):
    created = row["created_at"]
    hashtags = row.get("hashtags") or []
    if isinstance(hashtags, str): hashtags = [x for x in hashtags.split(",") if x]
    return {"id": row["id"], "author_username": row["author_username"], "title": row.get("title", ""),
            "content": row["content"], "media_type": row.get("media_type", "text"), "media_data": row.get("media_data", ""), "media_duration_seconds": row.get("media_duration_seconds"),
            "hashtags": hashtags, "weight": row.get("weight"), "sets_count": row.get("sets_count"),
            "exercise_name": row.get("exercise_name", ""), "reps": row.get("reps", ""),
            "duration_minutes": row.get("duration_minutes"), "workout_notes": row.get("workout_notes", ""),
            "created_at": created.isoformat() if hasattr(created, "isoformat") else created,
            "like_count": row.get("like_count", 0), "liked_by_me": bool(row.get("liked_by_me", False)), "comments": comments or [], "pinned": bool(row.get("pinned", False))}

def _can_view_author_content(viewer: str, author: str, conn=None) -> bool:
    if viewer.lower() == author.lower():
        return True
    if _DATABASE_URL:
        if conn is None:
            with _db() as db:
                return _can_view_author_content(viewer, author, db)
        blocked = conn.execute("SELECT 1 FROM user_blocks WHERE (blocker_username=%s AND blocked_username=%s) OR (blocker_username=%s AND blocked_username=%s) LIMIT 1",
            (viewer, author, author, viewer)).fetchone()
        muted = conn.execute("SELECT 1 FROM user_mutes WHERE muter_username=%s AND muted_username=%s LIMIT 1", (viewer, author)).fetchone()
        settings = conn.execute("SELECT private_account FROM user_settings WHERE username=%s", (author,)).fetchone()
        followed = conn.execute("SELECT 1 FROM user_follows WHERE follower_username=%s AND followed_username=%s LIMIT 1", (viewer, author)).fetchone()
        return not blocked and not muted and (not settings or not settings["private_account"] or bool(followed))
    blocked = (viewer, author) in _blocks or (author, viewer) in _blocks
    muted = (viewer, author) in _mutes
    private = _get_user_settings(author)["private_account"]
    followed = (viewer, author) in _follows
    return not blocked and not muted and (not private or followed)

@app.get("/api/posts")
def list_posts(hashtag: str | None = Query(default=None, max_length=50), limit: int = Query(default=15, ge=1, le=30), offset: int = Query(default=0, ge=0, le=10000), user: dict = Depends(_current_user)):
    normalized_tag = (hashtag or "").strip().lstrip("#").strip().lower()
    if _DATABASE_URL:
        with _db() as conn:
            rows = conn.execute("""SELECT p.*,
                (SELECT COUNT(*)::int FROM post_likes l WHERE l.post_id=p.id) AS like_count,
                EXISTS (SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.username=%s) AS liked_by_me
                FROM posts p
                WHERE (%s = '' OR p.hashtags @> ARRAY[%s]::text[]
                    OR EXISTS (SELECT 1 FROM unnest(p.hashtags) AS tag WHERE lower(ltrim(tag, '#'))=%s)
                    OR strpos(lower(COALESCE(p.content,'')), '#' || %s) > 0
                    OR strpos(lower(COALESCE(p.title,'')), '#' || %s) > 0)
                  AND (p.author_username=%s OR NOT COALESCE((SELECT private_account FROM user_settings WHERE username=p.author_username),FALSE)
                       OR EXISTS (SELECT 1 FROM user_follows WHERE follower_username=%s AND followed_username=p.author_username))
                  AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
                      (b.blocker_username=%s AND b.blocked_username=p.author_username) OR
                      (b.blocker_username=p.author_username AND b.blocked_username=%s))
                  AND NOT EXISTS (SELECT 1 FROM user_mutes m WHERE m.muter_username=%s AND m.muted_username=p.author_username)
                ORDER BY p.pinned DESC, p.created_at DESC LIMIT %s OFFSET %s""",
                (user["username"], normalized_tag, normalized_tag, normalized_tag, normalized_tag, normalized_tag,
                 user["username"], user["username"], user["username"], user["username"], user["username"], limit, offset)).fetchall()
            if not rows:
                return {"posts": []}
            post_ids = [row["id"] for row in rows]
            comment_rows = conn.execute("""SELECT id,post_id,author_username,content,created_at
                FROM post_comments WHERE post_id = ANY(%s) ORDER BY created_at ASC""", (post_ids,)).fetchall()
            comments_by_post = {}
            for comment in comment_rows:
                comments_by_post.setdefault(comment["post_id"], []).append({
                    "id": comment["id"], "author_username": comment["author_username"],
                    "content": comment["content"], "created_at": comment["created_at"]
                })
            result = []
            for row in rows:
                item = dict(row)
                item.pop("media_data", None)
                post_data = _post_dict(item, user["username"], comments_by_post.get(row["id"], []))
                post_data.pop("media_data", None)
                result.append(post_data)
            return {"posts": result}
    # Filter before paginating so matches older than the first page remain searchable.
    result = []
    visible_posts = []
    for p in sorted(_posts.values(), key=lambda p: (bool(p.get("pinned")), p["created_at"]), reverse=True):
        if p["author_username"] != user["username"] and ((user["username"],p["author_username"]) in _blocks or (p["author_username"],user["username"]) in _blocks or (user["username"],p["author_username"]) in _mutes):
            continue
        if p["author_username"] != user["username"] and _get_user_settings(p["author_username"])["private_account"] and (user["username"],p["author_username"]) not in _follows:
            continue
        tags = [str(tag).lstrip("#").strip().lower() for tag in p.get("hashtags", [])]
        visible_text = (str(p.get("content") or "") + " " + str(p.get("title") or "")).lower()
        if normalized_tag and normalized_tag not in tags and ("#" + normalized_tag) not in visible_text:
            continue
        visible_posts.append(p)
    visible_posts.sort(key=lambda p: (bool(p.get("pinned")), p["created_at"]), reverse=True)
    for p in visible_posts[offset:offset + limit]:
        row = dict(p)
        row.pop("media_data", None)
        row["like_count"] = sum(1 for pid, _ in _post_likes if pid == row["id"])
        row["liked_by_me"] = (row["id"], user["username"]) in _post_likes
        post_data = _post_dict(row, user["username"], _post_comments.get(row["id"], []))
        post_data.pop("media_data", None)
        result.append(post_data)
    return {"posts": result}

def _collect_post_hashtags(content: str, title: str, supplied: list[str]) -> list[str]:
    """Merge explicit hashtag input with tags visibly written in the post."""
    collected = []
    seen = set()
    for raw in [*(supplied or []), *re.findall(r"#([\w가-힣]{1,50})", content + " " + title, flags=re.UNICODE)]:
        tag = str(raw).strip().lstrip("#")[:50]
        if not tag:
            continue
        key = tag.casefold()
        if key not in seen:
            seen.add(key)
            collected.append(tag)
        if len(collected) >= 20:
            break
    return collected


@app.post("/api/posts", status_code=201)
def create_post(payload: PostIn, user: dict = Depends(_current_user)):
    global _post_seq
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="게시물 내용을 입력해 주세요.")
    _validate_community_text(payload.title, content, payload.exercise_name, payload.reps, payload.workout_notes, *(payload.hashtags or []))
    if payload.media_type == "video" and payload.media_duration_seconds is None:
        raise HTTPException(status_code=422, detail="영상 길이 확인이 필요합니다. 영상을 다시 선택해 주세요.")
    if payload.media_type == "image" and payload.media_duration_seconds is not None:
        raise HTTPException(status_code=422, detail="사진 게시물에는 영상 길이를 입력할 수 없습니다.")
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute("""INSERT INTO posts(author_username,content,title,media_type,media_data,media_duration_seconds,hashtags,weight,sets_count,exercise_name,reps,duration_minutes,workout_notes)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                (user["username"], content, payload.title.strip(), payload.media_type, payload.media_data, payload.media_duration_seconds,
                _collect_post_hashtags(content, payload.title, payload.hashtags), payload.weight, payload.sets_count,
                payload.exercise_name.strip(), payload.reps.strip(), payload.duration_minutes, payload.workout_notes.strip())).fetchone()
            return {"post": _post_dict(dict(row), user["username"], [])}
    with _lock:
        _post_seq += 1
        post = {"id": _post_seq, "author_username": user["username"], "title": payload.title.strip(), "content": content, "media_type": payload.media_type, "media_data": payload.media_data, "media_duration_seconds": payload.media_duration_seconds,
                "hashtags": _collect_post_hashtags(content, payload.title, payload.hashtags), "weight": payload.weight, "sets_count": payload.sets_count,
                "exercise_name": payload.exercise_name.strip(), "reps": payload.reps.strip(), "duration_minutes": payload.duration_minutes,
                "workout_notes": payload.workout_notes.strip(), "created_at": datetime.now(timezone.utc).isoformat(), "like_count": 0, "liked_by_me": False}
        _posts[post["id"]] = post
        _post_comments[post["id"]] = []
    return {"post": _post_dict(post, user["username"], [])}

@app.post("/api/posts/upload", status_code=201)
async def upload_post_media(
    title: str = Form(..., min_length=1, max_length=120),
    content: str = Form(..., min_length=1, max_length=2000),
    media_type: str = Form(..., pattern=r"^(image|video)$"),
    media: UploadFile = File(...),
    media_duration_seconds: int | None = Form(default=None, ge=1, le=60),
    hashtags: str = Form(default="[]", max_length=5000),
    weight: float | None = Form(default=None, ge=1, le=500),
    sets_count: int | None = Form(default=None, ge=0, le=500),
    exercise_name: str = Form(default="", max_length=100),
    reps: str = Form(default="", max_length=100),
    duration_minutes: int | None = Form(default=None, ge=0, le=1440),
    workout_notes: str = Form(default="", max_length=1000),
    user: dict = Depends(_current_user),
):
    """Accept the original binary file rather than a Base64-expanded JSON body."""
    if media_type == "video" and media_duration_seconds is None:
        raise HTTPException(status_code=422, detail="영상 길이 확인이 필요합니다. 영상을 다시 선택해 주세요.")
    if media_type == "image" and media_duration_seconds is not None:
        raise HTTPException(status_code=422, detail="사진 게시물에는 영상 길이를 입력할 수 없습니다.")
    limit = (5 if media_type == "image" else 40) * 1024 * 1024
    contents = await media.read(limit + 1)
    if not contents:
        raise HTTPException(status_code=422, detail="빈 파일은 업로드할 수 없습니다.")
    if len(contents) > limit:
        raise HTTPException(status_code=413, detail="사진은 5MB, 영상은 40MB 이하로 업로드해 주세요.")
    guessed = mimetypes.guess_type(media.filename or "")[0]
    mime = (media.content_type or guessed or "").lower()
    if mime in {"application/octet-stream", "binary/octet-stream"} and guessed:
        mime = guessed.lower()
    if not mime.startswith(media_type + "/"):
        raise HTTPException(status_code=415, detail="선택한 파일 형식과 미디어 종류가 일치하지 않습니다.")
    media_data = f"data:{mime};base64,{base64.b64encode(contents).decode('ascii')}"
    try:
        supplied_tags = json.loads(hashtags or "[]")
        if not isinstance(supplied_tags, list):
            raise ValueError("hashtags must be a list")
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=422, detail="해시태그 형식이 올바르지 않습니다.")
    payload = PostIn(
        title=title, content=content, media_type=media_type, media_data=media_data,
        media_duration_seconds=media_duration_seconds, hashtags=supplied_tags,
        weight=weight, sets_count=sets_count, exercise_name=exercise_name,
        reps=reps, duration_minutes=duration_minutes, workout_notes=workout_notes,
    )
    return create_post(payload, user)


@app.get("/api/posts/{post_id}/media/file")
def get_post_media_file(post_id: int, user: dict = Depends(_current_user)):
    """Return raw media bytes so video playback avoids JSON and Base64 decoding in the browser."""
    result = get_post_media(post_id, user)
    media_data = result.get("media_data") or ""
    match = re.match(r"^data:([^;,]+);base64,(.*)$", media_data, flags=re.DOTALL)
    if not match:
        raise HTTPException(status_code=404, detail="미디어 파일을 찾을 수 없습니다.")
    try:
        contents = base64.b64decode(match.group(2), validate=False)
    except (ValueError, TypeError):
        raise HTTPException(status_code=500, detail="미디어 파일을 읽지 못했습니다.")
    return Response(content=contents, media_type=match.group(1), headers={"Cache-Control": "private, max-age=120", "X-Content-Type-Options": "nosniff"})


@app.get("/api/posts/{post_id}/media")
def get_post_media(post_id: int, user: dict = Depends(_current_user)):
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute("SELECT author_username, media_data FROM posts WHERE id=%s", (post_id,)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
            author = row["author_username"]
            if not _can_view_author_content(user["username"], author, conn):
                raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
            return {"media_data": row["media_data"]}
    row = _posts.get(post_id)
    if not row:
        raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
    author = row["author_username"]
    if not _can_view_author_content(user["username"], author):
        raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
    return {"media_data": row.get("media_data", "")}


@app.get("/api/posts/{post_id}/media/playback")
def get_post_playback_url(post_id: int, user: dict = Depends(_current_user)):
    """Issue a short-lived signed URL so the browser can stream video with HTTP Range requests."""
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute("SELECT author_username FROM posts WHERE id=%s", (post_id,)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
            author = row["author_username"]
            if not _can_view_author_content(user["username"], author, conn):
                raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
    else:
        row = _posts.get(post_id)
        if not row:
            raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
        author = row["author_username"]
        if not _can_view_author_content(user["username"], author):
            raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
    expires = int(time.time()) + 180
    signature = hmac.new(_SECRET.encode(), f"{post_id}:{expires}".encode(), hashlib.sha256).hexdigest()
    return {"url": f"/api/posts/{post_id}/media/stream?expires={expires}&signature={signature}", "expires_at": expires}


@app.get("/api/posts/{post_id}/media/stream")
def stream_post_media(post_id: int, request: Request, expires: int, signature: str):
    """Serve signed media URLs progressively, including byte ranges requested by HTML video."""
    now = int(time.time())
    expected = hmac.new(_SECRET.encode(), f"{post_id}:{expires}".encode(), hashlib.sha256).hexdigest()
    if expires < now or expires > now + 180 or not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=403, detail="영상 재생 링크가 만료되었습니다. 다시 불러와 주세요.")
    cached_media = None
    with _video_cache_lock:
        cached_media = _video_cache.get(post_id)
        if cached_media is not None:
            _video_cache.move_to_end(post_id)
    if cached_media is not None:
        media_type, contents = cached_media
    else:
        if _DATABASE_URL:
            with _db() as conn:
                row = conn.execute("SELECT media_data FROM posts WHERE id=%s", (post_id,)).fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="미디어 파일을 찾을 수 없습니다.")
                media_data = row["media_data"] or ""
        else:
            row = _posts.get(post_id)
            if not row:
                raise HTTPException(status_code=404, detail="미디어 파일을 찾을 수 없습니다.")
            media_data = row.get("media_data", "")
        match = re.match(r"^data:([^;,]+);base64,(.*)$", media_data, flags=re.DOTALL)
        if not match:
            raise HTTPException(status_code=404, detail="미디어 파일을 찾을 수 없습니다.")
        try:
            media_type = match.group(1)
            contents = base64.b64decode(match.group(2), validate=False)
        except (ValueError, TypeError):
            raise HTTPException(status_code=500, detail="미디어 파일을 읽지 못했습니다.")
        if not contents:
            raise HTTPException(status_code=404, detail="빈 미디어 파일입니다.")
        # Video players request multiple byte ranges; decode the base64 payload only once per cached video.
        with _video_cache_lock:
            _video_cache[post_id] = (media_type, contents)
            _video_cache.move_to_end(post_id)
            while len(_video_cache) > _VIDEO_CACHE_MAX_ITEMS:
                _video_cache.popitem(last=False)
    total = len(contents)
    if total == 0:
        raise HTTPException(status_code=404, detail="빈 미디어 파일입니다.")
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "private, max-age=120, immutable", "X-Content-Type-Options": "nosniff"}
    range_header = request.headers.get("range", "")
    if range_header:
        found = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
        if not found:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{total}", "Accept-Ranges": "bytes"})
        start_text, end_text = found.groups()
        if not start_text:
            suffix = int(end_text or "0")
            if suffix <= 0:
                return Response(status_code=416, headers={"Content-Range": f"bytes */{total}", "Accept-Ranges": "bytes"})
            start = max(0, total - suffix)
            end = total - 1
        else:
            start = int(start_text)
            end = min(total - 1, int(end_text)) if end_text else min(total - 1, start + 1024 * 1024 - 1)
        if start >= total or end < start:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{total}", "Accept-Ranges": "bytes"})
        chunk = contents[start:end + 1]
        headers.update({"Content-Range": f"bytes {start}-{end}/{total}", "Content-Length": str(len(chunk))})
        return Response(content=chunk, status_code=206, media_type=media_type, headers=headers)
    headers["Content-Length"] = str(total)
    return Response(content=contents, media_type=media_type, headers=headers)


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
            author = conn.execute("SELECT author_username FROM posts WHERE id=%s", (post_id,)).fetchone()["author_username"]
            _notify(author, user["username"], "like", "게시물에 좋아요를 눌렀습니다.", post_id)
            _send_push(author, "새 좋아요", f"@{user['username']}님이 게시물에 좋아요를 눌렀습니다.", {"kind":"like", "username":user["username"], "post_id":str(post_id)})
            return {"liked": True}
    if post_id not in _posts: raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
    key = (post_id, user["username"])
    if key in _post_likes:
        _post_likes.remove(key)
        return {"liked": False}
    _post_likes.add(key)
    _notify(_posts[post_id]["author_username"], user["username"], "like", "게시물에 좋아요를 눌렀습니다.", post_id)
    _send_push(_posts[post_id]["author_username"], "새 좋아요", f"@{user['username']}님이 게시물에 좋아요를 눌렀습니다.", {"kind":"like", "username":user["username"], "post_id":str(post_id)})
    return {"liked": True}

@app.post("/api/posts/{post_id}/comments", status_code=201)
def create_comment(post_id: int, payload: CommentIn, user: dict = Depends(_current_user)):
    global _comment_seq
    content = payload.content.strip()
    if not content: raise HTTPException(status_code=422, detail="댓글 내용을 입력해 주세요.")
    _validate_community_text(content)
    if _DATABASE_URL:
        with _db() as conn:
            if not conn.execute("SELECT id FROM posts WHERE id=%s", (post_id,)).fetchone():
                raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
            row = conn.execute("""INSERT INTO post_comments(post_id,author_username,content)
                VALUES (%s,%s,%s) RETURNING id,author_username,content,created_at""", (post_id,user["username"],content)).fetchone()
            c = dict(row); c["created_at"] = c["created_at"].isoformat()
            author = conn.execute("SELECT author_username FROM posts WHERE id=%s", (post_id,)).fetchone()["author_username"]
            _notify(author, user["username"], "comment", "게시물에 댓글을 남겼습니다.", post_id)
            _send_push(author, "새 댓글", f"@{user['username']}: {content[:120]}", {"kind":"comment", "username":user["username"], "post_id":str(post_id)})
            return {"comment": c}
    if post_id not in _posts: raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
    with _lock:
        _comment_seq += 1
        comment = {"id": _comment_seq, "author_username": user["username"], "content": content, "created_at": datetime.now(timezone.utc).isoformat(), "pinned": False}
        _post_comments.setdefault(post_id, []).append(comment)
    _notify(_posts[post_id]["author_username"], user["username"], "comment", "게시물에 댓글을 남겼습니다.", post_id)
    _send_push(_posts[post_id]["author_username"], "새 댓글", f"@{user['username']}: {content[:120]}", {"kind":"comment", "username":user["username"], "post_id":str(post_id)})
    return {"comment": comment}

@app.post("/api/posts/{post_id}/comments/{comment_id}/pin")
def toggle_comment_pin(post_id: int, comment_id: int, user: dict = Depends(_current_user)):
    """Only the owner of the post may pin or unpin a comment."""
    if _DATABASE_URL:
        with _db() as conn:
            post = conn.execute("SELECT author_username FROM posts WHERE id=%s", (post_id,)).fetchone()
            if not post:
                raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
            if post["author_username"] != user["username"]:
                raise HTTPException(status_code=403, detail="게시물 작성자만 댓글을 고정할 수 있습니다.")
            comment = conn.execute("SELECT pinned FROM post_comments WHERE id=%s AND post_id=%s", (comment_id, post_id)).fetchone()
            if not comment:
                raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
            pinned = not bool(comment["pinned"])
            conn.execute("UPDATE post_comments SET pinned=%s WHERE id=%s AND post_id=%s", (pinned, comment_id, post_id))
            return {"pinned": pinned}
    if post_id not in _posts:
        raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
    if _posts[post_id]["author_username"] != user["username"]:
        raise HTTPException(status_code=403, detail="게시물 작성자만 댓글을 고정할 수 있습니다.")
    comments = _post_comments.get(post_id, [])
    target = next((item for item in comments if str(item["id"]) == str(comment_id)), None)
    if not target:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    target["pinned"] = not bool(target.get("pinned", False))
    comments.sort(key=lambda item: (not bool(item.get("pinned", False)), item.get("created_at", "")))
    return {"pinned": target["pinned"]}


@app.delete("/api/posts/{post_id}/comments/{comment_id}")
def delete_comment(post_id: int, comment_id: int, user: dict = Depends(_current_user)):
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute("SELECT author_username FROM post_comments WHERE id=%s AND post_id=%s", (comment_id, post_id)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
            post = conn.execute("SELECT author_username FROM posts WHERE id=%s", (post_id,)).fetchone()
            if row["author_username"] != user["username"] and (not post or post["author_username"] != user["username"]):
                raise HTTPException(status_code=403, detail="게시물 작성자 또는 댓글 작성자만 삭제할 수 있습니다.")
            conn.execute("DELETE FROM post_comments WHERE id=%s AND post_id=%s", (comment_id, post_id))
    else:
        if post_id not in _posts:
            raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
        comments = _post_comments.get(post_id, [])
        target = next((item for item in comments if str(item["id"]) == str(comment_id)), None)
        if not target:
            raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
        if target["author_username"] != user["username"] and _posts[post_id]["author_username"] != user["username"]:
            raise HTTPException(status_code=403, detail="게시물 작성자 또는 댓글 작성자만 삭제할 수 있습니다.")
        _post_comments[post_id] = [item for item in comments if str(item["id"]) != str(comment_id)]
    return {"deleted": True}


@app.delete("/api/posts/{post_id}")
def delete_post(post_id: int, user: dict = Depends(_current_user)):
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute("SELECT author_username FROM posts WHERE id=%s", (post_id,)).fetchone()
            if not row: raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
            if row["author_username"] != user["username"] and not _is_master(user): raise HTTPException(status_code=403, detail="본인의 게시물만 삭제할 수 있습니다.")
            conn.execute("DELETE FROM posts WHERE id=%s", (post_id,))
    else:
        row = _posts.get(post_id)
        if not row: raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
        if row["author_username"] != user["username"] and not _is_master(user): raise HTTPException(status_code=403, detail="본인의 게시물만 삭제할 수 있습니다.")
        _posts.pop(post_id, None)
        _post_comments.pop(post_id, None)
        for key in list(_post_likes):
            if key[0] == post_id: _post_likes.remove(key)
    return {"deleted": True}

@app.post("/api/posts/{post_id}/pin")
def toggle_post_pin(post_id: int, user: dict = Depends(_current_user)):
    if not _is_master(user): raise HTTPException(status_code=403, detail="마스터 계정만 게시물을 고정할 수 있습니다.")
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute("SELECT pinned FROM posts WHERE id=%s", (post_id,)).fetchone()
            if not row: raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
            pinned = not bool(row["pinned"])
            conn.execute("UPDATE posts SET pinned=%s WHERE id=%s", (pinned, post_id))
    else:
        post = _posts.get(post_id)
        if not post: raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
        pinned = not bool(post.get("pinned"))
        post["pinned"] = pinned
    return {"pinned": pinned}

@app.post("/api/users/{username}/suspend")
def toggle_account_suspension(username: str, user: dict = Depends(_current_user)):
    if not _is_master(user): raise HTTPException(status_code=403, detail="마스터 계정만 계정을 정지할 수 있습니다.")
    target = _find_username(username)
    if not target: raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if target["username"].lower() == user["username"].lower(): raise HTTPException(status_code=400, detail="마스터 계정은 스스로 정지할 수 없습니다.")
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute("UPDATE users SET suspended=NOT suspended WHERE username_key=%s RETURNING suspended", (target["username"].lower(),)).fetchone()
            suspended = bool(row["suspended"])
    else:
        key = target["username"].lower()
        suspended = key not in _suspended_users
        if suspended: _suspended_users.add(key)
        else: _suspended_users.discard(key)
    return {"suspended": suspended, "username": target["username"]}


def _profile_summary(username: str, viewer: str):
    target = _find_username(username)
    if not target:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if _DATABASE_URL:
        # Fetch all profile counters/relationship flags in one database round trip.
        with _db() as conn:
            stats = conn.execute("""
                SELECT
                    (SELECT COUNT(*)::int FROM user_follows WHERE followed_username=%s) AS followers,
                    (SELECT COUNT(*)::int FROM user_follows WHERE follower_username=%s) AS following,
                    EXISTS(SELECT 1 FROM user_follows WHERE follower_username=%s AND followed_username=%s) AS is_following,
                    EXISTS(SELECT 1 FROM user_follows WHERE follower_username=%s AND followed_username=%s) AS is_followed_by,
                    (SELECT COUNT(*)::int FROM posts WHERE author_username=%s) AS post_count
            """, (target["username"], target["username"], viewer, target["username"], target["username"], viewer, target["username"])).fetchone()
        followers = stats["followers"]
        following = stats["following"]
        is_following = bool(stats["is_following"])
        is_followed_by = bool(stats["is_followed_by"])
        post_count = stats["post_count"]
    else:
        followers = sum(1 for follower, followed in _follows if followed == target["username"])
        following = sum(1 for follower, followed in _follows if follower == target["username"])
        is_following = (viewer, target["username"]) in _follows
        is_followed_by = (target["username"], viewer) in _follows
        post_count = sum(1 for p in _posts.values() if p["author_username"] == target["username"])
    return {"name": target.get("name") or target["username"], "username": target["username"], "email": target["email"] if target["username"] == viewer else None,
            "verified": bool(target["verified"]), "follower_count": followers, "following_count": following,
            "post_count": post_count, "following_by_me": is_following, "followed_by_me": is_followed_by,
            "is_mutual": is_following and is_followed_by, "is_me": target["username"] == viewer}

@app.get("/api/users/{username}")
def get_user_profile(username: str, user: dict = Depends(_current_user)):
    return {"profile": _profile_summary(username, user["username"])}

@app.get("/api/users/{username}/relationships")
def get_user_relationships(username: str, type: str = "followers", user: dict = Depends(_current_user)):
    target = _find_username(username)
    if not target:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if type not in ("followers", "following"):
        raise HTTPException(status_code=400, detail="목록 유형이 올바르지 않습니다.")
    target_name = target["username"]
    if _DATABASE_URL:
        with _db() as conn:
            if type == "followers":
                rows = conn.execute("""
                    SELECT u.username, COALESCE(NULLIF(u.name, ''), u.username) AS name
                    FROM user_follows f
                    JOIN users u ON LOWER(u.username) = LOWER(f.follower_username)
                    WHERE f.followed_username=%s AND u.deletion_requested_at IS NULL
                    ORDER BY f.created_at DESC
                """, (target_name,)).fetchall()
            else:
                rows = conn.execute("""
                    SELECT u.username, COALESCE(NULLIF(u.name, ''), u.username) AS name
                    FROM user_follows f
                    JOIN users u ON LOWER(u.username) = LOWER(f.followed_username)
                    WHERE f.follower_username=%s AND u.deletion_requested_at IS NULL
                    ORDER BY f.created_at DESC
                """, (target_name,)).fetchall()
        users = [{"username": row["username"], "name": row["name"]} for row in rows]
    else:
        if type == "followers":
            names = [follower for follower, followed in _follows if followed == target_name]
        else:
            names = [followed for follower, followed in _follows if follower == target_name]
        users = []
        for name in names:
            person = _find_username(name)
            if person:
                users.append({"username": person["username"], "name": person.get("name") or person["username"]})
    return {"username": target_name, "type": type, "users": users}

@app.post("/api/users/{username}/follow")
def toggle_follow(username: str, user: dict = Depends(_current_user)):
    target = _find_username(username)
    if not target:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    me = user["username"]
    if target["username"] == me:
        raise HTTPException(status_code=400, detail="자신을 팔로우할 수 없습니다.")
    if _DATABASE_URL:
        with _db() as conn:
            blocked = conn.execute("SELECT 1 FROM user_blocks WHERE (blocker_username=%s AND blocked_username=%s) OR (blocker_username=%s AND blocked_username=%s) LIMIT 1",
                (me,target["username"],target["username"],me)).fetchone()
        if blocked: raise HTTPException(status_code=403, detail="차단한 계정과는 팔로우할 수 없습니다.")
    elif (me,target["username"]) in _blocks or (target["username"],me) in _blocks:
        raise HTTPException(status_code=403, detail="차단한 계정과는 팔로우할 수 없습니다.")
    if _DATABASE_URL:
        with _db() as conn:
            exists = conn.execute("SELECT 1 FROM user_follows WHERE follower_username=%s AND followed_username=%s", (me, target["username"])).fetchone()
            if exists:
                conn.execute("DELETE FROM user_follows WHERE follower_username=%s AND followed_username=%s", (me, target["username"]))
                followed = False
            else:
                conn.execute("INSERT INTO user_follows(follower_username,followed_username) VALUES (%s,%s) ON CONFLICT DO NOTHING", (me, target["username"]))
                followed = True
    else:
        key = (me, target["username"])
        if key in _follows:
            _follows.remove(key); followed = False
        else:
            _follows.add(key); followed = True
    if followed:
        _notify(target["username"], me, "follow", "회원님을 팔로우하기 시작했습니다.")
        _send_push(target["username"], "새 팔로워", f"@{me}님이 회원님을 팔로우하기 시작했습니다.", {"kind":"follow", "username":me})
    return {"following": followed, "profile": _profile_summary(target["username"], me)}

def _message_dict(row):
    created = row["created_at"]
    read_at = row.get("read_at")
    return {"id": row["id"], "sender_username": row["sender_username"], "recipient_username": row["recipient_username"],
            "content": row["content"], "created_at": created.isoformat() if hasattr(created, "isoformat") else created,
            "read_at": read_at.isoformat() if hasattr(read_at, "isoformat") else read_at}

_firebase_app = None
_firebase_init_lock = Lock()

def _notification_preference_enabled(username: str, kind: str) -> bool:
    preference = {"message": "notify_messages", "comment": "notify_comments", "like": "notify_likes", "follow": "notify_follows"}.get(kind)
    if not preference:
        return True
    try:
        return bool(_get_user_settings(username).get(preference, True))
    except Exception:
        return True


def _send_push(username: str, title: str, body: str, data: dict | None = None):
    """Send best-effort FCM notifications when production credentials are configured."""
    if not _notification_preference_enabled(username, str((data or {}).get("kind", (data or {}).get("type", "")))):
        return
    try:
        credential_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
        if not credential_json:
            return
        global _firebase_app
        with _firebase_init_lock:
            if _firebase_app is None:
                import firebase_admin
                from firebase_admin import credentials
                _firebase_app = firebase_admin.initialize_app(credentials.Certificate(json.loads(credential_json)))
        from firebase_admin import messaging
        if _DATABASE_URL:
            with _db() as conn:
                rows = conn.execute("SELECT token FROM push_devices WHERE username=%s", (username,)).fetchall()
            tokens = [row["token"] for row in rows]
        else:
            tokens = [token for token, owner in _push_devices.items() if owner == username]
        for token in tokens:
            try:
                messaging.send(messaging.Message(
                    token=token,
                    notification=messaging.Notification(title=title, body=body),
                    data={key: str(value) for key, value in (data or {}).items()},
                    android=messaging.AndroidConfig(priority="high", notification=messaging.AndroidNotification(channel_id="fitnova_messages")),
                ), app=_firebase_app)
            except Exception as exc:
                # Expired tokens are removed; other FCM errors do not prevent DM delivery.
                if "registration-token-not-registered" in str(exc).lower() or "invalid-registration-token" in str(exc).lower():
                    if _DATABASE_URL:
                        with _db() as conn: conn.execute("DELETE FROM push_devices WHERE token=%s", (token,))
                    else:
                        _push_devices.pop(token, None)
                else:
                    print(f"Push delivery failed: {type(exc).__name__}")
    except Exception as exc:
        print(f"Push service unavailable: {type(exc).__name__}")

_push_devices = {}  # token -> authenticated username, development adapter only

@app.post("/api/push/devices", status_code=201)
def register_push_device(payload: PushDeviceIn, user: dict = Depends(_current_user)):
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("INSERT INTO push_devices(token,username,platform) VALUES (%s,%s,%s) ON CONFLICT(token) DO UPDATE SET username=EXCLUDED.username, platform=EXCLUDED.platform, created_at=NOW()",
                         (payload.token, user["username"], payload.platform))
    else:
        _push_devices[payload.token] = user["username"]
    return {"registered": True}

@app.delete("/api/push/devices/{token}")
def unregister_push_device(token: str, user: dict = Depends(_current_user)):
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("DELETE FROM push_devices WHERE token=%s AND username=%s", (token, user["username"]))
    elif _push_devices.get(token) == user["username"]:
        _push_devices.pop(token, None)
    return {"removed": True}

@app.get("/api/messages")
def list_message_threads(user: dict = Depends(_current_user)):
    me = user["username"]
    if _DATABASE_URL:
        with _db() as conn:
            rows = conn.execute("""
                SELECT DISTINCT ON (other_user) other_user, id, sender_username, recipient_username, content, created_at, read_at,
                       (SELECT COUNT(*)::int FROM direct_messages unread WHERE unread.sender_username = other_user
                        AND unread.recipient_username = %s AND unread.read_at IS NULL) AS unread_count
                FROM (
                    SELECT CASE WHEN sender_username=%s THEN recipient_username ELSE sender_username END AS other_user,
                           id, sender_username, recipient_username, content, created_at, read_at
                    FROM direct_messages WHERE sender_username=%s OR recipient_username=%s
                ) dm
                ORDER BY other_user, created_at DESC
            """, (me, me, me, me)).fetchall()
        threads = [_message_dict(dict(row)) | {"username": row["other_user"], "unread_count": row["unread_count"]} for row in rows]
    else:
        latest = {}
        for msg in _messages:
            if me not in (msg["sender_username"], msg["recipient_username"]): continue
            other = msg["recipient_username"] if msg["sender_username"] == me else msg["sender_username"]
            if other not in latest or msg["created_at"] > latest[other]["created_at"]:
                latest[other] = msg
        threads = [_message_dict(msg) | {"username": name, "unread_count": sum(1 for item in _messages if item["sender_username"] == name and item["recipient_username"] == me and not item.get("read_at"))} for name, msg in latest.items()]
        threads.sort(key=lambda item: item["created_at"], reverse=True)
    return {"threads": threads}

@app.get("/api/messages/{username}")
def get_conversation(username: str, user: dict = Depends(_current_user)):
    target = _find_username(username)
    if not target: raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    me = user["username"]
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("UPDATE direct_messages SET read_at=NOW() WHERE sender_username=%s AND recipient_username=%s AND read_at IS NULL", (target["username"], me))
            rows = conn.execute("""SELECT id,sender_username,recipient_username,content,created_at,read_at FROM direct_messages
                WHERE (sender_username=%s AND recipient_username=%s) OR (sender_username=%s AND recipient_username=%s)
                ORDER BY created_at ASC LIMIT 500""", (me,target["username"],target["username"],me)).fetchall()
        messages = [_message_dict(dict(row)) for row in rows]
    else:
        now = datetime.now(timezone.utc).isoformat()
        with _lock:
            for item in _messages:
                if item["sender_username"] == target["username"] and item["recipient_username"] == me and not item.get("read_at"):
                    item["read_at"] = now
            messages = [_message_dict(m) for m in _messages if
                        (m["sender_username"] == me and m["recipient_username"] == target["username"]) or
                        (m["sender_username"] == target["username"] and m["recipient_username"] == me)]
    return {"username": target["username"], "messages": messages}

@app.post("/api/messages/{username}", status_code=201)
def send_direct_message(username: str, payload: MessageIn, user: dict = Depends(_current_user)):
    global _message_seq
    target = _find_username(username)
    if not target: raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    content = payload.content.strip()
    if not content: raise HTTPException(status_code=422, detail="메시지를 입력해 주세요.")
    _validate_community_text(content)
    if target["username"] == user["username"]: raise HTTPException(status_code=400, detail="자기 자신에게 메시지를 보낼 수 없습니다.")
    if _DATABASE_URL:
        with _db() as conn:
            blocked = conn.execute("SELECT 1 FROM user_blocks WHERE (blocker_username=%s AND blocked_username=%s) OR (blocker_username=%s AND blocked_username=%s) LIMIT 1",
                (user["username"],target["username"],target["username"],user["username"])).fetchone()
        if blocked: raise HTTPException(status_code=403, detail="이 계정과는 메시지를 주고받을 수 없습니다.")
    elif (user["username"],target["username"]) in _blocks or (target["username"],user["username"]) in _blocks:
        raise HTTPException(status_code=403, detail="이 계정과는 메시지를 주고받을 수 없습니다.")
    prefs = _get_user_settings(target["username"])
    if prefs["allow_messages_from"] == "following":
        if _DATABASE_URL:
            with _db() as conn:
                allowed = bool(conn.execute("SELECT 1 FROM user_follows WHERE follower_username=%s AND followed_username=%s", (target["username"], user["username"])).fetchone())
        else:
            allowed = (target["username"], user["username"]) in _follows
        if not allowed:
            raise HTTPException(status_code=403, detail="이 사용자는 팔로우한 계정에게서만 메시지를 받습니다.")
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute("""INSERT INTO direct_messages(sender_username,recipient_username,content)
                VALUES (%s,%s,%s) RETURNING id,sender_username,recipient_username,content,created_at,read_at""",
                (user["username"],target["username"],content)).fetchone()
        _notify(target["username"], user["username"], "message", "새 메시지를 보냈습니다.")
        _send_push(target["username"], "새 메시지", f"@{user['username']}: {content[:140]}", {"kind":"message", "username":user["username"]})
        return {"message": _message_dict(dict(row))}
    with _lock:
        _message_seq += 1
        message = {"id": _message_seq, "sender_username": user["username"], "recipient_username": target["username"],
                   "content": content, "created_at": datetime.now(timezone.utc).isoformat(), "read_at": None}
        _messages.append(message)
    _notify(target["username"], user["username"], "message", "새 메시지를 보냈습니다.")
    _send_push(target["username"], "새 메시지", f"@{user['username']}: {content[:140]}", {"kind":"message", "username":user["username"]})
    return {"message": _message_dict(message)}


def _get_user_settings(username: str):
    defaults = {"private_account": False, "allow_messages_from": "everyone", "show_activity": True, "show_workout_details": True, "notify_messages": True, "notify_comments": True, "notify_likes": True, "notify_follows": True}
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute("SELECT private_account,allow_messages_from,show_activity,show_workout_details,notify_messages,notify_comments,notify_likes,notify_follows FROM user_settings WHERE username=%s", (username,)).fetchone()
            if row: return dict(row)
            conn.execute("INSERT INTO user_settings(username) VALUES (%s) ON CONFLICT DO NOTHING", (username,))
        return defaults
    return defaults | _user_settings.get(username, {})

class SettingsIn(BaseModel):
    private_account: bool = False
    allow_messages_from: str = Field(default="everyone", pattern=r"^(everyone|following)$")
    show_activity: bool = True
    show_workout_details: bool = True
    notify_messages: bool = True
    notify_comments: bool = True
    notify_likes: bool = True
    notify_follows: bool = True
class SecurityCodeIn(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")
class PasswordChangeIn(SecurityCodeIn):
    new_password: str = Field(min_length=10, max_length=128)
class EmailRequestIn(BaseModel):
    email: EmailStr
class EmailConfirmIn(SecurityCodeIn):
    email: EmailStr

def _save_account_code(username: str, purpose: str, target_email: str, code: str):
    digest = _hash_code(username + ":" + purpose, code)
    expires = time.time() + 600
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("""INSERT INTO account_security_codes(username,purpose,target_email,code_hash,expires_at,tries)
                VALUES (%s,%s,%s,%s,%s,0) ON CONFLICT(username,purpose) DO UPDATE SET
                target_email=EXCLUDED.target_email,code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,tries=0""",
                (username,purpose,target_email.lower(),digest,expires))
    else:
        _account_codes[(username,purpose)] = {"target_email":target_email.lower(),"code_hash":digest,"expires_at":expires,"tries":0}

def _consume_account_code(username: str, purpose: str, code: str):
    if _DATABASE_URL:
        with _db() as conn:
            row=conn.execute("SELECT target_email,code_hash,expires_at,tries FROM account_security_codes WHERE username=%s AND purpose=%s",(username,purpose)).fetchone()
            if not row: return None
            conn.execute("UPDATE account_security_codes SET tries=tries+1 WHERE username=%s AND purpose=%s",(username,purpose))
            if row["tries"] >= 5 or row["expires_at"] < time.time() or not hmac.compare_digest(row["code_hash"],_hash_code(username+":"+purpose,code)):
                if row["tries"] >= 4 or row["expires_at"] < time.time(): conn.execute("DELETE FROM account_security_codes WHERE username=%s AND purpose=%s",(username,purpose))
                return None
            conn.execute("DELETE FROM account_security_codes WHERE username=%s AND purpose=%s",(username,purpose))
            return row["target_email"]
    row=_account_codes.get((username,purpose))
    if not row: return None
    row["tries"]+=1
    if row["tries"]>5 or row["expires_at"]<time.time(): _account_codes.pop((username,purpose),None); return None
    if not hmac.compare_digest(row["code_hash"],_hash_code(username+":"+purpose,code)): return None
    _account_codes.pop((username,purpose),None)
    return row["target_email"]

def _purge_expired_accounts():
    cutoff=datetime.now(timezone.utc)-timedelta(days=30)
    if _DATABASE_URL:
        with _db() as conn:
            expired=conn.execute("SELECT username FROM users WHERE deletion_requested_at IS NOT NULL AND deletion_requested_at<=%s",(cutoff,)).fetchall()
            for row in expired:
                name=row["username"]
                conn.execute("DELETE FROM posts WHERE author_username=%s",(name,))
                conn.execute("DELETE FROM user_follows WHERE follower_username=%s OR followed_username=%s",(name,name))
                conn.execute("DELETE FROM direct_messages WHERE sender_username=%s OR recipient_username=%s",(name,name))
                conn.execute("DELETE FROM push_devices WHERE username=%s", (name,))
                conn.execute("DELETE FROM post_comments WHERE author_username=%s",(name,))
                conn.execute("DELETE FROM post_likes WHERE username=%s",(name,))
                conn.execute("DELETE FROM saved_posts WHERE username=%s",(name,))
                conn.execute("DELETE FROM user_settings WHERE username=%s",(name,))
                conn.execute("DELETE FROM account_security_codes WHERE username=%s",(name,))
                conn.execute("DELETE FROM users WHERE username_key=%s",(name.lower(),))
    else:
        for name, account in list(_users.items()):
            requested=account.get("deletion_requested_at")
            if requested and datetime.fromisoformat(requested)<=cutoff:
                _users.pop(name,None); _user_settings.pop(name,None)
                _follows.difference_update([x for x in _follows if name in x])
                _saved_posts.difference_update([x for x in _saved_posts if x[0]==name])
                _messages[:]=[m for m in _messages if name not in (m["sender_username"],m["recipient_username"])]
                for token, owner in list(_push_devices.items()):
                    if owner == name: _push_devices.pop(token, None)
                for pid,p in list(_posts.items()):
                    if p["author_username"]==name: _posts.pop(pid,None); _post_comments.pop(pid,None)
                _post_likes.difference_update([x for x in _post_likes if x[1]==name])

@app.get("/api/account/settings")
def get_account_settings(user: dict = Depends(_current_user)):
    _purge_expired_accounts()
    return {"settings":_get_user_settings(user["username"]),"name":user.get("name") or user["username"],"email":user["email"],"username":user["username"]}

@app.patch("/api/account/settings")
def update_account_settings(payload: SettingsIn,user: dict = Depends(_current_user)):
    settings=payload.model_dump()
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("""INSERT INTO user_settings(username,private_account,allow_messages_from,show_activity,show_workout_details,notify_messages,notify_comments,notify_likes,notify_follows)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(username) DO UPDATE SET private_account=EXCLUDED.private_account,
                allow_messages_from=EXCLUDED.allow_messages_from,show_activity=EXCLUDED.show_activity,
                show_workout_details=EXCLUDED.show_workout_details,notify_messages=EXCLUDED.notify_messages,
                notify_comments=EXCLUDED.notify_comments,notify_likes=EXCLUDED.notify_likes,notify_follows=EXCLUDED.notify_follows,updated_at=NOW()""",
                (user["username"],settings["private_account"],settings["allow_messages_from"],settings["show_activity"],settings["show_workout_details"],settings["notify_messages"],settings["notify_comments"],settings["notify_likes"],settings["notify_follows"]))
    else: _user_settings[user["username"]]=settings
    return {"settings":settings}

@app.post("/api/account/password/request-code",status_code=202)
def request_password_change_code(request: Request,user: dict = Depends(_current_user)):
    _rate_limit("password-change:"+user["username"],5)
    code=f"{secrets.randbelow(1_000_000):06d}"
    _send_code(user["email"],code,"비밀번호 변경"); _save_account_code(user["username"],"password",user["email"],code)
    return {"message":"비밀번호 변경 보안 코드를 이메일로 발송했습니다."}

@app.post("/api/account/password/confirm")
def confirm_password_change(payload: PasswordChangeIn,user: dict = Depends(_current_user)):
    if not _consume_account_code(user["username"],"password",payload.code): raise HTTPException(status_code=400,detail="보안 코드가 올바르지 않거나 만료되었습니다.")
    hashed=_password_hash.hash(payload.new_password)
    if _DATABASE_URL:
        with _db() as conn: conn.execute("UPDATE users SET password_hash=%s WHERE username_key=%s",(hashed,user["username"].lower()))
    else: _users[user["username"]]["password_hash"]=hashed
    return {"changed":True,"message":"비밀번호를 변경했습니다."}

@app.post("/api/account/email/request-code",status_code=202)
def request_email_change_code(payload: EmailRequestIn,request: Request,user: dict = Depends(_current_user)):
    email=str(payload.email).lower()
    if email==user["email"].lower(): raise HTTPException(status_code=400,detail="현재 이메일과 같습니다.")
    if _find_email(email): raise HTTPException(status_code=409,detail="이미 사용 중인 이메일입니다.")
    _rate_limit("email-change:"+user["username"],5)
    code=f"{secrets.randbelow(1_000_000):06d}"
    _send_code(email,code,"이메일 변경"); _save_account_code(user["username"],"email",email,code)
    return {"message":"새 이메일로 인증 코드를 발송했습니다."}

@app.post("/api/account/email/confirm")
def confirm_email_change(payload: EmailConfirmIn,user: dict = Depends(_current_user)):
    email=str(payload.email).lower()
    target=_consume_account_code(user["username"],"email",payload.code)
    if not target or target!=email: raise HTTPException(status_code=400,detail="보안 코드가 올바르지 않거나 이메일과 일치하지 않습니다.")
    if _find_email(email): raise HTTPException(status_code=409,detail="이미 사용 중인 이메일입니다.")
    if _DATABASE_URL:
        with _db() as conn: conn.execute("UPDATE users SET email=%s,verified=TRUE WHERE username_key=%s",(email,user["username"].lower()))
    else: _users[user["username"]]["email"]=email
    return {"email":email,"message":"이메일을 변경했습니다."}

@app.delete("/api/account")
def request_account_deletion(user: dict = Depends(_current_user)):
    requested=datetime.now(timezone.utc)
    if _DATABASE_URL:
        with _db() as conn: conn.execute("UPDATE users SET deletion_requested_at=%s WHERE username_key=%s",(requested,user["username"].lower()))
    else: _users[user["username"]]["deletion_requested_at"]=requested.isoformat()
    return {"deleted":False,"scheduled_for":(requested+timedelta(days=30)).isoformat(),"message":"계정이 비활성화되었습니다. 30일 후 영구 삭제됩니다."}

@app.get("/api/users/{username}/posts")
def get_user_posts(username: str,user: dict = Depends(_current_user)):
    target=_find_username(username)
    if not target: raise HTTPException(status_code=404,detail="사용자를 찾을 수 없습니다.")
    if not _can_view_author_content(user["username"], target["username"]):
        raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
    if _DATABASE_URL:
        with _db() as conn:
            rows=conn.execute("""SELECT p.*,COUNT(DISTINCT l.username)::int AS like_count,
                COALESCE(BOOL_OR(l.username=%s),FALSE) AS liked_by_me FROM posts p LEFT JOIN post_likes l ON l.post_id=p.id
                WHERE p.author_username=%s GROUP BY p.id ORDER BY p.created_at DESC LIMIT 100""",(user["username"],target["username"])).fetchall()
            result=[]
            for row in rows:
                comments=conn.execute("SELECT id,author_username,content,created_at,pinned FROM post_comments WHERE post_id=%s ORDER BY pinned DESC, created_at ASC",(row["id"],)).fetchall()
                post_data = _post_dict(dict(row),user["username"],[dict(c) for c in comments])
                post_data.pop("media_data", None)
                result.append(post_data)
            return {"posts":result}
    result=[]
    for post in sorted(_posts.values(),key=lambda p:p["created_at"],reverse=True):
        if post["author_username"]!=target["username"]: continue
        row=dict(post);row["like_count"]=sum(1 for pid,_ in _post_likes if pid==row["id"]);row["liked_by_me"]=(row["id"],user["username"]) in _post_likes
        post_data = _post_dict(row,user["username"],_post_comments.get(row["id"],[]))
        post_data.pop("media_data", None)
        result.append(post_data)
    return {"posts":result[:100]}

@app.post("/api/posts/{post_id}/save")
def toggle_saved_post(post_id: int,user: dict = Depends(_current_user)):
    if _DATABASE_URL:
        with _db() as conn:
            if not conn.execute("SELECT id FROM posts WHERE id=%s",(post_id,)).fetchone(): raise HTTPException(status_code=404,detail="게시물을 찾을 수 없습니다.")
            exists=conn.execute("SELECT 1 FROM saved_posts WHERE username=%s AND post_id=%s",(user["username"],post_id)).fetchone()
            if exists: conn.execute("DELETE FROM saved_posts WHERE username=%s AND post_id=%s",(user["username"],post_id)); saved=False
            else: conn.execute("INSERT INTO saved_posts(username,post_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",(user["username"],post_id)); saved=True
    else:
        if post_id not in _posts: raise HTTPException(status_code=404,detail="게시물을 찾을 수 없습니다.")
        key=(user["username"],post_id)
        if key in _saved_posts: _saved_posts.discard(key); saved=False
        else: _saved_posts.add(key); saved=True
    return {"saved":saved}

@app.get("/api/saved-posts")
def list_saved_posts(user: dict = Depends(_current_user)):
    if _DATABASE_URL:
        with _db() as conn:
            rows=conn.execute("""SELECT p.*,COUNT(DISTINCT l.username)::int AS like_count,
                COALESCE(BOOL_OR(l.username=%s),FALSE) AS liked_by_me FROM saved_posts s JOIN posts p ON p.id=s.post_id
                LEFT JOIN post_likes l ON l.post_id=p.id WHERE s.username=%s
                AND (p.author_username=%s OR NOT COALESCE((SELECT private_account FROM user_settings WHERE username=p.author_username),FALSE)
                     OR EXISTS (SELECT 1 FROM user_follows WHERE follower_username=%s AND followed_username=p.author_username))
                AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
                    (b.blocker_username=%s AND b.blocked_username=p.author_username) OR
                    (b.blocker_username=p.author_username AND b.blocked_username=%s))
                AND NOT EXISTS (SELECT 1 FROM user_mutes m WHERE m.muter_username=%s AND m.muted_username=p.author_username)
                GROUP BY p.id,s.created_at ORDER BY s.created_at DESC LIMIT 100""",
                (user["username"],user["username"],user["username"],user["username"],user["username"],user["username"],user["username"])).fetchall()
            result=[]
            for row in rows:
                comments=conn.execute("SELECT id,author_username,content,created_at,pinned FROM post_comments WHERE post_id=%s ORDER BY pinned DESC, created_at ASC",(row["id"],)).fetchall()
                post_data = _post_dict(dict(row),user["username"],[dict(c) for c in comments])
                post_data.pop("media_data", None)
                result.append(post_data)
            return {"posts":result}
    result=[]
    for _,pid in [x for x in _saved_posts if x[0]==user["username"]]:
        if pid not in _posts: continue
        if not _can_view_author_content(user["username"], _posts[pid]["author_username"]): continue
        row=dict(_posts[pid]);row["like_count"]=sum(1 for post_id,_ in _post_likes if post_id==pid);row["liked_by_me"]=(pid,user["username"]) in _post_likes
        post_data = _post_dict(row,user["username"],_post_comments.get(pid,[]))
        post_data.pop("media_data", None)
        result.append(post_data)
    return {"posts":result}


def _notify(recipient: str, actor: str, kind: str, message: str, post_id: int | None = None):
    global _notification_seq
    if not recipient or recipient == actor:
        return
    if not _notification_preference_enabled(recipient, kind):
        return
    try:
        if _DATABASE_URL:
            with _db() as conn:
                conn.execute("INSERT INTO notifications(recipient_username,actor_username,kind,message,post_id) VALUES (%s,%s,%s,%s,%s)",
                    (recipient, actor, kind, message[:180], post_id))
        else:
            _notification_seq += 1
            _notifications.insert(0, {"id": _notification_seq, "recipient_username": recipient,
                "actor_username": actor, "kind": kind, "message": message[:180], "post_id": post_id,
                "read": False, "created_at": datetime.now(timezone.utc).isoformat()})
            del _notifications[200:]
    except Exception as exc:
        print(f"Notification write failed: {type(exc).__name__}")


class ReportIn(BaseModel):
    target_type: str = Field(pattern=r"^(post|comment|user|message)$")
    target_id: str = Field(min_length=1, max_length=100)
    reason: str = Field(min_length=2, max_length=80)
    details: str = Field(default="", max_length=1000)


class ReportStatusIn(BaseModel):
    status: str = Field(pattern=r"^(reviewed|dismissed)$")


def _maybe_alert_master_report_threshold(target_username: str) -> None:
    """Alert the master once when an account receives its fifth user report."""
    target = _find_username(target_username)
    if not target:
        return
    normalized = target["username"].casefold()
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute(
                "SELECT COUNT(*)::int AS report_count FROM content_reports WHERE target_type='user' AND LOWER(target_id)=LOWER(%s)",
                (target["username"],),
            ).fetchone()
            count = int(row["report_count"] or 0)
            if count < 5:
                return
            claimed = conn.execute(
                """INSERT INTO account_report_alerts(target_username, report_count)
                   VALUES (%s, %s) ON CONFLICT (target_username) DO NOTHING
                   RETURNING target_username""",
                (normalized, count),
            ).fetchone()
        if not claimed:
            return
    else:
        with _report_alert_lock:
            count = sum(
                1 for report in _reports
                if report.get("target_type") == "user"
                and str(report.get("target_id", "")).casefold() == normalized
            )
            if count < 5 or normalized in _report_alerted_users:
                return
            _report_alerted_users.add(normalized)

    master = _find_email("fitnova@naver.com")
    if not master or master["username"].casefold() == normalized:
        return
    message = f"@{target['username']} 계정에 신고가 {count}건 접수되었습니다. 신고 관리에서 확인해 주세요."
    _notify(master["username"], target["username"], "report_threshold", message)
    _send_push(
        master["username"],
        "FITNOVA 신고 알림",
        f"@{target['username']} 계정에 신고가 5건 이상 접수되었습니다.",
        {"type": "report_threshold", "username": target["username"]},
    )


@app.get("/api/search")
def search_social(q: str = Query(default="", max_length=80), user: dict = Depends(_current_user)):
    term = q.strip().lstrip("#").strip()
    if len(term) < 1:
        return {"query": q, "users": [], "posts": [], "hashtags": []}
    users, posts = [], []
    pattern = "%" + term.lower().replace("%", "\\%").replace("_", "\\_") + "%"
    if _DATABASE_URL:
        with _db() as conn:
            user_rows = conn.execute("SELECT username,name FROM users WHERE deletion_requested_at IS NULL AND (LOWER(username) LIKE %s OR LOWER(name) LIKE %s) ORDER BY username LIMIT 12",
                (pattern, pattern)).fetchall()
            users = [{"username": r["username"], "name": r.get("name") or r["username"]} for r in user_rows if r["username"].lower() != user["username"].lower()]
            rows = conn.execute("""SELECT p.*, COUNT(DISTINCT l.username)::int AS like_count,
                COALESCE(BOOL_OR(l.username=%s),FALSE) AS liked_by_me
                FROM posts p LEFT JOIN post_likes l ON l.post_id=p.id
                WHERE (LOWER(p.title) LIKE %s OR LOWER(p.content) LIKE %s OR EXISTS
                    (SELECT 1 FROM unnest(p.hashtags) tag WHERE LOWER(REPLACE(tag,'#','')) LIKE %s))
                AND (p.author_username=%s OR NOT COALESCE((SELECT private_account FROM user_settings WHERE username=p.author_username),FALSE)
                     OR EXISTS (SELECT 1 FROM user_follows WHERE follower_username=%s AND followed_username=p.author_username))
                AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
                    (b.blocker_username=%s AND b.blocked_username=p.author_username) OR
                    (b.blocker_username=p.author_username AND b.blocked_username=%s))
                AND NOT EXISTS (SELECT 1 FROM user_mutes m WHERE m.muter_username=%s AND m.muted_username=p.author_username)
                GROUP BY p.id ORDER BY p.created_at DESC LIMIT 20""",
                (user["username"], pattern, pattern, pattern, user["username"], user["username"],
                 user["username"], user["username"], user["username"])).fetchall()
            for row in rows:
                comments = conn.execute("SELECT id,author_username,content,created_at,pinned FROM post_comments WHERE post_id=%s ORDER BY pinned DESC, created_at ASC LIMIT 20", (row["id"],)).fetchall()
                item = _post_dict(dict(row), user["username"], [dict(c) for c in comments])
                item.pop("media_data", None)
                posts.append(item)
    else:
        users = [{"username": u["username"], "name": u.get("name") or u["username"]} for u in _users.values()
                 if u["username"].lower() != user["username"].lower() and
                 (term.lower() in u["username"].lower() or term.lower() in (u.get("name") or "").lower())][:12]
        for post in sorted(_posts.values(), key=lambda p: p["created_at"], reverse=True):
            author = post["author_username"]
            if not _can_view_author_content(user["username"], author): continue
            haystack = " ".join([str(post.get("title", "")), str(post.get("content", "")), " ".join(post.get("hashtags") or [])]).lower()
            if term.lower() not in haystack: continue
            row = dict(post)
            row["like_count"] = sum(1 for pid, _ in _post_likes if pid == row["id"])
            row["liked_by_me"] = (row["id"], user["username"]) in _post_likes
            item = _post_dict(row, user["username"], _post_comments.get(row["id"], []))
            item.pop("media_data", None)
            posts.append(item)
            if len(posts) >= 20: break
    tags = []
    for post in posts:
        for tag in post.get("hashtags") or []:
            tag_text = tag if str(tag).startswith("#") else "#" + str(tag)
            if term.lower() in tag_text.lower().lstrip("#") and tag_text not in tags: tags.append(tag_text)
    return {"query": q, "users": users, "posts": posts, "hashtags": tags[:12]}


@app.get("/api/notifications")
def list_notifications(user: dict = Depends(_current_user)):
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("DELETE FROM notifications WHERE recipient_username=%s AND created_at < NOW() - INTERVAL '1 hour'",
                (user["username"],))
            rows = conn.execute("SELECT id,actor_username,kind,message,post_id,read,created_at FROM notifications WHERE recipient_username=%s ORDER BY created_at DESC LIMIT 100",
                (user["username"],)).fetchall()
            unread = conn.execute("SELECT COUNT(*)::int AS n FROM notifications WHERE recipient_username=%s AND read=FALSE AND created_at >= NOW() - INTERVAL '1 hour'",
                (user["username"],)).fetchone()["n"]
            return {"notifications": [dict(r) for r in rows], "unread_count": unread}
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    _notifications[:] = [n for n in _notifications if n["recipient_username"] != user["username"] or (n.get("created_at") and datetime.fromisoformat(str(n["created_at"]).replace("Z", "+00:00")) >= cutoff)]
    rows = [dict(n) for n in _notifications if n["recipient_username"] == user["username"]][:100]
    return {"notifications": rows, "unread_count": sum(1 for n in rows if not n["read"])}


@app.delete("/api/notifications")
def clear_notifications(user: dict = Depends(_current_user)):
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("DELETE FROM notifications WHERE recipient_username=%s", (user["username"],))
    else:
        _notifications[:] = [n for n in _notifications if n["recipient_username"] != user["username"]]
    return {"cleared": True}


@app.post("/api/notifications/read")
def mark_notifications_read(user: dict = Depends(_current_user)):
    if _DATABASE_URL:
        with _db() as conn:
            conn.execute("UPDATE notifications SET read=TRUE WHERE recipient_username=%s AND read=FALSE", (user["username"],))
    else:
        for item in _notifications:
            if item["recipient_username"] == user["username"]: item["read"] = True
    return {"read": True}


@app.get("/api/account/safety")
def get_account_safety(user: dict = Depends(_current_user)):
    """Return account block and mute lists for account settings."""
    username = user["username"]
    if _DATABASE_URL:
        with _db() as conn:
            blocked_rows = conn.execute(
                "SELECT blocked_username FROM user_blocks WHERE blocker_username=%s ORDER BY created_at DESC",
                (username,)
            ).fetchall()
            muted_rows = conn.execute(
                "SELECT muted_username FROM user_mutes WHERE muter_username=%s ORDER BY created_at DESC",
                (username,)
            ).fetchall()
        blocked_users = [row["blocked_username"] for row in blocked_rows]
        muted_users = [row["muted_username"] for row in muted_rows]
    else:
        blocked_users = sorted(blocked for actor, blocked in _blocks if actor.lower() == username.lower())
        muted_users = sorted(muted for actor, muted in _mutes if actor.lower() == username.lower())
    return {"blocked_users": blocked_users, "muted_users": muted_users}

@app.post("/api/users/{username}/block")
def toggle_user_block(username: str, user: dict = Depends(_current_user)):
    target = _find_username(username)
    if not target: raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if target["username"].lower() == user["username"].lower(): raise HTTPException(status_code=400, detail="자기 자신은 차단할 수 없습니다.")
    actor, blocked = user["username"], target["username"]
    if _DATABASE_URL:
        with _db() as conn:
            exists = conn.execute("SELECT 1 FROM user_blocks WHERE blocker_username=%s AND blocked_username=%s", (actor, blocked)).fetchone()
            if exists:
                conn.execute("DELETE FROM user_blocks WHERE blocker_username=%s AND blocked_username=%s", (actor, blocked)); is_blocked = False
            else:
                conn.execute("INSERT INTO user_blocks(blocker_username,blocked_username) VALUES (%s,%s) ON CONFLICT DO NOTHING", (actor, blocked))
                conn.execute("DELETE FROM user_follows WHERE (follower_username=%s AND followed_username=%s) OR (follower_username=%s AND followed_username=%s)", (actor, blocked, blocked, actor))
                is_blocked = True
    else:
        key = (actor, blocked)
        if key in _blocks: _blocks.discard(key); is_blocked = False
        else:
            _blocks.add(key); _follows.discard((actor, blocked)); _follows.discard((blocked, actor)); is_blocked = True
    return {"blocked": is_blocked, "username": blocked}


@app.post("/api/users/{username}/mute")
def toggle_user_mute(username: str, user: dict = Depends(_current_user)):
    target = _find_username(username)
    if not target: raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if target["username"].lower() == user["username"].lower(): raise HTTPException(status_code=400, detail="자기 자신은 숨길 수 없습니다.")
    key = (user["username"], target["username"])
    if _DATABASE_URL:
        with _db() as conn:
            exists = conn.execute("SELECT 1 FROM user_mutes WHERE muter_username=%s AND muted_username=%s", key).fetchone()
            if exists: conn.execute("DELETE FROM user_mutes WHERE muter_username=%s AND muted_username=%s", key); muted = False
            else: conn.execute("INSERT INTO user_mutes(muter_username,muted_username) VALUES (%s,%s) ON CONFLICT DO NOTHING", key); muted = True
    else:
        if key in _mutes: _mutes.discard(key); muted = False
        else: _mutes.add(key); muted = True
    return {"muted": muted, "username": target["username"]}


@app.post("/api/reports", status_code=201)
def create_report(payload: ReportIn, user: dict = Depends(_current_user)):
    global _report_seq
    if payload.target_type == "user" and not _find_username(payload.target_id):
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if payload.target_type == "post":
        try: post_id = int(payload.target_id)
        except ValueError: raise HTTPException(status_code=422, detail="게시물 번호가 올바르지 않습니다.")
        if _DATABASE_URL:
            with _db() as conn:
                if not conn.execute("SELECT id FROM posts WHERE id=%s", (post_id,)).fetchone(): raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
                conn.execute("INSERT INTO content_reports(reporter_username,target_type,target_id,reason,details) VALUES (%s,%s,%s,%s,%s)",
                    (user["username"],payload.target_type,payload.target_id,payload.reason,payload.details))
        else:
            if post_id not in _posts: raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
            _report_seq += 1
            _reports.append({"id":_report_seq,"reporter_username":user["username"],"target_type":payload.target_type,"target_id":payload.target_id,"reason":payload.reason,"details":payload.details,"status":"open"})
    else:
        if _DATABASE_URL:
            with _db() as conn:
                conn.execute("INSERT INTO content_reports(reporter_username,target_type,target_id,reason,details) VALUES (%s,%s,%s,%s,%s)",
                    (user["username"],payload.target_type,payload.target_id,payload.reason,payload.details))
        else:
            _report_seq += 1
            _reports.append({"id":_report_seq,"reporter_username":user["username"],"target_type":payload.target_type,"target_id":payload.target_id,"reason":payload.reason,"details":payload.details,"status":"open"})
    if payload.target_type == "user":
        _maybe_alert_master_report_threshold(payload.target_id)
    return {"reported": True, "message": "신고가 접수되었습니다. 검토하겠습니다."}


@app.get("/api/admin/reports")
def list_admin_reports(
    status: str = Query(default="open", pattern=r"^(open|reviewed|dismissed|all)$"),
    user: dict = Depends(_current_user),
):
    if not _is_master(user):
        raise HTTPException(status_code=403, detail="마스터 계정만 신고를 관리할 수 있습니다.")
    if _DATABASE_URL:
        with _db() as conn:
            if status == "all":
                rows = conn.execute(
                    """SELECT id, reporter_username, target_type, target_id, reason, details, status, created_at
                       FROM content_reports ORDER BY created_at DESC LIMIT 500"""
                ).fetchall()
            else:
                rows = conn.execute(
                    """SELECT id, reporter_username, target_type, target_id, reason, details, status, created_at
                       FROM content_reports WHERE status=%s ORDER BY created_at DESC LIMIT 500""",
                    (status,),
                ).fetchall()
        reports = [dict(row) for row in rows]
    else:
        reports = [dict(item) for item in _reports if status == "all" or item.get("status", "open") == status]
        reports.sort(key=lambda item: item.get("id", 0), reverse=True)
        reports = reports[:500]
    return {"reports": reports}


@app.patch("/api/admin/reports/{report_id}")
def update_admin_report_status(report_id: int, payload: ReportStatusIn, user: dict = Depends(_current_user)):
    if not _is_master(user):
        raise HTTPException(status_code=403, detail="마스터 계정만 신고를 관리할 수 있습니다.")
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute(
                """UPDATE content_reports SET status=%s WHERE id=%s
                   RETURNING id, reporter_username, target_type, target_id, reason, details, status, created_at""",
                (payload.status, report_id),
            ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다.")
        report = dict(row)
    else:
        report = next((item for item in _reports if item["id"] == report_id), None)
        if not report:
            raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다.")
        report["status"] = payload.status
        report = dict(report)
    return {"report": report}


@app.patch("/api/posts/{post_id}")
def edit_post(post_id: int, payload: PostEditIn, user: dict = Depends(_current_user)):
    title, content = payload.title.strip(), payload.content.strip()
    if not title or not content: raise HTTPException(status_code=422, detail="제목과 내용을 입력해 주세요.")
    _validate_community_text(title, content)
    hashtags = []
    for item in payload.hashtags:
        tag = str(item).strip().lstrip("#")
        if tag and len(tag) <= 50 and tag not in hashtags: hashtags.append("#" + tag)
    hashtags = hashtags[:20]
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute("SELECT author_username FROM posts WHERE id=%s", (post_id,)).fetchone()
            if not row: raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
            if row["author_username"] != user["username"]: raise HTTPException(status_code=403, detail="본인이 작성한 게시물만 수정할 수 있습니다.")
            conn.execute("UPDATE posts SET title=%s,content=%s,hashtags=%s WHERE id=%s", (title,content,hashtags,post_id))
    else:
        post = _posts.get(post_id)
        if not post: raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
        if post["author_username"] != user["username"]: raise HTTPException(status_code=403, detail="본인이 작성한 게시물만 수정할 수 있습니다.")
        post.update({"title":title,"content":content,"hashtags":hashtags})
    return {"updated": True, "id": post_id, "title": title, "content": content, "hashtags": hashtags}


@app.get("/api/workout-records")
def list_workout_records(user: dict = Depends(_current_user)):
    if _DATABASE_URL:
        with _db() as conn:
            rows = conn.execute(
                "SELECT id, username, exercises, total_volume_kg, total_sets, total_reps, note, created_at FROM workout_analysis_sessions WHERE username=%s ORDER BY created_at DESC LIMIT 300",
                (user["username"],)
            ).fetchall()
        return {"records": [dict(row) for row in rows]}
    with _lock:
        records = [dict(item) for item in _workout_records.get(user["username"], [])]
    records.sort(key=lambda item: str(item.get("created_at", "")), reverse=True)
    return {"records": records[:300]}


@app.post("/api/workout-records", status_code=201)
def create_workout_record(payload: WorkoutRecordIn, user: dict = Depends(_current_user)):
    global _workout_record_seq
    exercises = []
    total_volume_kg = 0.0
    total_sets = 0
    total_reps = 0
    for item in payload.exercises:
        category = item.category.strip()
        exercise_name = item.exercise_name.strip()
        if not category or not exercise_name:
            raise HTTPException(status_code=422, detail="운동 카테고리와 종목을 선택해 주세요.")
        volume = round(item.weight_kg * item.sets * item.reps, 2)
        exercises.append({
            "category": category,
            "exercise_name": exercise_name,
            "weight_kg": item.weight_kg,
            "sets": item.sets,
            "reps": item.reps,
            "volume_kg": volume,
        })
        total_volume_kg += volume
        total_sets += item.sets
        total_reps += item.sets * item.reps
    total_volume_kg = round(total_volume_kg, 2)
    note = payload.note.strip()
    if _DATABASE_URL:
        with _db() as conn:
            row = conn.execute(
                """INSERT INTO workout_analysis_sessions(username, exercises, total_volume_kg, total_sets, total_reps, note)
                   VALUES (%s, %s::jsonb, %s, %s, %s, %s)
                   RETURNING id, username, exercises, total_volume_kg, total_sets, total_reps, note, created_at""",
                (user["username"], json.dumps(exercises, ensure_ascii=False), total_volume_kg, total_sets, total_reps, note)
            ).fetchone()
        return {"record": dict(row)}
    with _lock:
        _workout_record_seq += 1
        record = {
            "id": _workout_record_seq,
            "username": user["username"],
            "exercises": exercises,
            "total_volume_kg": total_volume_kg,
            "total_sets": total_sets,
            "total_reps": total_reps,
            "note": note,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _workout_records[user["username"]].insert(0, record)
    return {"record": record}


@app.delete("/api/workout-records/{record_id}")
def delete_workout_record(record_id: int, user: dict = Depends(_current_user)):
    if _DATABASE_URL:
        with _db() as conn:
            result = conn.execute(
                "DELETE FROM workout_analysis_sessions WHERE id=%s AND username=%s RETURNING id",
                (record_id, user["username"])
            ).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="운동 기록을 찾을 수 없습니다.")
    else:
        with _lock:
            records = _workout_records.get(user["username"], [])
            match = next((item for item in records if item["id"] == record_id), None)
            if not match:
                raise HTTPException(status_code=404, detail="운동 기록을 찾을 수 없습니다.")
            records.remove(match)
    return {"deleted": True, "id": record_id}

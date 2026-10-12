# FITNOVA backend

FastAPI authentication starter. Python 3.11+ recommended.

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Set `JWT_SECRET` to a long random secret before deployment. Configure `APP_ENV=production`, `SMTP_HOST`, `SMTP_PORT` (usually 587), `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `CORS_ORIGINS` to send real verification mail. Development mode prints the code to the server console only; the HTTP response never contains it.

**Prototype limitation:** user and verification data currently live in process memory, so restarts erase them and multiple workers are not safe. Replace this adapter with PostgreSQL and a shared rate limiter before public production launch. Use HTTPS and a managed secret store. Do not run multiple workers with this in-memory version.

Run tests from this directory with `pytest -q`.

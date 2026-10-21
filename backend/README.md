# FITNOVA backend

FastAPI API for FITNOVA. Python 3.11+ is recommended.

## Local development

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
``

Without `DATABASE_URL`, local development and automated tests use an in-memory adapter. That data disappears when the process restarts and is not suitable for public production. When `APP_ENV=production`, the API refuses to start without `DATABASE_URL` and `JWT_SECRET`.

## Required production configuration

Configure these values in the hosting provider's secret/environment settings, never in Git:

- `APP_ENV=production`
- `DATABASE_URL`: PostgreSQL connection string (use the provider's pooled URL only if supported by your database setup)
- `JWT_SECRET`: long, random secret used to sign sessions
- `VERIFICATION_CODE_SECRET`: separate long, random secret for one-time codes
- `CORS_ORIGINS`: comma-separated exact trusted origins
- `RESEND_API_KEY` and `RESEND_FROM`: preferred fast HTTPS email delivery. The sender address must be allowed by your Resend account (verify your own domain for production recipients).
- `GOOGLE_APPS_SCRIPT_URL` and `GOOGLE_APPS_SCRIPT_SECRET`: compatibility fallback when Resend is not configured.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: optional SMTP fallback when Apps Script is not configured.

For Android push notifications, configure `FIREBASE_SERVICE_ACCOUNT_JSON` on the API server and include the matching Firebase Android configuration in the built app. Push notifications will not work without both sides.

## Data and operational notes

- PostgreSQL-backed records persist when `DATABASE_URL` is configured; the in-memory adapter is for local tests only.
- The API creates/updates its required tables during startup. Keep regular database backups and verify restore procedures before launch.
- Rate-limit counters are process-local. For multiple server workers or higher traffic, replace them with a shared limiter (for example, Redis).
- Account deletion is scheduled with a 30-day grace period; verify the live database cleanup and retention behavior before public release.
- Never commit production secrets, Firebase service-account files, or real user data.

## Tests

Run from this directory:

```bash
pytest -q
``

The GitHub Actions workflow also builds the frontend and Android debug target. A successful debug build is not a signed Google Play release bundle.

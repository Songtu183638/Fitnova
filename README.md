# FITNOVA

FITNOVA is a Korean-first, fitness-focused social network for web and Android. It uses a dark interface with lime accents and combines workout logging with social features.

## Features currently implemented

- Email sign-up with one-time verification, email-code login, password reset, password change, and email change
- Social feed with photo/video posts, workout details, hashtags, pagination, likes, comments, post editing/deletion, and saved posts
- Member profiles, follow/unfollow, follower/following lists, profile privacy, and activity/workout-detail visibility controls
- Direct messages, read receipts, unread counts, notifications, and optional Android push notifications
- Search across members, captions, and hashtags
- Safety tools: report content/accounts, block accounts, hide/mute accounts, and a Settings screen to review/unblock/unhide them
- Workout records and an Android step-counter module (requires a supported Android device and permissions)
- Account settings, security changes, logout, and account deletion with a 30-day grace period
- Moderation tools for the designated administrator account

Some platform features require external configuration. In particular, Android push notifications need Firebase client configuration in the app and Firebase Admin credentials on the API server.

## Architecture

- `frontend/`: Vite + React web client and Capacitor Android project
- `backend/`: FastAPI API
- PostgreSQL is used when `DATABASE_URL` is configured. The in-memory adapter is for local tests only; production startup requires a database URL and `JWT_SECRET`.
- The web client is deployed on Vercel; the API is intended to run on a separate HTTPS host.

## Local development

See `frontend/README.md` and `backend/README.md`. Never commit production environment files, API secrets, Firebase service-account JSON, or real user data.

## Verification

GitHub Actions runs backend tests, builds the frontend, syncs Capacitor, and attempts an Android debug build. A passing CI run is necessary but does not replace production-backend checks, real-device testing, a signed Google Play App Bundle, or legal/policy review. See [RELEASE_READINESS.md](./RELEASE_READINESS.md) before public release.

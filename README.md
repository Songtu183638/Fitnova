# FITNOVA

FITNOVA is a fitness-focused social network for web and Android, built around a black and neon-green interface.

## Initial scope
- Username/email login and email verification with a six-digit one-time code
- Extensible FastAPI backend and responsive web client
- Capacitor Android shell sharing the web client
- Planned modules: photo feed, Reels, DMs, step tracking, profiles, follows, and privacy controls

## Repository layout
- `frontend/`: Vite + React web application and Capacitor Android configuration
- `backend/`: FastAPI authentication API

## Development
See `backend/README.md` and `frontend/README.md`. Real email verification requires SMTP environment variables; the API never returns the verification code in production.

"""Stable ASGI entry point for Render and other production hosts.

Use `uvicorn app.start:app --host 0.0.0.0 --port $PORT` with the backend
folder as the service root. Importing the canonical app keeps every route,
including `/api/auth/login` and `/api/auth/login/verify`, registered exactly
once and avoids maintaining a second application instance.
"""

from app.main import app

__all__ = ["app"]

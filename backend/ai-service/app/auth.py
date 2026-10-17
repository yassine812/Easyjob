"""Authentication for the AI service.

The AI service is an internal component: only the NestJS backend should call it
(the frontend never talks to it directly). When the ``AI_API_KEY`` environment
variable is set, every /ai endpoint requires ``Authorization: Bearer <key>``,
matched in constant time. When no key is configured (local dev / tests), the
service stays open — mirroring the backend's behaviour where the key is optional.
"""

import hmac
import os

from fastapi import Header, HTTPException, status

__all__ = ["require_api_key"]


def require_api_key(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("AI_API_KEY", "")
    if not expected:
        return  # key auth not configured — open (dev/tests)
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key",
        )
    provided = authorization.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

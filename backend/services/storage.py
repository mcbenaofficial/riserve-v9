"""
StorageService — local-first media storage for social posts.
Swap out upload/delete/public_url for S3/R2 without touching any caller.
"""
from __future__ import annotations

import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_BASE = Path(__file__).parent.parent / "uploads" / "media"
_PUBLIC_BASE = os.environ.get("PUBLIC_BACKEND_URL", "http://localhost:8000")


class StorageService:
    """Stores files under uploads/media/, served by FastAPI at /uploads/media/..."""

    @staticmethod
    def storage_path(tenant_id: str, asset_id: str, filename: str) -> str:
        return f"{tenant_id}/{asset_id}/{filename}"

    @classmethod
    def _abs(cls, storage_path: str) -> Path:
        return _BASE / storage_path

    @classmethod
    def upload(cls, data: bytes, storage_path: str) -> None:
        dest = cls._abs(storage_path)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        logger.info(f"StorageService: wrote {len(data):,} bytes → {dest}")

    @classmethod
    def delete(cls, storage_path: str) -> None:
        dest = cls._abs(storage_path)
        if not dest.exists():
            return
        dest.unlink()
        try:
            dest.parent.rmdir()
            dest.parent.parent.rmdir()
        except OSError:
            pass
        logger.info(f"StorageService: deleted {dest}")

    @staticmethod
    def public_url(storage_path: str) -> str:
        return f"{_PUBLIC_BASE}/uploads/media/{storage_path}"

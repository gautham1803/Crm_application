"""Storage provider — Supabase storage wrapper."""

from __future__ import annotations

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageProvider:
    """Supabase storage wrapper."""

    async def upload_file(
        self,
        file_path: str,
        file_content: bytes,
        content_type: str = "application/octet-stream",
    ) -> str | None:
        """Upload file and return public URL."""
        if not settings.supabase_url or not settings.supabase_service_key.get_secret_value():
            logger.warning("Supabase not configured, skipping upload")
            return None

        try:
            from supabase import create_client

            client = create_client(
                settings.supabase_url,
                settings.supabase_service_key.get_secret_value(),
            )
            bucket = client.storage.from_(settings.supabase_storage_bucket)
            bucket.upload(file_path, file_content, {"content-type": content_type})

            return f"{settings.supabase_url}/storage/v1/object/public/{settings.supabase_storage_bucket}/{file_path}"
        except Exception as e:
            logger.error(f"Storage upload error: {e}")
            return None

    async def get_signed_url(self, file_path: str, expires_in: int = 3600) -> str | None:
        """Get a signed URL for private file access."""
        if not settings.supabase_url:
            return None

        try:
            from supabase import create_client

            client = create_client(
                settings.supabase_url,
                settings.supabase_service_key.get_secret_value(),
            )
            bucket = client.storage.from_(settings.supabase_storage_bucket)
            result = bucket.create_signed_url(file_path, expires_in)
            return result.get("signedURL")
        except Exception as e:
            logger.error(f"Storage signed URL error: {e}")
            return None

from __future__ import annotations

import logging
import os
from typing import Any

from atlas_etl.utils import setup_logging

logger = logging.getLogger(__name__)


class SupabaseService:
    """Cliente service_role — SOMENTE backend / GitHub Actions."""

    def __init__(self, url: str | None = None, key: str | None = None) -> None:
        setup_logging(os.getenv("LOG_LEVEL", "INFO"))
        self.url = url or os.environ.get("SUPABASE_URL") or ""
        self.key = key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
        if not self.url or not self.key:
            self.client = None
            logger.warning("Supabase não configurado — modo offline")
            return
        if self.key.startswith("eyJ") is False and "service" not in self.key.lower():
            # não validamos formato rigidamente; apenas alertamos
            logger.info("Usando chave Supabase do ambiente (não logar o valor)")
        from supabase import create_client

        self.client = create_client(self.url, self.key)

    def ensure(self) -> Any:
        if not self.client:
            raise RuntimeError("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios")
        return self.client

    def fetch_queued_jobs(self, limit: int = 5) -> list[dict[str, Any]]:
        client = self.ensure()
        res = (
            client.table("ingestion_jobs")
            .select("*")
            .eq("status", "queued")
            .order("created_at")
            .limit(limit)
            .execute()
        )
        return list(res.data or [])

    def update_job(self, job_id: str, **fields: Any) -> None:
        if not self.client:
            logger.info("offline update_job %s %s", job_id, list(fields.keys()))
            return
        client = self.ensure()
        client.table("ingestion_jobs").update(fields).eq("id", job_id).execute()

    def log(
        self,
        job_id: str,
        message: str,
        *,
        level: str = "info",
        step: str | None = None,
        context: dict | None = None,
    ) -> None:
        if not self.client:
            logger.log(
                getattr(logging, level.upper(), logging.INFO),
                "[%s] %s %s",
                job_id,
                step or "",
                message,
            )
            return
        self.client.table("ingestion_job_logs").insert(
            {
                "job_id": job_id,
                "level": level,
                "step": step,
                "message": message,
                "context": context or {},
            }
        ).execute()

    def upsert_sync_state(self, source_code: str, state_uf: str, **fields: Any) -> None:
        if not self.client:
            return
        client = self.ensure()
        payload = {"source_code": source_code, "state_uf": state_uf or "--", **fields}
        client.table("sync_states").upsert(payload).execute()

    def find_source_file_by_hash(self, file_hash: str) -> dict | None:
        if not self.client:
            return None
        client = self.ensure()
        res = (
            client.table("source_files")
            .select("*")
            .eq("file_hash", file_hash)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None

    def insert_source_file(self, payload: dict[str, Any]) -> dict:
        if not self.client:
            return payload
        client = self.ensure()
        res = client.table("source_files").insert(payload).execute()
        return (res.data or [payload])[0]

    def insert_normalized(self, rows: list[dict[str, Any]]) -> None:
        if not rows or not self.client:
            return
        client = self.ensure()
        chunk = 200
        for i in range(0, len(rows), chunk):
            client.table("normalized_records").insert(rows[i : i + chunk]).execute()

    def insert_matching(self, rows: list[dict[str, Any]]) -> None:
        if not rows or not self.client:
            return
        client = self.ensure()
        client.table("matching_results").insert(rows).execute()

    def get_active_overrides(self, entity_type: str, entity_id: str) -> list[dict]:
        if not self.client:
            return []
        client = self.ensure()
        res = (
            client.table("manual_field_overrides")
            .select("*")
            .eq("entity_type", entity_type)
            .eq("entity_id", entity_id)
            .eq("is_active", True)
            .execute()
        )
        return list(res.data or [])

    def write_audit(
        self,
        action: str,
        entity_type: str,
        entity_id: str | None = None,
        after: dict | None = None,
        metadata: dict | None = None,
    ) -> None:
        if not self.client:
            return
        try:
            self.client.rpc(
                "write_audit_log",
                {
                    "p_action": action,
                    "p_entity_type": entity_type,
                    "p_entity_id": entity_id,
                    "p_before": None,
                    "p_after": after,
                    "p_metadata": metadata,
                },
            ).execute()
        except Exception as exc:
            logger.warning("audit rpc falhou: %s", type(exc).__name__)


class StorageService:
    def __init__(self, supabase: SupabaseService, bucket: str = "imports") -> None:
        self.supabase = supabase
        self.bucket = bucket

    def upload(self, local_path: str, storage_path: str) -> str:
        client = self.supabase.ensure()
        with open(local_path, "rb") as fh:
            client.storage.from_(self.bucket).upload(
                storage_path,
                fh,
                file_options={"content-type": "application/octet-stream", "upsert": "true"},
            )
        return storage_path

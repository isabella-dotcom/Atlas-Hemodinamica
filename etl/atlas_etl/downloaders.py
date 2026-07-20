from __future__ import annotations

import logging
from pathlib import Path

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from atlas_etl.utils import sha256_file

logger = logging.getLogger(__name__)


class HttpDownloader:
    def __init__(self, timeout: float = 120.0, max_retries: int = 3) -> None:
        self.timeout = timeout
        self.max_retries = max_retries

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
    def download(self, url: str, dest: Path) -> dict:
        dest.parent.mkdir(parents=True, exist_ok=True)
        logger.info("Downloading %s -> %s", url, dest)
        with httpx.stream("GET", url, timeout=self.timeout, follow_redirects=True) as resp:
            resp.raise_for_status()
            size = 0
            with dest.open("wb") as fh:
                for chunk in resp.iter_bytes():
                    fh.write(chunk)
                    size += len(chunk)
        digest = sha256_file(dest)
        return {
            "path": str(dest),
            "size": size,
            "sha256": digest,
            "url": url,
            "content_type": resp.headers.get("content-type"),
        }


class ResumableDownloader(HttpDownloader):
    """Download com suporte a Range quando o servidor permitir."""

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
    def download(self, url: str, dest: Path) -> dict:
        dest.parent.mkdir(parents=True, exist_ok=True)
        existing = dest.stat().st_size if dest.exists() else 0
        headers = {}
        mode = "wb"
        if existing > 0:
            headers["Range"] = f"bytes={existing}-"
            mode = "ab"
            logger.info("Resuming %s from byte %s", url, existing)

        with httpx.stream(
            "GET", url, timeout=self.timeout, follow_redirects=True, headers=headers
        ) as resp:
            if resp.status_code == 416:
                digest = sha256_file(dest)
                return {
                    "path": str(dest),
                    "size": existing,
                    "sha256": digest,
                    "url": url,
                    "resumed": True,
                }
            if existing and resp.status_code not in (206, 200):
                # servidor não suporta resume — recomeça
                mode = "wb"
                existing = 0
            resp.raise_for_status()
            size = existing
            with dest.open(mode) as fh:
                for chunk in resp.iter_bytes():
                    fh.write(chunk)
                    size += len(chunk)
        digest = sha256_file(dest)
        return {
            "path": str(dest),
            "size": size,
            "sha256": digest,
            "url": url,
            "resumed": existing > 0,
            "content_type": resp.headers.get("content-type"),
        }

from __future__ import annotations

import hashlib
import logging
import re
import unicodedata
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger("atlas_etl")


def setup_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


def project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def load_yaml(name: str) -> dict[str, Any]:
    path = project_root() / "config" / name
    with path.open(encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    if not isinstance(data, dict):
        raise ValueError(f"YAML inválido: {name}")
    return data


def normalize_person_name(value: str) -> str:
    text = unicodedata.normalize("NFKD", value or "")
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.upper().strip()
    text = re.sub(r"[^A-Z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_crm(value: str) -> str:
    """Preserva zeros à esquerda — apenas dígitos."""
    return re.sub(r"\D", "", value or "")


def normalize_uf(value: str) -> str:
    return (value or "").strip().upper()[:2]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

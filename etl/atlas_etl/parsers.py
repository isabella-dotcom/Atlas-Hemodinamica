from __future__ import annotations

import csv
import io
import zipfile
from pathlib import Path
from typing import Any, Iterator


def parse_csv_bytes(data: bytes, encoding: str = "utf-8") -> list[dict[str, str]]:
    text = data.decode(encoding, errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    return [{k: (v or "").strip() for k, v in row.items() if k} for row in reader]


def parse_csv_file(path: Path, encoding: str = "utf-8") -> list[dict[str, str]]:
    return parse_csv_bytes(path.read_bytes(), encoding=encoding)


def iter_zip_members(path: Path) -> Iterator[tuple[str, bytes]]:
    with zipfile.ZipFile(path, "r") as zf:
        for name in zf.namelist():
            if name.endswith("/"):
                continue
            yield name, zf.read(name)


def parse_zip_csv(path: Path) -> dict[str, list[dict[str, str]]]:
    out: dict[str, list[dict[str, str]]] = {}
    for name, data in iter_zip_members(path):
        lower = name.lower()
        if lower.endswith(".csv") or lower.endswith(".txt"):
            try:
                out[name] = parse_csv_bytes(data)
            except Exception:
                out[name] = parse_csv_bytes(data, encoding="latin-1")
    return out


def parse_dbf(path: Path) -> list[dict[str, Any]]:
    """Parse DBF via dbfread se disponível; senão levanta erro explícito."""
    try:
        from dbfread import DBF
    except ImportError as exc:
        raise RuntimeError(
            "dbfread não instalado — necessário para arquivos DBF do CNES"
        ) from exc
    table = DBF(str(path), encoding="latin-1", ignore_missing_memofile=True)
    return [dict(rec) for rec in table]


def parse_dbc(path: Path, dest_dbf: Path | None = None) -> list[dict[str, Any]]:
    """
    DBC (DATASUS) — tenta pyreaddbc / dbfread.
    Se não suportado no ambiente, registra erro explícito (não silencioso).
    """
    try:
        import pyreaddbc  # type: ignore
    except ImportError:
        raise RuntimeError(
            "DBC não suportado neste ambiente (instale pyreaddbc). "
            "Use CSV/DBF equivalentes ou converta previamente."
        )
    out = dest_dbf or path.with_suffix(".dbf")
    pyreaddbc.dbc2dbf(str(path), str(out))
    return parse_dbf(out)


def parse_fixed_width(
    text: str, columns: list[tuple[str, int, int]]
) -> list[dict[str, str]]:
    """columns: (name, start, end) 0-based half-open."""
    rows = []
    for line in text.splitlines():
        if not line.strip():
            continue
        row = {}
        for name, start, end in columns:
            row[name] = line[start:end].strip()
        rows.append(row)
    return rows

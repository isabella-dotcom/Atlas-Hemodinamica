from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin

from atlas_etl.discovery.source_catalog import SourceCatalog, SourceDefinition


@dataclass
class DiscoveredFile:
    source_code: str
    modality: str
    url: str
    filename: str
    competence: str | None
    state_uf: str | None
    year: int | None = None
    month: int | None = None
    metadata: dict[str, Any] | None = None


_COMPETENCE_RE = re.compile(r"(20\d{2})[-_]?(\d{2})")
_UF_RE = re.compile(r"(?:^|[^A-Z])([A-Z]{2})(?:[^A-Z]|$)")


def parse_competence(text: str) -> tuple[str | None, int | None, int | None]:
    m = _COMPETENCE_RE.search(text or "")
    if not m:
        return None, None, None
    year, month = int(m.group(1)), int(m.group(2))
    if month < 1 or month > 12:
        return None, None, None
    return f"{year:04d}-{month:02d}", year, month


def discover_cnes_files(
    state_uf: str,
    competence: str | None = None,
    modalities: list[str] | None = None,
    fallback_url: str | None = None,
    catalog: SourceCatalog | None = None,
) -> list[DiscoveredFile]:
    """
    Descobre arquivos CNES a partir do catálogo.

    Em produção, o worker tenta listar o FTP/portal. Se falhar, usa
    ``fallback_url`` oficial informada pelo usuário.
    """
    catalog = catalog or SourceCatalog()
    source = catalog.get("CNES")
    if not source or not source.enabled:
        raise ValueError("Fonte CNES desabilitada ou ausente no catálogo")

    uf = state_uf.upper()
    if source.allowed_states and uf not in source.allowed_states:
        raise ValueError(f"UF {uf} não permitida para CNES")

    wanted = {m.upper() for m in (modalities or [])} if modalities else None
    results: list[DiscoveredFile] = []

    if fallback_url:
        filename = fallback_url.rstrip("/").split("/")[-1] or "cnes_fallback.zip"
        comp, year, month = parse_competence(fallback_url + " " + (competence or ""))
        results.append(
            DiscoveredFile(
                source_code="CNES",
                modality="FALLBACK",
                url=fallback_url,
                filename=filename,
                competence=comp or competence,
                state_uf=uf,
                year=year,
                month=month,
                metadata={"via": "user_fallback"},
            )
        )
        return results

    # URLs candidatas oficiais (prefixos do catálogo) — sem scraping de HTML.
    base = source.base_url or source.ftp_base or ""
    for modality in source.modalities:
        code = str(modality.get("code", "")).upper()
        if wanted and code not in wanted:
            continue
        prefix = modality.get("file_prefix") or code
        # Padrão documentado DATASUS: competência AAAAMM no nome
        comp = competence or ""
        yymm = comp.replace("-", "") if comp else ""
        candidates = []
        if yymm:
            candidates.append(f"{prefix}{yymm}.zip")
            candidates.append(f"{prefix}_{uf}_{yymm}.zip")
        candidates.append(f"{prefix}.zip")
        for name in candidates:
            url = urljoin(base if base.endswith("/") else base + "/", name)
            comp_p, year, month = parse_competence(name + " " + (competence or ""))
            results.append(
                DiscoveredFile(
                    source_code="CNES",
                    modality=code,
                    url=url,
                    filename=name,
                    competence=comp_p or competence,
                    state_uf=uf,
                    year=year,
                    month=month,
                    metadata={"prefix": prefix, "constructed": True},
                )
            )
    return results


def filter_by_competence(
    files: list[DiscoveredFile], competence: str
) -> list[DiscoveredFile]:
    return [f for f in files if not f.competence or f.competence == competence]

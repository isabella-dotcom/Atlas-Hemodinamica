from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from atlas_etl.utils import load_yaml, project_root


@dataclass
class SourceDefinition:
    code: str
    name: str
    organization: str
    base_url: str
    discovery_url: str
    source_type: str
    enabled: bool
    update_frequency: str
    allowed_states: list[str] = field(default_factory=list)
    expected_formats: list[str] = field(default_factory=list)
    notes: str = ""
    modalities: list[dict[str, Any]] = field(default_factory=list)
    ftp_base: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


class SourceCatalog:
    def __init__(self, path: Path | None = None) -> None:
        cfg_path = path or (project_root() / "config" / "sources.yaml")
        data = load_yaml(cfg_path.name) if path is None else _load(cfg_path)
        self._sources = [
            SourceDefinition(
                code=s["code"],
                name=s["name"],
                organization=s.get("organization", ""),
                base_url=s.get("base_url", ""),
                discovery_url=s.get("discovery_url", ""),
                source_type=s.get("source_type", ""),
                enabled=bool(s.get("enabled", False)),
                update_frequency=s.get("update_frequency", ""),
                allowed_states=list(s.get("allowed_states") or []),
                expected_formats=list(s.get("expected_formats") or []),
                notes=s.get("notes") or "",
                modalities=list(s.get("modalities") or []),
                ftp_base=s.get("ftp_base"),
                raw=s,
            )
            for s in data.get("sources", [])
        ]

    def list_enabled(self) -> list[SourceDefinition]:
        return [s for s in self._sources if s.enabled]

    def get(self, code: str) -> SourceDefinition | None:
        code_u = code.upper()
        for s in self._sources:
            if s.code.upper() == code_u:
                return s
        return None

    def all(self) -> list[SourceDefinition]:
        return list(self._sources)


def _load(path: Path) -> dict[str, Any]:
    import yaml

    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}

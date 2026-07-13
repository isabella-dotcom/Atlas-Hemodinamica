"""
ETL do Atlas da Hemodinâmica
-----------------------------
Fluxo obrigatório:
  arquivo → raw_records (bruto) → normalização → candidatos → fila de validação

Nunca inserir diretamente na camada oficial.
Não contornar CAPTCHA, autenticação ou bloqueios de sites.
"""

from __future__ import annotations

import argparse
import re
import unicodedata
from pathlib import Path

import pandas as pd


UF_RE = re.compile(r"^[A-Za-z]{2}$")


def normalize_name(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.casefold()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def load_tabular(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix in {".csv", ".txt"}:
        return pd.read_csv(path, sep=None, engine="python", dtype=str)
    if suffix in {".xlsx", ".xls"}:
        return pd.read_excel(path, dtype=str)
    raise ValueError(f"Formato não suportado neste MVP: {suffix}")


def preview(path: Path, limit: int = 20) -> None:
    df = load_tabular(path).fillna("")
    print(f"Arquivo: {path.name}")
    print(f"Linhas: {len(df)} | Colunas: {list(df.columns)}")
    print(df.head(limit).to_string(index=False))


def validate_candidate_row(row: dict) -> list[str]:
    errors: list[str] = []
    if not str(row.get("full_name", "")).strip():
        errors.append("full_name obrigatório")
    crm = str(row.get("crm_number", "")).strip()
    uf = str(row.get("crm_uf", "")).strip().upper()
    if crm and not UF_RE.match(uf):
        errors.append("CRM exige UF válida")
    return errors


def to_candidate_records(df: pd.DataFrame) -> list[dict]:
    """Converte linhas normalizadas em candidatos (ainda não oficiais)."""
    records: list[dict] = []
    for _, row in df.iterrows():
        payload = {k: str(v).strip() for k, v in row.to_dict().items()}
        errors = validate_candidate_row(payload)
        records.append(
            {
                "layer": "candidato",
                "classification": "possivel_candidato",
                "full_name": payload.get("full_name", ""),
                "normalized_name": normalize_name(payload.get("full_name", "")),
                "crm_number": payload.get("crm_number") or None,
                "crm_uf": (payload.get("crm_uf") or "").upper() or None,
                "facility_name": payload.get("facility_name") or None,
                "city": payload.get("city") or None,
                "state_uf": (payload.get("state_uf") or "MG").upper(),
                "validation_errors": errors,
                "auto_approved": False,
            }
        )
    return records


def main() -> None:
    parser = argparse.ArgumentParser(description="ETL Atlas da Hemodinâmica")
    parser.add_argument("file", type=Path, help="CSV/TXT/Excel de entrada")
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Apenas mostra prévia do arquivo bruto",
    )
    args = parser.parse_args()

    if args.preview:
        preview(args.file)
        return

    df = load_tabular(args.file).fillna("")
    candidates = to_candidate_records(df)
    valid = [c for c in candidates if not c["validation_errors"]]
    invalid = [c for c in candidates if c["validation_errors"]]

    print(f"Candidatos válidos para revisão: {len(valid)}")
    print(f"Linhas com erro de validação: {len(invalid)}")
    print("Nenhum registro foi promovido à base oficial.")


if __name__ == "__main__":
    main()

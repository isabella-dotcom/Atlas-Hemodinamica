from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from atlas_etl.classifiers import HemodynamicsClassifier
from atlas_etl.discovery import SourceCatalog, discover_cnes_files, parse_competence
from atlas_etl.matchers import detect_crm_duplicates, match_doctor, match_facility
from atlas_etl.models import NormalizedDoctor, NormalizedFacility
from atlas_etl.normalizers import doctors_from_rows, facilities_from_rows, normalize_doctor_row
from atlas_etl.parsers import parse_csv_file, parse_fixed_width, parse_zip_csv
from atlas_etl.pipeline import IngestionPipeline
from atlas_etl.services import SupabaseService
from atlas_etl.utils import normalize_crm, sha256_bytes, sha256_file

FIXTURES = Path(__file__).parent / "fixtures"


def test_source_catalog_cnes_enabled():
    cat = SourceCatalog()
    cnes = cat.get("CNES")
    assert cnes is not None
    assert cnes.enabled
    sia = cat.get("SIA_SUS")
    assert sia is not None
    assert sia.enabled is False


def test_discover_cnes_with_fallback():
    files = discover_cnes_files(
        "MG",
        competence="2026-06",
        fallback_url="https://ftp.datasus.gov.br/cnes/demo_2026_06.zip",
    )
    assert len(files) == 1
    assert files[0].state_uf == "MG"
    assert files[0].modality == "FALLBACK"


def test_discover_constructs_official_urls():
    files = discover_cnes_files("MG", competence="2026-06", modalities=["ESTABELECIMENTOS"])
    assert files
    assert all(f.source_code == "CNES" for f in files)


def test_parse_competence():
    c, y, m = parse_competence("arquivo_202606.zip")
    assert c == "2026-06"
    assert y == 2026 and m == 6


def test_sha256_and_csv_parse():
    path = FIXTURES / "facilities_ficticias.csv"
    digest = sha256_file(path)
    assert len(digest) == 64
    rows = parse_csv_file(path)
    assert len(rows) == 2
    assert rows[0]["CO_CNES"] == "9999001"


def test_normalize_facilities_and_doctors():
    fac = facilities_from_rows(parse_csv_file(FIXTURES / "facilities_ficticias.csv"))
    assert fac[0].cnes_code == "9999001"
    assert fac[0].state_uf == "MG"
    docs = doctors_from_rows(parse_csv_file(FIXTURES / "professionals_ficticios.csv"))
    assert docs[0].crm_number == "090001"
    assert normalize_crm("090001") == "090001"


def test_crm_uf_matching_and_no_name_merge():
    doc = normalize_doctor_row(
        {"NOMEPROF": "Ana", "CRM": "123", "UF_CRM": "MG", "COD_PROF": "1"}
    )
    m = match_doctor(doc, {"123|MG": "uuid-1"}, {"ANA": ["uuid-2"]})
    assert m.match_type == "exato"
    m2 = match_doctor(doc, {}, {"ANA": ["uuid-2"]})
    assert m2.requires_review is True
    assert m2.match_type == "provavel"


def test_facility_cnes_match():
    fac = NormalizedFacility(
        cnes_code="9999001",
        legal_name="Hosp",
        source_code="CNES",
    )
    m = match_facility(fac, {"9999001": "fid"}, {})
    assert m.match_type == "exato"


def test_duplicate_crm_detection():
    dups = detect_crm_duplicates([("090001", "MG"), ("090001", "MG"), ("1", "SP")])
    assert "090001|MG" in dups


def test_hemodynamics_score_explainable():
    clf = HemodynamicsClassifier()
    score = clf.score_facility(
        cbo_codes=["225120"],
        sector_name="Serviço de Hemodinâmica",
        facility_type="Hospital",
        doctor_count=2,
    )
    assert score.total > 0
    assert score.parts
    assert score.classification in ("possivel_candidato", "atuacao_provavel")
    assert score.classification != "especialista_confirmado"


def test_pipeline_fixture_never_golden(tmp_path):
    pipeline = IngestionPipeline(SupabaseService(url="", key=""))
    pipeline.db.client = None
    job = {
        "id": "00000000-0000-0000-0000-000000000099",
        "job_type": "ingest_cnes",
        "source_code": "CNES",
        "state_uf": "MG",
        "competence": "2026-06",
        "parameters": {
            "local_fixture": str(FIXTURES / "facilities_ficticias.csv"),
            "entity": "facilities",
            "generate_candidates": False,
            "include_all_facilities": True,
        },
    }
    out = pipeline.process_job(job, tmp_path)
    assert out["status"] == "completed"
    assert out["metrics"]["facilities"] == 2
    # sem client = sem insert; garantia de não GOLDEN está no código layer=candidato


def test_zip_and_fixed_width(tmp_path):
    import zipfile

    csv_path = FIXTURES / "facilities_ficticias.csv"
    zpath = tmp_path / "demo.zip"
    with zipfile.ZipFile(zpath, "w") as zf:
        zf.write(csv_path, arcname="tbEstabelecimento.csv")
    parsed = parse_zip_csv(zpath)
    assert any(len(v) == 2 for v in parsed.values())
    rows = parse_fixed_width("ABC123\n", [("a", 0, 3), ("b", 3, 6)])
    assert rows[0]["a"] == "ABC"


def test_sha256_bytes_idempotent():
    assert sha256_bytes(b"abc") == hashlib.sha256(b"abc").hexdigest()


def test_doctor_without_crm_still_normalizes():
    doc = normalize_doctor_row({"NOMEPROF": "Sem CRM", "COD_PROF": "X"})
    assert doc.full_name == "Sem CRM"
    assert doc.crm_number is None

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from atlas_etl.classifiers import HemodynamicsClassifier
from atlas_etl.discovery import SourceCatalog, discover_cnes_files
from atlas_etl.downloaders import ResumableDownloader
from atlas_etl.matchers import match_doctor, match_facility
from atlas_etl.models import NormalizedDoctor, NormalizedFacility
from atlas_etl.normalizers import doctors_from_rows, facilities_from_rows
from atlas_etl.parsers import parse_csv_file, parse_zip_csv
from atlas_etl.services import StorageService, SupabaseService
from atlas_etl.utils import normalize_crm, normalize_person_name, normalize_uf, sha256_file

logger = logging.getLogger(__name__)


class IngestionPipeline:
    """
    FONTES → DOWNLOAD → RAW/normalized → MATCHING → CANDIDATOS → review_queue.
    Nunca promove para GOLDEN/oficial.
    """

    def __init__(self, supabase: SupabaseService | None = None) -> None:
        self.db = supabase or SupabaseService()
        self.storage = StorageService(self.db)
        self.downloader = ResumableDownloader()
        self.classifier = HemodynamicsClassifier()
        self.catalog = SourceCatalog()

    def process_job(self, job: dict[str, Any], workdir: Path) -> dict[str, Any]:
        job_id = job["id"]
        params = job.get("parameters") or {}
        state_uf = (job.get("state_uf") or params.get("state_uf") or "MG").upper()
        competence = job.get("competence") or params.get("competence")
        job_type = job.get("job_type") or "ingest_cnes"
        metrics: dict[str, Any] = {
            "facilities": 0,
            "doctors": 0,
            "candidates": 0,
            "matches": 0,
            "errors": 0,
        }

        try:
            if self._is_cancelled(job_id):
                return {"status": "cancelled", "metrics": metrics}

            self.db.update_job(
                job_id,
                status="discovering",
                current_step="discover",
                progress_percentage=5,
                started_at=datetime.now(timezone.utc).isoformat(),
            )
            self.db.log(job_id, "Iniciando descoberta de arquivos", step="discover")

            files = discover_cnes_files(
                state_uf=state_uf,
                competence=competence,
                modalities=params.get("modalities"),
                fallback_url=params.get("fallback_url"),
                catalog=self.catalog,
            )
            if params.get("discover_only"):
                self.db.update_job(
                    job_id,
                    status="completed",
                    current_step="discover_only",
                    progress_percentage=100,
                    finished_at=datetime.now(timezone.utc).isoformat(),
                    metrics={**metrics, "discovered": len(files)},
                )
                self.db.log(
                    job_id,
                    f"Descobertos {len(files)} arquivos (somente descoberta)",
                    step="discover",
                    context={"files": [f.filename for f in files[:20]]},
                )
                return {"status": "completed", "metrics": metrics, "files": files}

            local_csv = params.get("local_fixture")
            if local_csv:
                # Modo teste/offline com fixture fictícia
                path = Path(local_csv)
                return self._process_local_fixture(
                    job_id, path, state_uf, competence, metrics, params
                )

            if not files:
                raise RuntimeError("Nenhum arquivo descoberto — informe fallback_url oficial")

            # Download do primeiro arquivo utilizável (ou todos se download_all)
            targets = files if params.get("download_all") else files[:1]
            self.db.update_job(
                job_id, status="downloading", current_step="download", progress_percentage=15
            )

            for discovered in targets:
                if self._is_cancelled(job_id):
                    return {"status": "cancelled", "metrics": metrics}
                dest = (
                    workdir
                    / "cnes"
                    / state_uf
                    / (discovered.competence or "unknown")
                    / discovered.filename
                )
                try:
                    info = self.downloader.download(discovered.url, dest)
                except Exception as exc:
                    self.db.log(
                        job_id,
                        f"Falha download {discovered.url}: {exc}",
                        level="warning",
                        step="download",
                    )
                    metrics["errors"] += 1
                    continue

                existing = None
                if self.db.client:
                    existing = self.db.find_source_file_by_hash(info["sha256"])
                if existing and not params.get("force"):
                    self.db.log(
                        job_id,
                        f"Arquivo duplicado (hash) — skip {discovered.filename}",
                        step="download",
                    )
                    continue

                storage_path = (
                    f"cnes/{state_uf}/{discovered.competence or 'unknown'}/{discovered.filename}"
                )
                if self.db.client:
                    try:
                        self.storage.upload(str(dest), storage_path)
                    except Exception as exc:
                        self.db.log(
                            job_id,
                            f"Upload storage falhou: {type(exc).__name__}",
                            level="warning",
                            step="storage",
                        )

                    self.db.insert_source_file(
                        {
                            "source_code": "CNES",
                            "source_url": discovered.url,
                            "original_filename": discovered.filename,
                            "storage_path": storage_path,
                            "file_hash": info["sha256"],
                            "file_size": info["size"],
                            "state_uf": state_uf,
                            "competence": discovered.competence or competence,
                            "downloaded_at": datetime.now(timezone.utc).isoformat(),
                            "status": "stored",
                            "job_id": job_id,
                            "metadata": discovered.metadata or {},
                        }
                    )

                # Parse quando CSV/ZIP com CSV
                self.db.update_job(
                    job_id, status="parsing", current_step="parse", progress_percentage=40
                )
                rows_by_name: dict[str, list[dict]] = {}
                suffix = dest.suffix.lower()
                if suffix == ".csv":
                    rows_by_name[dest.name] = parse_csv_file(dest)
                elif suffix == ".zip":
                    rows_by_name = parse_zip_csv(dest)
                else:
                    self.db.log(
                        job_id,
                        f"Formato {suffix} requer conversão/DBF — registre fallback CSV",
                        level="warning",
                        step="parse",
                    )

                self._normalize_and_load(
                    job_id,
                    rows_by_name,
                    state_uf,
                    discovered.competence or competence,
                    metrics,
                    params,
                )

            status = "completed" if metrics["errors"] == 0 else "partial"
            self.db.update_job(
                job_id,
                status=status,
                current_step="done",
                progress_percentage=100,
                finished_at=datetime.now(timezone.utc).isoformat(),
                metrics=metrics,
            )
            if competence:
                self.db.upsert_sync_state(
                    "CNES",
                    state_uf,
                    last_processed_competence=competence,
                    last_success_at=datetime.now(timezone.utc).isoformat(),
                )
            self.db.write_audit(
                "ingestion.complete",
                "ingestion_job",
                job_id,
                after=metrics,
            )
            return {"status": status, "metrics": metrics}

        except Exception as exc:
            logger.exception("Job %s failed", job_id)
            self.db.update_job(
                job_id,
                status="failed",
                error_message=str(exc)[:2000],
                finished_at=datetime.now(timezone.utc).isoformat(),
                current_step="error",
                metrics=metrics,
            )
            self.db.log(job_id, str(exc), level="error", step="error")
            return {"status": "failed", "error": str(exc), "metrics": metrics}

    def _process_local_fixture(
        self,
        job_id: str,
        path: Path,
        state_uf: str,
        competence: str | None,
        metrics: dict[str, Any],
        params: dict[str, Any],
    ) -> dict[str, Any]:
        self.db.update_job(
            job_id, status="parsing", current_step="fixture", progress_percentage=30
        )
        digest = sha256_file(path)
        self.db.log(job_id, f"Fixture local {path.name} hash={digest[:12]}…", step="fixture")
        if path.suffix.lower() == ".zip":
            rows_by_name = parse_zip_csv(path)
        else:
            rows_by_name = {path.name: parse_csv_file(path)}
        self._normalize_and_load(
            job_id, rows_by_name, state_uf, competence, metrics, params
        )
        self.db.update_job(
            job_id,
            status="completed",
            current_step="done",
            progress_percentage=100,
            finished_at=datetime.now(timezone.utc).isoformat(),
            metrics=metrics,
        )
        return {"status": "completed", "metrics": metrics}

    def _normalize_and_load(
        self,
        job_id: str,
        rows_by_name: dict[str, list[dict]],
        state_uf: str,
        competence: str | None,
        metrics: dict[str, Any],
        params: dict[str, Any],
    ) -> None:
        self.db.update_job(
            job_id, status="normalizing", current_step="normalize", progress_percentage=55
        )
        facilities: list[NormalizedFacility] = []
        doctors: list[NormalizedDoctor] = []
        for name, rows in rows_by_name.items():
            lower = name.lower()
            if "estab" in lower or "facility" in lower or params.get("entity") == "facilities":
                facilities.extend(
                    facilities_from_rows(
                        rows, source_code="CNES", competence=competence, source_file=name
                    )
                )
            if "prof" in lower or "doctor" in lower or params.get("entity") == "doctors":
                doctors.extend(
                    doctors_from_rows(
                        rows, source_code="CNES", competence=competence, source_file=name
                    )
                )
            # Se não detectou, tenta ambos por colunas
            if not facilities and not doctors and rows:
                keys = {k.lower() for k in rows[0]}
                if any("cnes" in k or "fantasia" in k for k in keys):
                    facilities.extend(
                        facilities_from_rows(
                            rows, source_code="CNES", competence=competence, source_file=name
                        )
                    )
                if any("crm" in k or "profissional" in k or "nomeprof" in k for k in keys):
                    doctors.extend(
                        doctors_from_rows(
                            rows, source_code="CNES", competence=competence, source_file=name
                        )
                    )

        metrics["facilities"] = len(facilities)
        metrics["doctors"] = len(doctors)

        # Classificar estabelecimentos
        hemo_facilities = []
        for fac in facilities:
            score = self.classifier.score_facility(
                facility_type=fac.facility_type,
                sector_name=f"{fac.legal_name} {fac.trade_name or ''}",
                doctor_count=0,
            )
            if score.total >= 25 or params.get("include_all_facilities"):
                hemo_facilities.append((fac, score))

        self.db.update_job(
            job_id, status="matching", current_step="match", progress_percentage=70
        )
        existing_cnes: dict[str, str] = {}
        existing_crm: dict[str, str] = {}
        if self.db.client:
            try:
                client = self.db.ensure()
                fac_res = (
                    client.table("health_facilities")
                    .select("id,cnes")
                    .eq("is_deleted", False)
                    .not_.is_("cnes", "null")
                    .limit(5000)
                    .execute()
                )
                for row in fac_res.data or []:
                    if row.get("cnes"):
                        existing_cnes[str(row["cnes"])] = row["id"]
                reg_res = (
                    client.table("medical_registrations")
                    .select("doctor_id,number,state_uf")
                    .eq("registration_type", "CRM")
                    .limit(10000)
                    .execute()
                )
                for row in reg_res.data or []:
                    key = f"{normalize_crm(row['number'])}|{normalize_uf(row['state_uf'])}"
                    existing_crm[key] = row["doctor_id"]
            except Exception as exc:
                self.db.log(
                    job_id,
                    f"Lookup existentes falhou: {type(exc).__name__}",
                    level="warning",
                    step="match",
                )

        normalized_payloads = []
        matching_payloads = []
        for fac, score in hemo_facilities:
            m = match_facility(fac, existing_cnes, {})
            nid = str(uuid4())
            normalized_payloads.append(
                {
                    "id": nid,
                    "job_id": job_id,
                    "entity_type": "facility",
                    "source_record_id": fac.cnes_code,
                    "normalized_data": {
                        **fac.model_dump(),
                        "score": score.total,
                        "score_parts": score.parts,
                        "auto_classification": score.classification,
                    },
                    "status": "valid",
                }
            )
            matching_payloads.append(
                {
                    "job_id": job_id,
                    "entity_type": "facility",
                    "normalized_record_id": nid,
                    "matched_entity_id": m.matched_entity_id,
                    "match_type": m.match_type,
                    "confidence_score": m.confidence_score,
                    "matching_reasons": m.reasons,
                    "requires_review": m.requires_review,
                }
            )
            metrics["matches"] += 1

        for doc in doctors:
            m = match_doctor(doc, existing_crm, {})
            score = self.classifier.score_doctor(doc.cbo_code)
            if score.total < 15 and not params.get("include_all_doctors"):
                continue
            nid = str(uuid4())
            normalized_payloads.append(
                {
                    "id": nid,
                    "job_id": job_id,
                    "entity_type": "doctor",
                    "source_record_id": doc.source_record_id,
                    "normalized_data": {
                        **doc.model_dump(),
                        "score": score.total,
                        "score_parts": score.parts,
                        "auto_classification": score.classification,
                    },
                    "status": "valid",
                }
            )
            matching_payloads.append(
                {
                    "job_id": job_id,
                    "entity_type": "doctor",
                    "normalized_record_id": nid,
                    "matched_entity_id": m.matched_entity_id,
                    "match_type": m.match_type,
                    "confidence_score": m.confidence_score,
                    "matching_reasons": m.reasons,
                    "requires_review": True,
                }
            )

        if self.db.client:
            self.db.insert_normalized(normalized_payloads)
            self.db.insert_matching(matching_payloads)

        if params.get("generate_candidates", True) and self.db.client:
            self.db.update_job(
                job_id, status="loading", current_step="candidates", progress_percentage=85
            )
            metrics["candidates"] = self._create_candidates(
                job_id, hemo_facilities, doctors, existing_cnes, existing_crm, competence
            )

    def _create_candidates(
        self,
        job_id: str,
        hemo_facilities: list,
        doctors: list[NormalizedDoctor],
        existing_cnes: dict[str, str],
        existing_crm: dict[str, str],
        competence: str | None,
    ) -> int:
        client = self.db.ensure()
        created = 0
        for fac, score in hemo_facilities:
            if fac.cnes_code and fac.cnes_code in existing_cnes:
                # observação de origem — não overwrite
                entity_id = existing_cnes[fac.cnes_code]
                overrides = {
                    o["field_name"] for o in self.db.get_active_overrides("facility", entity_id)
                }
                if "phone" not in overrides and fac.phone:
                    client.table("source_observations").insert(
                        {
                            "entity_type": "facility",
                            "entity_id": entity_id,
                            "field_name": "phone",
                            "observed_value": fac.phone,
                            "competence": competence,
                            "confidence_score": 70,
                            "is_current": True,
                        }
                    ).execute()
                continue
            # novo candidato
            insert = {
                "name": fac.legal_name,
                "trade_name": fac.trade_name,
                "normalized_name": normalize_person_name(fac.legal_name),
                "cnes": fac.cnes_code,
                "cnpj": fac.cnpj,
                "city": fac.city,
                "state_uf": fac.state_uf or "MG",
                "phone": fac.phone,
                "email": fac.email,
                "layer": "candidato",
                "confidence_score": min(score.total, 80),
                "auto_extracted": True,
                "primary_source_code": "CNES",
                "source_competence": competence,
                "last_synced_at": datetime.now(timezone.utc).isoformat(),
                "notes": f"Ingestão automática job {job_id} — {score.classification}",
                "address_street": (fac.address or {}).get("street"),
                "address_zip": (fac.address or {}).get("zip"),
                "address_number": (fac.address or {}).get("number"),
                "address_district": (fac.address or {}).get("district"),
            }
            res = client.table("health_facilities").insert(insert).select("id").execute()
            fid = (res.data or [{}])[0].get("id")
            if fid:
                client.table("review_queue").insert(
                    {
                        "facility_id": fid,
                        "status": "pendente",
                        "priority": 50,
                        "review_type": "candidato",
                        "origin": "ingestion",
                        "reason": f"CNES auto {competence}",
                    }
                ).execute()
                created += 1

        for doc in doctors:
            key = None
            if doc.crm_number and doc.crm_state:
                key = f"{normalize_crm(doc.crm_number)}|{normalize_uf(doc.crm_state)}"
            if key and key in existing_crm:
                continue
            score = self.classifier.score_doctor(doc.cbo_code)
            if score.classification == "rejeitado" and score.total < 15:
                continue
            # Nunca especialista_confirmado
            classification = score.classification
            if classification not in ("possivel_candidato", "atuacao_provavel"):
                classification = "possivel_candidato"
            res = (
                client.table("doctors")
                .insert(
                    {
                        "full_name": doc.full_name,
                        "normalized_name": doc.normalized_name,
                        "city": doc.city,
                        "state_uf": doc.state_uf or doc.crm_state or "MG",
                        "layer": "candidato",
                        "classification": classification,
                        "validation_status": "nao_iniciada",
                        "confidence_score": min(score.total, 70),
                        "auto_extracted": True,
                        "primary_source_code": "CNES",
                        "source_competence": competence,
                        "last_synced_at": datetime.now(timezone.utc).isoformat(),
                        "notes": f"Ingestão automática job {job_id}",
                    }
                )
                .select("id")
                .execute()
            )
            did = (res.data or [{}])[0].get("id")
            if not did:
                continue
            if doc.crm_number and doc.crm_state:
                client.table("medical_registrations").insert(
                    {
                        "doctor_id": did,
                        "registration_type": "CRM",
                        "number": doc.crm_number,
                        "state_uf": doc.crm_state,
                        "status": "desconhecido",
                        "verification_status": "nao_verificado",
                        "confidence_score": 40,
                        "notes": "CRM da fonte CNES — validação humana pendente",
                    }
                ).execute()
            client.table("review_queue").insert(
                {
                    "doctor_id": did,
                    "status": "pendente",
                    "priority": 55,
                    "review_type": "candidato",
                    "origin": "ingestion",
                    "reason": f"CNES auto {competence}",
                }
            ).execute()
            client.table("evidences").insert(
                {
                    "entity_type": "doctor",
                    "entity_id": did,
                    "title": "Registro CNES (ingestão automática)",
                    "description": f"competence={competence} cbo={doc.cbo_code}",
                    "status": "pendente",
                    "confirmed_field": "full_name",
                    "captured_value": doc.full_name,
                }
            ).execute()
            created += 1
        return created

    def _is_cancelled(self, job_id: str) -> bool:
        if not self.db.client:
            return False
        try:
            res = (
                self.db.ensure()
                .table("ingestion_jobs")
                .select("status")
                .eq("id", job_id)
                .limit(1)
                .execute()
            )
            rows = res.data or []
            return bool(rows and rows[0].get("status") == "cancelled")
        except Exception:
            return False


def process_queued_jobs(limit: int = 3, workdir: str | Path = "/tmp/atlas-etl") -> int:
    db = SupabaseService()
    if not db.client:
        logger.error("Sem credenciais Supabase")
        return 0
    pipeline = IngestionPipeline(db)
    jobs = db.fetch_queued_jobs(limit=limit)
    wd = Path(workdir)
    wd.mkdir(parents=True, exist_ok=True)
    done = 0
    for job in jobs:
        pipeline.process_job(job, wd)
        done += 1
    return done

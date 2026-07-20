#!/usr/bin/env python3
"""CLI do worker de ingestão Atlas."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# garante import do pacote quando executado de etl/
sys.path.insert(0, str(Path(__file__).resolve().parent))

from atlas_etl.pipeline import IngestionPipeline, process_queued_jobs  # noqa: E402
from atlas_etl.services import SupabaseService  # noqa: E402
from atlas_etl.utils import setup_logging  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Atlas ETL worker")
    parser.add_argument(
        "command",
        choices=[
            "process-queue",
            "run-job",
            "discover-cnes",
            "ingest-fixture",
        ],
    )
    parser.add_argument("--job-id", help="UUID do job")
    parser.add_argument("--state-uf", default="MG")
    parser.add_argument("--competence")
    parser.add_argument("--fallback-url")
    parser.add_argument("--fixture")
    parser.add_argument("--limit", type=int, default=3)
    parser.add_argument("--workdir", default="./.etl-work")
    parser.add_argument("--discover-only", action="store_true")
    args = parser.parse_args()
    setup_logging()

    if args.command == "process-queue":
        n = process_queued_jobs(limit=args.limit, workdir=args.workdir)
        print(json.dumps({"processed": n}))
        return 0

    if args.command == "discover-cnes":
        from atlas_etl.discovery import discover_cnes_files

        files = discover_cnes_files(
            state_uf=args.state_uf,
            competence=args.competence,
            fallback_url=args.fallback_url,
        )
        print(json.dumps([f.__dict__ for f in files], ensure_ascii=False, indent=2))
        return 0

    db = SupabaseService()
    pipeline = IngestionPipeline(db)
    workdir = Path(args.workdir)
    workdir.mkdir(parents=True, exist_ok=True)

    if args.command == "run-job":
        if not args.job_id or not db.client:
            print("run-job exige --job-id e SUPABASE_*", file=sys.stderr)
            return 2
        res = (
            db.ensure()
            .table("ingestion_jobs")
            .select("*")
            .eq("id", args.job_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            print("job não encontrado", file=sys.stderr)
            return 1
        out = pipeline.process_job(rows[0], workdir)
        print(json.dumps(out, default=str))
        return 0 if out.get("status") in ("completed", "partial") else 1

    if args.command == "ingest-fixture":
        if not args.fixture:
            print("--fixture obrigatório", file=sys.stderr)
            return 2
        job = {
            "id": args.job_id or "00000000-0000-0000-0000-000000000001",
            "job_type": "ingest_cnes_fixture",
            "source_code": "CNES",
            "state_uf": args.state_uf,
            "competence": args.competence,
            "parameters": {
                "local_fixture": args.fixture,
                "generate_candidates": False,
                "include_all_facilities": True,
                "include_all_doctors": True,
            },
        }
        # offline: sem client
        pipeline.db.client = None
        out = pipeline.process_job(job, workdir)
        print(json.dumps(out, default=str))
        return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

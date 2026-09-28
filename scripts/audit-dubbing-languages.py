#!/usr/bin/env python3
"""Read-only local audit; render approved decisions into a CLI-created migration."""
import argparse
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent


def query(sql: str) -> object:
    result = subprocess.run(
        ["docker", "exec", "supabase_db_App", "psql", "-U", "postgres", "-d", "postgres",
         "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql],
        check=True, capture_output=True, text=True,
    )
    lines = [line for line in result.stdout.splitlines() if line.startswith(("{", "["))]
    if len(lines) != 1:
        raise RuntimeError("Expected one JSON audit result from the local database")
    return json.loads(lines[0])


AUDIT_SQL = r"""
BEGIN READ ONLY;
WITH queue_jobs AS (
  SELECT 'wiki_extract' AS queue,message FROM pgmq.q_wiki_extract
  UNION ALL SELECT 'wiki_check',message FROM pgmq.q_wiki_check
  UNION ALL SELECT 'wiki_discovery',message FROM pgmq.q_wiki_discovery
), jobs_by_media AS (
  SELECT (message->>'tmdb_id')::bigint AS content_id,
    CASE WHEN message->>'media_type' IN ('episode','season') THEN 'tv' ELSE message->>'media_type' END AS content_type,
    jsonb_agg(jsonb_build_object('queue',queue,'wikipedia_language',COALESCE(message->>'wikipedia_language',message->>'language'),
      'dubbing_language',message->>'dubbing_language','page_id',message->>'page_id','section_indexes',message->'section_indexes')) AS jobs
  FROM queue_jobs GROUP BY 1,2
), source_names AS (
  SELECT w.dubbing_project_id,jsonb_agg(DISTINCT s.name) AS names
  FROM public.work w JOIN public.source s ON s.id=w.source_id GROUP BY w.dubbing_project_id
), snapshots AS MATERIALIZED (
  SELECT p.*,public.dubbing_language_review_snapshot(p.id) AS snapshot
  FROM public.dubbing_projects p WHERE p.language IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.dubbing_languages l WHERE l.code=p.language)
)
SELECT jsonb_build_object(
  'generated_at',now(),'scope','local Supabase snapshot; no live database writes',
  'registry',(SELECT jsonb_agg(code ORDER BY code) FROM public.dubbing_languages),
  'total_projects',(SELECT count(*) FROM public.dubbing_projects),
  'unresolved_projects',(SELECT count(*) FROM snapshots),
  'language_counts',(SELECT jsonb_agg(t) FROM (SELECT language,count(*) AS projects FROM snapshots GROUP BY language ORDER BY count(*) DESC) t),
  'queue_counts',(SELECT jsonb_agg(t) FROM (SELECT queue,COALESCE(message->>'wikipedia_language',message->>'language') AS wikipedia_language,message->>'dubbing_language' AS dubbing_language,count(*) AS jobs FROM queue_jobs GROUP BY 1,2,3 ORDER BY count(*) DESC) t),
  'projects',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'project_id',p.id,'content_id',p.content_id,'content_type',p.content_type,'current_language',p.language,
    'expected_snapshot_hash',md5(p.snapshot::text),'snapshot',p.snapshot,
    'studio',(SELECT to_jsonb(s) FROM public.studios s WHERE s.id=p.studio_id),
    'source_names',COALESCE(n.names,'[]'::jsonb),'pending_source_jobs',COALESCE(j.jobs,'[]'::jsonb),
    'regional_siblings',COALESCE((SELECT jsonb_agg(jsonb_build_object('project_id',s.id,'language',s.language,
      'expected_target_snapshot_hash',md5(public.dubbing_language_review_snapshot(s.id)::text)))
      FROM public.dubbing_projects s JOIN public.dubbing_languages l ON l.code=s.language
      WHERE s.content_id=p.content_id AND s.content_type=p.content_type AND s.id<>p.id),'[]'::jsonb),
    'proposed_language',NULL,'review_reason','A Wikipedia edition and cast nationality do not prove a dubbing region'
  ) ORDER BY p.id) FROM snapshots p LEFT JOIN source_names n ON n.dubbing_project_id=p.id
    LEFT JOIN jobs_by_media j ON j.content_id=p.content_id AND j.content_type=p.content_type),'[]'::jsonb)
);
COMMIT;
"""


def render_migration(manifest_path: Path, output: Path) -> None:
    manifest = json.loads(manifest_path.read_text())
    if not isinstance(manifest, dict) or not isinstance(manifest.get("decisions"), list):
        raise ValueError("Manifest must contain a decisions array")
    decisions = manifest["decisions"]
    if not decisions:
        raise ValueError("No approved decisions; do not generate an empty migration")
    for decision in decisions:
        if not isinstance(decision, dict):
            raise ValueError("Each decision must be an object")
        for key in ("project_id", "target_language", "approved_by", "evidence_url", "evidence_quote", "expected_snapshot_hash"):
            if not decision.get(key):
                raise ValueError(f"Decision is missing {key}")
        if decision.get("survivor_id") and not decision.get("expected_target_snapshot_hash"):
            raise ValueError("Merge decisions require the reviewed survivor snapshot hash")
    directory = ROOT / "packages/database/supabase/migrations"
    if output.resolve().parent != directory.resolve() or not output.is_file() or output.stat().st_size:
        raise ValueError("Output must be an empty migration created by the Supabase CLI")
    literal = json.dumps(decisions, ensure_ascii=False).replace("'", "''")
    sql = "-- Explicitly reviewed regional decisions; fails if audited data has changed.\n"
    sql += "SELECT public.apply_reviewed_dubbing_languages('" + literal + "'::jsonb);\n"
    if manifest.get("finalize") is True:
        sql += "SELECT public.finalize_dubbing_language_constraints();\n"
    output.write_text(sql)
    print(f"Rendered {len(decisions)} approved decisions into {output}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "scripts/scratch/dubbing-language-audit.json")
    parser.add_argument("--approved-manifest", type=Path)
    parser.add_argument("--output-migration", type=Path)
    args = parser.parse_args()
    if args.approved_manifest:
        if not args.output_migration:
            parser.error("--approved-manifest requires --output-migration")
        render_migration(args.approved_manifest, args.output_migration)
        return
    report = query(AUDIT_SQL)
    if not isinstance(report, dict):
        raise RuntimeError("Malformed audit report")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"report": str(args.output), "total_projects": report.get("total_projects"),
                      "unresolved_projects": report.get("unresolved_projects"),
                      "language_counts": report.get("language_counts")}, ensure_ascii=False))


if __name__ == "__main__":
    main()

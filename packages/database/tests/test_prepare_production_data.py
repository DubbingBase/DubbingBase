import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "prepare-production-data.py"


class PrepareProductionDataTest(unittest.TestCase):
    def test_filters_storage_and_global_trigger_bypass_and_counts_copy_rows(self):
        source = """SET session_replication_role = replica;
COPY \"public\".\"dubbing_projects\" (\"id\") FROM stdin;
1
\\.
COPY \"public\".\"dubbing_languages\" (\"code\") FROM stdin;
fr-FR
\\.
COPY \"public\".\"text_values\" (\"value\") FROM stdin;
INSERT INTO this_is_data
SET session_replication_role = replica;
\\.
COPY \"public\".\"empty_reference\" (\"id\") FROM stdin;
\\.
COPY \"storage\".\"objects\" (\"id\") FROM stdin;
storage-object-row
\\.
COPY \"storage\".\"buckets_vectors\" (\"id\") FROM stdin;
\\.
"""

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source_path = root / "production-data.sql"
            prepared_path = root / "production-data-prepared.sql"
            manifest_path = root / "production-data-manifest.json"
            source_path.write_text(source, encoding="utf-8")

            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    str(source_path),
                    str(prepared_path),
                    str(manifest_path),
                ],
                check=True,
                capture_output=True,
                text=True,
            )

            prepared = prepared_path.read_text(encoding="utf-8")
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

        self.assertNotIn("SET session_replication_role = replica;\nCOPY", prepared)
        self.assertNotIn('COPY "storage"."objects"', prepared)
        self.assertNotIn("storage-object-row", prepared)
        self.assertNotIn('COPY "storage"."buckets_vectors"', prepared)
        self.assertIn("SET session_replication_role = replica;\n\\.\n", prepared)
        self.assertIn('COPY "public"."empty_reference"', prepared)
        self.assertEqual(
            [
                {"schema": "public", "name": "dubbing_languages", "rows": 1},
                {"schema": "public", "name": "dubbing_projects", "rows": 1},
                {"schema": "public", "name": "empty_reference", "rows": 0},
                {"schema": "public", "name": "text_values", "rows": 2},
            ],
            manifest["tables"],
        )
        self.assertEqual(1, manifest["removed_session_replication_role"])
        self.assertEqual(
            {"public.dubbing_languages.code": ["fr-FR"]},
            manifest["reference_sets"],
        )
        self.assertEqual(
            [
                {"schema": "storage", "name": "buckets_vectors", "rows": 0},
                {"schema": "storage", "name": "objects", "rows": 1},
            ],
            manifest["storage_tables_restored_separately"],
        )
        self.assertIn("Prepared 4 database tables", result.stdout)


if __name__ == "__main__":
    unittest.main()

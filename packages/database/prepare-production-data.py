#!/usr/bin/env python3
"""Prepare a pg_dump COPY snapshot and its data-only table manifest."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


IDENTIFIER = r'(?:"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)'
COPY_RE = re.compile(
    rf"^COPY\s+({IDENTIFIER})\s*\.\s*({IDENTIFIER})\s*\((.*)\)\s+FROM\s+stdin;\s*$",
    re.IGNORECASE,
)
INSERT_RE = re.compile(r"^INSERT\s+INTO\s+", re.IGNORECASE)
SESSION_ROLE_RE = re.compile(
    r"^\s*SET\s+session_replication_role\s*=\s*replica\s*;\s*$",
    re.IGNORECASE,
)


def decode_identifier(value: str) -> str:
    value = value.strip()
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1].replace('""', '"')
    return value.lower()


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit(
            "usage: prepare-production-data.py INPUT.sql OUTPUT.sql MANIFEST.json"
        )

    source_path, output_path, manifest_path = map(Path, sys.argv[1:])
    manifest_tables: dict[tuple[str, str], int] = {}
    storage_tables: dict[tuple[str, str], int] = {}
    registry_codes: list[str] = []
    current_table: tuple[str, str] | None = None
    current_registry_codes: list[str] | None = None
    current_storage_table: tuple[str, str] | None = None
    skip_copy = False
    removed_session_role = 0
    saw_copy = False

    with source_path.open(encoding="utf-8", newline="") as source, output_path.open(
        "w", encoding="utf-8", newline=""
    ) as output:
        for line in source:
            stripped = line.rstrip("\r\n")

            if skip_copy:
                if stripped == r"\.":
                    skip_copy = False
                    current_storage_table = None
                elif current_storage_table is not None:
                    storage_tables[current_storage_table] += 1
                continue

            if current_table is not None:
                output.write(line)
                if stripped == r"\.":
                    current_table = None
                    current_registry_codes = None
                else:
                    manifest_tables[current_table] += 1
                    if current_registry_codes is not None:
                        if "\\" in stripped or "\t" in stripped:
                            raise SystemExit(
                                "unsupported escaped value in dubbing-language code snapshot"
                            )
                        if stripped != r"\N":
                            registry_codes.append(stripped)
                continue

            if SESSION_ROLE_RE.match(line):
                removed_session_role += 1
                continue

            if INSERT_RE.match(line):
                raise SystemExit(
                    "snapshot contains INSERT statements; fetch it with --use-copy"
                )

            if stripped.upper().startswith("COPY "):
                match = COPY_RE.match(stripped)
                if match is None:
                    raise SystemExit(f"unsupported COPY statement: {stripped[:160]}")

                saw_copy = True
                schema = decode_identifier(match.group(1))
                table = decode_identifier(match.group(2))
                relation = (schema, table)
                if schema == "storage":
                    storage_tables.setdefault(relation, 0)
                    current_storage_table = relation
                    skip_copy = True
                    continue

                manifest_tables.setdefault(relation, 0)
                current_table = relation
                if relation == ("public", "dubbing_languages"):
                    columns = [
                        decode_identifier(column)
                        for column in match.group(3).split(",")
                    ]
                    if columns != ["code"]:
                        raise SystemExit(
                            "dubbing_languages snapshot must contain only its code column"
                        )
                    current_registry_codes = registry_codes
                output.write(line)
                continue

            output.write(line)

    if skip_copy or current_table is not None:
        raise SystemExit("snapshot ended before a COPY block was complete")
    if not saw_copy or not manifest_tables:
        raise SystemExit("snapshot has no database tables to restore")
    if removed_session_role > 1:
        raise SystemExit("snapshot contains multiple session_replication_role settings")

    manifest = {
        "format": 1,
        "tables": [
            {"schema": schema, "name": table, "rows": rows}
            for (schema, table), rows in sorted(manifest_tables.items())
        ],
        "reference_sets": {
            "public.dubbing_languages.code": sorted(set(registry_codes))
        }
        if ("public", "dubbing_languages") in manifest_tables
        else {},
        "removed_session_replication_role": removed_session_role,
        "storage_tables_restored_separately": [
            {"schema": schema, "name": table, "rows": rows}
            for (schema, table), rows in sorted(storage_tables.items())
        ],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(
        f"Prepared {len(manifest_tables)} database tables; "
        f"removed {removed_session_role} global trigger-bypass setting(s)."
    )


if __name__ == "__main__":
    main()

# /// script
# requires-python = ">=3.11"
# dependencies = ["pyarrow>=17"]
# ///
"""Generate the Parquet/CSV/JSONL fixtures used by tests.

Run: uv run scripts/generate_fixtures.py
The output is committed to tests/fixtures/ (this script is the reproduction recipe).
"""

import datetime
import json
from decimal import Decimal
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

FIXTURES = Path(__file__).parent.parent / "tests" / "fixtures"
FIXTURES.mkdir(parents=True, exist_ok=True)

ROWS = 100


def base_table() -> pa.Table:
    """Base table covering the major logical types."""
    return pa.table(
        {
            "id": pa.array(range(ROWS), type=pa.int64()),
            "score": pa.array([i * 0.5 for i in range(ROWS)], type=pa.float64()),
            "name": pa.array([f"user_{i:03d}" for i in range(ROWS)]),
            "active": pa.array([i % 2 == 0 for i in range(ROWS)]),
            "created_at": pa.array(
                [
                    datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)
                    + datetime.timedelta(hours=i)
                    for i in range(ROWS)
                ],
                type=pa.timestamp("us", tz="UTC"),
            ),
            "birthday": pa.array(
                [datetime.date(1990, 1, 1) + datetime.timedelta(days=i * 30) for i in range(ROWS)],
                type=pa.date32(),
            ),
            "balance": pa.array(
                [Decimal(f"{i}.{i % 100:02d}") for i in range(ROWS)],
                type=pa.decimal128(10, 2),
            ),
            "tags": pa.array(
                [[f"tag{i % 3}", f"tag{i % 5}"] for i in range(ROWS)],
                type=pa.list_(pa.string()),
            ),
            "meta": pa.array(
                [{"lang": "en" if i % 2 == 0 else "ja", "level": i % 10} for i in range(ROWS)],
                type=pa.struct([("lang", pa.string()), ("level", pa.int32())]),
            ),
            "nullable": pa.array(
                [None if i % 7 == 0 else f"val_{i}" for i in range(ROWS)],
            ),
            "unicode": pa.array([f"日本語_{i}_🦆" for i in range(ROWS)]),
        }
    )


def diff_right_table(left: pa.Table) -> pa.Table:
    """Variant of the base table with known row-level differences (join key: id).

    vs base: ids 10/20 removed, ids 100-102 added, ids 1/3/5/7 changed
    (score +1000; names of 3/7 also renamed) -> 3 added, 2 removed, 4 changed, 94 unchanged.
    """
    removed_ids = {10, 20}
    changed_score_ids = {1, 3, 5, 7}
    changed_name_ids = {3, 7}

    right_rows = []
    for row in left.to_pylist():
        if row["id"] in removed_ids:
            continue
        r = dict(row)
        if r["id"] in changed_score_ids:
            r["score"] = r["score"] + 1000.0
        if r["id"] in changed_name_ids:
            r["name"] = f"renamed_{r['id']:03d}"
        right_rows.append(r)

    template = left.to_pylist()[0]
    for new_id in (100, 101, 102):
        r = dict(template)
        r["id"] = new_id
        r["name"] = f"user_{new_id:03d}"
        right_rows.append(r)

    return pa.Table.from_pylist(right_rows, schema=left.schema)


def diff_schema_right_table(left: pa.Table) -> pa.Table:
    """Variant with schema-level differences: drops `nullable`, adds `region`,
    and changes `score` from float64 to int64."""
    t = left.drop_columns(["nullable"])
    int_score = pa.array(
        [int(v) for v in left.column("score").to_pylist()], type=pa.int64()
    )
    t = t.set_column(t.schema.get_field_index("score"), "score", int_score)
    return t.append_column("region", pa.array(["apac"] * left.num_rows))


def main() -> None:
    table = base_table()

    # Every compression codec supported by both hyparquet-compressors and DuckDB.
    # "lz4" (legacy Hadoop LZ4) is unsupported by hyparquet, so use the current-standard lz4_raw
    for label, codec in [
        ("snappy", "snappy"),
        ("gzip", "gzip"),
        ("zstd", "zstd"),
        ("lz4", "lz4_raw"),
        ("none", "none"),
    ]:
        pq.write_table(table, FIXTURES / f"basic_{label}.parquet", compression=codec)

    # Multiple row groups (for pagination tests)
    big = pa.concat_tables([table] * 50)  # 5,000 rows
    pq.write_table(big, FIXTURES / "multi_rowgroup.parquet", row_group_size=1000)

    # Empty table
    pq.write_table(table.slice(0, 0), FIXTURES / "empty.parquet")

    # Pairs for the diff tool (known added/removed/changed counts, schema drift,
    # and a duplicate-key pair for key-uniqueness warnings)
    pq.write_table(table, FIXTURES / "diff_left.parquet")
    pq.write_table(diff_right_table(table), FIXTURES / "diff_right.parquet")
    pq.write_table(diff_schema_right_table(table), FIXTURES / "diff_schema_right.parquet")
    pq.write_table(
        pa.table({"id": pa.array([1, 1, 2, 3], type=pa.int64()), "v": ["a", "b", "c", "d"]}),
        FIXTURES / "diff_nokey_left.parquet",
    )
    pq.write_table(
        pa.table({"id": pa.array([1, 2, 2, 4], type=pa.int64()), "v": ["a", "c", "x", "e"]}),
        FIXTURES / "diff_nokey_right.parquet",
    )

    # Source CSV / JSONL for the converters
    simple = table.select(["id", "score", "name", "active"])
    import pyarrow.csv as pacsv

    pacsv.write_csv(simple, FIXTURES / "simple.csv")
    with open(FIXTURES / "simple.jsonl", "w", encoding="utf-8") as f:
        for row in simple.to_pylist():
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    for p in sorted(FIXTURES.iterdir()):
        print(f"{p.name}: {p.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()

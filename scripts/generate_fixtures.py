# /// script
# requires-python = ">=3.11"
# dependencies = ["pyarrow>=17"]
# ///
"""テスト用Parquet/CSV/JSONL fixtureを生成する。

実行: uv run scripts/generate_fixtures.py
生成物は tests/fixtures/ にコミットする(再現手順としてこのスクリプトを保存)。
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
    """主要な論理型を網羅した基本テーブル。"""
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


def main() -> None:
    table = base_table()

    # 各圧縮コーデック(hyparquet-compressors / DuckDB両対応の範囲)。
    # "lz4"(レガシーHadoop LZ4)はhyparquet非対応のため、現行標準のlz4_rawを使う
    for label, codec in [
        ("snappy", "snappy"),
        ("gzip", "gzip"),
        ("zstd", "zstd"),
        ("lz4", "lz4_raw"),
        ("none", "none"),
    ]:
        pq.write_table(table, FIXTURES / f"basic_{label}.parquet", compression=codec)

    # 複数row group(ページネーション検証用)
    big = pa.concat_tables([table] * 50)  # 5,000行
    pq.write_table(big, FIXTURES / "multi_rowgroup.parquet", row_group_size=1000)

    # 空テーブル
    pq.write_table(table.slice(0, 0), FIXTURES / "empty.parquet")

    # 変換元CSV / JSONL
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

---
slug: convert-parquet-to-csv-command-line
title: "Convert Parquet to CSV from the Command Line"
description: "Three ways to turn a Parquet file into CSV from a terminal — a DuckDB one-liner, Python with pandas or pyarrow — plus a no-install browser fallback."
date: "2026-08-15"
faq:
  - question: "What is the fastest way to convert Parquet to CSV in a terminal?"
    answer: "A DuckDB one-liner: duckdb -c \"COPY (SELECT * FROM 'file.parquet') TO 'file.csv' (HEADER)\". DuckDB is a single binary with no dependencies, streams the data, and handles every common compression codec automatically."
  - question: "Can I convert Parquet to CSV without installing anything?"
    answer: "Yes. Drop the file into the browser-based Parquet to CSV converter on this site. It runs DuckDB compiled to WebAssembly locally in the tab, so nothing is uploaded and no CLI or Python environment is needed."
  - question: "Why is the CSV so much larger than the Parquet file?"
    answer: "Parquet is columnar and compressed; CSV is plain text with none of that. A 5–10x size increase is normal, and repetitive string columns can inflate far more. This is expected, not a conversion error."
  - question: "How do I convert many Parquet files into a single CSV?"
    answer: "Use a glob in the DuckDB source: COPY (SELECT * FROM 'exports/*.parquet') TO 'all.csv' (HEADER). DuckDB unions the files and writes one CSV with a single header row."
---

## The one-liner that usually wins: DuckDB

The [DuckDB CLI](https://duckdb.org/docs/installation/) is a single
dependency-free binary, which makes it the cleanest command-line route:

```bash
duckdb -c "COPY (SELECT * FROM 'events.parquet') TO 'events.csv' (HEADER, DELIMITER ',');"
```

That streams the file — it never loads the whole dataset into memory — and
it auto-detects Snappy, Gzip, ZSTD and LZ4 compression from the file
metadata. Because the source is just a `SELECT`, you can trim during the
conversion instead of exporting everything and cleaning up afterwards:

```bash
duckdb -c "COPY (
  SELECT user_id, event_type, created_at
  FROM 'events.parquet'
  WHERE created_at >= '2026-08-01'
) TO 'august.csv' (HEADER);"
```

Two more variants worth knowing:

```bash
# Many files -> one CSV (single header row)
duckdb -c "COPY (SELECT * FROM 'exports/*.parquet') TO 'all.csv' (HEADER);"

# Straight to stdout, for piping into grep/awk/another tool
duckdb -csv -c "SELECT * FROM 'events.parquet'" | head -20
```

For a semicolon-delimited file (common for European Excel locales), set
`DELIMITER ';'` in the `COPY` options.

## Python: pandas or pyarrow

If a Python environment is already part of the pipeline, pandas is the
familiar route:

```bash
python -c "import pandas as pd; pd.read_parquet('events.parquet').to_csv('events.csv', index=False)"
```

Note `index=False` — without it pandas prepends an unnamed index column
that confuses every downstream consumer. For large files, pyarrow's CSV
writer skips the pandas conversion step and is noticeably faster:

```python
import pyarrow.parquet as pq
import pyarrow.csv as pcsv

pcsv.write_csv(pq.read_table("events.parquet"), "events.csv")
```

Both approaches load the table into memory, so for files in the multi-GB
range prefer the DuckDB streaming route above.

## No terminal at all: convert in the browser

When the file is on a machine where you cannot (or do not want to) install
anything — a locked-down work laptop, someone else's desk — the
[Parquet to CSV converter](/convert/parquet-to-csv) does the same job in a
browser tab. It runs DuckDB compiled to WebAssembly locally, so the file is
never uploaded; that distinction matters when the data is confidential. If
you want to filter or sample before exporting, the [SQL Workbench](/sql)
accepts the same file and lets you download any query result as CSV.

## What to check after converting

CSV discards Parquet's type system, so a quick sanity pass saves pain
downstream:

- **Timestamps** become plain strings. DuckDB writes ISO 8601, which most
  tools re-parse cleanly; pandas output follows its own formatting.
- **Decimals and big integers** may lose their declared precision — Excel
  in particular will happily round an 18-digit ID.
- **Nested columns** (lists, structs) are serialized as text in a single
  cell. If you need the structure, export
  [JSON](/convert/parquet-to-json) or JSONL instead.
- **Row count**: compare `wc -l output.csv` (minus the header) against the
  source. The row count is in the Parquet footer — drop the file into the
  [Parquet Viewer](/parquet-viewer) to read it without scanning any data.

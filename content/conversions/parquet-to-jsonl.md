---
slug: parquet-to-jsonl
title: "Convert Parquet to JSONL (NDJSON) Online — Free & Private"
description: "Convert Parquet files to newline-delimited JSON locally in your browser. One object per line, nested types preserved — no upload required."
faq:
  - question: "What is the difference between JSONL and JSON?"
    answer: "JSONL (also called NDJSON) puts one complete JSON object on each line with no enclosing array. Tools can process it line by line without loading the whole file, which is why log pipelines, BigQuery and many ML tools prefer it."
  - question: "Can I load the output into BigQuery or Elasticsearch?"
    answer: "Yes — newline-delimited JSON is the native bulk-load format for BigQuery, and close to what Elasticsearch's bulk API expects (Elasticsearch additionally interleaves action lines)."
  - question: "Are nested columns preserved?"
    answer: "Yes. Lists become JSON arrays and structs become nested objects on every line, exactly as in the source Parquet schema."
---

## Why JSONL?

Newline-delimited JSON is the workhorse format of streaming data: each line
is independently parseable, so files can be split, tailed, grepped and
processed with constant memory. BigQuery bulk loads it natively, `jq` chews
through it, and every log shipper understands it.

## How the conversion works

Your `.parquet` file is registered with DuckDB-WASM inside the browser and
exported with `COPY … TO (FORMAT JSON)` — DuckDB's default JSON export is
already newline-delimited. The converted file downloads automatically, and
your data never leaves the machine.

## Practical notes

- **Line order matches row order** in the source file.
- **Nulls are explicit** (`"field": null`), unlike CSV.
- **Size**: JSONL is verbose. If the target system also reads Parquet
  directly (DuckDB, pandas, Polars, Spark all do), skipping the conversion
  entirely is the faster path — try querying the file as-is in the
  [SQL Workbench](/sql).

Need a single JSON array instead of lines? Use
[Parquet to JSON](/convert/parquet-to-json).

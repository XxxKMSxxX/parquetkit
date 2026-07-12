---
slug: jsonl-to-parquet
title: "Convert JSONL (NDJSON) to Parquet Online — Free & Private"
description: "Convert newline-delimited JSON to typed, ZSTD-compressed Parquet locally in your browser. Schema is inferred automatically — no upload."
date: "2026-07-12"
faq:
  - question: "How is the schema inferred from JSONL?"
    answer: "DuckDB samples the file and unifies the fields and types it sees — numbers, strings, booleans, timestamps, arrays and nested objects. Fields missing on some lines become nullable columns."
  - question: "What happens to nested objects?"
    answer: "Nested JSON objects become Parquet struct columns and arrays become list columns, preserving the structure for engines like Spark, DuckDB and Polars."
  - question: "My lines have inconsistent fields — will it fail?"
    answer: "Generally no. DuckDB unions the observed keys into one schema and fills missing values with null. Wildly heterogeneous files may end up with very wide, mostly-null schemas though."
---

## Why convert JSONL to Parquet?

JSONL is great for producing data and terrible for analyzing it: every query
re-parses text, field names repeat on every line, and there is no type
information. Converting logs or event exports to Parquet gives you typed
columns, a fraction of the file size (ZSTD compression), and instant
compatibility with DuckDB, pandas, Polars, Spark and every data warehouse.

## How this converter works

1. Drop a `.jsonl` / `.ndjson` file above.
2. DuckDB reads it with `read_json`, inferring a unified schema from the
   lines — including nested objects and arrays.
3. The result is written as ZSTD-compressed Parquet and downloads
   automatically.

As with every tool on this site, the conversion is fully local: your file is
never uploaded, so event logs containing user data stay on your machine.

## After converting

Open the output in the [Parquet Viewer](/parquet-viewer) to inspect the
inferred schema, or aggregate it immediately in the
[SQL Workbench](/sql) — both work on the file you just downloaded without
any further setup.

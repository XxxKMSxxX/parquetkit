---
slug: parquet-to-json
title: "Convert Parquet to JSON Online — Free & Private"
description: "Convert Parquet files to a JSON array locally in your browser. Nested columns are preserved as real JSON objects — no upload, no signup."
date: "2026-07-12"
faq:
  - question: "What JSON structure does the output have?"
    answer: "The output is a single JSON array containing one object per row. If you need one object per line for streaming pipelines, use the Parquet to JSONL converter instead."
  - question: "Are nested Parquet types preserved?"
    answer: "Yes. Lists become JSON arrays and structs become nested objects — this is the main advantage of JSON output over CSV, which has to flatten everything to text."
  - question: "How are timestamps and decimals represented?"
    answer: "Timestamps are written as ISO-8601 strings and decimals as numbers. Extremely large 64-bit integers that exceed JavaScript's safe range are emitted as numbers per the JSON spec, so consumers should parse with big-number support if that matters."
---

## JSON array vs JSONL — pick the right one

This page produces a **single JSON array** (`[{…}, {…}]`), which is what REST
APIs, fixtures and most application code expect. If the file feeds a
streaming pipeline, a log processor or `jq`-style line tooling, you probably
want [Parquet to JSONL](/convert/parquet-to-jsonl) instead — one JSON object
per line, no enclosing array.

## How the conversion works

The file is registered with an in-browser DuckDB engine and exported with
`COPY … TO (FORMAT JSON, ARRAY true)`. Nothing is uploaded — the conversion
runs entirely inside your browser — once the engine has loaded it keeps
working even without a network connection — and leaves no copy of your data
anywhere.

## When JSON beats CSV as an export format

- The Parquet file contains **lists or structs** you want to keep intact.
- The consumer is **application code** that parses JSON natively.
- You need **explicit null** values — CSV cannot distinguish empty string
  from null, JSON can.

JSON is however the most verbose of the export formats: expect the output to
be several times larger than the source Parquet. For a quick look at the data
before converting, use the [Parquet Viewer](/parquet-viewer).

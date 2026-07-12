---
slug: parquet-vs-csv
title: "Parquet vs CSV: Size, Speed and When to Use Each"
description: "A practical comparison of Parquet and CSV — file size, query speed, type safety and tool support — with concrete guidance on choosing."
date: "2026-07-12"
faq:
  - question: "How much smaller is Parquet than CSV?"
    answer: "Typically 5-10x smaller for tabular business data, thanks to columnar layout plus compression like ZSTD or Snappy. Highly repetitive columns compress even further."
  - question: "Is CSV ever faster than Parquet?"
    answer: "For tiny files that are written once and read once, CSV's simplicity can win — there is no metadata overhead. For anything queried repeatedly or selectively, Parquet is faster because engines read only the columns and row groups they need."
  - question: "Why does every warehouse still accept CSV?"
    answer: "Ubiquity. Every tool ever written can produce CSV, so it remains the lowest common denominator for data exchange — which is exactly why converting at the boundary is so common."
---

## The one-paragraph answer

CSV is a **text interchange format**: universal, human-readable, schema-free.
Parquet is a **storage and analytics format**: typed, columnar, compressed.
Use CSV to move data between humans and arbitrary tools; use Parquet when the
data will be stored, scanned or queried more than once.

## Size

Parquet stores each column contiguously and compresses it. Real-world
tabular data typically shrinks 5–10x versus the equivalent CSV. That is not a
rounding error — it is the difference between an email attachment and a
download link, or between a $50 and a $500 monthly S3 bill.

## Speed

- **Column pruning**: `SELECT revenue FROM sales` reads only the revenue
  column from Parquet; with CSV every byte must be parsed.
- **Predicate pushdown**: Parquet row-group statistics let engines skip
  entire chunks that cannot match a filter.
- **No re-parsing**: types are stored once, not re-inferred on every read.

## Type safety

CSV has no types: `01234` might be a zip code or the number 1234, and every
consumer guesses independently — a classic source of silent data bugs.
Parquet fixes the schema at write time, including timestamps with timezones,
decimals with precision, and nested lists and structs.

## Tool support

CSV opens in literally everything, including Excel. Parquet is native to the
data stack — Spark, DuckDB, pandas, Polars, BigQuery, Snowflake, Athena — but
not to spreadsheets or most SaaS import screens.

## Converting between them

Both directions run locally in your browser on this site:
[CSV to Parquet](/convert/csv-to-parquet) infers types automatically and
writes ZSTD-compressed output, and [Parquet to CSV](/convert/parquet-to-csv)
flattens typed columns back to text for spreadsheet users. To sanity-check a
file before or after, use the [Parquet Viewer](/parquet-viewer).

---
slug: csv-to-parquet
title: "Convert CSV to Parquet Online — Free & Private"
description: "Convert CSV files to Parquet with ZSTD compression, locally in your browser. No upload, no signup — typed columns are inferred automatically."
faq:
  - question: "How are column types decided?"
    answer: "DuckDB samples the CSV and infers types automatically — integers, floats, dates, timestamps and booleans are detected. Anything ambiguous falls back to text."
  - question: "What compression does the output use?"
    answer: "The output is written with Zstandard (ZSTD) compression, which typically shrinks a CSV to a fraction of its original size while staying fast to read in every modern Parquet reader."
  - question: "My CSV uses semicolons or tabs — will it work?"
    answer: "Yes. The delimiter, quoting style and header row are auto-detected by DuckDB's CSV sniffer, which handles the vast majority of real-world CSV dialects."
  - question: "Why is my Parquet file so much smaller than the CSV?"
    answer: "Parquet stores each column together and compresses it, so repeated values and predictable patterns compress extremely well. A 5-10x size reduction is common."
---

## Why convert CSV to Parquet?

CSV is universal but expensive: every read parses text, types are guessed by
every consumer independently, and the file compresses poorly. Parquet fixes
all three — typed columns, columnar layout and built-in compression — which is
why data warehouses, lakehouses, pandas, Polars and DuckDB all read it
natively. Converting once and querying many times is almost always worth it.

## How this converter works

1. Drop a `.csv` file above.
2. DuckDB's CSV sniffer detects the delimiter, header and column types from a
   sample of the file.
3. The data is written as Parquet with ZSTD compression and downloads
   automatically.

Everything happens inside your browser — the file is never uploaded, which
makes this safe for customer exports, financial data and anything else you
would not paste into a cloud tool.

## Checking the result

Want to confirm the schema came out right? Open the downloaded file in the
[Parquet Viewer](/parquet-viewer) to see the inferred column types, row count
and compression, or run a quick aggregation in the [SQL Workbench](/sql)
before shipping the file into your pipeline.

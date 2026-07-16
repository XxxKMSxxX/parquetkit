---
slug: check-if-parquet-file-is-corrupted
title: "How to Check If a Parquet File Is Corrupted (No Install Needed)"
description: "Validate a Parquet file in your browser: check the footer and schema instantly, then scan every row group with one SQL query. No pyarrow, no Spark."
date: "2026-07-16"
faq:
  - question: "What is the fastest way to validate a Parquet file?"
    answer: "Drop it into a browser-based viewer. If the schema and metadata render, the file's framing and footer are valid — that rules out truncation, the most common corruption, in about a second."
  - question: "Does opening a Parquet file check all of its data?"
    answer: "No. Viewers read the footer plus the pages you actually look at. To validate every row group, run a full-scan query such as SELECT count(*) over all columns — any damaged page will surface as a read error."
  - question: "What causes Parquet file corruption?"
    answer: "Interrupted writes and partial uploads are the usual causes, followed by files that were never Parquet (renamed exports) and, rarely, storage-level bit rot inside a compressed page."
---

## The situation

A file arrived from a pipeline, a colleague or an S3 bucket, and something
downstream is unhappy — or you simply do not trust it and want to know
*before* the nightly job does. "Is this Parquet file corrupted?" has a
two-level answer, and you can get both levels without installing anything.

## Level 1: structural check (one second)

Drop the file into the [Parquet viewer](/parquet-viewer). The viewer reads
the file's footer first — the metadata block that every reader depends on —
so the result is meaningful either way:

- **Schema, row count and metadata appear** → the framing is intact: magic
  bytes present, footer parseable, column metadata readable. The most
  common corruption — truncation from an interrupted write — is ruled out.
- **The viewer reports an error** → the file is structurally broken or not
  Parquet at all. See
  [what "magic bytes not found" means](/docs/parquet-magic-bytes-not-found)
  for the specific failure modes and fixes.

Everything runs locally in your browser; the file is never uploaded, so
this is safe for data you cannot share.

## Level 2: full-data scan

A valid footer does not guarantee every data page decompresses cleanly. To
validate the actual data, force a read of every row group. Open the file in
the [SQL workbench](/sql) and run a query that touches all columns:

```sql
SELECT count(*) FROM read_parquet('yourfile.parquet');

-- Stricter: force every column to be decoded, not just counted
SELECT min(column_a), min(column_b) /* ...every column... */
FROM read_parquet('yourfile.parquet');
```

If a page is damaged, the scan stops with a decompression or decoding error
that names the offending column — far more actionable than a generic
failure from a distributed job. If both queries complete, the file decodes
end to end.

The command-line equivalents, if you already have the tools installed, are
`duckdb -c "SELECT count(*) FROM 'file.parquet'"` or pyarrow's
`parquet.read_table` — they perform the same scan, they just need an
environment first.

## Reading the error, if you get one

- **Magic bytes / footer errors** — truncation or a non-Parquet file. The
  data after the break is unrecoverable; re-export from the source.
- **Decompression errors in one column** — corruption inside a compressed
  page (rare; storage or transfer damage). Other columns may still read
  cleanly, so a salvage `SELECT` of the healthy columns can recover most of
  the data.
- **Type or schema errors** — the file is healthy, but its schema differs
  from what the reader expected. That is a different problem with a
  different fix: [compare the schemas of two files](/diff) to find exactly
  which column drifted.

## Preventing the next one

Corrupted Parquet files are almost always born, not made: they come from
writes that did not finish. Write to a temporary path and rename on
success, let multipart uploads complete before consumers see the object,
and keep the writer's `_SUCCESS` markers (or equivalent) as the signal that
a directory is safe to read.

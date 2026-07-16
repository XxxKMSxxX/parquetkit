---
slug: parquet-magic-bytes-not-found
title: "Parquet \"Magic Bytes Not Found\" — What It Means and How to Fix It"
description: "The PAR1 magic bytes error means your Parquet file is truncated or not Parquet at all. Here is how to diagnose it in seconds and where the file broke."
date: "2026-07-16"
faq:
  - question: "What are the PAR1 magic bytes in a Parquet file?"
    answer: "Every valid Parquet file starts and ends with the same four bytes: PAR1. Readers check the trailing PAR1 plus the footer before anything else, so a missing tail means the file was cut off mid-write."
  - question: "Can a truncated Parquet file be repaired?"
    answer: "Usually not fully. The footer at the end of the file holds the metadata for every row group, so a missing footer means readers cannot locate the data. The reliable fix is re-exporting from the source."
  - question: "Why does my Parquet file open in one tool but fail in another?"
    answer: "Some readers only touch the row groups they need, so a file with damage in one region can partially work. A reader that validates the footer or scans every page will fail on the same file."
---

## The situation

A job that worked yesterday suddenly fails with something like
`Invalid: Parquet magic bytes not found in footer` or
`file is smaller than the minimum size` — from Spark, dask, DuckDB, pandas
or a BI connector. The wording varies by engine, but the meaning is the
same: the reader looked at the end of the file and did not find what every
valid Parquet file must have there.

## What the error actually means

A Parquet file is framed by four magic bytes — the ASCII characters `PAR1`
— at the very beginning **and** the very end. Just before the trailing
`PAR1` sits the footer: the metadata that records where every row group and
column chunk lives. Readers start from the end, so the trailing bytes are
the first thing checked.

When they are missing, one of two things is true:

- **The file is truncated.** The write was interrupted — a killed job, a
  failed or partial upload, a full disk, a multipart transfer that never
  completed — so the footer was never written. The beginning of the file
  looks fine; the end simply is not there.
- **The file was never Parquet.** A CSV or JSON export renamed to
  `.parquet`, an HTML error page saved by a download script, a zero-byte
  placeholder, or a gzip of a Parquet file (`.parquet.gz` needs
  decompressing first — Parquet's internal compression is per-page, not
  whole-file).

## Diagnose it in seconds

Drop the file into the [Parquet viewer](/parquet-viewer). It reads the
footer first — exactly like the engine that raised the error — so you get
an immediate, engine-neutral verdict: if the schema and metadata appear,
the file's framing is intact and your problem lies elsewhere (for example a
schema mismatch); if the viewer reports it cannot read the file, the file
itself is broken, not your pipeline configuration. Nothing is uploaded, so
this is safe even for confidential exports.

Two more checks help pin down which failure mode you have:

- **Size.** Compare the file's size with a healthy sibling from the same
  job. A suspiciously round number (exactly 8 MB, exactly 100 MB) often
  marks an upload that died at a part boundary.
- **Head and tail.** On a terminal: `head -c 4 file.parquet` and
  `tail -c 4 file.parquet` should both print `PAR1`. A `PAR1` head with a
  missing tail is truncation; no `PAR1` at either end means the file was
  never Parquet.

## Fixing it

There is no honest repair story for a missing footer: the footer is the map
to the data, and without it readers cannot navigate the row groups. In
practice the fix is upstream:

- Re-run the export, and write to a temporary name first, renaming only
  after the writer closes successfully — that makes interrupted writes
  invisible to consumers.
- For object stores, verify multipart uploads complete (or enable integrity
  checks) before downstream jobs pick files up.
- If the source is gone, check whether the writer left `_temporary`
  directories or an earlier partition you can fall back to.

If the file opens fine in the viewer but a specific engine still complains,
the framing is not your problem — look at
[schema mismatches between files](/docs/parquet-column-data-type-mismatch)
instead, and see
[how to check a Parquet file for corruption](/docs/check-if-parquet-file-is-corrupted)
for the full diagnostic checklist.

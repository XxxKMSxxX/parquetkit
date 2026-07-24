---
slug: parquet-compression-snappy-vs-gzip-vs-zstd
title: "Parquet Compression: Snappy vs Gzip vs Zstd, Which to Pick"
description: "Snappy, Gzip, and Zstd trade file size for CPU time differently. Benchmarks, defaults by engine, and how to check or change the codec in an existing Parquet file."
date: "2026-07-25"
faq:
  - question: "What is the default Parquet compression codec?"
    answer: "It depends on the writer. Spark and pandas/pyarrow default to Snappy, while newer tools like DuckDB default to ZSTD. Always check created_by and the column encoding rather than assuming."
  - question: "Is Zstd always better than Snappy for Parquet?"
    answer: "For file size and read speed, usually yes at similar compression levels. Snappy still wins on raw write throughput for latency-sensitive pipelines where every millisecond of write time matters more than storage cost."
  - question: "Can I change the compression codec of an existing Parquet file without Spark?"
    answer: "Yes. DuckDB can read any Parquet file and rewrite it with a different codec via COPY ... TO ... (FORMAT PARQUET, COMPRESSION 'zstd') without installing Java or Spark."
  - question: "Does Gzip compress Parquet better than Zstd?"
    answer: "Gzip often reaches a similar or slightly smaller file size than Zstd at default settings, but it is markedly slower to write and read, which is why most modern pipelines have moved off it."
---

## Why the codec matters more than people think

Parquet compresses data page-by-page, per column, and the codec you pick
changes three things independently: file size on disk, CPU time to write,
and CPU time to read. Picking the wrong one silently taxes every job that
touches the file afterward — including ad hoc queries you're running today.

## The three codecs, briefly

- **Snappy** — the historical default for Spark and pyarrow. Optimizes for
  speed over ratio: fast to write, fast to decompress, but leaves size on
  the table. No compression level to tune.
- **Gzip** (DEFLATE) — better compression ratio than Snappy, sometimes by
  30-40%, but 2-4x slower on both write and read. Good for cold archival
  data you rarely query.
- **Zstd** — released after Snappy and Gzip were already entrenched as
  Parquet defaults, and generally beats both: ratio close to or better than
  Gzip, speed close to Snappy, plus a tunable level (1-22) to trade further.
  It's now the default in DuckDB and increasingly common elsewhere.

## Rough numbers

On a typical mixed-type analytical table (strings, timestamps, floats),
relative to an uncompressed baseline:

| Codec | Size | Write speed | Read speed |
|---|---|---|---|
| Snappy | ~40% | fastest | fast |
| Gzip | ~25-30% | slowest | slow |
| Zstd (level 3) | ~25-30% | fast | fast |
| Zstd (level 15+) | ~20-25% | slow | fast |

Exact numbers depend heavily on your data's entropy — dictionary-friendly
low-cardinality columns compress well under any codec, while
high-cardinality UUID or hash columns barely compress at all regardless of
codec choice.

## Check what a file is already using

Drop the file into the [Parquet viewer](/parquet-viewer) — the metadata
panel shows the compression codec per column along with `created_by`, so
you know both what you have and which engine wrote it. Or query it
directly with DuckDB in the [SQL workbench](/sql):

```sql
SELECT path_in_schema, compression, total_compressed_size, total_uncompressed_size
FROM parquet_metadata('yourfile.parquet');
```

If `total_compressed_size` is close to `total_uncompressed_size` for a
text-heavy column, that column isn't compressing well under its current
codec — worth testing an alternative.

## Re-compress an existing file

No Spark or Java required. DuckDB rewrites Parquet files with any codec in
one statement:

```sql
COPY (SELECT * FROM read_parquet('input.parquet'))
TO 'output_zstd.parquet' (FORMAT PARQUET, COMPRESSION 'zstd', COMPRESSION_LEVEL 9);
```

Swap `'zstd'` for `'gzip'`, `'snappy'`, or `'uncompressed'` to compare. Run
both outputs back through `parquet_metadata()` and diff the sizes directly,
or use the [diff tool](/diff) if you want to confirm the actual row data
didn't change — only the encoding did.

## Picking one

- **Interactive/ad hoc query files**: Zstd level 1-3. Cheap to write, cheap
  to read, meaningfully smaller than Snappy.
- **Write-latency-critical pipelines** (streaming ingestion, many small
  files per second): Snappy, or Zstd level 1 if your writer supports it.
- **Cold storage / archival**: Zstd level 15-19, or Gzip if your downstream
  tooling can't read Zstd (older Hive/Presto versions, some legacy Java
  readers pre-dating Parquet 2.9).
- **Unsure**: Zstd level 3 is the safest modern default — check it against
  your own data with the snippet above before committing a pipeline to it.

---
slug: combine-csv-files-into-one-parquet
title: "Combine Multiple CSV Files into One Parquet File"
description: "Turn a folder of CSV exports into a single compressed Parquet file with one DuckDB command, handling schema drift — or do it entirely in your browser."
date: "2026-08-15"
faq:
  - question: "How do I combine CSV files with different columns into one Parquet file?"
    answer: "Pass union_by_name=true to DuckDB's read_csv. Columns are matched by header name instead of position, columns missing from a file are filled with NULL, and every column that appears in any input is kept."
  - question: "Why does combining CSVs fail with a type conversion error?"
    answer: "DuckDB infers each file's column types from a sample. If one file makes a column look numeric while another contains text in it, the union fails. Re-run with sample_size=-1 to scan whole files, or all_varchar=true and cast explicitly."
  - question: "How much smaller is Parquet than the source CSVs?"
    answer: "Typically 5–10x smaller with ZSTD compression, because Parquet stores columns contiguously and encodes repeated values efficiently. Highly repetitive columns like categories or status flags compress even further."
  - question: "Can I keep track of which source file each row came from?"
    answer: "Yes — add filename=true to read_csv and a filename column containing each row's source path is added automatically. It survives into the Parquet output like any other column."
---

## The situation

A system exports one CSV per day, store or batch — `2026-08-01.csv`,
`2026-08-02.csv`, dozens more — and you want them as a single fast,
compressed file. Concatenating with `cat` breaks immediately: every file
repeats its header row, and any file whose columns are ordered differently
silently corrupts the result. The right move is to union them properly and
write Parquet once.

## One command with DuckDB

The [DuckDB CLI](https://duckdb.org/docs/installation/) does the whole job
with a glob:

```bash
duckdb -c "COPY (
  SELECT * FROM read_csv('exports/*.csv', union_by_name=true)
) TO 'combined.parquet' (FORMAT PARQUET, COMPRESSION zstd);"
```

`union_by_name=true` is the important option. Without it, files are matched
column-by-position, so an export whose columns were reordered in March puts
values into the wrong fields. With it, columns are matched by header name,
files missing a column get `NULL` there, and schema drift — a field added
halfway through the year — merges cleanly.

To record where each row came from, let DuckDB add the source path as a
column:

```bash
duckdb -c "COPY (
  SELECT * FROM read_csv('exports/*.csv', union_by_name=true, filename=true)
) TO 'combined.parquet' (FORMAT PARQUET, COMPRESSION zstd);"
```

## When type inference bites

CSV has no types, so DuckDB infers them from a sample of each file. Across
many files this can disagree: a `ref_code` column that happens to be all
digits in January reads as `BIGINT`, then February contains `A-1023` and
the union fails with a conversion error. Two fixes, in order of preference:

```sql
-- Scan entire files instead of a sample before deciding types
read_csv('exports/*.csv', union_by_name=true, sample_size=-1)

-- Nuclear option: read everything as text, cast the columns you trust
read_csv('exports/*.csv', union_by_name=true, all_varchar=true)
```

With `all_varchar=true`, cast deliberately in the `SELECT`
(`CAST(amount AS DECIMAL(12,2))`) so the Parquet file ends up with real
types rather than strings — the compression and query-speed benefits of
Parquet largely come from typed columns.

## Doing it in the browser instead

No terminal available, or the data too sensitive to move around? Drop all
the CSVs into the [SQL Workbench](/sql) — it runs DuckDB as WebAssembly
locally, nothing is uploaded. Globs cannot expand in a browser, so list the
files explicitly:

```sql
SELECT * FROM 'day1.csv'
UNION ALL BY NAME
SELECT * FROM 'day2.csv'
UNION ALL BY NAME
SELECT * FROM 'day3.csv';
```

Download the result as CSV, then feed it to the
[CSV to Parquet converter](/convert/csv-to-parquet), which re-infers types
and writes a compressed Parquet file. Fine for a handful of files; for
fifty, the CLI glob above is the better tool.

## Verify the output

Check the result before deleting anything: drop `combined.parquet` into the
[Parquet Viewer](/parquet-viewer) and confirm the row count matches the sum
of the inputs and the schema shows the types you expect — not `VARCHAR`
everywhere. If your inputs are already Parquet rather than CSV, the
mechanics differ slightly; see
[How to Merge Multiple Parquet Files into One](/docs/merge-multiple-parquet-files).

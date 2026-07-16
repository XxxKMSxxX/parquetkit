---
slug: parquet-column-data-type-mismatch
title: "PARQUET_COLUMN_DATA_TYPE_MISMATCH: Find Which File Drifted"
description: "Spark or Databricks fails reading a Parquet dataset when one file's column type changed. Here is how to find the drifted file and column, and fix it."
date: "2026-07-16"
faq:
  - question: "What does PARQUET_COLUMN_DATA_TYPE_MISMATCH mean?"
    answer: "The reader expected a column to have one type — from the table definition or the first file it opened — but a Parquet file in the dataset stores that column with a different physical type, so the read fails."
  - question: "Why did my Parquet column type change between files?"
    answer: "Type inference is the usual cause: a batch where an integer column was all null, or values happened to parse as a different type, makes writers like pandas emit a different physical type for the same logical column."
  - question: "How do I find which Parquet file has the wrong schema?"
    answer: "Compare a known-good file against a suspect one with a schema diff, or read each file's footer and check the column's physical type. The file whose type differs from the table definition is the one to rewrite."
  - question: "Does mergeSchema fix type mismatches in Spark?"
    answer: "No. Schema merging reconciles added or missing columns, not conflicting physical types for the same column. A double stored as INT64 in one file still fails; that file has to be rewritten with an explicit cast."
---

## The situation

A Spark, Databricks or Fabric job that has read a dataset for months
suddenly fails with
`FAILED_READ_FILE.PARQUET_COLUMN_DATA_TYPE_MISMATCH` (or an
`Unsupported schema evolution` / `incompatible Parquet schema` variant).
Nothing in your code changed. What changed is one of the *files*: somewhere
in the dataset, a new file stores a column with a different physical type
than the older files — `score` was `DOUBLE`, and last night's batch wrote
it as `INT64`.

The error message rarely tells you **which file** or, on some engines, even
which column. That is the actual problem to solve.

## Why this happens

Parquet files carry their own schema in the footer, and readers require the
files of one dataset to agree. They stop agreeing when:

- **Type inference flips.** A pandas or JSON-based writer infers types per
  batch. A batch where an int column contains nulls becomes `double`; a
  batch where every value happens to be whole becomes `int64`. Same
  pipeline, different footer.
- **The producer changed.** An upstream team migrated writers, upgraded a
  library, or "cleaned up" a column — decimal precision, timestamp unit and
  string-vs-binary changes are classics.
- **A backfill used different code** than the incremental job, so old and
  new partitions disagree.

## Find the drifted file and column

You need to see footers, not run more failing jobs.

1. **Pick a known-good file and a suspect.** The failing file path is often
   in the engine's error detail; otherwise take one file from the oldest
   partition and one from the newest.
2. **Diff their schemas.** Drop the pair into the
   [Parquet diff tool](/diff) — schema differences (added, removed and
   re-typed columns) are read from the footers and shown instantly, before
   any rows load. A re-typed column like `score: DOUBLE → INT64` is your
   culprit. The comparison runs locally in your browser, so production data
   never leaves your machine.
3. **Confirm across the dataset** if needed: any single file's full schema
   is visible by dropping it into the [viewer](/parquet-viewer), including
   physical and logical types per column.

## Fix it

- **Rewrite the drifted files with an explicit cast.** One statement in
  DuckDB (locally or in the [SQL workbench](/sql) for smaller files):

  ```sql
  COPY (SELECT * REPLACE (CAST(score AS DOUBLE) AS score)
        FROM read_parquet('bad_file.parquet'))
  TO 'bad_file_fixed.parquet' (FORMAT PARQUET);
  ```

- **Pin the schema at write time** so inference can never flip again:
  explicit dtypes in pandas, a declared schema in pyarrow/Spark writers.
- **Don't reach for `mergeSchema`** — it merges *added* columns; it does
  not reconcile two physical types for the same column.

After rewriting, run the [diff](/diff) once more between a fixed file and
the good one: schemas identical, and — since the tool also compares rows by
key — you can confirm the rewrite changed types without changing data.

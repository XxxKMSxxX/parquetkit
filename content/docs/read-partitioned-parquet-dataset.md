---
slug: read-partitioned-parquet-dataset
title: "How to Read a Partitioned Parquet Dataset Without Spark"
description: "Query a directory of Hive-partitioned Parquet files with DuckDB SQL, filter by partition columns, and understand how partition pruning works."
date: "2026-08-01"
faq:
  - question: "What is a Hive-partitioned Parquet dataset?"
    answer: "A directory tree where folder names encode column values, like sales/year=2026/month=07/data.parquet. The partition columns (year, month) live in the path, not inside the files themselves."
  - question: "Do I need Spark to query a partitioned Parquet dataset?"
    answer: "No. DuckDB reads Hive-partitioned directories natively with a glob pattern and reconstructs the partition columns from the folder names automatically — no cluster, no metastore."
  - question: "What is partition pruning and why does it matter?"
    answer: "It is an engine skipping entire files or folders that can't match a query's filter, based on the partition values in the path, before reading any data. Filtering on partition columns can make a query orders of magnitude faster."
  - question: "Can I query partitioned Parquet files in the browser?"
    answer: "Yes, if you can select multiple files at once — DuckDB-WASM supports the same glob and hive_partitioning behavior as native DuckDB, just with files chosen from your local disk instead of a path string."
---

## The situation

A pipeline (Spark, Airflow, dbt, a nightly export) has written Parquet as a
directory tree instead of a single file:

```
events/
  year=2026/
    month=01/
      part-0000.parquet
      part-0001.parquet
    month=02/
      part-0000.parquet
  year=2025/
    month=12/
      part-0000.parquet
```

This is the standard Hive partitioning layout: `year` and `month` are not
columns stored inside any individual file — they're encoded in the folder
names, and the engine reading the dataset is expected to reconstruct them
from the path. Opening one `part-0000.parquet` in isolation gets you a
slice of the data with those columns missing entirely, which is usually
the confusing part the first time someone hits this.

## Querying the whole dataset with DuckDB

DuckDB reads the directory as a single logical table with a glob pattern:

```sql
SELECT *
FROM read_parquet('events/**/*.parquet', hive_partitioning = true)
LIMIT 20;
```

`hive_partitioning = true` tells DuckDB to parse `year=2026/month=01` out
of each file's path and add `year` and `month` as real columns in the
result — you can select, filter and group by them exactly as if they'd
been stored in the file.

Recent DuckDB versions auto-detect Hive partitioning for paths that follow
the `key=value` convention, so the explicit flag is mostly there for
clarity or for older versions where detection is off by default.

## Filtering by partition — and why it's fast

```sql
SELECT event_type, count(*)
FROM read_parquet('events/**/*.parquet', hive_partitioning = true)
WHERE year = 2026 AND month = 2
GROUP BY event_type;
```

Because `year` and `month` come from the path, DuckDB can decide which
files even need to be opened *before* reading a single byte of Parquet
data — it just checks folder names against the filter. This is partition
pruning: on a dataset with years of daily partitions, a query for one
month touches only that month's files instead of scanning everything. It's
the same idea SQL engines like Spark and Athena use, just without the
cluster.

## Loading a subset into one file

To materialize a filtered slice as a single ordinary Parquet file:

```sql
COPY (
  SELECT * FROM read_parquet('events/**/*.parquet', hive_partitioning = true)
  WHERE year = 2026
) TO 'events_2026.parquet' (FORMAT PARQUET, COMPRESSION 'zstd');
```

That gives you a flat file you can hand to someone else, drop into the
[Parquet Viewer](/parquet-viewer), or diff against a previous export with
[Parquet Diff](/diff) — none of which need to know anything about the
original partition layout.

## Doing this without installing DuckDB

The same `read_parquet` glob and `hive_partitioning` behavior works in
[SQL Workbench](/sql) on this site, backed by DuckDB-WASM — select every
file from the partitioned directory at once (most browsers support
selecting a folder or multiple files in the file picker) and query them
as one table, entirely client-side. Useful for a one-off look at a
partitioned export without pulling in Spark or a local DuckDB install at
all.

## Common mistake: opening a single part file

If you only open `part-0000.parquet` from one partition folder, you'll see
correct row data but no `year` or `month` columns, and you'll be looking
at one partition's worth of rows, not the dataset. Anyone getting
unexpectedly narrow results from what should be a large dataset should
check whether they're pointed at one file instead of the partitioned glob.

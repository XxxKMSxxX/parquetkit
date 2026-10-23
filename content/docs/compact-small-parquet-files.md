---
slug: compact-small-parquet-files
title: "Compact Small Parquet Files Without Spark (DuckDB)"
description: "Thousands of tiny Parquet files make every query slow. Find them, rewrite each partition into a few right-sized files with DuckDB, verify, and swap safely."
date: "2026-10-24"
faq:
  - question: "What is a good target size for Parquet files?"
    answer: "Roughly 100 MB to 1 GB per file, with row groups of a few hundred thousand to a million rows. Smaller than that and per-file open and footer overhead dominates query time; much larger and parallelism suffers."
  - question: "Can I compact files in place?"
    answer: "Not safely. Write the compacted output to a new directory, verify row counts and a fingerprint against the original, then swap the directories. Deleting inputs before verifying risks losing data if the job dies halfway."
  - question: "Should I compact Delta Lake or Iceberg tables this way?"
    answer: "No. Those table formats track data files in a transaction log, so files rewritten behind their back corrupt the table. Use the format's own command, such as OPTIMIZE in Delta Lake or rewrite_data_files in Iceberg."
  - question: "Does compaction change the data?"
    answer: "It should not change values, but it can change row order and column types if you add casts. Comparing a count plus a sum of row hashes before and after proves the rows survived intact."
---

## The small-files problem

Streaming jobs, hourly appends and over-partitioned Spark writes all end
the same way: a directory with thousands of Parquet files of a few hundred
kilobytes each. Every file has to be opened, its footer parsed and its
schema reconciled, so a query over 5,000 tiny files can take ten times
longer than the same rows in five files. Compression is worse too, because
dictionaries and statistics restart in every file.

Compaction rewrites them into a few right-sized files. It is not the same
as [merging into one file](/docs/merge-multiple-parquet-files): a
partitioned dataset should keep its `dt=` directories, with fewer files
inside each.

## Step 1: measure it

Count files per partition without reading any data:

```sql
SELECT regexp_extract(file, 'dt=([^/]+)', 1) AS dt, count(*) AS files
FROM glob('events/*/*.parquet')
GROUP BY dt
ORDER BY files DESC;
```

To see how small the row groups are, drop a sample file into the
[Parquet Viewer](/parquet-viewer) or query its footer, as described in
[row group statistics](/docs/parquet-row-group-statistics-min-max).
Partitions with dozens of files of a few MB each are the ones worth
compacting.

## Step 2: rewrite into a new directory

DuckDB reads the whole dataset, keeps the partition column and writes it
back out partitioned:

```sql
COPY (
  SELECT *
  FROM read_parquet('events/*/*.parquet', hive_partitioning = true)
  ORDER BY dt, customer_id
) TO 'events_compacted' (
  FORMAT parquet,
  PARTITION_BY (dt),
  COMPRESSION zstd,
  ROW_GROUP_SIZE 500000
);
```

The output is typically one `data_0.parquet` per partition. Two choices
here matter:

- **`ORDER BY` a column you filter on.** Sorted data gives each row group a
  narrow min/max range, so readers can skip most of the file. Compaction is
  the cheapest moment to get that for free.
- **Zstd and large row groups.** Compression and statistics both work
  better on bigger groups than on the default output of most streaming
  writers.

If one partition is huge, compact it on its own and cap the file size
instead of producing a single multi-GB file:

```sql
COPY (SELECT * FROM read_parquet('events/dt=2026-10-01/*.parquet'))
TO 'compacted_2026_10_01' (FORMAT parquet, FILE_SIZE_BYTES '512mb');
```

`FILE_SIZE_BYTES` is approximate; DuckDB starts a new file once the
threshold is passed. Compacting one partition at a time also keeps memory
bounded on a laptop, and only rewrites the partitions that actually
fragmented.

## Step 3: verify before you delete anything

Compare a row count and an order-independent fingerprint between the old
and new directories:

```sql
SELECT count(*), sum(hash(t))
FROM read_parquet('events/*/*.parquet', hive_partitioning = true) t;

SELECT count(*), sum(hash(t))
FROM read_parquet('events_compacted/*/*.parquet', hive_partitioning = true) t;
```

Both numbers must match. The reasoning behind the fingerprint is in
[checking whether two Parquet files are identical](/docs/check-if-two-parquet-files-are-identical).

## Step 4: swap

```bash
mv events events_old && mv events_compacted events
# after downstream jobs have run cleanly:
rm -r events_old
```

Do it while no writer is appending, or new files that land mid-swap end up
in the old directory. On object storage there is no atomic rename, so point
readers at a new prefix rather than copying files over the old one.

## Things that break compaction

- **Table formats.** Delta Lake, Iceberg and Hudi track data files in a log.
  Rewriting files directly corrupts the table, so use `OPTIMIZE` or the
  format's own rewrite procedure.
- **Schema drift between old and new files.** If a column was added
  partway through, read with `union_by_name = true` so that older rows get
  NULL instead of the job failing.
- **Marker files.** Spark's `_SUCCESS` and `_metadata` files are not data.
  Keep the glob to `*.parquet` so they are not picked up.

## Preventing the next pile-up

Compaction treats the symptom. The cause is writing too often in tiny
batches. Buffer rows and flush in larger batches (see
[appending to Parquet](/docs/append-to-existing-parquet-file)), partition by
day rather than by hour unless the volume justifies it, and schedule
compaction for partitions once they stop receiving writes.

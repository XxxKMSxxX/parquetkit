---
slug: split-large-parquet-file
title: "How to Split a Large Parquet File into Smaller Files"
description: "Split an oversized Parquet file by target size, by row count, or by a column value — with DuckDB SQL, pyarrow, or in the browser with no install."
date: "2026-08-22"
faq:
  - question: "What is a good target size per Parquet file?"
    answer: "Roughly 128 MB to 1 GB of compressed data per file. Smaller files multiply metadata reads and scheduling overhead, which is the classic small-file problem and often slower than one large file."
  - question: "How do I split a Parquet file into files of exactly N rows?"
    answer: "Add a bucket column computed from row_number() and partition on it: (row_number() OVER () - 1) // 1000000 AS part, then COPY with PARTITION_BY (part)."
  - question: "Does splitting a Parquet file make queries faster?"
    answer: "Not by itself. Row groups inside one file are already read in parallel. Splitting helps when it enables partition pruning on a filter column, or when a downstream tool has a hard file-size limit."
  - question: "Can I split a Parquet file without installing anything?"
    answer: "Yes. Run LIMIT/OFFSET slices in a browser SQL workbench and download each slice. It runs on WebAssembly locally, so the file is never uploaded."
---

## First, decide the split key

"Split this file" usually means one of three different things, and the right
command differs for each:

- **By target size** — an upload limit, an artifact size cap, a mail attachment.
- **By row count** — a downstream tool that chokes past N rows, such as Excel's
  1,048,576-row ceiling.
- **By a column value** — date, region, tenant, so later queries can skip files.

Check what you are working with first:

```sql
SELECT count(*) FROM 'big.parquet';
```

## Split by target size

DuckDB writes a directory of files and rolls over at a size threshold:

```sql
COPY (SELECT * FROM 'big.parquet')
TO 'chunks' (FORMAT parquet, FILE_SIZE_BYTES '100mb');
```

The threshold is approximate — DuckDB closes a file once a row group pushes
it past the limit, so individual files land near, not exactly at, the target.

## Split by a column value

This is the version worth preferring when there is a natural key, because it
produces a Hive-partitioned layout that readers can prune:

```sql
COPY (SELECT * FROM 'big.parquet')
TO 'by_month' (FORMAT parquet, PARTITION_BY (year, month), OVERWRITE_OR_IGNORE);
```

The result is `by_month/year=2026/month=07/data_0.parquet`, and the partition
columns live in the path rather than inside the files. Querying it back is
covered in
[read a partitioned Parquet dataset](/docs/read-partitioned-parquet-dataset).

One caution: partition on a low-cardinality column. Partitioning by
`user_id` produces one tiny file per user and makes everything slower.

## Split by exact row count

There is no built-in "N rows per file" option, so compute a bucket and
partition on it:

```sql
COPY (
  SELECT *, (row_number() OVER () - 1) // 1000000 AS part
  FROM 'big.parquet'
)
TO 'parts' (FORMAT parquet, PARTITION_BY (part));
```

`//` is integer division, so rows 0–999,999 get `part=0`, the next million
`part=1`, and so on. The window function forces a single ordered pass, which
is fine for a one-off but not something to put in a hot pipeline.

## In the browser, no install

Open the [SQL Workbench](/sql), drop the file in, and take slices:

```sql
SELECT * FROM 'big.parquet' LIMIT 1000000 OFFSET 0;
```

Download the result, then repeat with `OFFSET 1000000`. Add an `ORDER BY` on
a stable column so slices do not overlap or skip rows. This is the practical
route for the Excel case — see
[opening Parquet in Excel](/docs/open-parquet-in-excel).

## With pyarrow

If the split belongs in a Python pipeline:

```python
import pyarrow.dataset as ds

ds.write_dataset(
    ds.dataset("big.parquet", format="parquet"),
    "parts",
    format="parquet",
    max_rows_per_file=1_000_000,
    max_rows_per_group=200_000,
    existing_data_behavior="overwrite_or_ignore",
)
```

`max_rows_per_file` gives the exact row cap that DuckDB needs a bucket
column for. Pass `partitioning=["year", "month"]` to combine it with a
column split.

## Before you split

Splitting is not a performance fix on its own — a single Parquet file is
already read in parallel across row groups, and hundreds of small files cost
more in metadata reads than they save. Split when a hard limit or a real
partition key demands it. If you overshoot, the inverse operation is
[merging Parquet files](/docs/merge-multiple-parquet-files).

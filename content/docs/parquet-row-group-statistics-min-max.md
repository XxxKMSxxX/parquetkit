---
slug: parquet-row-group-statistics-min-max
title: "View Parquet Row Group Statistics (Min, Max, Null Count)"
description: "Read the per-row-group min/max and null counts stored in a Parquet footer with DuckDB's parquet_metadata(), and use them to explain why a filter is fast or slow."
date: "2026-09-26"
faq:
  - question: "Does reading Parquet statistics scan the data?"
    answer: "No. Row group statistics live in the file footer next to the schema. parquet_metadata() reads only that footer, so it returns in about the same time for a 10 MB file and a 10 GB file."
  - question: "Why are stats_min and stats_max NULL for some columns?"
    answer: "The writer chose not to store them. That is common for long strings, some binary columns and files from older or minimal writers. Without statistics, readers cannot skip row groups for filters on that column."
  - question: "What is a good row group size?"
    answer: "Most engines default to somewhere between about 100,000 and 1,000,000 rows, or 64 to 128 MB per group. Very small groups add footer overhead, and a single huge group makes pruning and parallel reads impossible."
  - question: "Can I see this without installing DuckDB?"
    answer: "Yes. The SQL Workbench on this site runs DuckDB in your browser, so parquet_metadata() works on a local file with no install and no upload."
---

## Why the footer matters

A Parquet file is split into **row groups**. For each column in each row
group, the writer usually stores statistics in the footer: minimum, maximum
and null count. When a query says `WHERE order_date >= '2026-09-01'`, the
reader checks those numbers and skips every row group whose maximum is
earlier than that date. This is called predicate pushdown, and it is why
the same filter is instant on one file and slow on another.

You can read those statistics yourself. That is the quickest way to find
out whether a filter can skip anything at all.

## Step 1: file-level overview

```sql
SELECT num_rows, num_row_groups, created_by, format_version
FROM parquet_file_metadata('orders.parquet');
```

`created_by` tells you which writer produced the file (for example
`parquet-cpp-arrow`, `parquet-mr` or DuckDB), which helps when files from
two pipelines behave differently. The [Parquet Viewer](/parquet-viewer)
shows the same row count, row group count and writer as soon as you drop a
file in.

## Step 2: statistics per row group

```sql
SELECT row_group_id,
       row_group_num_rows,
       stats_min,
       stats_max,
       stats_null_count
FROM parquet_metadata('orders.parquet')
WHERE path_in_schema = 'order_date'
ORDER BY row_group_id;
```

`parquet_metadata()` returns one row per column chunk, meaning one column in
one row group, so filter on `path_in_schema` to look at a single column.
Nested fields appear with dotted paths such as `address.city`. Run it in
the [SQL Workbench](/sql) against a local file. Only the footer is read.

## Step 3: read the pattern

**Ranges that don't overlap** mean the data is sorted or clustered by the
column:

```text
row_group_id  stats_min    stats_max
0             2026-01-01   2026-03-14
1             2026-03-14   2026-05-30
2             2026-05-30   2026-09-25
```

A filter on this column can skip most row groups.

**Ranges that all cover the whole domain** mean the file is unordered:

```text
row_group_id  stats_min    stats_max
0             2026-01-01   2026-09-25
1             2026-01-02   2026-09-25
2             2026-01-01   2026-09-24
```

No row group can be ruled out, so every filter on this column reads the
whole column. The file is fine. It just was not written with this filter
in mind.

**NULL statistics** mean there is nothing to prune with. Check which
columns have them:

```sql
SELECT path_in_schema,
       count(*) AS chunks,
       count(stats_min) AS chunks_with_stats
FROM parquet_metadata('orders.parquet')
GROUP BY path_in_schema
ORDER BY chunks_with_stats;
```

## Fixing a file that cannot be pruned

Rewrite it sorted by the column you filter on most, and set an explicit
row group size:

```sql
COPY (SELECT * FROM 'orders.parquet' ORDER BY order_date)
TO 'orders_sorted.parquet'
(FORMAT PARQUET, ROW_GROUP_SIZE 250000, COMPRESSION ZSTD);
```

Then run Step 2 again on the new file. The ranges should now follow each
other in order. Sorting can only help one column (or a leading
combination), so pick the one your queries filter on, usually a date or a
tenant id. If the file is too big to rewrite in one go, split it by that
column first. See
[How to Split a Large Parquet File](/docs/split-large-parquet-file).

## Other footer details worth checking

The same function exposes more per-chunk details:

- `compression` and `encodings` show how each column is stored (see
  [Snappy vs Gzip vs Zstd](/docs/parquet-compression-snappy-vs-gzip-vs-zstd)).
- `total_compressed_size` and `total_uncompressed_size` show which columns
  take up the space.
- `parquet_kv_metadata('orders.parquet')` lists key/value metadata, such as
  the embedded Arrow or pandas schema that writers store there.

Summing `total_compressed_size` by `path_in_schema` is a quick way to see
which column makes a file larger than expected.

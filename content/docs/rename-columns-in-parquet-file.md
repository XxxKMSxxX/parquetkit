---
slug: rename-columns-in-parquet-file
title: "How to Rename, Drop or Reorder Columns in a Parquet File"
description: "Parquet files can't be edited in place. Rename, drop, reorder or retype columns by rewriting the file with one DuckDB statement or a few lines of pyarrow."
date: "2026-10-03"
faq:
  - question: "Can I rename a column in a Parquet file without rewriting it?"
    answer: "Not with standard tools. Column names live in the Thrift-encoded footer, and DuckDB, pyarrow, pandas and Spark all rename by writing a new file. Table formats like Delta Lake (column mapping) and Iceberg can rename through metadata instead."
  - question: "Does rewriting a Parquet file change the data?"
    answer: "Values stay the same, but compression codec, row group size and key-value metadata such as the pandas index info come from the new writer's settings. Set them explicitly if downstream jobs depend on them."
  - question: "How do I rename a column in every file of a partitioned dataset?"
    answer: "Read the whole dataset with a glob and hive_partitioning enabled, then COPY it back out with PARTITION_BY to a new directory. Swap the directories once you have checked the row count."
  - question: "Can I write the result back to the same file name?"
    answer: "Write to a new path first, verify it, then move it over the original. Reading from and writing to the same file in one statement risks truncating the input before it has been fully read."
---

## Why there is no "edit" button

A Parquet file stores its schema — column names, types, order — in the
footer, and every row group's column chunks are laid out to match it. No
mainstream tool patches that footer in place. Renaming `cust_id` to
`customer_id`, dropping a debug column or moving `id` to the front all mean
the same thing: read the file, write a new one with the changed schema.

That sounds expensive, but it is a single streaming pass. DuckDB rewrites a
multi-GB file in seconds without holding it all in memory.

## Check the current schema first

Before writing anything, confirm the exact column names and types. Drop the
file into the [Parquet Viewer](/parquet-viewer) to see the schema without
installing anything, or run:

```sql
DESCRIBE SELECT * FROM 'events.parquet';
```

Column names are case-sensitive in many downstream engines, so copy them
exactly.

## DuckDB: one statement for every change

DuckDB's star modifiers let you express the change without listing every
column:

```sql
-- Rename
COPY (
  SELECT * RENAME (cust_id AS customer_id, ts AS event_time)
  FROM 'events.parquet'
) TO 'events_v2.parquet' (FORMAT parquet, COMPRESSION zstd);

-- Drop
COPY (
  SELECT * EXCLUDE (debug_payload, _tmp_flag)
  FROM 'events.parquet'
) TO 'events_v2.parquet' (FORMAT parquet, COMPRESSION zstd);

-- Reorder: put id and event_time first, keep the rest as-is
COPY (
  SELECT id, event_time, * EXCLUDE (id, event_time)
  FROM 'events.parquet'
) TO 'events_v2.parquet' (FORMAT parquet, COMPRESSION zstd);

-- Change a type without touching the other columns
COPY (
  SELECT * REPLACE (CAST(amount AS DECIMAL(18, 2)) AS amount)
  FROM 'events.parquet'
) TO 'events_v2.parquet' (FORMAT parquet, COMPRESSION zstd);
```

The modifiers combine, so one pass can rename, drop and retype at once. You
can try the `SELECT` part in the [SQL Workbench](/sql) first to preview the
result in your browser, then run the `COPY` with the DuckDB CLI to produce
the new file.

For a partitioned dataset, do the same over a glob and write a new
directory:

```sql
COPY (
  SELECT * RENAME (cust_id AS customer_id)
  FROM read_parquet('events/*/*.parquet', hive_partitioning = true)
) TO 'events_v2' (FORMAT parquet, PARTITION_BY (dt));
```

## pyarrow: when you are already in Python

```python
import pyarrow.parquet as pq

table = pq.read_table("events.parquet")

mapping = {"cust_id": "customer_id", "ts": "event_time"}
table = table.rename_columns([mapping.get(c, c) for c in table.column_names])
table = table.drop_columns(["debug_payload"])
table = table.select(["id", "event_time"] + [
    c for c in table.column_names if c not in ("id", "event_time")
])

pq.write_table(table, "events_v2.parquet", compression="zstd")
```

Passing a list to `rename_columns` works on every pyarrow version; the
dict form only exists in recent releases. `read_table` loads the whole file
into memory, so for files larger than RAM, prefer the DuckDB route or
iterate with `pq.ParquetFile(...).iter_batches()` and a `ParquetWriter`.

## What a rewrite can silently change

- **Compression.** DuckDB and pyarrow both default to Snappy, whatever the
  original file used. Pass the codec you actually want.
- **Row group size.** Readers that rely on row-group statistics to skip
  data perform differently if groups get much larger or smaller. DuckDB
  accepts `ROW_GROUP_SIZE 122880` in the `COPY` options.
- **Key-value metadata.** The `pandas` metadata block (index columns,
  original dtypes) is not carried over by DuckDB. If a pandas consumer
  relied on it, rewrite with pyarrow from a pandas DataFrame instead.
- **Downstream queries.** Every job selecting `cust_id` breaks. Renaming
  is a schema change; announce it like one.

## Verify before you replace the original

Compare row counts and the new schema:

```sql
SELECT
  (SELECT count(*) FROM 'events.parquet')    AS before,
  (SELECT count(*) FROM 'events_v2.parquet') AS after;
DESCRIBE SELECT * FROM 'events_v2.parquet';
```

If you only changed types, the [Parquet Diff](/diff) tool will show the
re-typed columns from the footers and confirm that no rows were added or
removed. Once the numbers match, move the new file over the old one.

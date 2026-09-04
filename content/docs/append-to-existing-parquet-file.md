---
slug: append-to-existing-parquet-file
title: "How to Append Rows to an Existing Parquet File"
description: "Parquet files are written once, so appending means adding a row group or a new file. fastparquet append=True, a DuckDB rewrite and the dataset-directory pattern."
date: "2026-09-05"
faq:
  - question: "Can you append to a Parquet file in place?"
    answer: "Not as a plain file operation. The footer holding the schema and row-group offsets sits at the end of the file, so adding rows means writing a new row group and rewriting the footer. fastparquet does this with append=True; pyarrow and DuckDB expect a rewrite or a new file."
  - question: "Does pyarrow support appending to an existing Parquet file?"
    answer: "No. ParquetWriter can add row groups while a file is open, but it cannot reopen a finished file. The pyarrow-idiomatic answer is to write a new file into the same directory and read the directory as one dataset."
  - question: "Why is appending row by row a bad idea?"
    answer: "Every append creates a new row group. Thousands of tiny row groups bloat the footer and slow down every reader. Buffer incoming rows and append in batches of tens of thousands, then compact the file periodically."
  - question: "How do I check how many row groups a file has?"
    answer: "Drop it into the Parquet Viewer. The schema tab shows row groups, row count and the writer that created the file, read from the footer without scanning any data."
---

## Why "append" is not a normal file operation

A Parquet file is a sequence of row groups followed by a footer that holds
the schema, the byte offset of every column chunk and their statistics,
then a length and the `PAR1` magic bytes. Readers start from the end. That
layout is why `cat new.parquet >> old.parquet` produces a file that fails
with a magic-bytes error rather than a longer dataset (see
[Parquet magic bytes not found](/docs/parquet-magic-bytes-not-found)):
the footer must be the last thing in the file.

Appending therefore means one of three things: rewrite the footer after
adding a row group, rewrite the whole file, or stop treating one file as
the unit and add a new file next to it.

## Option 1: fastparquet `append=True`

fastparquet is the one mainstream Python library that appends to a single
file in place. It reads the existing footer, writes the new rows as
additional row groups, and writes a fresh footer:

```python
import pandas as pd
import fastparquet

new_rows = pd.DataFrame({"id": [101, 102], "name": ["x", "y"]})
fastparquet.write("events.parquet", new_rows, append=True)
```

The same flag passes through pandas:
`df.to_parquet("events.parquet", engine="fastparquet", append=True)`.

Two rules. The file must already exist, and the schema must match exactly —
an extra or missing column raises
`ValueError: Column names of new data are [...] But column names in existing file are [...]`.
And the file must be one fastparquet can read: files with nested structs
or newer encodings from other writers may not be (see
[fastparquet vs pyarrow](/docs/fastparquet-vs-pyarrow)).

## Option 2: rewrite with DuckDB

No fastparquet, no Python? Rewriting is a single streaming `COPY`, and it
takes the new rows from any source format:

```sql
COPY (
  SELECT * FROM 'events.parquet'
  UNION ALL BY NAME
  SELECT * FROM 'new_rows.csv'
) TO 'events_new.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);
```

Then replace the old file with the new one. The cost is proportional to the
whole file, not the new rows, but DuckDB streams the rewrite so a
multi-GB file is fine. `BY NAME` tolerates column order differences and
fills a column missing on one side with `NULL` — useful when the new rows
gained a field. In the browser, the [SQL Workbench](/sql) runs the same
`UNION` and exports CSV, which the
[CSV to Parquet converter](/convert/csv-to-parquet) turns back into
Parquet.

## Option 3: add a file, not rows

This is what every query engine actually expects. Write the new batch as
its own file into a directory and read the directory as one table:

```python
import pyarrow.parquet as pq

pq.write_table(new_table, "events/part-2026-09-05.parquet")
```

```sql
SELECT count(*) FROM read_parquet('events/*.parquet');
```

DuckDB can do the writing too, with unique filenames generated for you:

```sql
COPY new_rows TO 'events'
  (FORMAT PARQUET, PARTITION_BY (day), APPEND);
```

Nothing is rewritten, concurrent writers never touch the same file, and
Spark, DuckDB, Polars and pyarrow all read the directory natively (see
[reading a partitioned dataset](/docs/read-partitioned-parquet-dataset)).
When the directory accumulates hundreds of small files, compact them back
into one — [merging Parquet files](/docs/merge-multiple-parquet-files)
covers that.

## Batch size decides whether appending is fast or terrible

Every append, in option 1 or option 3, produces at least one row group or
file. Appending one row at a time from a loop yields thousands of row
groups holding a single row each: the footer balloons, statistics become
useless for skipping, and every reader pays for it. Buffer incoming rows
and flush in batches of at least tens of thousands. To see what a file
looks like after a week of appends, drop it into the
[Parquet Viewer](/parquet-viewer): the row-group count and `created_by`
writer are right there in the footer.

## Which to pick

- **Existing fastparquet pipeline, one file, matching schema** → option 1.
- **Occasional append, any tooling, must stay a single file** → option 2.
- **Continuous ingestion, several writers, or anything read by Spark** → option 3.

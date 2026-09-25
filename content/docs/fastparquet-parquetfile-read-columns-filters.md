---
slug: fastparquet-parquetfile-read-columns-filters
title: "fastparquet ParquetFile: Read Columns, Filters and Row Groups"
description: "Use fastparquet's ParquetFile to inspect a file, load only the columns you need, prune row groups with filters and iterate in chunks to keep memory flat."
date: "2026-09-26"
faq:
  - question: "Why do filters in fastparquet still return rows that don't match?"
    answer: "By default filters only skip whole row groups whose min/max statistics rule them out. Rows inside a surviving row group are all returned. Pass row_filter=True in recent releases, or filter the DataFrame afterwards."
  - question: "How do I get the row count without loading the data?"
    answer: "ParquetFile reads only the footer when you open it. pf.count() or sum(rg.num_rows for rg in pf.row_groups) gives the total from metadata, with no column data read."
  - question: "Can fastparquet open a directory of partitioned files?"
    answer: "Yes. Pass the directory path (or a list of files) to ParquetFile. Hive-style key=value folders become categorical columns you can filter on, and those filters skip entire files."
  - question: "Is there a way to peek at a file without writing Python?"
    answer: "The Parquet Viewer on this site shows the schema, row groups and first rows in your browser. It reads the file locally with WebAssembly and never uploads it."
---

## Why not just `pd.read_parquet`?

`pd.read_parquet(path, engine="fastparquet")` loads everything. That is
fine for small files. For big ones, fastparquet's own `ParquetFile` object
lets you look at the metadata first and then read only what you need.
Opening it costs one footer read, no matter how big the file is.

This guide assumes fastparquet is already installed. If `import
fastparquet` fails, see
[Fix fastparquet Install and Import Errors](/docs/fastparquet-install-and-import-errors).
If you are still choosing an engine, read
[fastparquet vs pyarrow](/docs/fastparquet-vs-pyarrow) first.

## Inspect before you read

```python
from fastparquet import ParquetFile

pf = ParquetFile("events.parquet")

pf.columns          # ['event_id', 'user_id', 'ts', 'country', 'amount']
pf.dtypes           # {'event_id': dtype('int64'), 'amount': dtype('float64'), ...}
pf.count()          # total rows, from the footer
len(pf.row_groups)  # how the file is chunked
pf.info             # dict: name, columns, partitions, rows
```

The row group count matters. Filters and chunked reads both work one row
group at a time. A 5 GB file written as a single row group gets nothing
from either.

## Read only some columns

```python
df = pf.to_pandas(columns=["user_id", "amount"])
```

Parquet is columnar, so skipped columns are never read from disk. On wide
tables this is usually the biggest single saving, larger than any filter.

## Filter with row-group statistics

```python
df = pf.to_pandas(
    columns=["user_id", "amount", "country"],
    filters=[("country", "==", "JP"), ("amount", ">", 100)],
)
```

A flat list of tuples is combined with AND. A list of lists is OR-of-ANDs:
`[[("country", "==", "JP")], [("country", "==", "US")]]`. Supported
operators include `==`, `!=`, `<`, `<=`, `>`, `>=`, `in` and `not in`.

These filters work at the **row-group** level. fastparquet compares each
condition with the row group's min/max statistics and skips groups that
cannot match. Groups that might match are returned in full, so the result
can contain `country == "US"` rows. You have two ways to get exact results:

```python
# recent fastparquet releases: also filter rows inside surviving groups
df = pf.to_pandas(filters=[("country", "==", "JP")], row_filter=True)

# works everywhere: prune with statistics, then filter exactly
df = pf.to_pandas(filters=[("country", "==", "JP")])
df = df[df["country"] == "JP"]
```

Pruning only helps when the data is sorted or clustered by the filter
column. If every row group contains every country, no group can be skipped.

## Process a large file in chunks

```python
total = 0
for chunk in pf.iter_row_groups(columns=["amount"], filters=[("amount", ">", 0)]):
    total += chunk["amount"].sum()
```

Each iteration returns one row group as a DataFrame, so peak memory is
about one row group instead of the whole file. `pf.head(10)` also reads
only as far as it needs, which is handy for a quick look.

## Partitioned datasets

```python
pf = ParquetFile("events/")    # events/country=JP/part.0.parquet, ...
pf.cats                        # {'country': ['JP', 'US', ...]}
df = pf.to_pandas(filters=[("country", "in", ["JP", "KR"])])
```

Partition columns come from the directory names. Filters on them skip
whole files without opening them.

## The same questions without Python

To check a file's columns, row count or row-group layout before you write
any of the code above, drop it into the [Parquet Viewer](/parquet-viewer).
Once you want to filter, the [SQL Workbench](/sql) runs DuckDB in your
browser:

```sql
SELECT user_id, amount
FROM 'events.parquet'
WHERE country = 'JP' AND amount > 100;
```

DuckDB also prunes row groups using statistics, and it always applies the
filter exactly, so you never have to add a second filtering step.

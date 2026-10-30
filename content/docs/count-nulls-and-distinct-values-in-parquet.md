---
slug: count-nulls-and-distinct-values-in-parquet
title: "Count Nulls and Distinct Values per Column in Parquet"
description: "Profile every column of a Parquet file in one query: null counts, distinct values, blanks and NaN, with DuckDB SUMMARIZE and COLUMNS(*), in the browser or the CLI."
date: "2026-10-31"
faq:
  - question: "How do I count nulls in every column of a Parquet file at once?"
    answer: "In DuckDB, SELECT count_if(COLUMNS(*) IS NULL) FROM 'file.parquet' returns one null count per column in a single row. Wrap it in UNPIVOT to get one row per column instead."
  - question: "Is approx_unique from SUMMARIZE an exact distinct count?"
    answer: "No. It is a HyperLogLog estimate, which is fast and usually close, but it can be off by a few percent. Use count(DISTINCT col) when you need the exact number."
  - question: "Does count(DISTINCT col) include NULL or NaN?"
    answer: "NULL is not counted as a distinct value. NaN in a float column is counted as one value, so a column with real numbers and NaN reports one more distinct value than you might expect."
  - question: "Can I read null counts without scanning the data?"
    answer: "Often, yes. Most writers store a null count per column chunk in the footer, which parquet_metadata() exposes. It is instant, but only as reliable as the writer that produced the file."
---

## The questions before any analysis

Before trusting a Parquet file you received, you want to know which
columns are mostly empty, which have suspiciously few distinct values and
whether "missing" means `NULL`, an empty string or `NaN`. Every query below
runs in the [SQL Workbench](/sql) on a local file without uploading it, and
works the same in the DuckDB CLI or Python.

## Start with SUMMARIZE

```sql
SUMMARIZE SELECT * FROM 'orders.parquet';
```

It returns one row per column with `column_type`, `min`, `max`,
`approx_unique`, `avg`, `std`, quartiles, `count` and `null_percentage`.
That covers most profiling needs in one statement. Two caveats:
`approx_unique` is an estimate, and `null_percentage` counts only real
`NULL`s, not blank strings or `NaN`.

## Exact null counts for every column

`COLUMNS(*)` repeats an expression for every column, so one query covers a
table of any width:

```sql
SELECT count_if(COLUMNS(*) IS NULL)
FROM 'orders.parquet';
```

The result is a single wide row. For a wide table, one row per column is
easier to read:

```sql
UNPIVOT (
  SELECT count_if(COLUMNS(*) IS NULL) FROM 'orders.parquet'
) ON COLUMNS(*)
INTO NAME column_name VALUE null_count;
```

## Exact distinct counts

```sql
SELECT count(DISTINCT COLUMNS(*))
FROM 'orders.parquet';
```

`NULL` is not counted as a value. `NaN` in a float column is counted as one
distinct value. A column whose distinct count equals the row count is a
candidate key; a "status" column with 4,000 distinct values probably has
inconsistent casing or trailing spaces.

On very large files, exact distinct counts on high-cardinality text
columns take memory. Run them on the few columns you care about, and use
`approx_unique` from `SUMMARIZE` for the rest.

## The missing values that are not NULL

Data exported from CSV or spreadsheets often stores missing values as empty
strings, and pandas pipelines produce `NaN` in float columns. Neither shows
up as `NULL`:

```sql
SELECT
  count_if(trim(customer_name) = '') AS blank_names,
  count_if(isnan(amount))            AS nan_amounts,
  count_if(customer_name IN ('N/A', 'null', '-')) AS placeholder_names
FROM 'orders.parquet';
```

If these counts are large, decide how to treat them before you aggregate:
`avg(amount)` returns `NaN` if any value in the column is `NaN`.

## Instant counts from the footer

Most Parquet writers record a null count per column chunk in the file
footer. DuckDB can sum them without reading any data pages:

```sql
SELECT path_in_schema, sum(stats_null_count) AS nulls
FROM parquet_metadata('orders.parquet')
GROUP BY ALL;
```

This is useful for multi-gigabyte files, but some writers omit the
statistics, which leaves the column `NULL`. See
[row group statistics](/docs/parquet-row-group-statistics-min-max) for what
else the footer holds.

## The pandas equivalent

```python
import pandas as pd

df = pd.read_parquet("orders.parquet")
print(df.isna().sum())   # NULL and NaN together
print(df.nunique())      # distinct, excluding NULL/NaN
```

pandas treats `NULL` and `NaN` as the same missing value, so it cannot tell
you which of the two a column contains. When that difference matters, as it
does with integer columns that turned into floats, use the SQL version.

## Quick look without SQL

To browse the schema and the first rows before profiling, drop the file
into the [Parquet Viewer](/parquet-viewer). For the same checks on a
second version of the file, the [Parquet Diff](/diff) tool reports schema
changes between the two.

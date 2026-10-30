---
slug: export-parquet-subset-to-csv
title: "Export Selected Columns or Rows from Parquet to CSV"
description: "Convert only part of a Parquet file to CSV — chosen columns, filtered rows or a reproducible random sample — with DuckDB SQL in the browser, the CLI or pyarrow."
date: "2026-10-31"
faq:
  - question: "Can I convert only some columns of a Parquet file to CSV?"
    answer: "Yes. Select the columns you want in a SQL query — SELECT id, country, amount FROM 'file.parquet' — and export the result. Parquet is columnar, so columns you leave out are never even read."
  - question: "How do I take a random sample of a Parquet file as CSV?"
    answer: "Add USING SAMPLE to the DuckDB query, for example USING SAMPLE reservoir(10000 ROWS) REPEATABLE (42). It returns exactly 10,000 random rows, and the same seed gives the same sample on the next run."
  - question: "Why does my WHERE price > 10 filter keep rows with NaN?"
    answer: "DuckDB orders NaN above every other floating-point value, so NaN > 10 is true. Add AND NOT isnan(price) to the filter if NaN values should be excluded from the export."
---

## Why export a subset

A full [Parquet to CSV conversion](/convert/parquet-to-csv) is the right
call when someone needs the whole table. Often they do not: an analyst
wants five columns out of eighty, one country's orders, or a
10,000-row sample to try in a spreadsheet. Exporting only that slice gives
a smaller file, a faster conversion and fewer columns for the recipient to
misread. Because Parquet stores each column separately, skipping columns
also means skipping their bytes entirely.

## In the browser: one query, then Download CSV

Drop the file into the [SQL Workbench](/sql), write the query for the slice
you want and click **Download CSV**. The download contains the full query
result, not only the rows rendered on screen. Nothing is uploaded; DuckDB
runs locally on WebAssembly.

If you are not sure of the column names, open the file in the
[Parquet Viewer](/parquet-viewer) first — the schema is read from the
footer instantly.

## Choosing columns

List the columns you need:

```sql
SELECT order_id, country, amount, created_at
FROM 'orders.parquet';
```

When it is easier to say what to drop, use `EXCLUDE`:

```sql
SELECT * EXCLUDE (raw_payload, debug_flags)
FROM 'orders.parquet';
```

For wide tables with naming conventions, `COLUMNS` takes a regular
expression and keeps every matching column:

```sql
SELECT order_id, COLUMNS('^price_|^qty_')
FROM 'orders.parquet';
```

## Choosing rows

Ordinary `WHERE` clauses work, and DuckDB uses row-group statistics to skip
parts of the file that cannot match:

```sql
SELECT order_id, country, amount
FROM 'orders.parquet'
WHERE country = 'JP'
  AND created_at >= DATE '2026-10-01';
```

One trap with float columns: DuckDB sorts `NaN` above every other value, so
`WHERE amount > 10` keeps rows where `amount` is `NaN`. If the column can
contain NaN, add `AND NOT isnan(amount)`.

## Taking a sample

`LIMIT 1000` gives the first rows, which are usually the oldest or a
single partition — not representative. Use `USING SAMPLE` instead:

```sql
-- exactly 10,000 random rows, same rows every time
SELECT * FROM 'orders.parquet'
USING SAMPLE reservoir(10000 ROWS) REPEATABLE (42);

-- roughly 1% of rows, sampled row by row
SELECT * FROM 'orders.parquet'
USING SAMPLE 1 PERCENT (bernoulli);
```

A bare percentage (`USING SAMPLE 1%`) defaults to system sampling, which
picks whole chunks of rows. It is faster but clustered; prefer `bernoulli`
when the sample should be spread across the whole file.

## On the command line

The same queries work in the DuckDB CLI wrapped in `COPY`:

```bash
duckdb -c "COPY (
  SELECT * EXCLUDE (raw_payload) FROM 'orders.parquet'
  WHERE country = 'JP'
) TO 'orders_jp.csv' (HEADER)"
```

## In Python with pyarrow

pyarrow can read only some columns and filter while reading, then write CSV
without pandas:

```python
import pyarrow.parquet as pq
import pyarrow.csv as pacsv

table = pq.read_table(
    "orders.parquet",
    columns=["order_id", "country", "amount"],
    filters=[("country", "=", "JP")],
)
pacsv.write_csv(table, "orders_jp.csv")
```

`write_csv` quotes every string value and leaves nulls as empty unquoted
fields. If the consumer is strict about formatting, see
[null and timestamp formatting in Parquet to CSV](/docs/parquet-to-csv-null-and-timestamp-formatting).

## Check the slice

Before sending the CSV, confirm it contains what you meant to export: run
`SELECT count(*)` with the same `WHERE` clause and compare it with the
number of data lines in the file. A count far lower than expected usually
points to a typo in a filter value or a timezone boundary on a timestamp
filter.

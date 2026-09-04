---
slug: convert-parquet-to-excel-xlsx
title: "Convert Parquet to Excel (XLSX) with DuckDB or Python"
description: "Produce a real .xlsx workbook from a Parquet file — dates stay dates, types survive — with a DuckDB one-liner or pandas, plus fixes for the two errors you will hit."
date: "2026-09-05"
faq:
  - question: "Can DuckDB write Excel files directly from Parquet?"
    answer: "Yes. The excel extension adds an xlsx writer: INSTALL excel; LOAD excel; then COPY (SELECT * FROM 'file.parquet') TO 'file.xlsx' WITH (FORMAT xlsx, HEADER true). Dates and timestamps come out as real Excel date cells."
  - question: "Why does pandas to_excel fail with 'Excel does not support datetimes with timezones'?"
    answer: "Parquet timestamps written by Spark or Arrow are usually timezone-aware, and Excel has no timezone concept. Strip it before writing with df[col].dt.tz_convert(None), which converts to UTC and drops the zone."
  - question: "What happens if the Parquet file has more than 1,048,576 rows?"
    answer: "pandas raises 'This sheet is too large' and DuckDB raises 'Sheet row limit exceeded'. Neither truncates silently. Split the rows across sheets or files, or aggregate first — no Excel worksheet can hold more."
  - question: "Is converting to CSV good enough instead?"
    answer: "Often, and it needs no install. But CSV carries no types, so Excel guesses at dates by locale and rounds long numeric IDs. XLSX keeps typed cells, which is the reason to go through the extra step."
---

## When CSV is not good enough

The quickest way into Excel is CSV — drop the file into the
[Parquet to CSV converter](/convert/parquet-to-csv) and open the result,
as described in [opening a Parquet file in Excel](/docs/open-parquet-in-excel).
That loses Parquet's types on the way, and Excel re-guesses them:
`2026-03-04` may become April 3 depending on locale, leading zeros vanish,
booleans turn into text. A real `.xlsx` keeps dates as date cells,
numbers as numbers and booleans as booleans. Two tools produce one.

## DuckDB: one COPY statement

Recent DuckDB releases ship an `excel` extension with an xlsx writer:

```sql
INSTALL excel;
LOAD excel;

COPY (SELECT * FROM 'orders.parquet')
TO 'orders.xlsx' WITH (FORMAT xlsx, HEADER true, SHEET 'orders');
```

From a shell it is one line:

```bash
duckdb -c "INSTALL excel; LOAD excel; COPY (SELECT * FROM 'orders.parquet') TO 'orders.xlsx' WITH (FORMAT xlsx, HEADER true);"
```

Details worth knowing, verified on DuckDB 1.5:

- `HEADER` defaults to **false** — forget it and the column names are gone.
- Dates, times and timestamps are written as Excel serial numbers with a
  date number format, so they behave as dates in Excel. `TIMESTAMPTZ` is
  converted to UTC and the zone is dropped.
- Booleans become `TRUE`/`FALSE` cells. Lists, structs and other
  non-numeric types are cast to text.
- `SHEET_ROW_LIMIT` defaults to 1,048,576, and the writer errors rather
  than truncating when a query exceeds it.

## pandas: to_excel and its two errors

```python
import pandas as pd

df = pd.read_parquet("orders.parquet")
df.to_excel("orders.xlsx", index=False)   # needs openpyxl or xlsxwriter
```

**Error 1: timezones.** Spark- and Arrow-written Parquet usually stores
timestamps as timezone-aware, and pandas refuses:

```text
ValueError: Excel does not support datetimes with timezones.
Please ensure that datetimes are timezone unaware before writing to Excel.
```

Convert every such column first:

```python
for col in df.select_dtypes("datetimetz").columns:
    df[col] = df[col].dt.tz_convert(None)   # UTC, zone dropped
```

Use `dt.tz_convert("Asia/Tokyo").dt.tz_localize(None)` instead if the
spreadsheet should show local time.

**Error 2: too many rows.** Past 1,048,576 rows pandas stops with
`ValueError: This sheet is too large!`. Split across sheets:

```python
LIMIT = 1_000_000
with pd.ExcelWriter("orders.xlsx", engine="xlsxwriter") as xw:
    for i, start in enumerate(range(0, len(df), LIMIT)):
        df.iloc[start:start + LIMIT].to_excel(xw, sheet_name=f"part{i + 1}", index=False)
```

`xlsxwriter` is considerably faster than `openpyxl` for large writes;
either way, expect Excel output to be an order of magnitude slower than
CSV, so filtering before exporting pays off.

## Two type traps that survive the conversion

**Long integer IDs.** Excel keeps 15 significant digits in any number
cell, xlsx included, so an `int64` order ID like `4523891027365412789`
gets its trailing digits zeroed. Cast such columns to text before
exporting — `CAST(order_id AS VARCHAR)` in DuckDB or `.astype(str)` in
pandas.

**Nested columns.** Lists and structs become one text cell per row in
both tools. If you need their fields as columns, flatten first
(see [flattening nested Parquet columns](/docs/flatten-nested-parquet-columns)).

## Check the file before converting

Drop the Parquet file into the [Parquet Viewer](/parquet-viewer): the
schema tab shows which columns are timestamps with a zone, which are
nested and how many rows there are — all read from the footer in under a
second. If the row count is above the limit, do not fight it: run an
aggregate or a filter in the [SQL Workbench](/sql) and export the slice a
spreadsheet can actually use.

---
slug: convert-excel-xlsx-to-parquet
title: "How to Convert an Excel File (XLSX) to Parquet"
description: "Get a spreadsheet into Parquet without pandas: export the sheet as CSV, convert it in your browser, and fix the types Excel mangled on the way out."
date: "2026-08-29"
faq:
  - question: "Can I convert XLSX to Parquet without installing Python?"
    answer: "Yes. Save the sheet as CSV from Excel, then run it through the CSV to Parquet converter on this site. The conversion happens in an in-browser DuckDB build on WebAssembly, so the spreadsheet never leaves your machine."
  - question: "Why do my leading zeros disappear when converting Excel to Parquet?"
    answer: "Excel drops them when it treats a code like 00123 as a number, and the loss happens before any converter sees the file. Format the column as Text in the sheet, or read the column as a string and cast it explicitly during conversion."
  - question: "What happens to a workbook with several sheets?"
    answer: "Parquet has no concept of sheets or tabs, so each sheet becomes its own file. Export each sheet as a separate CSV, convert each one, and stack them afterwards with UNION ALL BY NAME if they share a schema."
  - question: "Do Excel formulas survive the conversion?"
    answer: "No. Parquet stores values, not formulas, so each cell keeps only its last computed result. Recalculate the workbook before exporting so that no stale or error values are written into the output file."
---

## Why there is no direct XLSX to Parquet button

An XLSX file is a zipped bundle of worksheets, styles, formulas and merged
cells. Parquet is a columnar table with one fixed schema. The conversion is
not a format swap so much as a decision about which rectangle of cells is
actually the table — which is why every reliable route goes through a flat
CSV first.

## The no-install route

1. In Excel, select the sheet you want and choose **File → Save As →
   CSV UTF-8 (Comma delimited)**. Pick UTF-8 explicitly; the plain "CSV"
   option writes a legacy code page and mangles non-ASCII text.
2. Drop the CSV into the [CSV to Parquet converter](/convert/csv-to-parquet).
   Types are inferred, the output is Zstd-compressed, and everything runs
   locally in your browser.
3. Verify the result in the [Parquet Viewer](/parquet-viewer) — check the
   column types before anything downstream depends on them.

Before step 1, make the sheet look like a table: one header row, no merged
cells, no blank rows above the header, no totals row at the bottom, and no
notes in a stray column to the right. Anything else becomes a phantom column
or a row of nulls in the Parquet output.

## Fixing the types Excel broke

Spreadsheets are untyped by habit, so the CSV usually needs a pass before it
becomes a well-typed Parquet file. Drop the CSV into the
[SQL Workbench](/sql) and shape it there:

```sql
SELECT
  CAST(order_id AS VARCHAR)                   AS order_id,
  strptime(order_date, '%d/%m/%Y')            AS order_date,
  CAST(replace(amount, ',', '') AS DOUBLE)    AS amount,
  nullif(trim(notes), '')                     AS notes
FROM 'orders.csv';
```

Three things this handles, all of them common:

- **Locale formatting.** A German or French workbook writes `1.234,56`.
  Strip the thousands separator and normalize the decimal mark before
  casting, or the value silently lands as text.
- **Ambiguous dates.** `03/04/2026` is March 4 or April 3 depending on who
  saved the file. `strptime` with an explicit format removes the guesswork;
  never let inference decide this one.
- **Codes that look numeric.** Postcodes, SKUs and account numbers must stay
  `VARCHAR`, or `00123` becomes `123` and joins start failing.

Download the corrected result as CSV, run it through the converter, and the
Parquet file carries real types.

## If you do have a local toolchain

DuckDB (1.2 and newer) reads XLSX directly through its `excel` extension, so
the CSV hop disappears:

```sql
INSTALL excel; LOAD excel;
COPY (SELECT * FROM read_xlsx('orders.xlsx', sheet = 'Orders'))
TO 'orders.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);
```

The pandas equivalent needs `openpyxl` installed alongside it:

```python
import pandas as pd

df = pd.read_excel("orders.xlsx", sheet_name="Orders", dtype={"order_id": "string"})
df.to_parquet("orders.parquet", compression="zstd")
```

Pass `dtype=` for every identifier column. Without it, pandas infers `int64`
for code columns and the leading zeros are gone before you can object.

## Size limits, in both directions

A worksheet holds at most 1,048,576 rows, so any Excel export is small by
Parquet standards and conversion is quick. The interesting limit is the
return trip: a Parquet file with tens of millions of rows will not fit back
into a sheet. When that is the goal, filter or aggregate first — the
[open Parquet in Excel](/docs/open-parquet-in-excel) guide covers that
direction.

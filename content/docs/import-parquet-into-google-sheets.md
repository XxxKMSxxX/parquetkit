---
slug: import-parquet-into-google-sheets
title: "How to Import a Parquet File into Google Sheets"
description: "Google Sheets cannot open Parquet. Convert it to CSV locally, stay under the 10-million-cell limit, and keep IDs, leading zeros and dates intact on import."
date: "2026-10-24"
faq:
  - question: "Can Google Sheets open a Parquet file directly?"
    answer: "No. Sheets imports CSV, TSV, XLSX and a few other spreadsheet formats, but not Parquet. Convert the file to CSV first, ideally after filtering it down to the rows and columns you actually need."
  - question: "How much data fits in Google Sheets?"
    answer: "A spreadsheet holds at most 10 million cells across all of its tabs, and a single cell holds up to 50,000 characters. Rows times columns is what counts, so dropping unused columns raises the row ceiling directly."
  - question: "Why do my IDs show up as 1.23457E+18 in Sheets?"
    answer: "Sheets stores numbers as double-precision floats with about 15 significant digits, so longer integer IDs get rounded. Cast them to text before exporting, or untick the option to convert text to numbers when importing."
  - question: "Is my data uploaded when I convert it on ParquetKit?"
    answer: "No. The Parquet to CSV conversion and the SQL Workbench run in your browser via WebAssembly. Only the CSV you choose to import into Google Sheets leaves your machine."
---

## Why you can't just upload it

Google Sheets imports CSV, TSV, XLSX and ODS, but not Parquet. If you upload
a `.parquet` file to Drive and try to open it, Drive offers no Sheets
option. So the route is the same as for Excel: **Parquet → CSV → Sheets.**
The interesting part is getting a CSV that Sheets can actually hold and
won't mangle.

## Step 1: check the size against the cell limit

A Google spreadsheet holds at most **10 million cells**, counted across
every tab. That ceiling is rows × columns, not rows alone: a 40-column
file runs out at 250,000 rows.

Drop the file into the [SQL Workbench](/sql) and check:

```sql
SELECT count(*) AS rows FROM 'orders.parquet';
DESCRIBE SELECT * FROM 'orders.parquet';
```

Multiply rows by columns. If the result is anywhere near 10 million, cut
the data down before exporting. Even well under the limit, Sheets slows
down noticeably once you get into the millions of cells.

## Step 2: shape the export with SQL

Pick only the columns the sheet needs, filter the rows, and turn risky
types into safe text in the same query:

```sql
SELECT
  CAST(order_id AS VARCHAR)            AS order_id,   -- 19-digit IDs survive
  customer_code,                                      -- already text: '00123'
  strftime(created_at, '%Y-%m-%d %H:%M:%S') AS created_at,
  region,
  amount
FROM 'orders.parquet'
WHERE created_at >= TIMESTAMP '2026-09-01';
```

Each cast does a specific job:

- **Long integer IDs.** Sheets keeps about 15 significant digits, so an
  `INT64` ID like `1234567890123456789` comes back rounded. Exporting it as
  text keeps it exact.
- **Timestamps.** An unambiguous `YYYY-MM-DD HH:MM:SS` string parses as a
  date in every locale. Convert to the time zone your audience expects
  before formatting; Parquet often stores UTC.
- **Nested columns.** Structs and lists come out as long text blobs.
  Flatten them first; see
  [flattening nested columns](/docs/flatten-nested-parquet-columns).

If a summary is what the sheet is really for, aggregate instead. A
`GROUP BY region, month` gives you a few hundred rows, and that is a far
better spreadsheet than two million raw ones.

Run the query and download the result as CSV. For a whole file with no
reshaping, the [Parquet to CSV converter](/convert/parquet-to-csv) does the
same thing in one drop.

## Step 3: import with the right options

In Google Sheets, open **File → Import → Upload** and pick the CSV. The
dialog asks two things:

1. **Import location.** Create a new spreadsheet, insert a new sheet,
   replace the current sheet, or append to it. Appending is useful for
   adding a monthly extract to an existing tab, but it counts toward the
   same 10-million-cell ceiling.
2. **Convert text to numbers, dates, and formulas.** With this ticked,
   Sheets strips leading zeros from codes like `00123`, rounds long IDs and
   treats any value starting with `=` as a formula. Untick it when your data
   has codes or untrusted text, and then format the date and amount columns
   yourself.

Leave the separator on *Detect automatically* unless you exported with a
non-comma delimiter.

## Check what arrived

Compare the row count in the sheet (the last row number minus the header)
with the `count(*)` from step 1. Then spot-check three things: an ID column
for rounding, a code column for lost leading zeros, and a date column for
day/month swaps. Fixing these now is much cheaper than after someone has
built a pivot table on top.

## When Sheets is the wrong tool

If the filtered data still won't fit, Sheets isn't the right destination.
Keep the analysis in SQL and export only the results, or use Excel, which
fits 1,048,576 rows per sheet (see
[converting Parquet to Excel](/docs/convert-parquet-to-excel-xlsx)). Teams
already on BigQuery can query large tables from Sheets through Connected
Sheets without importing the raw rows at all.

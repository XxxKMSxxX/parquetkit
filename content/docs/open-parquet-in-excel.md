---
slug: open-parquet-in-excel
title: "How to Open a Parquet File in Excel (Step by Step)"
description: "Excel cannot read Parquet natively. Convert the file to CSV in your browser — and trim oversized files with SQL first — to get it into a spreadsheet."
faq:
  - question: "Does Excel support Parquet natively?"
    answer: "No. Double-clicking a .parquet file does nothing useful. Power Query in some Microsoft 365 builds can import Parquet, but availability varies by version and platform, so CSV conversion remains the reliable route."
  - question: "What is Excel's maximum row count?"
    answer: "A worksheet holds at most 1,048,576 rows. A CSV with more rows than that gets silently truncated on open, so filter or sample large Parquet files before converting."
  - question: "Will converting to CSV lose data?"
    answer: "Values are preserved, but Parquet's type information is not — timestamps, decimals and nested structures become plain text that Excel re-interprets. Check date and ID columns after opening."
---

## The short answer

Excel has no native Parquet support — there is no way to double-click a
`.parquet` file and see a spreadsheet. Power Query can import Parquet in some
Microsoft 365 builds, but it is buried several menus deep and unavailable in
many versions, including most Mac installs. The dependable route is:
**convert the Parquet file to CSV, then open the CSV in Excel.** Both steps
take under a minute.

## Step 1: Convert Parquet to CSV in your browser

Open the [Parquet to CSV converter](/convert/parquet-to-csv) and drop your
file. The conversion runs on WebAssembly inside your browser tab — the file
is never uploaded to a server, which matters when the data is confidential.
Download the resulting CSV and open it in Excel like any other spreadsheet.

If you first want to check what the file contains — column names, types, a
sample of rows — drag it into the [Parquet Viewer](/parquet-viewer) before
converting.

## Step 2: Mind the 1,048,576-row limit

An Excel worksheet caps out at **1,048,576 rows**. Parquet files routinely
exceed that, because the format is built for exactly the datasets
spreadsheets struggle with. Open a larger CSV and Excel loads the first
million-ish rows and drops the rest — often without an error you would
notice.

If your file might be over the limit, check first. In the
[SQL Workbench](/sql), drop the file and run:

```sql
SELECT count(*) FROM 'data.parquet';
```

## Step 3: Shrink oversized files with SQL first

When the count is too high, do not hand Excel the whole file — hand it the
slice you actually need. The workbench runs DuckDB in your browser, so you
can filter, sample or aggregate before exporting:

```sql
-- Just the recent rows
SELECT *
FROM 'data.parquet'
WHERE order_date >= DATE '2026-01-01';

-- A capped preview for eyeballing
SELECT * FROM 'data.parquet' LIMIT 100000;

-- Often the best fix: aggregate, then export thousands of rows, not millions
SELECT region, product, sum(amount) AS revenue
FROM 'data.parquet'
GROUP BY region, product;
```

Run the query, download the result as CSV, and open that in Excel. An
aggregated summary is usually what the spreadsheet was for anyway — pivot
tables get dramatically faster too.

## What about Power Query?

If you have a Windows Microsoft 365 build with Parquet support, *Data → Get
Data → From File → From Parquet* works and preserves types. It is worth
using when your whole team is on the same modern Excel version. But because
support is inconsistent across versions, platforms and corporate installs,
CSV remains the format you can send to anyone with confidence.

## Watch for type surprises

CSV is untyped, so Excel guesses: long numeric IDs get rounded into
scientific notation, `2026-03-04` may flip between March 4 and April 3
depending on locale, and leading zeros vanish. After opening, spot-check
date and identifier columns — or import via *Data → From Text/CSV*, which
lets you set column types explicitly.

## Summary

1. Count rows in the [SQL Workbench](/sql) if the file might be large.
2. Filter or aggregate with SQL when it exceeds 1,048,576 rows.
3. [Convert to CSV](/convert/parquet-to-csv) locally in your browser.
4. Open in Excel and verify dates and IDs survived the trip.

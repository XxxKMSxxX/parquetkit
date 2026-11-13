---
slug: open-large-csv-file-with-duckdb
title: "Open a CSV File Too Large for Excel with DuckDB"
description: "Excel stops at 1,048,576 rows and text editors freeze on multi-GB CSVs. Preview, filter and summarize huge CSV files with DuckDB, in a terminal or the browser."
date: "2026-11-14"
faq:
  - question: "Does DuckDB load the whole CSV into memory?"
    answer: "No. DuckDB streams the file. A LIMIT query reads only the first chunk, and aggregates like count(*) scan the file without holding all rows in memory, so files larger than RAM work."
  - question: "Can DuckDB read a gzipped CSV directly?"
    answer: "Yes. Files ending in .csv.gz are decompressed on the fly, so SELECT * FROM 'export.csv.gz' LIMIT 20 works without unzipping first. Expect scans to be slower than on the uncompressed file."
  - question: "Why does a query fail halfway through with a conversion error?"
    answer: "DuckDB guesses column types from a sample of rows. If a value deep in the file does not fit the guessed type, the scan fails at that line. Set the column type explicitly or use store_rejects to collect the bad rows."
  - question: "Can I do this without installing DuckDB?"
    answer: "Yes. Drop the CSV into the SQL Workbench on parquetkit.com. It runs DuckDB in your browser through WebAssembly, so the same queries work and the file is never uploaded."
---

## Why the usual tools fail

A 3 GB CSV export has two common outcomes. Excel loads the first 1,048,576 rows,
warns that the rest did not load, and you have no way to know what was
cut. A text editor tries to load the whole file into memory and freezes.

DuckDB avoids both problems. It queries the CSV where it sits, reads only what
the query needs, and handles files larger than your RAM. You get a
spreadsheet-like preview plus SQL to filter and summarize.

## Preview the first rows

With the DuckDB CLI installed (a single binary from
[duckdb.org](https://duckdb.org/docs/installation/)), you can query the file by name:

```sh
duckdb -c "SELECT * FROM 'export.csv' LIMIT 20"
```

The sniffer detects the delimiter, the header and the quoting, so semicolon
or tab-separated files usually work unchanged. To see what it decided:

```sql
SELECT Delimiter, HasHeader, Columns FROM sniff_csv('export.csv');
DESCRIBE SELECT * FROM 'export.csv';
```

Wide tables are hard to read in the default box layout. In the interactive
shell, `.mode line` prints one field per line, which is easier for checking a
single record.

## Answer questions without opening it

The whole point is not to scroll 40 million rows. Ask instead:

```sql
-- How many rows are there really?
SELECT count(*) FROM 'export.csv';

-- Only the rows you care about
SELECT * FROM 'export.csv'
WHERE country = 'DE' AND order_date >= DATE '2026-01-01'
LIMIT 100;

-- Per-column min, max, null % and distinct count
SUMMARIZE SELECT * FROM 'export.csv';
```

To get a slice that Excel *can* open, write the filtered result to a new
file:

```sql
COPY (SELECT * FROM 'export.csv' WHERE country = 'DE')
TO 'export_de.csv' (HEADER);
```

## When type detection gets it wrong

DuckDB infers types from a sample of rows, not the whole file. Two problems
come up often.

**A conversion error partway through the file.** Every sampled value of
`qty` is a number, but a row the sample missed contains `N/A`:

```text
Conversion Error: CSV Error on Line: 2381907
Error when converting column "qty". Could not convert string "N/A" to 'BIGINT'
```

The error names the line, so you can see what is in the data. Then tell
DuckDB what the value means, or set the type yourself:

```sql
SELECT * FROM read_csv('export.csv',
  nullstr = 'N/A',
  types = {'qty': 'INTEGER', 'customer_id': 'VARCHAR'});
```

If a few rows are malformed and you need to see them, collect them with
`store_rejects` instead of skipping them:

```sql
SELECT * FROM read_csv('export.csv', store_rejects = true);
SELECT line, column_name, error_type, csv_line FROM reject_errors;
```

**IDs that should stay text.** Values with leading zeros such as `01234`
are detected as `VARCHAR`. A long numeric ID without them becomes `BIGINT`, though,
and loses formatting you may need. Declare those columns as `VARCHAR` in
`types`, or use `all_varchar = true` to read everything as text while
exploring.

## Prefer a GUI?

`duckdb -ui` opens DuckDB's local web interface, which gives you a results
grid for the same queries. If you would rather not install anything, the
[SQL Workbench](/sql) runs the same engine in your browser. Drop the CSV in
and query it by filename (`SELECT * FROM 'export.csv' LIMIT 20`). Nothing is
uploaded.

## If you will open it again, convert it once

Every query on a CSV re-parses text. If you will keep using the file,
convert it to Parquet once. It ends up several times smaller, keeps the
types you fixed above, and later queries run much faster:

```sql
COPY (SELECT * FROM read_csv('export.csv', types = {'customer_id': 'VARCHAR'}))
TO 'export.parquet' (FORMAT parquet, COMPRESSION zstd);
```

The [CSV to Parquet converter](/convert/csv-to-parquet) does this in the
browser, and the result opens instantly in the
[Parquet Viewer](/parquet-viewer). For a folder of CSV files, see
[Combine Multiple CSV Files into One Parquet File](/docs/combine-csv-files-into-one-parquet).
For the size and speed trade-offs, see [Parquet vs CSV](/docs/parquet-vs-csv).

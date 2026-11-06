---
slug: verify-parquet-to-csv-conversion
title: "Verify a Parquet to CSV Conversion Didn't Lose Data"
description: "Prove a CSV export matches its source Parquet file: row counts, column profiles and an exact typed row comparison in DuckDB SQL, plus the usual places data goes missing."
date: "2026-11-07"
faq:
  - question: "Why does wc -l give a different row count than the Parquet file?"
    answer: "wc -l counts newline characters, not records. It includes the header line, and any text value containing a line break is quoted and spread over several lines. Count rows with a CSV parser such as DuckDB's read_csv instead."
  - question: "Can I compare a CSV and a Parquet file without casting types?"
    answer: "Not reliably. Auto-detection may read an ID with leading zeros as an integer or a timestamp as text, and then values that are actually equal compare as different. Read the CSV with the Parquet column types passed explicitly."
  - question: "Which column types usually change in a CSV export?"
    answer: "Nested lists and structs become text, binary columns become escaped strings, time-zone-aware timestamps are rendered in the session time zone, and some writers turn empty strings into the same empty field as NULL."
---

## Why check at all

Converting Parquet to CSV feels lossless, but CSV has no types, no NULL
marker and no nesting. The converter makes a choice for each of those, and
you usually only find out which choice when a downstream load fails or a
total doesn't reconcile. If the CSV is going to a client, an auditor or a
system you can't easily re-run, spend two minutes proving it matches.

Every query below runs in the [SQL Workbench](/sql): drop both the source
`.parquet` and the exported `.csv` onto the page and they're registered under
their filenames. It all runs locally in DuckDB-WASM, so nothing is uploaded.
The same SQL works in the `duckdb` CLI.

## Step 1: count rows with a parser, not wc

```sql
SELECT
  (SELECT count(*) FROM read_parquet('orders.parquet')) AS parquet_rows,
  (SELECT count(*) FROM read_csv('orders.csv'))         AS csv_rows;
```

Skip `wc -l`. It counts the header line, and any text value that
contains a line break is quoted and spread over several lines. Customer
notes and addresses do this all the time.

## Step 2: compare the column lists

```sql
DESCRIBE SELECT * FROM read_parquet('orders.parquet');
DESCRIBE SELECT * FROM read_csv('orders.csv');
```

The names and their order should match exactly. The types will differ where
CSV auto-detection guessed (a `VARCHAR` zip code read back as `BIGINT`, a
`DECIMAL(18,2)` read back as `DOUBLE`). That's expected. Write down the
Parquet types, because the next step uses them.

## Step 3: profile both sides

`SUMMARIZE` gives min, max, approximate distinct count and null percentage
per column in one call:

```sql
SUMMARIZE SELECT * FROM read_parquet('orders.parquet');
SUMMARIZE SELECT * FROM read_csv('orders.csv');
```

Put the two results side by side and look for three things:

- **`null_percentage` going up or down.** If it rises, empty strings became
  NULL. If it falls, NULLs were written as a literal such as `NaN` or `None`
  and are now read back as text.
- **`min`/`max` shifting on timestamps.** That's usually a time-zone
  conversion.
- **Text columns whose min starts with a digit** where the Parquet column
  had leading zeros. The export kept them, but the re-read dropped them.

## Step 4: exact row comparison with typed reads

To prove the data is identical, read the CSV with the Parquet types forced,
then take a set difference in both directions:

```sql
CREATE TEMP TABLE csv_typed AS
SELECT * FROM read_csv('orders.csv',
  types = {'order_id': 'VARCHAR', 'amount': 'DECIMAL(18,2)',
           'created_at': 'TIMESTAMP'});

SELECT 'missing_from_csv' AS side, * FROM (
  SELECT * FROM read_parquet('orders.parquet') EXCEPT ALL SELECT * FROM csv_typed)
UNION ALL
SELECT 'extra_in_csv', * FROM (
  SELECT * FROM csv_typed EXCEPT ALL SELECT * FROM read_parquet('orders.parquet'));
```

Zero rows back means every row survived with its exact values. `EXCEPT ALL`
keeps duplicates, so a row that is in the Parquet twice but only once in the
CSV still shows up. When rows do come back, the two sides usually differ in
a single column, which tells you which conversion rule to fix.

## Where CSV exports usually lose data

- **NULL vs empty string.** DuckDB writes NULL as an empty field and quotes
  an empty string as `""`, so the two stay distinct. pandas `to_csv` writes
  both as an empty field, so the difference is lost. See
  [controlling nulls and timestamps in CSV](/docs/parquet-to-csv-null-and-timestamp-formatting).
- **Floats.** A `float_format="%.2f"` in pandas quietly rounds everything.
  DuckDB and the default pandas settings write values that round-trip exactly.
- **Time zones.** `TIMESTAMP WITH TIME ZONE` values are written in the
  session time zone with an offset, so they're the same instant in a
  different wall-clock form. Compare them as `TIMESTAMPTZ`, not as text.
- **Nested columns.** Lists and structs come out as text like `[1, 2]` or
  `{'sku': 'A1'}`. CSV can't hold them faithfully, so either
  [flatten them](/docs/flatten-nested-parquet-columns) before export or
  exclude them from the comparison.
- **Binary.** `BLOB` columns become escaped `\x..` text. Leave them out of
  the CSV unless a consumer actually needs them.

If you're still producing the file, export it with the
[Parquet to CSV converter](/convert/parquet-to-csv), then run Steps 1 and 4
before you send it anywhere.

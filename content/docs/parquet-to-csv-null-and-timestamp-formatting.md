---
slug: parquet-to-csv-null-and-timestamp-formatting
title: "Parquet to CSV: Control Nulls, Timestamps and Quoting"
description: "Your exported CSV has NaN, shifted timestamps or mangled accents. How to control null strings, date formats, delimiters and encoding when writing CSV."
date: "2026-09-19"
faq:
  - question: "How do I stop pandas writing NaN for missing values in CSV?"
    answer: "Pass na_rep to to_csv: df.to_csv('out.csv', index=False, na_rep=''). Without it pandas writes the literal text NaN for floats and an empty field for object columns, so the same missing value is encoded two different ways in one file."
  - question: "How do I control the timestamp format when exporting Parquet to CSV?"
    answer: "In DuckDB, set TIMESTAMPFORMAT and DATEFORMAT in the COPY options, for example TIMESTAMPFORMAT '%Y-%m-%d %H:%M:%S'. In pandas, pass date_format to to_csv. Both take strftime-style patterns."
  - question: "Why did my timestamps shift by a few hours in the CSV?"
    answer: "Parquet timestamps marked as UTC-adjusted are rendered in the reader's session time zone. Run SET TimeZone = 'UTC' in DuckDB before the COPY, or convert explicitly, so the text output is not tied to the machine that produced it."
  - question: "Why are accented characters broken when I open the CSV in Excel?"
    answer: "DuckDB and pyarrow write UTF-8 without a byte order mark, and Excel on Windows assumes the local ANSI code page instead. Write with encoding='utf-8-sig' from pandas, or open the file through Excel's Data From Text import and pick UTF-8."
---

## The default output is a guess

Converting Parquet to CSV is easy; the friction comes afterwards, when the
file reaches a loader, a spreadsheet or a colleague and something looks
wrong. Parquet stores typed values plus an explicit null flag. CSV stores
text. Every writer has to invent a text representation for nulls, dates,
floats and embedded separators, and the defaults differ per tool. Setting
them explicitly is the whole job.

## Nulls

Decide once what a missing value looks like and make both sides agree:

```sql
COPY (SELECT * FROM 'events.parquet')
TO 'events.csv' (HEADER, NULLSTR '');
```

An empty field is the usual choice, because most loaders read it back as
NULL. If the destination distinguishes "empty string" from "missing", pick a
sentinel that cannot occur in the data, such as `NULLSTR '\N'` (the MySQL and
Postgres convention).

pandas needs the same instruction, and its default is worse — float columns
get the literal text `NaN` while object columns get an empty field:

```python
df.to_csv("events.csv", index=False, na_rep="")
```

## Timestamps and dates

Parquet timestamps carry a unit and a UTC flag; CSV carries neither. Pin the
time zone before formatting so the output does not depend on the laptop that
ran the export:

```sql
SET TimeZone = 'UTC';
COPY (SELECT * FROM 'events.parquet')
TO 'events.csv' (
  HEADER,
  NULLSTR '',
  DATEFORMAT '%Y-%m-%d',
  TIMESTAMPFORMAT '%Y-%m-%dT%H:%M:%SZ'
);
```

ISO 8601 is the safest default: unambiguous, sortable as text, and parsed by
every loader. Avoid `%d/%m/%Y`, which a US-locale reader will silently
misread for the first twelve days of each month. In pandas the equivalent is
`date_format="%Y-%m-%dT%H:%M:%SZ"`.

## Delimiters, quotes and long numbers

```sql
COPY (SELECT * FROM 'events.parquet')
TO 'events.csv' (HEADER, DELIMITER ';', QUOTE '"', FORCE_QUOTE (order_id, zip));
```

Three things worth setting deliberately:

- **Delimiter.** A European Excel locale expects `;`. If a text column can
  contain your delimiter, quoting handles it, but a mismatched delimiter and
  locale produces a single-column import every time.
- **Forced quoting.** Identifiers with leading zeros (`00734`) and 18-digit
  IDs survive the file fine, but Excel converts them to numbers on open
  unless they arrive quoted — and even then, prefer XLSX via the
  [Parquet to Excel guide](/docs/convert-parquet-to-excel-xlsx) when types
  matter.
- **Floats.** Full repr precision makes noisy diffs. `float_format="%.4f"`
  in pandas, or `round(amount, 4)` in the DuckDB `SELECT`, gives stable
  output.

## Encoding

DuckDB and pyarrow write UTF-8 without a BOM. That is correct, and Excel on
Windows still misreads it. If the file is destined for a spreadsheet, either
export from pandas with `encoding="utf-8-sig"` or tell the recipient to
import rather than double-click.

## Nested columns

List and struct columns have no CSV representation, so writers serialize
them as text blobs in one cell. If the structure matters, flatten first or
export [JSON](/convert/parquet-to-json) instead.

## Verify before shipping

Open the result in the [SQL Workbench](/sql) and read it back with the same
settings you wrote:

```sql
SELECT count(*), count(order_id), min(created_at), max(created_at)
FROM read_csv('events.csv', header = true, nullstr = '');
```

If `count(*)` and `count(order_id)` differ by more than the null count in the
source — check the source footer in the [Parquet Viewer](/parquet-viewer) —
an unquoted delimiter split a row. That is the single most common silent
corruption in CSV exports, and it shows up in ten seconds this way.

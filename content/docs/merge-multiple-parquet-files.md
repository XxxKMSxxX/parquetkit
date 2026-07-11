---
slug: merge-multiple-parquet-files
title: "How to Merge Multiple Parquet Files into One"
description: "Combine several Parquet files into a single dataset with DuckDB SQL in your browser — including files whose schemas don't quite match — or with pyarrow."
faq:
  - question: "Can I merge Parquet files without installing anything?"
    answer: "Yes. Drop the files into the browser SQL Workbench on this site and UNION them with one DuckDB query. Everything runs locally on WebAssembly; nothing is uploaded."
  - question: "What if the files have different columns?"
    answer: "Use UNION ALL BY NAME. It matches columns by name instead of position, fills columns missing from a file with NULL, and keeps every column that appears in any input."
  - question: "Does merging remove duplicate rows?"
    answer: "UNION ALL keeps every row from every file, including duplicates. If you want duplicates collapsed, use UNION (without ALL) or add SELECT DISTINCT around the combined result."
---

## The situation

Exports arrive as one Parquet file per day, per region or per batch job —
`sales_jan.parquet`, `sales_feb.parquet`, and so on — and you need them as a
single dataset. You do not need Spark for this. A short SQL query in the
browser, or a few lines of Python, gets it done.

## Merge in the browser with SQL

Open the [SQL Workbench](/sql) and drop **all** the files in at once. Each
file is registered under its own filename and is immediately queryable.
Stacking them is one `UNION ALL`:

```sql
SELECT * FROM 'sales_jan.parquet'
UNION ALL BY NAME
SELECT * FROM 'sales_feb.parquet'
UNION ALL BY NAME
SELECT * FROM 'sales_mar.parquet';
```

One thing to know: the workbench registers each dropped file by its exact
name, so reference files individually as shown — glob patterns like
`'sales_*.parquet'` or `read_parquet` with a wildcard have nothing to expand
against in the browser. List each filename explicitly.

## Why `BY NAME` matters

Plain `UNION ALL` matches columns **by position**: if one file was exported
with columns in a different order, values silently land in the wrong
columns, or the query errors on a type mismatch. `UNION ALL BY NAME` matches
columns **by name** instead, which makes it the safe default for files that
were produced at different times:

- Reordered columns are aligned correctly.
- A column present in only some files is kept, padded with `NULL` elsewhere.
- Schema drift — a field added in March that January lacks — merges cleanly
  instead of failing.

It is also worth tagging where each row came from:

```sql
SELECT *, 'jan' AS source FROM 'sales_jan.parquet'
UNION ALL BY NAME
SELECT *, 'feb' AS source FROM 'sales_feb.parquet'
ORDER BY source;
```

## Check and export the result

Before exporting, sanity-check that the row counts add up:

```sql
SELECT source, count(*) FROM merged GROUP BY source;
```

(Or simply `count(*)` on the combined query versus each input.) Then run the
merge query and click *Download CSV* to save the combined dataset. If the
destination is a spreadsheet, that CSV opens directly; if you want to keep
the data in Parquet, round-trip the CSV through the
[CSV to Parquet converter](/convert/csv-to-parquet), which re-infers types
and writes compressed output. To verify the final file, drop it into the
[Parquet Viewer](/parquet-viewer).

## Alternative: Python with pyarrow

If the files already live next to a Python environment, `pyarrow` merges
them without any SQL:

```python
import pyarrow.parquet as pq
import pyarrow as pa

files = ["sales_jan.parquet", "sales_feb.parquet", "sales_mar.parquet"]
tables = [pq.read_table(f) for f in files]

merged = pa.concat_tables(tables, promote_options="default")
pq.write_table(merged, "sales_all.parquet", compression="zstd")
```

`promote_options="default"` is the pyarrow counterpart of `BY NAME`: it
unifies differing schemas and fills missing columns with nulls. Drop it and
`concat_tables` requires identical schemas.

## Which route to pick

Use the browser when the files are on your laptop and you want the merge —
plus any filtering or deduplication — done in the next two minutes with
nothing installed. Use pyarrow when the merge is part of a pipeline that
runs repeatedly, or when the output must stay in Parquet without a CSV
round-trip.

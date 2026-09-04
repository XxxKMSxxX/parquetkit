---
slug: large-parquet-to-csv-without-running-out-of-memory
title: "Convert a Large Parquet File to CSV Without Running Out of Memory"
description: "pandas dies converting a multi-GB Parquet file to CSV? Stream it instead — DuckDB COPY, pyarrow batches or Polars sink_csv write the CSV without loading it all."
date: "2026-09-05"
faq:
  - question: "Why does pandas run out of memory converting Parquet to CSV?"
    answer: "read_parquet decodes the entire file into memory, and string columns become Python objects that take several times the space of the compressed Parquet. Then to_csv builds the text on top. A 2 GB Parquet file can need 20 GB of RAM this way."
  - question: "What is the most memory-efficient way to convert Parquet to CSV?"
    answer: "Stream it. DuckDB's COPY reads one row group at a time and writes CSV as it goes, so memory stays bounded regardless of file size. pyarrow's iter_batches and Polars' sink_csv do the same from Python."
  - question: "Can I write the CSV compressed to save disk space?"
    answer: "Yes. DuckDB picks gzip or zstd from the output extension (.csv.gz or .csv.zst), and Polars sink_csv takes a compression argument. Most downstream tools, including pandas and DuckDB, read gzip CSV directly."
  - question: "Does the browser converter handle large files?"
    answer: "The converter reads the Parquet file by reference, so input size is not the problem; the CSV output is assembled in browser memory. For very large outputs, select only the columns you need in the SQL Workbench first, or use a streaming CLI route."
---

## Why the obvious script dies

```python
import pandas as pd
pd.read_parquet("events.parquet").to_csv("events.csv", index=False)
```

This works at 200 MB and gets killed at 5 GB, and the reason is a memory
multiplier, not a bug. Parquet is columnar and compressed; `read_parquet`
decodes every column into memory, and string columns turn into individual
Python objects that cost far more than their compressed bytes. Then
`to_csv` renders the text. A 2 GB Parquet file with a few string columns
can easily want 20 GB of RAM before a single line reaches disk — hence
`MemoryError`, or a process silently killed by the OS.

The fix is the same in every tool: never hold the whole table. Read a row
group or a batch, write it as CSV, drop it, repeat. Three ways to do that.

## Fix 1: DuckDB streams by default

```bash
duckdb -c "COPY (SELECT * FROM 'events.parquet') TO 'events.csv' (HEADER);"
```

DuckDB reads row groups as it writes, so memory stays flat whether the
file is 500 MB or 50 GB. Two settings make it bulletproof for big jobs:

```sql
SET memory_limit = '4GB';
SET temp_directory = '/tmp/duck_spill';

COPY (
  SELECT id, ts, amount
  FROM 'events.parquet'
  WHERE ts >= '2026-01-01'
) TO 'events.csv.gz' (HEADER);
```

The `.csv.gz` extension is enough: DuckDB detects gzip (or zstd for
`.csv.zst`) from the filename. Selecting three columns instead of thirty
shrinks the output proportionally, and the `WHERE` is applied while
reading. Avoid `ORDER BY` on huge exports — sorting has to see all rows,
which is exactly the case `memory_limit` and `temp_directory` exist to
spill to disk.

## Fix 2: pyarrow, one batch at a time

If Python is already in the pipeline, skip pandas and let pyarrow write
the CSV incrementally:

```python
import pyarrow.parquet as pq
import pyarrow.csv as pcsv

pf = pq.ParquetFile("events.parquet")
with pcsv.CSVWriter("events.csv", pf.schema_arrow) as writer:
    for batch in pf.iter_batches(batch_size=100_000):
        writer.write(batch)
```

Peak memory is roughly one batch, not the file. Pass
`columns=["id", "ts", "amount"]` to `iter_batches` to skip columns you
do not need. Note that the Arrow CSV writer quotes every string value,
which is valid CSV but looks different from pandas output.

## Fix 3: Polars sink_csv

```python
import polars as pl

(
    pl.scan_parquet("events.parquet")
    .select("id", "ts", "amount")
    .sink_csv("events.csv.gz", compression="gzip")
)
```

`scan_parquet` is lazy and `sink_csv` runs the streaming engine, so the
projection and any `.filter()` are pushed into the Parquet reader and the
result is written straight to disk. `read_parquet` followed by
`write_csv` would materialize everything — the `scan`/`sink` pair is the
whole point.

## The disk is the other limit

CSV is 5–10x larger than Parquet for typical tabular data, so a 3 GB
Parquet file becomes a 20–30 GB CSV. Check free space before starting,
write gzip when the consumer can read it, and ask whether the consumer
needs every column at all. If the real goal is a smaller file for a
spreadsheet or a colleague, filtering or aggregating first usually beats
converting everything.

## In the browser

The [Parquet to CSV converter](/convert/parquet-to-csv) reads the input by
reference and never uploads it, so a large *input* is fine; the CSV output,
however, is assembled in the tab's memory. For big files, open the
[SQL Workbench](/sql), select the columns and rows you need, and use
*Download CSV* on the result — the same projection trick as above, with no
install. If the whole thing must come out, split the file first
(see [splitting a large Parquet file](/docs/split-large-parquet-file)).

## Verify the output

Compare the row count against the Parquet footer — the
[Parquet Viewer](/parquet-viewer) shows it instantly without scanning
data — and check `wc -l events.csv` minus the header line. For gzip
output, `zcat events.csv.gz | wc -l` does the same.

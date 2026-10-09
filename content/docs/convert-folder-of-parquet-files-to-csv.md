---
slug: convert-folder-of-parquet-files-to-csv
title: "Batch Convert a Folder of Parquet Files to CSV"
description: "Convert every Parquet file in a directory to its own CSV in one go — with a DuckDB shell loop, PowerShell, a pyarrow script, or a multi-file drop in the browser."
date: "2026-10-10"
faq:
  - question: "Can DuckDB convert many Parquet files to separate CSV files in one SQL statement?"
    answer: "Not cleanly. COPY writes one output (or a partitioned directory tree), so the simplest reliable approach is a shell loop that runs one COPY per input file. Each run streams the file, so memory stays flat."
  - question: "How do I get one combined CSV instead of one CSV per file?"
    answer: "Read the whole folder with a glob and copy the result once: COPY (SELECT * FROM read_parquet('data/*.parquet', union_by_name=true)) TO 'all.csv' (HEADER). union_by_name lines up columns by name when files differ."
  - question: "Can I batch convert Parquet to CSV without installing anything?"
    answer: "Yes. Drop several files at once onto the browser Parquet to CSV converter on this site. Each one is converted locally with DuckDB WebAssembly and gets its own CSV named after the input file."
  - question: "Why do some CSVs in the batch have different columns?"
    answer: "Each Parquet file carries its own schema, and a per-file conversion preserves it. If a pipeline added or dropped a column partway through, the CSVs will differ too. Use union_by_name when combining, or select an explicit column list."
---

## The situation

A pipeline dropped forty Parquet files into `exports/` — one per day,
partition or job run — and the downstream consumer wants CSV. Not one big
CSV, but `2026-10-01.csv`, `2026-10-02.csv` and so on, one per input. This
is a loop problem, not a SQL problem, and it takes one line in most shells.

## DuckDB in a shell loop (macOS / Linux)

DuckDB is a single binary, streams each file, and handles every common
Parquet codec. Loop over the files and run one `COPY` per file:

```bash
mkdir -p csv
for f in exports/*.parquet; do
  name=$(basename "$f" .parquet)
  duckdb -c "COPY (SELECT * FROM '$f') TO 'csv/$name.csv' (HEADER, DELIMITER ',')"
done
```

Each run starts a fresh in-memory DuckDB, so a 5 GB file in the middle of
the batch does not hold memory for the rest of the loop. CSV options go
inside the `COPY` parentheses: `HEADER`, `DELIMITER ';'`, `NULLSTR ''`.

## PowerShell (Windows)

```powershell
New-Item -ItemType Directory -Force csv | Out-Null
Get-ChildItem exports\*.parquet | ForEach-Object {
  $out = "csv\$($_.BaseName).csv"
  duckdb -c "COPY (SELECT * FROM '$($_.FullName)') TO '$out' (HEADER)"
}
```

## pyarrow, streaming per batch

If DuckDB is not available but pyarrow is, convert batch by batch so no
file is ever fully loaded:

```python
from pathlib import Path
import pyarrow.parquet as pq
import pyarrow.csv as pv

out_dir = Path("csv")
out_dir.mkdir(exist_ok=True)

for src in sorted(Path("exports").glob("*.parquet")):
    pf = pq.ParquetFile(src)
    with pv.CSVWriter(out_dir / f"{src.stem}.csv", pf.schema_arrow) as writer:
        for batch in pf.iter_batches(batch_size=100_000):
            writer.write_batch(batch)
    print(f"{src.name}: {pf.metadata.num_rows} rows")
```

Avoid the `pd.read_parquet(f).to_csv(...)` pattern for large batches — it
loads each whole file into memory, and nulls in integer columns turn into
floats (`42.0`) in the output.

## In the browser, no install

The [Parquet to CSV converter](/convert/parquet-to-csv) accepts multiple
files in one drop. Select every file in the folder, and each is converted
locally with DuckDB WebAssembly into a CSV named after its source
(`2026-10-01.parquet` becomes `2026-10-01.csv`). A *Download all* button
saves the batch. Nothing is uploaded, which matters when the folder holds
customer data.

## Check the batch before you ship it

Two quick checks catch most problems:

- **Row counts match.** Compare each input with
  `SELECT count(*) FROM 'exports/2026-10-01.parquet'` against `wc -l`
  on the CSV (minus one for the header). A mismatch usually means a
  string column contains embedded newlines — still valid quoted CSV, but
  worth knowing before someone splits it by line.
- **Schemas agree.** Count schema entries per file in the
  [SQL Workbench](/sql) or the CLI:
  `SELECT file_name, count(*) FROM parquet_schema('exports/*.parquet') GROUP BY ALL ORDER BY 2`.
  A file with a different count will produce a CSV with different
  headers.

If what you actually need is a single file, read the folder with a glob
and write once — see [merging multiple Parquet files](/docs/merge-multiple-parquet-files).
For null strings, date formats and quoting, see
[Parquet to CSV formatting options](/docs/parquet-to-csv-null-and-timestamp-formatting).

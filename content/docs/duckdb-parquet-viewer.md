---
slug: duckdb-parquet-viewer
title: "DuckDB Parquet Viewer Options Compared: CLI, UI, and Browser"
description: "DuckDB can view Parquet files through its CLI, its local web UI, Python, or a browser-based tool. Here is how each works and when to pick one."
date: "2026-08-01"
faq:
  - question: "Does DuckDB have a built-in Parquet viewer?"
    answer: "Yes, several. The duckdb CLI can query and display files directly, and running duckdb -ui launches a local web interface with a schema browser and results grid, both without any separate viewer application."
  - question: "What is the fastest way to preview a Parquet file with DuckDB?"
    answer: "From the CLI: duckdb -c \"SELECT * FROM 'file.parquet' LIMIT 20\". It requires DuckDB installed but no server, no table creation, and returns a formatted result in under a second for files of any size."
  - question: "Can I browse a Parquet file with DuckDB without installing anything?"
    answer: "Yes. A browser-based tool running DuckDB-WASM gives you the same query engine and a file browser with zero install — useful on a locked-down machine or when you just want a one-off look."
  - question: "Does DuckDB's UI upload my file anywhere?"
    answer: "No, both the CLI and the duckdb -ui local web interface run entirely on your machine and read files from local disk. A browser-based WASM tool is similarly local as long as it states files never leave the device."
---

## Four ways to view a Parquet file with DuckDB

"DuckDB viewer" usually means one of four different things, and which one
you want depends on whether you're willing to install anything and whether
you need to run SQL or just want to eyeball the data.

### 1. The DuckDB CLI

The fastest option if DuckDB is already installed. No table creation, no
import step — DuckDB treats the file path as a table reference directly:

```sql
duckdb -c "DESCRIBE SELECT * FROM 'orders.parquet'"
duckdb -c "SELECT * FROM 'orders.parquet' LIMIT 20"
duckdb -c "SUMMARIZE SELECT * FROM 'orders.parquet'"
```

`SUMMARIZE` is worth knowing specifically for viewing purposes — it returns
per-column min, max, approximate distinct count and null percentage in one
call, which is often more useful than scrolling rows when you're getting
oriented in an unfamiliar file.

### 2. `duckdb -ui` — the local web interface

Recent DuckDB versions ship a built-in web UI:

```bash
duckdb -ui
```

This opens a local browser tab with a schema tree, a SQL editor and a
results grid — closer to a desktop database client than the CLI, but still
running entirely on your machine with no server to configure. It's the
right choice when you want to click through a schema and scroll results
rather than type every query, but still want the full DuckDB SQL dialect
available.

### 3. Python + DuckDB

For viewing inside a notebook or existing analysis:

```python
import duckdb

duckdb.sql("SELECT * FROM 'orders.parquet' LIMIT 20").show()
duckdb.sql("DESCRIBE SELECT * FROM 'orders.parquet'").show()
```

Useful mainly when the viewing step is one line in a longer script — not
worth the overhead if all you want is a look at the file.

### 4. Browser-based DuckDB (no install)

DuckDB compiles to WebAssembly, which is what powers browser tools like
the [SQL Workbench](/sql) and [Parquet Viewer](/parquet-viewer) on this
site. You get the DuckDB engine and dialect with zero install, on a
locked-down laptop, a Chromebook, or someone else's machine — drop a file
in and query it immediately, or just browse the schema and a row sample
without writing SQL. Because it's WASM running client-side, files never
get uploaded anywhere, which matters for anything you can't put on a
random SaaS tool.

## Which one to reach for

- **Already have DuckDB installed, need one quick answer** → CLI one-liner.
- **Exploring an unfamiliar file interactively, want to click around** →
  `duckdb -ui`.
- **Viewing is a step in a larger script or notebook** → Python + duckdb.
- **No install, shared machine, or just want a fast look** → the
  [browser-based viewer](/parquet-viewer), or [SQL Workbench](/sql) once
  you need joins or aggregates across multiple files.

All four ultimately use the same query engine and give consistent results
— the choice is about environment and workflow, not correctness. If you're
comparing schemas across two files rather than viewing one, the
[Parquet Diff](/diff) tool is the more direct route than any of the above.

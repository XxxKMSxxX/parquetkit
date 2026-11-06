---
slug: open-duckdb-database-file
title: "How to Open and View a .duckdb Database File"
description: "Someone sent you a .duckdb file. List its tables, preview rows and open it read-only with the CLI, the built-in UI or Python, and fix the lock and version errors."
date: "2026-11-07"
faq:
  - question: "How do I tell whether a .db file is DuckDB or SQLite?"
    answer: "Look at the first bytes. A SQLite file starts with the text 'SQLite format 3', while a DuckDB file has the four characters DUCK at byte offset 8. Running head -c 16 file.db | xxd shows which one you have."
  - question: "Why do I get 'Could not set lock on file' when opening a DuckDB file?"
    answer: "Another process, often a Python notebook or a DBeaver session, has the file open for writing, and DuckDB allows only one writer process at a time. Close that connection. Read-only mode lets several readers share the file, but only when no writer holds it."
  - question: "Can I open a .duckdb file in a browser-based Parquet tool?"
    answer: "Not directly. Export the tables to Parquet with EXPORT DATABASE or COPY, then open the Parquet files in a browser viewer, where they can be read and queried without installing anything."
---

## A .duckdb file is a whole database

Unlike a Parquet or CSV file, a `.duckdb` file holds a whole database: any
number of schemas, tables and views in DuckDB's own storage format. Only
DuckDB can read it. So "viewing" it means opening it with some DuckDB
client and finding out what's inside.

First, make sure it really is DuckDB. Files are often named `.db`:

```bash
head -c 16 data.db | xxd
```

`DUCK` at offset 8 means DuckDB. `SQLite format 3` at the start means
SQLite, which DuckDB can still read with `ATTACH 'data.db' (TYPE SQLITE)`.

## Option 1: the DuckDB CLI

Open the file read-only so you can't change it by accident:

```bash
duckdb -readonly analytics.duckdb
```

Then get oriented:

```sql
SHOW ALL TABLES;                 -- every schema, table and its columns
.tables                          -- just the names
DESCRIBE orders;                 -- columns and types of one table
SELECT * FROM orders LIMIT 20;   -- preview rows
SUMMARIZE orders;                -- min, max, nulls, distinct per column
```

For an overview with sizes:

```sql
SELECT schema_name, table_name, estimated_size, column_count
FROM duckdb_tables()
ORDER BY estimated_size DESC;
```

`estimated_size` is the row count DuckDB keeps in its catalog, so this is
instant even for big tables. Views live in `duckdb_views()`. They hold no
data and may point to files or extensions that don't exist on your machine.

## Option 2: the built-in web UI

```bash
duckdb -ui analytics.duckdb
```

This opens a local web interface with a table tree, a SQL editor and a
results grid. It's a good choice if you'd rather click through tables than
type `DESCRIBE` for each one. It runs on your machine, and the database
file is read from local disk.

## Option 3: Python or a desktop client

```python
import duckdb

con = duckdb.connect("analytics.duckdb", read_only=True)
con.sql("SHOW ALL TABLES").show()
df = con.sql("SELECT * FROM orders LIMIT 1000").df()
```

GUI clients such as DBeaver also have a DuckDB driver. Keep in mind that
the client's bundled DuckDB version decides which files it can open (see
below).

## Error: "Could not set lock on file"

DuckDB lets one process write to a database file at a time. If a notebook
kernel, a running script or DBeaver has the file open in read-write mode,
every other process gets this error. The message includes the PID that
holds the lock. Close that connection or stop the kernel. `-readonly` lets
several readers share the file, but it can't get past an active writer.

## Error: database file version not supported

Files from DuckDB versions before 0.10 used a storage format that later
versions can't read. Newer DuckDB versions read files from older ones, but
an old CLI can't open a file written by a newer DuckDB. The fix is almost
always to upgrade the client you're opening it with. For a pre-0.10 file,
open it with the matching old version, `EXPORT DATABASE` it, and import
that into the current version.

## View the data without installing DuckDB

If you just want to look at the tables, export them to Parquet once and
share those instead of the database file:

```sql
EXPORT DATABASE 'analytics_export' (FORMAT parquet);
```

Each table becomes its own `.parquet` file, which you can open in the
[Parquet Viewer](/parquet-viewer) or query and join in the
[SQL Workbench](/sql) with no install. Both run DuckDB in the browser
locally. See [exporting DuckDB tables to Parquet](/docs/export-duckdb-table-to-parquet)
for per-table `COPY` options, and the
[DuckDB viewer comparison](/docs/duckdb-parquet-viewer) if your goal is
browsing Parquet files rather than a database.

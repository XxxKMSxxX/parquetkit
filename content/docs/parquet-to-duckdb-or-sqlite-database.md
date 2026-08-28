---
slug: parquet-to-duckdb-or-sqlite-database
title: "Load a Parquet File into a DuckDB or SQLite Database"
description: "Turn Parquet files into a queryable .duckdb or .sqlite database file — with the right commands, the type traps, and when to skip the import entirely."
date: "2026-08-29"
faq:
  - question: "Do I need to import Parquet into DuckDB before querying it?"
    answer: "No. DuckDB reads Parquet files in place with read_parquet(), including glob patterns across a directory. Import only when you want a single portable database file, or when repeated queries over the same data should avoid re-scanning the files."
  - question: "How do I convert a Parquet file to SQLite?"
    answer: "Load DuckDB's sqlite extension, ATTACH a database file with TYPE SQLITE, and run CREATE TABLE ... AS SELECT * FROM read_parquet('file.parquet'). DuckDB writes the rows straight into the SQLite file, with no intermediate CSV."
  - question: "Does the schema survive the import?"
    answer: "Into DuckDB, yes — types map one to one. Into SQLite, no: it has only five storage classes, so DECIMAL becomes a float, timestamps become text or numbers, and nested columns have no representation at all."
  - question: "How large a Parquet file can I import?"
    answer: "DuckDB streams the data instead of loading it into memory, so files much larger than RAM import fine. The practical limit is disk space for the resulting database, which is usually several times the compressed Parquet size."
---

## First: do you actually need the import?

DuckDB queries Parquet files directly, so a lot of "convert Parquet to a
database" work is unnecessary:

```sql
SELECT region, sum(amount)
FROM read_parquet('sales/*.parquet')
GROUP BY region;
```

Import when you need something the files cannot give you: a single portable
file to hand someone, indexes, a target for a BI tool or ORM that speaks
SQLite, or write access to the data.

## Parquet into a DuckDB database file

One command, no session needed:

```bash
duckdb analytics.duckdb -c "CREATE TABLE sales AS SELECT * FROM read_parquet('sales/*.parquet')"
```

Inside an existing session, attach the target and create the table there:

```sql
ATTACH 'analytics.duckdb' AS db;
CREATE TABLE db.sales AS SELECT * FROM read_parquet('sales/*.parquet');
```

The glob reads every matching file as one table, and column types carry over
exactly — including `TIMESTAMP`, `DECIMAL`, `LIST` and `STRUCT`.

If the files change but the queries should stay current, create a view
instead of a table. The database file then holds the query, not the data:

```sql
CREATE VIEW sales AS SELECT * FROM read_parquet('sales/*.parquet');
```

Note that a view stores the file paths as written, so it breaks if the
database file is moved to a machine where those paths do not exist.

## Parquet into SQLite

DuckDB's `sqlite` extension writes directly into a SQLite file:

```sql
INSTALL sqlite; LOAD sqlite;
ATTACH 'analytics.sqlite' AS lite (TYPE SQLITE);
CREATE TABLE lite.sales AS SELECT * FROM read_parquet('sales.parquet');
```

Then index it with the `sqlite3` CLI, where the syntax is unambiguous:

```bash
sqlite3 analytics.sqlite "CREATE INDEX idx_sales_order_id ON sales(order_id);"
```

SQLite's type system is the part that bites. It has five storage classes —
`NULL`, `INTEGER`, `REAL`, `TEXT`, `BLOB` — so:

- **`DECIMAL` becomes a float.** Money columns lose exactness. Cast to
  integer minor units first: `CAST(amount * 100 AS BIGINT)`.
- **Timestamps stop being timestamps.** Decide the representation yourself
  rather than accepting the default, for example
  `strftime(ts, '%Y-%m-%d %H:%M:%S') AS ts`, and keep it consistent across
  tables so comparisons still work.
- **Nested columns have no target type.** Flatten `STRUCT` columns into
  scalar ones before the import — see
  [flatten nested Parquet columns](/docs/flatten-nested-parquet-columns) —
  or serialize them with `to_json(payload)`.
- **`UBIGINT` values above 2^63 overflow.** SQLite integers are signed
  64-bit. Store those as text if the range is genuinely used.

Do the casting in the `SELECT`, not afterwards:

```sql
CREATE TABLE lite.sales AS
SELECT
  order_id,
  CAST(amount * 100 AS BIGINT)        AS amount_cents,
  strftime(created_at, '%Y-%m-%d')    AS created_on,
  to_json(payload)                    AS payload_json
FROM read_parquet('sales.parquet');
```

## Check the file before you import it

An import inherits every problem in the source. Two minutes of inspection
first is cheaper than debugging a loaded table: open the file in the
[Parquet Viewer](/parquet-viewer) to read its schema and row count, and use
the [SQL Workbench](/sql) to try the casts and confirm row counts before
committing them to a database file. Both run entirely in the browser, so
nothing is uploaded.

## Verifying the result

Compare counts on both sides, and spot-check a numeric total rather than
trusting the row count alone:

```sql
SELECT count(*), sum(amount_cents) FROM lite.sales;
```

A matching row count with a drifting sum is the classic signature of a
silent type conversion — exactly the failure mode the casts above prevent.

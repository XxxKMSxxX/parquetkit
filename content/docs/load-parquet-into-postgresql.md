---
slug: load-parquet-into-postgresql
title: "How to Load a Parquet File into PostgreSQL"
description: "Import Parquet into a Postgres table with DuckDB's postgres extension or via CSV and psql's \\copy, including type mapping, struct columns and NULL handling."
date: "2026-10-31"
faq:
  - question: "Can PostgreSQL read Parquet files natively?"
    answer: "Not out of the box. COPY in core Postgres reads text, CSV and binary formats only. You either convert the data on the way in, with DuckDB or a CSV export, or install a server-side Parquet extension."
  - question: "Why does DuckDB fail with 'Composite types in Postgres must be named'?"
    answer: "A Parquet STRUCT column maps to an unnamed composite type, which the postgres extension cannot create. Convert the column with to_json(col) so it lands as a json column, or flatten its fields into separate columns."
  - question: "Do NULLs survive the CSV route?"
    answer: "Yes. DuckDB writes NULL as an empty unquoted field and an empty string as a quoted pair of double quotes. Postgres CSV mode reads them back as NULL and empty string respectively."
  - question: "What happens to unsigned integer columns?"
    answer: "Postgres has no unsigned integers. DuckDB maps UBIGINT to numeric(20,0) so no value overflows. If you know the values fit, cast to BIGINT before loading to get a smaller, faster column."
---

## Postgres has no Parquet reader

`COPY` in core PostgreSQL reads text, CSV and its own binary format, so
`COPY orders FROM 'orders.parquet'` is not an option on a standard install.
There are two reliable routes that need nothing installed on the server:
DuckDB writing straight into Postgres, or a CSV export loaded with `\copy`.
Both were checked against PostgreSQL with DuckDB 2.0.

## Route 1: DuckDB's postgres extension

DuckDB can attach a Postgres database and write into it like a local
schema. It reads the Parquet file and sends the rows in one step:

```sql
INSTALL postgres;
LOAD postgres;

ATTACH 'dbname=shop user=etl host=127.0.0.1' AS pg (TYPE postgres);

CREATE TABLE pg.public.orders AS
SELECT * FROM 'orders.parquet';
```

Keep the password out of the connection string; the extension uses libpq,
so `PGPASSWORD` or a `~/.pgpass` file works. To add more files to the
same table later:

```sql
INSERT INTO pg.public.orders
SELECT * FROM 'orders_2026_11.parquet';
```

DuckDB creates the table with mapped types: `BIGINT` to `bigint`,
`VARCHAR` to `character varying`, `TIMESTAMP WITH TIME ZONE` to
`timestamptz`, `DECIMAL(10,2)` to `numeric(10,2)` and `INTEGER[]` to
`integer[]`. Two types need attention.

**Structs fail.** A `STRUCT` column stops the load with
`Composite types in Postgres must be named`. Convert it to JSON in the
same statement:

```sql
CREATE TABLE pg.public.orders AS
SELECT * REPLACE (to_json(address) AS address)
FROM 'orders.parquet';
```

The column arrives as `json`. Use `ALTER TABLE ... TYPE jsonb` afterwards if
you want to index it. To get separate columns instead, see
[flattening nested Parquet columns](/docs/flatten-nested-parquet-columns).

**Unsigned integers grow.** `UBIGINT` becomes `numeric(20,0)` because
Postgres has no unsigned type. If the values fit, `CAST(col AS BIGINT)`
gives a smaller column.

## Route 2: CSV and psql's \copy

When DuckDB cannot reach the database directly, for example through a
bastion host or a locked-down network, export CSV and load it with
`psql`. First look at the column types:

```sql
DESCRIBE SELECT * FROM 'orders.parquet';
```

Create the table by hand from that output:

```sql
CREATE TABLE orders (
  order_id   bigint,
  customer   text,
  created_at timestamptz,
  amount     numeric(10,2)
);
```

Export with the [Parquet to CSV converter](/convert/parquet-to-csv) in the
browser, or with the CLI:

```bash
duckdb -c "COPY (SELECT order_id, customer, created_at, amount
  FROM 'orders.parquet') TO 'orders.csv' (HEADER)"
```

Then load it from the client side:

```bash
psql -d shop -c "\copy orders FROM 'orders.csv' WITH (FORMAT csv, HEADER true)"
```

`\copy` reads the file on your machine, so it works without file access on
the server, unlike plain `COPY`. NULLs round-trip correctly: DuckDB writes
`NULL` as an empty field and an empty string as `""`, and Postgres CSV mode
reads them back the same way. Timestamps with time zones include their
offset, so they land on the correct instant.

List and struct columns do not fit CSV well. Drop them with `EXCLUDE`, or
convert them with `to_json()` and declare the target column as `jsonb`.

## Verify the load

Compare row counts on both sides:

```sql
-- DuckDB
SELECT count(*) FROM 'orders.parquet';
-- Postgres
SELECT count(*) FROM orders;
```

Then spot-check a few null-heavy columns with `count(col)` on both sides.
If you have not inspected the file yet, the
[Parquet Viewer](/parquet-viewer) shows the schema and row count without
uploading anything. For a quick query that does not need a database, the
[SQL Workbench](/sql) may answer the question without any import.

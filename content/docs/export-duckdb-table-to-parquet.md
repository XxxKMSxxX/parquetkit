---
slug: export-duckdb-table-to-parquet
title: "Export a DuckDB Table or Database to Parquet Files"
description: "Write DuckDB tables and query results to Parquet with COPY TO, tune compression and row groups, partition the output, or dump a whole .duckdb file with EXPORT DATABASE."
date: "2026-10-17"
faq:
  - question: "How do I export a DuckDB table to Parquet?"
    answer: "Run COPY my_table TO 'my_table.parquet' (FORMAT parquet); in the DuckDB CLI or Python. Any SELECT query can be exported the same way by wrapping it in parentheses."
  - question: "How do I export every table in a .duckdb file at once?"
    answer: "Use EXPORT DATABASE 'out_dir' (FORMAT parquet);. It writes one Parquet file per table plus schema.sql and load.sql, so the database can be recreated later with IMPORT DATABASE."
  - question: "Which compression should I use when exporting from DuckDB?"
    answer: "DuckDB defaults to Snappy. ZSTD usually produces noticeably smaller files at similar read speed and is supported by pyarrow, Spark and modern query engines, so it is a good choice for files you will keep."
  - question: "How can I check the exported Parquet file is correct?"
    answer: "Open it in a Parquet viewer to confirm the schema and row count, or query parquet_metadata('file.parquet') in DuckDB to see row groups, compression and statistics per column."
---

## The situation

You did your cleaning in DuckDB — maybe in a persistent `analytics.duckdb`
file — and now someone needs the result as Parquet: a Spark job, a data lake
bucket, a colleague with pandas. A `.duckdb` file is only readable by DuckDB;
Parquet is readable by everything. The export is one statement.

## Export a table or a query

```sql
-- whole table
COPY orders TO 'orders.parquet' (FORMAT parquet);

-- any query
COPY (
  SELECT order_id, customer_id, amount, created_at
  FROM orders
  WHERE created_at >= DATE '2026-01-01'
) TO 'orders_2026.parquet' (FORMAT parquet);
```

From a shell, without opening an interactive session:

```bash
duckdb analytics.duckdb -c "COPY orders TO 'orders.parquet' (FORMAT parquet)"
```

From Python, the same SQL works through `duckdb.connect("analytics.duckdb").execute(...)`,
or with the relational API: `con.table("orders").write_parquet("orders.parquet")`.

## Options worth setting

```sql
COPY orders TO 'orders.parquet' (
  FORMAT parquet,
  COMPRESSION zstd,
  ROW_GROUP_SIZE 1000000
);
```

- **`COMPRESSION`** — `snappy` (default), `zstd`, `gzip` or `uncompressed`.
  ZSTD is typically the best size/speed trade-off; see the
  [codec comparison](/docs/parquet-compression-snappy-vs-gzip-vs-zstd).
- **`ROW_GROUP_SIZE`** — rows per row group. Larger groups compress better;
  smaller ones let readers skip more data with min/max statistics. The
  default (around 122,880 rows) is fine for most files; raise it for big
  analytical tables.
- **Sort before writing.** `ORDER BY` the column people filter on most
  (often a date). Row group statistics then become tight ranges, and
  filtered reads skip most of the file.

## Partitioned output

For a data lake layout, write a directory instead of a single file:

```sql
COPY (SELECT *, year(created_at) AS year FROM orders)
TO 'orders_lake' (FORMAT parquet, PARTITION_BY (year), OVERWRITE_OR_IGNORE);
```

This produces `orders_lake/year=2025/data_0.parquet` and so on, which Spark,
Athena and DuckDB itself read as a [Hive-partitioned
dataset](/docs/read-partitioned-parquet-dataset). Keep partition columns
low-cardinality — partitioning by `customer_id` creates thousands of tiny
files.

## Export the whole database

```sql
EXPORT DATABASE 'analytics_export' (FORMAT parquet, COMPRESSION zstd);
```

You get one Parquet file per table, plus `schema.sql` (the `CREATE`
statements, including views and sequences) and `load.sql`. Running
`IMPORT DATABASE 'analytics_export'` in a fresh DuckDB rebuilds everything.
This is also the reliable way to move data between DuckDB versions whose
storage formats differ.

## Type gotchas

- **`HUGEINT` and `UHUGEINT`** have no Parquet equivalent; DuckDB writes them
  as `DOUBLE`, losing precision. Cast to `DECIMAL(38,0)` or `VARCHAR` first.
- **`TIMESTAMP WITH TIME ZONE`** is stored as UTC with the adjusted-to-UTC
  flag. Readers that ignore the flag show UTC wall-clock times.
- **`ENUM`** columns become plain strings (dictionary-encoded), so the list
  of allowed values does not survive the round trip.
- **`UNION`** columns are written as a plain struct of a tag plus one field
  per member, which other engines will not interpret as a union. Pick the
  member you need, or cast to `VARCHAR`, before exporting.

## Verify the output

Before shipping the file, drop it into the [Parquet Viewer](/parquet-viewer)
to check column names, types and row count — it runs locally, so nothing
leaves your machine. In DuckDB you can also inspect the physical layout:

```sql
SELECT row_group_id, path_in_schema, compression, num_values
FROM parquet_metadata('orders.parquet');
```

If a consumer also needs CSV or JSON, convert the result with
[Parquet to CSV](/convert/parquet-to-csv) or
[Parquet to JSON](/convert/parquet-to-json) instead of re-exporting.

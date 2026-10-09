---
slug: read-parquet-key-value-metadata
title: "Read Parquet Key-Value Metadata (pandas, Spark, created_by)"
description: "Every Parquet footer stores key-value metadata: the writer, the pandas index, Spark's schema, custom tags. Read it with DuckDB SQL or pyarrow, and write your own."
date: "2026-10-10"
faq:
  - question: "What is key-value metadata in a Parquet file?"
    answer: "A list of string key and value pairs stored in the file footer alongside the schema. Writers use it for their own bookkeeping, such as pandas index info or the Arrow schema, and you can add custom entries like a source system or pipeline version."
  - question: "Why does parquet_kv_metadata return BLOB values?"
    answer: "The Parquet format does not guarantee the bytes are valid text, so DuckDB returns BLOBs. Wrap key and value in decode() to get VARCHAR when they are UTF-8, which is the case for the common pandas, Arrow and Spark keys."
  - question: "Can I read Parquet metadata without downloading the whole file?"
    answer: "Yes. Metadata lives in the footer at the end of the file, so DuckDB and pyarrow read only those bytes. Over HTTP or S3 that means a few kilobytes even for a multi-GB file."
  - question: "Does rewriting a Parquet file keep its key-value metadata?"
    answer: "Not necessarily. A rewrite with DuckDB or Spark produces a new footer from that writer, so pandas or custom entries from the original can disappear. Copy them explicitly if downstream code depends on them."
---

## What lives in the footer

Besides the schema and row group statistics, a Parquet footer has a
free-form list of key-value pairs. You rarely see it, but it answers
questions that matter when a file behaves oddly:

- **`created_by`** (a dedicated field, not a pair) — the writer and
  version, such as `parquet-cpp-arrow version 17.0.0` or
  `parquet-mr version 1.13.1`.
- **`pandas`** — a JSON document with the pandas version, which columns
  were the index, and the original dtype of each column.
- **`ARROW:schema`** — the serialized Arrow schema, used by pyarrow to
  restore types like timezone-aware timestamps and dictionary columns.
- **`org.apache.spark.version`** and
  **`org.apache.spark.sql.parquet.row.metadata`** — written by Spark, the
  latter holding Spark's own schema as JSON.
- Anything a pipeline added: `source`, `run_id`, `schema_version`.

## Read it with DuckDB SQL

`parquet_kv_metadata()` lists the pairs. Keys and values come back as
BLOBs, so decode them:

```sql
SELECT decode(key) AS key, decode(value) AS value
FROM parquet_kv_metadata('orders.parquet');
```

The writer and basic counts come from `parquet_file_metadata()`:

```sql
SELECT created_by, num_rows, num_row_groups, format_version
FROM parquet_file_metadata('orders.parquet');
```

Both accept globs, which turns them into an audit tool for a whole
folder — for example, which files were written by which job:

```sql
SELECT file_name, created_by
FROM parquet_file_metadata('exports/*.parquet')
ORDER BY created_by;
```

To pull a field out of the pandas JSON, use DuckDB's JSON functions:

```sql
SELECT json_extract_string(decode(value), '$.pandas_version') AS pandas_version,
       json_extract(decode(value), '$.index_columns')        AS index_columns
FROM parquet_kv_metadata('orders.parquet')
WHERE decode(key) = 'pandas';
```

All of these run in the [SQL Workbench](/sql) too: drop the file and
query it by filename. The file stays in your browser, and only the
footer is parsed.

## Read it with pyarrow

```python
import json
import pyarrow.parquet as pq

meta = pq.read_metadata("orders.parquet")
print(meta.created_by, meta.num_rows, meta.num_row_groups)

kv = meta.metadata or {}
for key, value in kv.items():
    print(key.decode(), value[:80])

pandas_meta = json.loads(kv[b"pandas"]) if b"pandas" in kv else None
```

`read_metadata` only touches the footer, so it is fast on large files.
`pq.read_schema(path).pandas_metadata` is a shortcut for the pandas
block.

## Write your own metadata

Tagging files with where they came from saves a lot of guesswork later.
In DuckDB, add `KV_METADATA` to the `COPY` options:

```sql
COPY (SELECT * FROM 'orders.csv')
TO 'orders.parquet'
(FORMAT parquet, KV_METADATA {source: 'crm', run_id: '2026-10-10T02:00'});
```

In pyarrow, merge with the existing schema metadata rather than replacing
it, or you will drop the `pandas` and `ARROW:schema` entries:

```python
table = pq.read_table("orders.parquet")
merged = {**(table.schema.metadata or {}), b"source": b"crm"}
pq.write_table(table.replace_schema_metadata(merged), "orders_tagged.parquet")
```

## When metadata explains a bug

- **The index reappears as a column** (`__index_level_0__`): the file
  came from pandas with a non-default index. The `pandas` block shows it
  under `index_columns`.
- **Timestamps lose their timezone** in one reader but not another: one
  reader uses `ARROW:schema`, the other ignores it.
- **Types differ across files in a dataset**: compare `created_by`
  across the folder to find the file written by a different engine. See
  [finding which file drifted](/docs/parquet-column-data-type-mismatch).

For the schema itself, see
[printing a Parquet schema](/docs/print-parquet-schema-without-installing);
for per-column statistics, see
[row group min/max statistics](/docs/parquet-row-group-statistics-min-max).

---
slug: convert-json-array-to-parquet
title: "Convert a JSON Array File to Parquet (Not JSONL)"
description: "Turn a regular JSON file — one big array or an API response with a data key — into typed Parquet with DuckDB read_json, and fix the size and schema errors it hits."
date: "2026-10-17"
faq:
  - question: "What is the difference between JSON and JSONL for conversion?"
    answer: "JSONL has one complete object per line, so it can be read in a stream. A JSON array is a single value wrapped in brackets. DuckDB reads both, but arrays need format = 'array' and very large ones are slower to parse."
  - question: "How do I convert only the records inside a key like data or results?"
    answer: "Read the file as one object, then unnest the array: SELECT unnest(data, recursive := true) FROM read_json('response.json'). Export that query to Parquet with COPY ... TO."
  - question: "Why do I get a maximum_object_size error?"
    answer: "DuckDB limits a single JSON value to 16 MB by default. When the whole file is one object wrapping an array, raise the limit with maximum_object_size set to a value larger than the file size in bytes."
  - question: "Can I convert a JSON array without installing anything?"
    answer: "Yes. Drop the .json file into the browser SQL Workbench and query it with read_json. For simplest results, convert it to JSONL first and use the JSONL to Parquet converter, which runs locally."
---

## The situation

An API dump or export tool gave you `events.json` that looks like this:

```json
[
  {"id": 1, "user": {"name": "Ana", "plan": "pro"}, "tags": ["a", "b"], "ts": "2026-10-01T09:12:00Z"},
  {"id": 2, "user": {"name": "Ben", "plan": "free"}, "tags": [], "ts": "2026-10-01T09:15:30Z"}
]
```

It is not JSONL — it is one array — and you want Parquet so it is smaller,
typed and queryable. DuckDB handles this without pandas.

## Plain array of objects

```sql
COPY (
  SELECT * FROM read_json('events.json', format = 'array')
) TO 'events.parquet' (FORMAT parquet, COMPRESSION zstd);
```

`read_json` samples the records and infers a schema: `id` becomes `BIGINT`,
`ts` becomes `TIMESTAMP`, `user` becomes a `STRUCT(name VARCHAR, plan VARCHAR)`
and `tags` a `VARCHAR[]`. Those nested types are written as native Parquet
structs and lists, not as JSON strings. Check what was inferred before
writing:

```sql
DESCRIBE SELECT * FROM read_json('events.json', format = 'array');
```

As a one-liner from a shell:

```bash
duckdb -c "COPY (FROM read_json('events.json', format='array')) TO 'events.parquet' (FORMAT parquet)"
```

## Records wrapped in an object

Many APIs return `{"count": 2, "data": [ ... ]}`. Read the outer object and
unnest the array:

```sql
COPY (
  SELECT unnest(data, recursive := true)
  FROM read_json('response.json', maximum_object_size = 200000000)
) TO 'records.parquet' (FORMAT parquet);
```

`recursive := true` expands each record's fields into columns. Drop it if
you prefer one struct column per record.

## Errors you will hit

- **"maximum_object_size of 16777216 bytes exceeded"** — the whole file is
  one JSON value (common in the wrapped case). Set `maximum_object_size` to
  more than the file size in bytes, as above. For multi-GB arrays, converting
  to JSONL once with `jq -c '.[]' events.json > events.jsonl` is faster and
  streams.
- **A column comes out as `JSON` or `VARCHAR` instead of a struct** — the
  field has mixed shapes across records (an object here, a string there), or
  the variation sits beyond the inference sample. Pass
  `sample_size = -1` to scan every record, or declare the types yourself:

  ```sql
  read_json('events.json', format = 'array',
            columns = {id: 'BIGINT', user: 'STRUCT(name VARCHAR, plan VARCHAR)',
                       tags: 'VARCHAR[]', ts: 'TIMESTAMPTZ'})
  ```

- **IDs lose leading zeros or overflow** — values such as `"00123"` stay
  strings, but unquoted 20-digit numbers become `DOUBLE`. Declare them
  `VARCHAR` in `columns`.
- **Timestamps stay strings** — non-ISO formats are not detected. Pass
  `timestampformat = '%d/%m/%Y %H:%M'` or cast with `strptime()` in the
  `SELECT`.

## In the browser

Drop the `.json` file into the [SQL Workbench](/sql) and run the same
`read_json(..., format = 'array')` query to check the inferred schema and
spot bad records — the file stays on your machine. The workbench downloads
results as CSV; for a direct Parquet output, convert the array to JSONL and
use [JSONL to Parquet](/convert/jsonl-to-parquet), which infers the schema
the same way and writes ZSTD-compressed Parquet locally. Open the result in
the [Parquet Viewer](/parquet-viewer) to confirm nested columns kept their
structure.

Going the other direction? See [Parquet to JSON](/convert/parquet-to-json).

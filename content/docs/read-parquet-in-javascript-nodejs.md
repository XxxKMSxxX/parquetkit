---
slug: read-parquet-in-javascript-nodejs
title: "Read a Parquet File in JavaScript or Node.js (and Output JSON)"
description: "Read Parquet from Node.js or the browser with hyparquet or DuckDB, write the rows out as JSON, and fix the BigInt and compression errors you'll run into."
date: "2026-11-07"
faq:
  - question: "Why does JSON.stringify fail on rows read from Parquet?"
    answer: "Parquet INT64 columns are decoded as JavaScript BigInt so no precision is lost, and JSON.stringify throws 'Do not know how to serialize a BigInt'. Pass a replacer that converts bigint values to strings, or to numbers if they fit."
  - question: "Do I need a native module to read Parquet in Node.js?"
    answer: "No. hyparquet is pure JavaScript with no dependencies and works in Node.js and browsers. DuckDB's Node package ships a native binary, which is faster for large files and SQL but heavier to install."
  - question: "Which compression codecs does hyparquet support?"
    answer: "Snappy is built in. For gzip, zstd, brotli or LZ4 files, install hyparquet-compressors and pass its compressors object to the read call, otherwise the read fails on the first compressed page."
---

## Two good options

For reading Parquet in JavaScript there are two libraries worth using:

- **hyparquet**: pure JavaScript, no dependencies, runs in Node.js and in
  the browser. Best for reading a file or a slice of one into objects.
- **DuckDB** (`@duckdb/node-api` in Node, DuckDB-WASM in the browser): a full
  SQL engine. Best when you need to filter, aggregate or join before you
  output anything, or when the file is large.

If you just need the data as JSON once, you don't need code at all: the
[Parquet to JSON converter](/convert/parquet-to-json) does it in the browser,
and the [Parquet Viewer](/parquet-viewer) shows the schema first.

## hyparquet: rows as plain objects

```bash
npm install hyparquet
```

```js
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet'

const file = await asyncBufferFromFile('events.parquet')
const rows = await parquetReadObjects({
  file,
  columns: ['user_id', 'event', 'ts'], // optional: read only these
  rowStart: 0,
  rowEnd: 1000,                          // optional: a slice
})
console.log(rows[0])
```

`asyncBufferFromFile` reads byte ranges on demand rather than loading the
whole file. With `columns` and a row range set, hyparquet only decodes the
column chunks and pages it needs. In the browser, use `asyncBufferFromUrl`
for a remote file or `await file.arrayBuffer()` for a file the
user picked in a file input.

### Error: "Do not know how to serialize a BigInt"

INT64 columns, which most IDs and counters are, come back as `BigInt` so
values above 2^53 keep every digit. `JSON.stringify` refuses them. Convert
them in a replacer:

```js
import { writeFile } from 'node:fs/promises'

const json = JSON.stringify(rows, (_key, value) =>
  typeof value === 'bigint' ? value.toString() : value)
await writeFile('events.json', json)
```

Use `Number(value)` instead of `toString()` only if you know every value is
below `Number.MAX_SAFE_INTEGER`. Otherwise large IDs get silently rounded.
Timestamps are decoded to `Date` objects, which `JSON.stringify` writes as
ISO-8601 UTC strings.

### Error on gzip or zstd files

hyparquet decodes Snappy out of the box. Files written with Zstd, which
Spark and DuckDB increasingly use, or with gzip or Brotli, need the codec
package:

```bash
npm install hyparquet-compressors
```

```js
import { compressors } from 'hyparquet-compressors'

const rows = await parquetReadObjects({ file, compressors })
```

To check which codec a file uses, open it in the
[Parquet Viewer](/parquet-viewer) or see
[Snappy vs Gzip vs Zstd](/docs/parquet-compression-snappy-vs-gzip-vs-zstd).

## DuckDB in Node.js: SQL first, then JSON

```bash
npm install @duckdb/node-api
```

```js
import { DuckDBInstance } from '@duckdb/node-api'

const instance = await DuckDBInstance.create()
const connection = await instance.connect()

// Write JSON straight to disk, no rows held in JS memory
await connection.run(`
  COPY (SELECT user_id, event, ts FROM 'events.parquet' WHERE event = 'purchase')
  TO 'purchases.json' (FORMAT json, ARRAY true)
`)

// Or pull a small result into JS as JSON-safe objects
const reader = await connection.runAndReadAll(
  `SELECT event, count(*) AS n FROM 'events.parquet' GROUP BY event`)
console.log(reader.getRowObjectsJson())
```

Leave out `ARRAY true` to get JSON Lines, one object per line, which is
easier to stream into another tool. DuckDB handles every common codec,
globs like `'events/*.parquet'` and nested columns, and `COPY` streams, so a
multi-gigabyte file doesn't have to fit in the Node heap. `@duckdb/node-api`
replaces the older `duckdb` npm package, so use it for new code.

## Which to choose

- A slice of a file into objects, in the browser or a serverless
  function → **hyparquet**.
- Filtering, aggregation, multiple files, or output bigger than memory →
  **DuckDB**.
- A one-off conversion → no code. Use the
  [converter](/convert/parquet-to-json) or try the query first in the
  [SQL Workbench](/sql).

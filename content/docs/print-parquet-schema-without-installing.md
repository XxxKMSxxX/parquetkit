---
slug: print-parquet-schema-without-installing
title: "Print a Parquet File's Schema Without Installing Anything"
description: "See a Parquet file's columns, types and row count in seconds — in your browser, with no pyarrow, Spark or parquet-tools. Works for multi-GB files."
date: "2026-07-16"
faq:
  - question: "How do I see a Parquet file's schema without Python?"
    answer: "Drop the file into a browser-based viewer. The schema lives in the file footer, so it renders in under a second — no environment, no install, and the file never leaves your machine."
  - question: "Why is reading a Parquet schema instant even for huge files?"
    answer: "The schema is stored in a small footer at the end of the file. Reading it requires only the last few hundred kilobytes, so file size is irrelevant — a 10 GB file answers as fast as a 10 MB one."
  - question: "What is the difference between physical and logical types in Parquet?"
    answer: "The physical type is how bytes are stored (INT64, BYTE_ARRAY). The logical type says what they mean (TIMESTAMP, STRING, DECIMAL). Two files can share a logical type but differ physically, which matters for readers."
---

## The situation

Someone hands you a Parquet file and the first question is always the same:
*what is in it?* Column names, types, row count. The traditional answers
all start with an installation — and if you are on a locked-down laptop, in
a hurry, or just do not want a Python environment for a ten-second
question, that is friction you do not need.

## The zero-install way

Drop the file into the [Parquet viewer](/parquet-viewer). The schema tab
shows every column with its physical and logical type, plus row count, row
groups, compression and the writer that produced the file (`created_by`).
It is effectively `parquet-tools schema` as a drag & drop.

Two properties make this better than it sounds:

- **It is instant regardless of size.** Parquet keeps the schema in a
  footer at the end of the file, and the viewer reads only that — a
  multi-gigabyte file shows its schema as fast as a tiny one, because the
  data pages are never touched.
- **Nothing is uploaded.** The read happens locally in your browser via
  WebAssembly, so a confidential extract is as safe to inspect as it is
  sitting in your Downloads folder.

If you want the schema *as a query result* — say, to copy column lists —
open the file in the [SQL workbench](/sql) instead:

```sql
DESCRIBE SELECT * FROM read_parquet('yourfile.parquet');
```

## The traditional ways, for completeness

If you are already in an environment with tooling, the equivalents are:

```python
import pyarrow.parquet as pq
print(pq.read_schema("yourfile.parquet"))
```

```sql
-- DuckDB CLI
DESCRIBE SELECT * FROM 'yourfile.parquet';
```

Both are fine — they simply assume an installed environment, which is
exactly the assumption the browser route removes. (The once-standard
`parquet-tools` jar is deprecated and increasingly awkward to obtain, so it
is no longer the easy answer it used to be.)

## Reading what the schema tells you

- **Physical vs logical types.** `BYTE_ARRAY` + `STRING` is a text column;
  `INT64` + `TIMESTAMP(MICROS)` is a proper timestamp; a bare `INT96` is a
  [legacy timestamp with its own problems](/docs/parquet-int96-timestamps).
- **DECIMAL precision and scale** live in the logical type — worth checking
  before money columns flow into a system that silently casts them to
  float.
- **Row groups** hint at how the file was written: one giant row group and
  thousands of tiny ones both have performance implications for readers.

And when the real question is not "what is the schema" but "did the schema
*change*" — yesterday's file versus today's — skip the manual comparison:
[diff the two files](/diff) and added, removed and re-typed columns are
listed for you, before a single row is read.

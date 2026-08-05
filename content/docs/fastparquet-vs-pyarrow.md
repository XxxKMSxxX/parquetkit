---
slug: fastparquet-vs-pyarrow
title: "fastparquet vs pyarrow: Which Python Parquet Engine to Use"
description: "fastparquet and pyarrow both read and write Parquet from pandas, but they differ on speed, type support and maintenance. Here is how to choose."
date: "2026-08-01"
faq:
  - question: "Is fastparquet still maintained?"
    answer: "It receives occasional maintenance releases but far less investment than pyarrow, which is backed by the Apache Arrow project and used as the default Parquet engine in pandas, DuckDB and most modern tools."
  - question: "Does pandas use pyarrow or fastparquet by default?"
    answer: "Since pandas 2.0, pyarrow is the default engine for read_parquet and to_parquet when installed. fastparquet is only used if you pass engine='fastparquet' explicitly or pyarrow is unavailable."
  - question: "Can fastparquet read files written by pyarrow?"
    answer: "Usually, for standard column types. It struggles with newer Parquet features — nested structs, certain logical types and some encodings introduced after fastparquet's active-development period — where pyarrow has full support."
  - question: "Do I need either library just to look at a Parquet file?"
    answer: "No. For a quick look at schema, row counts or a sample of rows, a browser-based viewer avoids installing either engine or a Python environment at all."
---

## The short answer

Use **pyarrow**. It is the reference implementation of the Parquet format,
backed by the Apache Arrow project, and it is what pandas, DuckDB, Polars
and most modern tools use under the hood. **fastparquet** is an older,
pure-Python-plus-Numba implementation that predates wide pyarrow adoption
and is now maintained mostly for backward compatibility. Reach for it only
if you have a legacy codebase that already depends on it, or you hit a
narrow case where its behavior differs in your favor.

## Where they actually differ

**Type and feature support.** pyarrow tracks the Parquet spec closely —
nested structs and lists, all the modern logical types (DECIMAL, UUID,
proper timestamp units), and newer encodings like byte-stream-split. Some of
these either fail or silently coerce to something else under fastparquet.
If your data has nested columns, this alone settles the choice.

**Write compatibility.** Files written by pyarrow are readable by every
mainstream engine — Spark, DuckDB, Polars, BigQuery, Snowflake. Files
written by fastparquet are usually fine too, but edge cases (specific
encodings, certain compression combinations) have occasionally tripped up
downstream readers. If the file leaves your machine, pyarrow removes that
risk entirely.

**Speed.** For typical read/write workloads pyarrow is faster, since its
core is a C++ implementation with an optimized Python binding rather than
Numba-JIT-compiled Python. The Numba compile step also gives fastparquet a
noticeable first-call warm-up cost that pyarrow does not have.

**Dependencies.** fastparquet pulls in Numba and llvmlite, which are heavy
and occasionally awkward to install on locked-down or ARM environments.
pyarrow ships prebuilt wheels for essentially every platform pandas
supports, so it tends to be the easier install in practice too.

## Practical commands

Reading and writing with pyarrow via pandas:

```python
import pandas as pd

df = pd.read_parquet("data.parquet", engine="pyarrow")
df.to_parquet("out.parquet", engine="pyarrow", compression="zstd")
```

The equivalent with fastparquet, for comparison:

```python
df = pd.read_parquet("data.parquet", engine="fastparquet")
df.to_parquet("out.parquet", engine="fastparquet", compression="gzip")
```

Note fastparquet's compression codec support is narrower — no ZSTD in
older releases — which is one more reason pyarrow tends to win once you
care about output file size.

## When fastparquet still makes sense

The main legitimate reason to keep it around is an existing pipeline that
was built on it years ago and works fine, where migrating carries risk
without a corresponding payoff. Outside of that, new projects should just
default to pyarrow (or skip installing either library for one-off
inspection tasks — see below).

## Skipping the install entirely

If the actual goal is just to look at a Parquet file — check the schema,
preview rows, confirm a row count — neither library is necessary. The
[Parquet Viewer](/parquet-viewer) reads the file's footer and pages
directly in your browser via WebAssembly, and the [SQL Workbench](/sql)
runs full DuckDB queries against it, both without installing Python at
all. That is often faster than spinning up an environment just to run
`df.head()`.

---
slug: fastparquet-write-options
title: "fastparquet write(): Compression, Partitioning and Row Groups"
description: "Write Parquet with fastparquet that other tools read correctly: per-column compression, partition_on with hive layout, row group size, object_encoding and INT96."
date: "2026-10-10"
faq:
  - question: "Does fastparquet compress output by default?"
    answer: "fastparquet.write() defaults to compression=None, so files come out uncompressed. pandas to_parquet passes compression='snappy' by default, so the same DataFrame written through pandas is compressed."
  - question: "Why does partition_on still produce a single file?"
    answer: "With the default file_scheme='simple', fastparquet writes exactly one file and ignores partition_on without raising an error. Pass file_scheme='hive' (or 'drill') to get one directory per partition value."
  - question: "How do I fix \"Can't infer object conversion type\"?"
    answer: "An object column holds mixed or unexpected Python types. Clean the column, or tell fastparquet how to encode it with object_encoding, for example {'payload': 'json', 'name': 'utf8'}."
  - question: "Can Spark and DuckDB read fastparquet output?"
    answer: "Yes for standard flat types written with the defaults. Use times='int96' only if an old reader requires it, and check the result in a viewer before handing files to another team."
---

## The basic call

fastparquet has two ways in: directly through `fastparquet.write`, or via
pandas with `engine="fastparquet"`. Both end up in the same function, and
pandas forwards extra keyword arguments to it.

```python
import fastparquet

fastparquet.write("orders.parquet", df, compression="ZSTD")

# equivalent through pandas
df.to_parquet("orders.parquet", engine="fastparquet", compression="zstd")
```

One difference catches people out: `fastparquet.write()` defaults to
**no compression**, while `pandas.to_parquet` defaults to `snappy`. If a
fastparquet file is suspiciously large, that is usually why.

## Compression, per column if you want

`compression` accepts a codec name (`SNAPPY`, `GZIP`, `ZSTD`, `LZ4`,
`BROTLI`) or a dict. The dict form lets you spend CPU only where it pays
off — heavy codecs on large text columns, fast ones elsewhere:

```python
fastparquet.write(
    "events.parquet", df,
    compression={"payload": "ZSTD", "_default": "SNAPPY"},
)
```

Codecs come from the `cramjam` package, which fastparquet installs as a
dependency. For how the codecs compare, see
[Snappy vs Gzip vs Zstd](/docs/parquet-compression-snappy-vs-gzip-vs-zstd).

## Partitioned output with partition_on

To split output into one folder per value of a column, combine
`partition_on` with `file_scheme="hive"`. Without it, `partition_on` is
silently ignored and you get one ordinary file:

```python
fastparquet.write(
    "sales/", df,
    partition_on=["year", "region"],
    file_scheme="hive",
    compression="SNAPPY",
)
```

That produces `sales/year=2026/region=EU/part.0.parquet` and so on, plus
`_metadata` and `_common_metadata` summary files at the root. The
partition columns are removed from the data files and encoded in the
paths instead. Through pandas, `partition_cols=["year", "region"]` does
the same and sets the hive scheme for you.

Read it back with any hive-aware reader:

```sql
SELECT region, sum(amount)
FROM read_parquet('sales/**/*.parquet', hive_partitioning = true)
GROUP BY region;
```

The `*.parquet` glob skips the `_metadata` files. More on querying
layouts like this in
[reading a partitioned Parquet dataset](/docs/read-partitioned-parquet-dataset).

## Row group size

`row_group_offsets` controls how rows are cut into row groups. Pass an
integer for rows per group:

```python
fastparquet.write("big.parquet", df, row_group_offsets=500_000)
```

Very small groups (a few thousand rows) bloat the footer and slow scans;
very large ones reduce how much a reader can skip using min/max
statistics. A few hundred thousand to a few million rows is a sensible
range for analytics files.

## Object columns and object_encoding

pandas `object` columns can hold anything, so fastparquet inspects them
(`object_encoding="infer"`). When a column mixes types it fails with
`Can't infer object conversion type`. Declare the encoding instead:

```python
fastparquet.write(
    "users.parquet", df,
    object_encoding={"name": "utf8", "tags": "json", "avatar": "bytes"},
)
```

`json` stores dicts and lists as JSON strings — readable everywhere, but
not as native nested Parquet types. If downstream tools need real struct
or list columns, write with pyarrow; see
[fastparquet vs pyarrow](/docs/fastparquet-vs-pyarrow).

## Other options worth knowing

- `write_index=False` — skip writing the pandas index as a column.
- `times="int96"` — legacy timestamp encoding, only for old Hive or Impala
  readers. See [the INT96 problem](/docs/parquet-int96-timestamps).
- `append=True` — add row groups to an existing file; covered in
  [appending to a Parquet file](/docs/append-to-existing-parquet-file).
- `custom_metadata={"source": "crm"}` — store key-value metadata in the
  footer.

## Verify what you wrote

Drop the output into the [Parquet Viewer](/parquet-viewer) to confirm the
column types, row group count and codec before it leaves your machine.
The `created_by` field will read `fastparquet-python`, which is useful
when tracing which job produced a file.

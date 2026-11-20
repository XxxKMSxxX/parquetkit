---
slug: pyspark-parquet-to-csv-single-file
title: "PySpark Parquet to CSV: Write a Single File, Not a Folder"
description: "Spark writes CSV as a folder of part files with no header. Get one named CSV from a Parquet source with coalesce(1), fix quoting and nulls, and handle struct columns."
date: "2026-11-21"
faq:
  - question: "Why does Spark write a folder instead of a single CSV file?"
    answer: "Each partition of a DataFrame is written by a separate task, and every task produces its own part file inside the output directory. The path you pass to write.csv() is always a directory name, never a file name, even when there is only one partition."
  - question: "Should I use coalesce(1) or repartition(1)?"
    answer: "coalesce(1) avoids a shuffle but can pull the whole upstream plan into a single task, so the read and any filters also run single-threaded. repartition(1) adds a shuffle but keeps the upstream stages parallel. For a plain read-and-write either works; after heavy transformations prefer repartition(1)."
  - question: "Why is the header row missing from my Spark CSV?"
    answer: "The CSV writer's header option defaults to false. Add .option(\"header\", True) before .csv(). With several part files every file gets its own header row, which is one more reason to write a single partition when the file is meant for people."
  - question: "Can I convert Parquet to CSV without starting a Spark cluster?"
    answer: "Yes. For a file that fits on one machine, a DuckDB one-liner or the browser converter on this site writes a single CSV with a header directly, with no part files to rename and no JVM to start."
---

## The surprise

You read a Parquet dataset and call `df.write.csv("events.csv")`, expecting
a file. What you get is a directory named `events.csv` containing
`part-00000-…-c000.csv`, `part-00001-…`, a `_SUCCESS` marker and, on a local
filesystem, hidden `.crc` files. There is no header row either. All of this
is by design: Spark writes one file per partition, in parallel, and the path
you pass is always a directory.

## Write one part file

```python
df = spark.read.parquet("s3a://lake/events/")

(df.coalesce(1)
   .write
   .mode("overwrite")
   .option("header", True)
   .csv("out/events_csv"))
```

`coalesce(1)` collapses the DataFrame to one partition, so the directory
holds exactly one `part-00000-*.csv`. `header` defaults to false, and the
default save mode fails if the path already exists, hence `mode("overwrite")`.

A single partition means a single task writes every row. That is fine for a
few gigabytes and painful for a few hundred; if the output is that large,
the consumer probably should not be getting one CSV.

## Give the file a real name

Spark has no option for naming the part file, so rename it afterwards. On a
local filesystem:

```python
import glob, shutil

part = glob.glob("out/events_csv/part-*.csv")[0]
shutil.move(part, "out/events.csv")
shutil.rmtree("out/events_csv")
```

On Databricks, do the same with `dbutils.fs`:

```python
part = [f.path for f in dbutils.fs.ls("dbfs:/out/events_csv") if f.name.startswith("part-")][0]
dbutils.fs.mv(part, "dbfs:/out/events.csv")
dbutils.fs.rm("dbfs:/out/events_csv", recurse=True)
```

If the result comfortably fits in driver memory, skip the directory
entirely with `df.toPandas().to_csv("events.csv", index=False)`. Everything
is collected to the driver, so keep this to small, already-aggregated
outputs.

## Options worth setting

```python
(df.coalesce(1).write.mode("overwrite")
   .option("header", True)
   .option("escape", '"')
   .option("nullValue", "")
   .option("timestampFormat", "yyyy-MM-dd HH:mm:ss")
   .option("compression", "gzip")
   .csv("out/events_csv"))
```

- **`escape`** is the one that bites. Spark escapes a quote inside a quoted
  field with a backslash, while Excel, pandas and DuckDB expect the quote to
  be doubled. Setting `escape` to `"` produces standard CSV; without it, any
  value containing a double quote shifts columns in the reader.
- **`nullValue`** controls how nulls are written. Empty strings are written
  as `""` by default (`emptyValue`), so null and empty stay distinguishable.
- **`timestampFormat`** and **`dateFormat`** fix the layout; timestamps are
  rendered in the session time zone (`spark.sql.session.timeZone`).
- **`compression`** set to `gzip` yields `part-00000-*.csv.gz`.

## Struct, array and map columns

Parquet happily stores nested types; CSV cannot. The write fails at
analysis time with a message saying the CSV data source does not support
the struct, array or map type of the offending column. Flatten or serialize
before writing:

```python
from pyspark.sql import functions as F

flat = (df
    .withColumn("city", F.col("address.city"))
    .withColumn("tags", F.concat_ws("|", "tags"))
    .withColumn("payload", F.to_json("payload"))
    .drop("address"))
```

Pick struct fields into their own columns, join arrays of strings with a
delimiter, and fall back to `to_json` for anything deeper. To see which
columns are nested before the job fails, drop one part file of the dataset
into the [Parquet Viewer](/parquet-viewer); the schema tab shows every
nested field. The SQL equivalents are in
[flattening nested Parquet columns](/docs/flatten-nested-parquet-columns).

## When Spark is the wrong tool

If the Parquet data is one file, or a folder that fits on a laptop,
starting a cluster to produce a CSV is the slow path. DuckDB writes a
single file with a header directly:

```bash
duckdb -c "COPY (SELECT * FROM 'events/*.parquet') TO 'events.csv' (HEADER)"
```

With nothing installed, the [Parquet to CSV converter](/convert/parquet-to-csv)
does the same in the browser, and the file never leaves your machine. More
terminal variants are in
[Parquet to CSV from the command line](/docs/convert-parquet-to-csv-command-line).

Whichever route you take, compare `df.count()` with the CSV's line count
minus the header before handing the file over. If the numbers disagree,
embedded newlines in a text column are the usual cause, and
[verifying a Parquet to CSV conversion](/docs/verify-parquet-to-csv-conversion)
walks through an exact check.

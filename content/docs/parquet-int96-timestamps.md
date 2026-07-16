---
slug: parquet-int96-timestamps
title: "Why Your Parquet Timestamps Are Wrong: The INT96 Problem"
description: "Timestamps shifted by hours, wrong by centuries, or rejected outright? Your Parquet file probably uses legacy INT96. What it is and how to deal with it."
date: "2026-07-16"
faq:
  - question: "What is an INT96 timestamp in Parquet?"
    answer: "A legacy 12-byte encoding — nanoseconds within a day plus a Julian day number — used by Hive, Impala and older Spark. It is deprecated but still written by many systems for compatibility."
  - question: "Why do my Parquet timestamps shift by a few hours between tools?"
    answer: "INT96 carries no timezone information, so each reader decides whether the value is UTC or local time. Two tools with different conventions render the same bytes hours apart."
  - question: "How do I stop Spark from writing INT96 timestamps?"
    answer: "Set spark.sql.parquet.outputTimestampType to TIMESTAMP_MICROS, and timestamps are written as standard INT64 with explicit semantics that every modern reader agrees on."
---

## The situation

A timestamp column looks fine in one tool and wrong in another: shifted by
exactly your UTC offset, off by centuries, or rejected with
`unsupported encoding` / out-of-bounds errors. Before blaming the data,
check how the timestamps are *stored* — the odds are good you are looking
at INT96.

## What INT96 is, and why it lingers

Early Hive, Impala and Spark stored timestamps as a 12-byte value: eight
bytes of nanoseconds-within-the-day plus four bytes of Julian day number.
The encoding was deprecated in the Parquet format years ago in favor of
INT64 timestamps with explicit units (millis/micros/nanos) and an explicit
UTC flag — but "deprecated" is doing a lot of work: Spark still *writes*
INT96 when asked to interoperate with old Hive
(`spark.sql.parquet.writeLegacyFormat`), plenty of long-lived pipelines
never changed their defaults, and files written in 2019 do not rewrite
themselves.

So modern readers meet INT96 constantly, and each handles it differently.
That divergence is the bug you are seeing.

## The three failure modes

- **Hour-sized shifts.** INT96 carries no timezone semantics. Some
  ecosystems treated the value as UTC, others as local time. Every reader
  guesses (pyarrow and modern Spark assume UTC), so the same bytes render
  hours apart between tools — the classic "it's right in Hive, wrong in
  pandas" report.
- **Century-sized errors.** The Julian-day component interacts with the
  calendar change of 1582. Engines apply (or skip) a rebase between the
  Julian and proleptic Gregorian calendars; historical dates written by old
  Spark can drift by days unless the reader applies the matching rebase
  (Spark's `int96RebaseModeInRead` exists precisely for this).
- **Precision overflow.** INT96 is nanoseconds. Readers that coerce to
  nanosecond-precision types (pandas' classic `datetime64[ns]`) hit
  out-of-bounds errors for dates before 1677 or after 2262.

## Check what your file actually contains

Drop the file into the [Parquet viewer](/parquet-viewer): the schema shows
each timestamp column's physical type — `INT96` versus `INT64` with a
`TIMESTAMP` logical annotation — and the metadata panel shows `created_by`,
which usually names the writer (old Spark and Impala are the usual
suspects). Then look at the rendered values: if they are off by your UTC
offset, you have the timezone-convention problem, not corrupted data.

To test a hypothesis, run the conversion yourself in the
[SQL workbench](/sql):

```sql
SELECT ts,
       ts AT TIME ZONE 'UTC' AS as_utc
FROM read_parquet('yourfile.parquet')
LIMIT 10;
```

Everything runs locally in your browser — no need to move a production
extract anywhere to inspect it.

## Fix it at the source

- **Stop writing INT96.** In Spark:
  `spark.conf.set("spark.sql.parquet.outputTimestampType", "TIMESTAMP_MICROS")`
  — and do not enable `writeLegacyFormat` unless an ancient Hive really
  reads your output.
- **Rewrite legacy files once** (DuckDB reads INT96 and writes modern
  timestamps):

  ```sql
  COPY (SELECT * FROM read_parquet('legacy.parquet'))
  TO 'modern.parquet' (FORMAT PARQUET);
  ```

- **Pin the read-side convention** where you cannot rewrite: Spark's
  `int96RebaseModeInRead`/`datetimeRebaseModeInRead` settings make the
  interpretation explicit instead of version-dependent.

After a rewrite, [diff the two files](/diff) joined on a key column: the
timestamp cells should be the only thing that changed — and if the diff
shows an unexpected constant offset on every row, you have just caught the
timezone-convention problem before it reached a dashboard.

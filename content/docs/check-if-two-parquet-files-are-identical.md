---
slug: check-if-two-parquet-files-are-identical
title: "Check If Two Parquet Files Contain Identical Data"
description: "Byte checksums say two Parquet files differ even when the rows match. Prove the data is identical with a row-count-plus-hash fingerprint in DuckDB SQL."
date: "2026-10-24"
faq:
  - question: "Why do two Parquet files with the same rows have different checksums?"
    answer: "Parquet bytes depend on the compression codec, row-group size, encodings, row order and the writer's created_by metadata. Any of these change the SHA-256 without changing a single value, so a byte mismatch proves nothing about the data."
  - question: "Does row order affect the hash fingerprint?"
    answer: "No. The fingerprint sums one hash per row, and addition does not depend on order, so a file sorted differently produces the same result. Use sum rather than bit_xor so that duplicate rows are counted instead of cancelling out."
  - question: "Can a hash fingerprint give a false match?"
    answer: "In theory two different datasets could collide, but with a row count plus a sum of 64-bit row hashes that is vanishingly unlikely for real data. When a release depends on it, confirm with the two-way EXCEPT ALL query, which is exact."
  - question: "Can I compare a Parquet file with a CSV export this way?"
    answer: "Yes, provided you cast the CSV columns back to the Parquet types first. Hashes of the string '42' and the integer 42 differ, so compare typed values, not raw text."
---

## The question is yes or no

Sometimes you don't need a full diff. You rewrote a file with a different
codec, compacted a partition, moved a pipeline to a new engine, or got a
"fixed" file from a colleague, and you only need to know one thing: **is
the data still exactly the same?** If it is, you're done. If it isn't, then
you go hunting for what changed.

The obvious check gets it wrong:

```bash
shasum -a 256 old.parquet new.parquet
```

Matching checksums do mean the data is identical. Different checksums
mean nothing, though. Changing the codec from Snappy to Zstd, writing
different row-group sizes or even upgrading the writer library changes
every byte while every value stays put. You have to compare the data
instead.

## Step 1: compare the schemas

Column names, order and types must match before comparing values means
anything. Run this for both files in the [SQL Workbench](/sql), or drop
them into the [Parquet Viewer](/parquet-viewer):

```sql
DESCRIBE SELECT * FROM 'old.parquet';
DESCRIBE SELECT * FROM 'new.parquet';
```

A column that changed from `INTEGER` to `BIGINT` holds the same numbers
but hashes differently. Settle whether that counts as a change before
going on.

## Step 2: a fingerprint per file

This query reduces a whole file to two numbers:

```sql
SELECT count(*) AS n, sum(hash(t)) AS fingerprint
FROM read_parquet('old.parquet') t;
```

`hash(t)` hashes the entire row (in DuckDB, `t` refers to the row as a
struct). `sum` adds those hashes up, and since addition ignores order, a
file sorted differently gives the same fingerprint. Run the same query on
`new.parquet`. If both `n` and `fingerprint` match, the files hold the same
multiset of rows.

Use `sum`, not `bit_xor`. XOR cancels pairs, so a file where one row got
duplicated twice would wrongly match the original.

This is a single streaming scan, so it works on files much larger than
memory, and it also works across the files of a dataset:

```sql
SELECT count(*), sum(hash(t))
FROM read_parquet('events/*/*.parquet', hive_partitioning = true) t;
```

## Step 3: an exact check, if you need proof

A fingerprint is probabilistic. When you want an exact answer, take the
difference in both directions with `EXCEPT ALL`, which respects
duplicates:

```sql
SELECT count(*) AS differing_rows FROM (
  (SELECT * FROM 'old.parquet' EXCEPT ALL SELECT * FROM 'new.parquet')
  UNION ALL
  (SELECT * FROM 'new.parquet' EXCEPT ALL SELECT * FROM 'old.parquet')
);
```

Zero means identical. `EXCEPT` matches columns by position, so if only the
column order differs, list the columns explicitly in the same order on
both sides.

## Comparing Parquet with its CSV export

The same fingerprint checks whether a [CSV conversion](/convert/parquet-to-csv)
lost anything. Cast the CSV back to the Parquet types first:

```sql
SELECT count(*), sum(hash(t)) FROM (
  SELECT id::BIGINT AS id, amount::DECIMAL(18,2) AS amount, created_at::TIMESTAMP AS created_at
  FROM read_csv('export.csv')
) t;
```

If this matches the Parquet fingerprint, the round trip kept every value.
If it doesn't, the usual suspects are timestamps that lost their time zone
or sub-second precision, and floats printed with fewer digits.

## When the answer is "no"

A mismatch tells you that something changed, not what. To see which rows
were added, removed or edited, use the [Parquet Diff](/diff) tool or the
keyed SQL in [comparing two Parquet files](/docs/compare-two-parquet-files).
Floating-point columns deserve a look first: `-0.0` versus `0.0`, or a value
recomputed with a different summation order, changes the hash even though
nobody would call it a real change.

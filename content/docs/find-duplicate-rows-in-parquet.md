---
slug: find-duplicate-rows-in-parquet
title: "How to Find and Remove Duplicate Rows in a Parquet File"
description: "Count exact duplicates, find repeated business keys and keep only the newest row per key — with DuckDB SQL in your browser or a short pandas script."
date: "2026-08-29"
faq:
  - question: "How do I count duplicate rows in a Parquet file?"
    answer: "Compare the total row count with the count of distinct rows in the same query. The difference is the number of duplicated rows. In DuckDB that is one SELECT with two scalar subqueries, and it runs without loading the file into memory."
  - question: "How do I keep only the most recent row per key?"
    answer: "Use a window function: row_number() OVER (PARTITION BY key ORDER BY updated_at DESC), then keep rows where the number is 1. DuckDB's QUALIFY clause lets you filter on it directly, without a subquery."
  - question: "Why does SELECT DISTINCT not remove my duplicates?"
    answer: "DISTINCT compares every column, so a single differing value — an ingestion timestamp, a file-name column, trailing whitespace — makes two otherwise identical records count as different rows. Deduplicate on the business key instead of the whole row."
  - question: "Can I deduplicate a Parquet file without installing anything?"
    answer: "Yes. Drop the file into the SQL Workbench on this site and run the deduplication query there. It executes in an in-browser DuckDB build on WebAssembly, so the file never leaves your machine."
---

## Where the duplicates come from

Duplicates in Parquet are almost always a pipeline artifact rather than bad
source data: a batch job re-ran and appended the same day twice, overlapping
date ranges were exported, or several per-region files were stacked with
`UNION ALL` and the overlap was never removed. The fix is the same in every
case — first measure, then decide which copy wins.

## Step 1: how many duplicates are there?

Drop the file into the [SQL Workbench](/sql) and ask for both counts at
once:

```sql
SELECT
  (SELECT count(*) FROM 'sales.parquet') AS total_rows,
  (SELECT count(*) FROM (SELECT DISTINCT * FROM 'sales.parquet')) AS distinct_rows;
```

If the two numbers match, there are no *exact* duplicates — which does not
mean there are no duplicated records. Any column that differs per load
(`ingested_at`, `source_file`, a surrogate row id) makes every copy unique
at the row level while the business content is repeated.

## Step 2: find repeated keys

This is the check that actually matters. Group by the column that should be
unique and keep only the groups with more than one row:

```sql
SELECT order_id, count(*) AS copies
FROM 'sales.parquet'
GROUP BY order_id
HAVING count(*) > 1
ORDER BY copies DESC
LIMIT 50;
```

Then look at one offender in full to decide what "duplicate" means here —
byte-identical re-import, or two genuine versions of the same record?

```sql
SELECT * FROM 'sales.parquet'
WHERE order_id = 'A-1043'
ORDER BY updated_at;
```

For a composite key, group by all its parts: `GROUP BY order_id, line_no`.

## Step 3: remove them

Exact duplicates collapse with `DISTINCT`:

```sql
SELECT DISTINCT * FROM 'sales.parquet';
```

Keeping one row per key — the useful version — is a window function. DuckDB's
`QUALIFY` filters on it without wrapping the query in a subquery:

```sql
SELECT *
FROM 'sales.parquet'
QUALIFY row_number() OVER (
  PARTITION BY order_id
  ORDER BY updated_at DESC
) = 1;
```

Swap `updated_at DESC` for whatever defines "the good copy": the highest
version number, the latest load timestamp, or `source_file DESC`. Add tie
breakers to the `ORDER BY` if the sort column is not unique — otherwise which
row survives is arbitrary and can change between runs.

Export the cleaned result as CSV from the workbench, then send it back
through the [CSV to Parquet converter](/convert/csv-to-parquet) if you need
the output in Parquet again.

## Traps worth knowing

- **NULL keys.** `PARTITION BY order_id` puts every NULL-keyed row into one
  partition, so all but one are dropped. Count them first
  (`SELECT count(*) FROM 'sales.parquet' WHERE order_id IS NULL`) and handle
  them separately.
- **Near-duplicates.** `"ACME "` and `"acme"` are different keys. Normalize
  in the partition expression: `PARTITION BY lower(trim(customer))`.
- **Floats.** Values that differ in the last bits look distinct to `DISTINCT`
  even when they print identically. Round in the comparison if that matters.

## The pandas equivalent

```python
import pandas as pd

df = pd.read_parquet("sales.parquet")
df = df.sort_values("updated_at").drop_duplicates(subset=["order_id"], keep="last")
df.to_parquet("sales_dedup.parquet", compression="zstd")
```

Correct, but it loads the whole file into memory and gives you no view of
*what* was duplicated. Run the counting queries first — the row count you
delete is worth understanding before you delete it. To confirm the result,
drop the new file into the [Parquet Viewer](/parquet-viewer), or diff it
against the original with the [Parquet Diff](/diff) tool.

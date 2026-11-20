---
slug: diff-parquet-files-without-primary-key
title: "Diff Two Parquet Files Without a Primary Key"
description: "No id column to join on? Diff two Parquet files as multisets with EXCEPT ALL, count duplicate rows on each side, or find a column combination that works as a key."
date: "2026-11-21"
faq:
  - question: "How do I diff two Parquet files that have no unique id?"
    answer: "Compare whole rows instead of joining on a key. In DuckDB, old EXCEPT ALL new returns rows that were removed and new EXCEPT ALL old returns rows that were added, counting duplicates correctly. A changed row shows up once on each side."
  - question: "What is the difference between EXCEPT and EXCEPT ALL?"
    answer: "EXCEPT works on sets: it removes duplicates first, so a row that appears three times in one file and once in the other is reported as no difference. EXCEPT ALL works on multisets and returns the two surplus copies."
  - question: "How can I tell whether a set of columns is a usable key?"
    answer: "Compare count(*) with count(DISTINCT (col_a, col_b)) on both files. If the two numbers are equal in each file, the combination identifies a row uniquely and you can run a normal keyed diff on it."
  - question: "Does row order matter for a keyless diff?"
    answer: "No. EXCEPT ALL and grouped counts ignore physical order, so a file that was re-sorted or rewritten with different row groups compares as unchanged. Parquet does not guarantee row order across writers, so positional comparison is unreliable anyway."
---

## When there is nothing to join on

A keyed diff joins old and new on an `id` and reports each row as added,
removed or changed. Event logs, fact tables and ad-hoc exports often have
no such column, and joining on something that is not unique multiplies rows
until every count is wrong.

Without a key, the question changes from "what happened to row 42?" to
"which rows exist on one side and not the other, and how many times?". The
queries below run in the DuckDB CLI or in the [SQL Workbench](/sql): drop
both files in and reference them by filename.

## Rows on one side only

```sql
SELECT 'removed' AS side, * FROM (
  SELECT * FROM 'old.parquet' EXCEPT ALL SELECT * FROM 'new.parquet'
)
UNION ALL
SELECT 'added', * FROM (
  SELECT * FROM 'new.parquet' EXCEPT ALL SELECT * FROM 'old.parquet'
)
ORDER BY ALL;
```

Use `EXCEPT ALL`, not `EXCEPT`. Plain `EXCEPT` deduplicates both inputs
first, so a file that lost one of two identical rows looks unchanged. A row
whose value was edited appears twice in this output: once as `removed` with
the old value, once as `added` with the new one.

Both files need the same columns in the same order. If they differ, list
the shared columns explicitly instead of `*`.

## See how many copies changed

When duplicates are legitimate, such as two identical line items, a count
per distinct row is easier to read:

```sql
WITH o AS (SELECT *, count(*) AS n FROM 'old.parquet' GROUP BY ALL),
     n AS (SELECT *, count(*) AS n FROM 'new.parquet' GROUP BY ALL)
SELECT * EXCLUDE (n),
       coalesce(o.n, 0) AS old_rows,
       coalesce(n.n, 0) AS new_rows
FROM o FULL JOIN n USING (region, sku, qty)
WHERE coalesce(o.n, 0) != coalesce(n.n, 0)
ORDER BY ALL;
```

Put every data column in `USING`. The result reads like a ledger:

```text
region  sku  qty  old_rows  new_rows
eu      d    9    0         1
jp      a    1    2         1
us      b    2    1         0
us      b    5    0         1
```

One `jp / a` duplicate disappeared, `eu / d` is new, and `us / b` went from
quantity 2 to 5. One caveat: `USING` never matches NULL to NULL, so rows
with a NULL in any column are listed on both sides even when unchanged. The
`EXCEPT ALL` query treats NULLs as equal and is the one to trust for
nullable data.

## Look for a composite key

Often a key exists; it is just spread over several columns. Test a
candidate on both files:

```sql
SELECT count(*) AS total,
       count(DISTINCT (region, sku)) AS distinct_keys
FROM 'old.parquet';
```

If `total` equals `distinct_keys` in both files, the combination is a key.
Add a combined column and use the [Parquet Diff](/diff) tool or the keyed
join from [comparing two Parquet files](/docs/compare-two-parquet-files) to
get cell-level `old → new` changes:

```sql
SELECT concat_ws('|', region, sku) AS row_key, * FROM 'old.parquet';
```

If the numbers are close but not equal, list the offenders:

```sql
SELECT region, sku, count(*) AS n
FROM 'old.parquet'
GROUP BY ALL
HAVING count(*) > 1;
```

A handful of repeats is often a data bug worth fixing first; see
[finding duplicate rows](/docs/find-duplicate-rows-in-parquet).

## Things that create false differences

- **Floats.** A value recomputed by a different engine can differ in the
  last digit. Compare `round(amount, 6)` when a tolerance is acceptable.
- **Types.** `EXCEPT ALL` casts both sides to a common type, so an `INTEGER`
  to `BIGINT` change is invisible in the row diff. Check with
  `DESCRIBE SELECT * FROM 'old.parquet'` on each file.
- **Timestamps.** A column written with and without a time zone holds
  different instants even when the text looks alike.
- **Whitespace and case.** Wrap suspect string columns in `trim()` or
  `lower()` to confirm they are the only cause.

If all you need is a yes or no, a row count plus hash fingerprint is
cheaper than either query above:
[check if two Parquet files are identical](/docs/check-if-two-parquet-files-are-identical).

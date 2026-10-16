---
slug: join-two-parquet-files-on-key
title: "How to Join Two Parquet Files on a Key Column"
description: "Merge two Parquet files side by side — add customer columns to orders, enrich events with lookups — using a DuckDB JOIN in the browser, the CLI, or pandas."
date: "2026-10-17"
faq:
  - question: "Is joining Parquet files the same as merging them?"
    answer: "No. Merging usually means stacking files with the same columns on top of each other (UNION). Joining matches rows from two different files on a key and puts their columns side by side."
  - question: "Why does my joined result have more rows than the original file?"
    answer: "The key is not unique on the lookup side, so each matching row is repeated once per duplicate. Check with SELECT key, count(*) ... GROUP BY key HAVING count(*) > 1 and deduplicate before joining."
  - question: "Can I join a Parquet file with a CSV file?"
    answer: "Yes. DuckDB reads both formats in the same query, so you can join orders.parquet to regions.csv directly. Make sure the key columns end up with the same type, casting one side if needed."
  - question: "Can I save the joined result as a new Parquet file?"
    answer: "With the DuckDB CLI, wrap the query in COPY (...) TO 'out.parquet' (FORMAT parquet). The browser SQL Workbench downloads results as CSV, which you can convert back to Parquet on the CSV to Parquet page."
---

## The situation

You have `orders.parquet` with a `customer_id` column and `customers.parquet`
with names, countries and signup dates. You want one table with both. In
pandas this is `pd.merge`; in Spark it is a join. Neither is necessary for a
one-off: DuckDB joins Parquet files directly, without loading them into a
database first.

This is different from [stacking files with the same
columns](/docs/merge-multiple-parquet-files). Here the files have *different*
columns and you match rows on a key.

## Join in the browser

Open the [SQL Workbench](/sql), drop both files in, and reference each by its
filename:

```sql
SELECT o.*, c.name, c.country
FROM 'orders.parquet' AS o
LEFT JOIN 'customers.parquet' AS c USING (customer_id);
```

Use `LEFT JOIN` when every order must survive even if its customer is
missing; use `JOIN` (inner) when you only want matched rows. To find orders
whose customer is missing entirely — usually the first question after a join
looks wrong — use an anti join:

```sql
SELECT o.*
FROM 'orders.parquet' AS o
ANTI JOIN 'customers.parquet' AS c USING (customer_id);
```

Nothing is uploaded; the join runs in DuckDB compiled to WebAssembly in your
tab. Download the result as CSV, or inspect either input first in the
[Parquet Viewer](/parquet-viewer).

## Join with the DuckDB CLI and write Parquet

Locally, the same query can write a new Parquet file in one step:

```sql
COPY (
  SELECT o.*, c.name, c.country
  FROM 'orders.parquet' o
  LEFT JOIN 'customers.parquet' c USING (customer_id)
) TO 'orders_enriched.parquet' (FORMAT parquet, COMPRESSION zstd);
```

DuckDB only reads the columns the query touches, so joining a 40-column fact
file against a 3-column lookup stays fast even when the files are large, and
it spills to disk instead of failing when the hash table does not fit in
memory.

## The same thing in pandas

```python
import pandas as pd

orders = pd.read_parquet("orders.parquet")
customers = pd.read_parquet("customers.parquet", columns=["customer_id", "name", "country"])

enriched = orders.merge(customers, on="customer_id", how="left", validate="many_to_one")
enriched.to_parquet("orders_enriched.parquet", index=False)
```

`validate="many_to_one"` raises immediately if `customer_id` repeats in the
customer file — the cheapest guard against silent row multiplication.

## What goes wrong

- **Duplicate keys on the lookup side.** If a customer appears twice, every
  one of their orders appears twice. Check before joining:

  ```sql
  SELECT customer_id, count(*) AS n
  FROM 'customers.parquet'
  GROUP BY customer_id HAVING n > 1;
  ```

- **Key type mismatch.** One file stores `customer_id` as `BIGINT`, the other
  as `VARCHAR` (common when one side came from CSV). DuckDB may refuse the
  comparison or, worse, match nothing. Cast explicitly:
  `ON o.customer_id = CAST(c.customer_id AS BIGINT)`. Compare both schemas
  with `DESCRIBE SELECT * FROM 'customers.parquet'` first.
- **Leading zeros and whitespace.** `'00123'` and `'123'` do not match, nor
  does `'A1 '` and `'A1'`. Normalise with `trim()` or `lpad()` on the side
  that is wrong.
- **Name collisions.** Two files with an `updated_at` column produce
  ambiguous or duplicated names with `SELECT *`. List columns explicitly and
  alias them (`c.updated_at AS customer_updated_at`).
- **NULL keys never match.** Rows with a NULL key drop out of an inner join
  and get NULL lookups in a left join. That is SQL semantics, not a bug —
  count them with `WHERE customer_id IS NULL` so the gap is explained.

After the join, a quick sanity check is that a `LEFT JOIN` returns exactly
as many rows as the left file: `SELECT count(*) FROM 'orders.parquet'`
should equal the joined count. If it is larger, go back to the duplicate-key
check.

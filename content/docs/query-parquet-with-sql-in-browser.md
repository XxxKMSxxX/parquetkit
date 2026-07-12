---
slug: query-parquet-with-sql-in-browser
title: "Query Parquet Files with SQL — No Database Required"
description: "Run real SQL against local Parquet and CSV files using DuckDB in the browser: joins, aggregates and window functions with zero setup."
date: "2026-07-12"
faq:
  - question: "Do I need to create tables or import data first?"
    answer: "No. Dropped files are queryable immediately by filename — SELECT * FROM 'sales.parquet' just works. There is no import step because DuckDB reads the file by reference."
  - question: "Can I join a Parquet file with a CSV file?"
    answer: "Yes. Register both files and join them in one query: SELECT … FROM 'sales.parquet' s JOIN 'regions.csv' r ON s.region_id = r.id."
  - question: "What SQL features are available?"
    answer: "The full DuckDB dialect: window functions, CTEs, aggregates, string and date functions, JSON functions, PIVOT and more. If it runs in DuckDB, it runs here."
---

## SQL on files, not databases

The fastest way to answer a question about a Parquet file is usually a SQL
query — but standing up a database, defining a table and importing the data
turns a 30-second question into a 30-minute chore. DuckDB removed the import
step: it queries files in place. DuckDB-WASM goes further and removes the
install step, running the whole engine inside your browser.

The [SQL Workbench](/sql) on this site is exactly that: drop files, write
SQL, get results. Nothing is uploaded.

## Recipes

**Row count and quick profile**

```sql
SELECT count(*) FROM 'events.parquet';
SUMMARIZE SELECT * FROM 'events.parquet';
```

**Top-N aggregation**

```sql
SELECT user_id, count(*) AS events
FROM 'events.parquet'
GROUP BY user_id
ORDER BY events DESC
LIMIT 20;
```

**Join Parquet with CSV**

```sql
SELECT r.name, sum(s.amount) AS revenue
FROM 'sales.parquet' s
JOIN 'regions.csv' r ON s.region_id = r.id
GROUP BY r.name;
```

**Export the answer**

Run the query, then click *Download CSV* — or convert the whole file with
the [Parquet to CSV converter](/convert/parquet-to-csv) if you need
everything.

## When to graduate to a real database

Browser SQL shines for exploration and one-off analysis. Once you need
scheduled queries, concurrent users or data that exceeds your machine's
memory for a single result set, move the same SQL to DuckDB on a server or a
warehouse — the dialect carries over unchanged.

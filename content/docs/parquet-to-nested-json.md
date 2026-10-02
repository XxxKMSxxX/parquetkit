---
slug: parquet-to-nested-json
title: "Convert Flat Parquet Rows to Nested JSON with DuckDB"
description: "Turn flat Parquet rows into nested JSON — orders with an items array, customer objects — using DuckDB's list() and struct syntax. Includes JSON array and JSONL output."
date: "2026-10-03"
faq:
  - question: "How do I group Parquet rows into a JSON array per key?"
    answer: "GROUP BY the key and aggregate the child columns with list({'field': col, ...}). DuckDB turns the resulting list of structs into a JSON array of objects when you COPY the query to FORMAT json."
  - question: "Why do orders without items get an item full of nulls?"
    answer: "A LEFT JOIN produces one row of NULLs for parents with no children, and list() keeps it. Add FILTER (WHERE child_key IS NOT NULL) to the aggregate and wrap it in coalesce(..., []) to get an empty array instead."
  - question: "How do I write a single JSON array instead of one object per line?"
    answer: "Add ARRAY true to the COPY options: (FORMAT json, ARRAY true). Without it DuckDB writes newline-delimited JSON (JSONL), which is better for large files and streaming consumers."
  - question: "Will DECIMAL values stay exact in the JSON output?"
    answer: "They are written as JSON numbers, so 9.50 becomes 9.5 and most JSON parsers read it as a double. Cast to VARCHAR in the SELECT if the consumer needs the exact decimal string."
---

## Flat in, nested out

Parquet exports from warehouses are usually flat: one row per order line,
with the order and customer fields repeated on every row. The API,
document store or front-end that consumes the data wants the opposite
shape:

```json
{"order_id": 1001,
 "customer": {"name": "Aiko", "email": "aiko@example.com"},
 "items": [{"sku": "A-1", "qty": 2}, {"sku": "B-7", "qty": 1}]}
```

A plain [Parquet to JSON](/convert/parquet-to-json) conversion keeps the
flat shape — one object per row. To nest, you regroup the rows first. In
DuckDB that takes two building blocks: struct literals for objects and
`list()` for arrays.

## Objects: struct literals

`{'name': customer_name, 'email': customer_email}` builds a struct, and a
struct serialises as a JSON object:

```sql
SELECT order_id,
       {'name': customer_name, 'email': customer_email} AS customer
FROM 'orders.parquet';
```

## Arrays: list() with GROUP BY

To collect child rows into an array, group by the parent key and aggregate
structs:

```sql
COPY (
  SELECT order_id,
         list({'sku': sku, 'qty': qty, 'unit_price': unit_price}
              ORDER BY sku) AS items
  FROM 'order_lines.parquet'
  GROUP BY order_id
  ORDER BY order_id
) TO 'orders.json' (FORMAT json, ARRAY true);
```

Output:

```json
[
  {"order_id":1001,"items":[{"sku":"A-1","qty":2,"unit_price":9.5},{"sku":"B-7","qty":1,"unit_price":24.0}]},
  {"order_id":1002,"items":[{"sku":"A-1","qty":5,"unit_price":9.5}]}
]
```

The `ORDER BY` inside `list()` makes the array order deterministic;
without it, element order depends on how the file was scanned.

## Parent and child in separate files

Real data often has orders in one file and lines in another. Join, then
group. `GROUP BY ALL` groups by every non-aggregated column so you do not
have to repeat them:

```sql
COPY (
  SELECT o.order_id,
         o.order_date,
         {'name': o.customer_name, 'email': o.customer_email} AS customer,
         coalesce(
           list({'sku': l.sku, 'qty': l.qty, 'unit_price': l.unit_price}
                ORDER BY l.sku)
             FILTER (WHERE l.sku IS NOT NULL),
           []
         ) AS items
  FROM 'orders.parquet' o
  LEFT JOIN 'order_lines.parquet' l USING (order_id)
  GROUP BY ALL
  ORDER BY o.order_id
) TO 'orders.jsonl' (FORMAT json);
```

The `FILTER` and `coalesce` are not decoration. Without them, an order
with no lines comes out as
`"items":[{"sku":null,"qty":null,"unit_price":null}]` — one phantom item
that will break any consumer counting items. With them it is `"items":[]`.

Leaving out `ARRAY true` gives JSONL, one order per line. Prefer that for
anything large: consumers can stream it, and a truncated file loses only
its last line instead of becoming invalid JSON.

## Types to watch

- **Dates and timestamps** become ISO strings (`"2026-09-01"`), which is
  usually what you want. Use `strftime` if the consumer expects another
  format.
- **DECIMAL** becomes a JSON number, so `9.50` turns into `9.5`. For money
  sent to systems that parse numbers as doubles, emit
  `CAST(unit_price AS VARCHAR)` instead.
- **64-bit integers** are written exactly, but JavaScript parses numbers
  above 2**53 lossily. Cast large IDs to strings if a browser reads the
  file.

## Check the result

Read the JSON back and compare against the source:

```sql
SELECT count(*) AS orders, sum(len(items)) AS lines
FROM read_json('orders.jsonl');

SELECT (SELECT count(*) FROM 'orders.parquet')      AS orders,
       (SELECT count(*) FROM 'order_lines.parquet') AS lines;
```

`DESCRIBE SELECT * FROM read_json('orders.jsonl')` should show `customer`
as a `STRUCT` and `items` as a `STRUCT(...)[]`. If `items` is `JSON` or
`VARCHAR`, the nesting did not survive.

## Where to run it

You can build and preview the nested `SELECT` in the
[SQL Workbench](/sql) — drop both Parquet files and the struct and list
columns render in the result grid, all in your browser. Run the final
`COPY` with the DuckDB CLI to write the JSON file. If you need the
opposite direction, turning nested columns into flat CSV, see
[flattening nested Parquet columns](/docs/flatten-nested-parquet-columns).

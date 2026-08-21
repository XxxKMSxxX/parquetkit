---
slug: flatten-nested-parquet-columns
title: "How to Flatten Nested Parquet Columns to CSV or JSON"
description: "Parquet struct and list columns become unusable text in CSV. Flatten them properly with DuckDB SQL, or keep the nesting by exporting JSON instead."
date: "2026-08-22"
faq:
  - question: "Why does my struct column look like {'city': 'Tokyo'} in the CSV?"
    answer: "That is DuckDB's text rendering of a STRUCT value, not JSON — it uses single quotes, so json.loads rejects it downstream. Wrap the column in to_json() before exporting if you want a parseable string."
  - question: "How do I expand a struct into one column per field?"
    answer: "Select the fields by name with dot notation, or use unnest(col, recursive := true) to expand every field at once, including fields of nested structs."
  - question: "What happens to row counts when I unnest a list column?"
    answer: "One input row becomes one row per list element, so the result grows. Use array_to_string(col, '|') instead when you need to keep exactly one row per record."
  - question: "Is there a way to avoid flattening altogether?"
    answer: "Yes, if the consumer accepts JSON. Exporting to JSON or JSONL preserves the nested structure exactly, so no information is lost and no column naming scheme is needed."
---

## Why nesting breaks CSV

Parquet stores nested data natively: a `STRUCT` column holds named fields, a
`LIST` column holds a variable number of values per row. CSV has neither
concept. When you export directly, those columns arrive as a single opaque
cell — usually something like `{'city': 'Tokyo', 'zip': '150-0001'}` — which
looks like JSON but is not: DuckDB renders struct values with single quotes,
so any downstream `json.loads` fails immediately.

Deciding *how* to flatten is the actual work. Start by looking at what you
have.

## Step 1: see the nested types

Drop the file into the [Parquet Viewer](/parquet-viewer), or ask DuckDB:

```sql
DESCRIBE SELECT * FROM 'events.parquet';
```

Nested columns show up as `STRUCT(city VARCHAR, zip VARCHAR)` or
`VARCHAR[]`. Everything else is already CSV-safe.

## Step 2a: promote struct fields to columns

Dot notation reads a single field. Combine it with `EXCLUDE` to drop the
original struct in the same select:

```sql
SELECT * EXCLUDE (address),
       address.city AS address_city,
       address.zip  AS address_zip
FROM 'events.parquet';
```

For a wide or deeply nested struct, expand everything at once:

```sql
SELECT id, unnest(address, recursive := true)
FROM 'events.parquet';
```

`recursive := true` also flattens structs inside structs. It is faster to
write, but the generated column names come from the field names alone, so
two nested fields called `id` collide — explicit aliases are safer for
anything you will re-import later.

## Step 2b: keep the struct, but as real JSON

When the fields vary or you just need the data to survive the round trip,
stringify instead of expanding:

```sql
SELECT * REPLACE (to_json(address) AS address)
FROM 'events.parquet';
```

`REPLACE` swaps one column in place and leaves the rest of the select
untouched. The CSV now contains `{"city":"Tokyo","zip":"150-0001"}` — valid
JSON, parseable by anything.

## Step 2c: lists become rows, or a delimited string

To explode a list into rows:

```sql
SELECT id, unnest(tags) AS tag
FROM 'events.parquet';
```

Each input row produces one row per element, so a 10,000-row file with three
tags each returns 30,000 rows. When the output must stay one row per record,
join the elements instead:

```sql
SELECT id, array_to_string(tags, '|') AS tags
FROM 'events.parquet';
```

## Step 3: export

In the [SQL Workbench](/sql), run the flattening query and download the
result as CSV. Note that the workbench registers each dropped file under its
exact name, so reference `'events.parquet'` literally — glob patterns have
nothing to expand against in the browser.

From a terminal:

```bash
duckdb -c "COPY (SELECT * EXCLUDE (address), address.city AS address_city
                 FROM 'events.parquet') TO 'flat.csv' (HEADER)"
```

## Or do not flatten at all

Flattening is only necessary because CSV is flat. If whatever consumes the
data reads JSON, export nesting intact and skip this entire problem:

```bash
duckdb -c "COPY (SELECT * FROM 'events.parquet') TO 'events.jsonl' (FORMAT json)"
```

DuckDB writes newline-delimited JSON by default; add `ARRAY true` for a
single JSON array. The browser equivalents are the
[Parquet to JSON](/convert/parquet-to-json) and
[Parquet to JSONL](/convert/parquet-to-jsonl) converters, both of which
preserve structs and lists as-is.

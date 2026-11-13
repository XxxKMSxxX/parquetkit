---
slug: pyarrow-schema-at-index-was-different
title: "Fix pyarrow \"Schema at index N was different\" When Merging"
description: "Merging Parquet files with pyarrow fails with Schema at index 1 was different or Table schema does not match. Find the exact field that differs and fix it."
date: "2026-11-14"
faq:
  - question: "What does \"Schema at index 1 was different\" mean?"
    answer: "pa.concat_tables found that the second table in your list (index 1, counting from zero) has a schema that is not identical to the first one. Column order, type width, timestamp unit or nullability can each trigger it."
  - question: "Does promote_options fix every schema mismatch?"
    answer: "No. promote_options=\"default\" handles reordered columns, missing columns, null-typed columns and nullability. \"permissive\" also widens numeric types and timestamp units. A column that is int64 in one file and string in another still fails and needs an explicit cast."
  - question: "Why does ParquetWriter say the table schema does not match?"
    answer: "A ParquetWriter is created with one fixed schema, and every write_table call must match it exactly. Cast each table to the writer's schema before writing it."
  - question: "Can I merge files with conflicting types without Python?"
    answer: "Yes. DuckDB's union_by_name option promotes conflicting columns to a common type, falling back to VARCHAR, and it works in the browser SQL Workbench with UNION ALL BY NAME."
---

## The error

You read a set of Parquet files and combine them, and pyarrow refuses:

```text
pyarrow.lib.ArrowInvalid: Schema at index 1 was different:
id: int64
v: string
vs
v: string
id: int64
```

or, when you stream them into one output file with `pq.ParquetWriter`:

```text
ValueError: Table schema does not match schema used to create file:
table:
id: int32 ...
```

By default, `pa.concat_tables` and `ParquetWriter.write_table` both require
schemas to be **identical**. The same column names are not enough. Field
order, type width and nullability all have to match too. Files written by different jobs,
pandas versions or Spark runs rarely match that strictly.

## Step 1: find the field that differs

The error message prints both schemas but does not point at the
difference. Compare the footers instead. `read_schema` reads only the
footer, so this is fast even for large files:

```python
import pyarrow.parquet as pq

files = ["part-0.parquet", "part-1.parquet", "part-2.parquet"]
base = pq.read_schema(files[0])

for f in files[1:]:
    s = pq.read_schema(f)
    if s.names != base.names:
        print(f, "column order/set:", s.names)
    for field in s:
        if field.name not in base.names:
            continue
        ref = base.field(field.name)
        if field.type != ref.type or field.nullable != ref.nullable:
            print(f, field.name, ref.type, "->", field.type,
                  "nullable", ref.nullable, "->", field.nullable)
```

Without Python, drop each file into the [Parquet Viewer](/parquet-viewer)
to read its schema, or drop two at a time into [Parquet Diff](/diff), which
lists added, removed and re-typed columns.

## Step 2: match the cause to the fix

| What differs | Typical cause | Fix |
|---|---|---|
| Column order | different `SELECT` order upstream | `promote_options="default"` |
| Column missing in some files | field added later | `promote_options="default"` |
| `null` type vs real type | an all-null pandas column | `promote_options="default"` |
| `not null` vs nullable | Spark or a strict writer | `promote_options="default"` |
| `int32` vs `int64` | different writers | `promote_options="permissive"` |
| `timestamp[ns]` vs `timestamp[us]` | pandas vs Spark/DuckDB | `promote_options="permissive"` |
| `int64` vs `string` | bad data in one batch | explicit cast (below) |

`promote_options` arrived in pyarrow 14. On older versions, upgrade or cast.

```python
import pyarrow as pa

tables = [pq.read_table(f) for f in files]
merged = pa.concat_tables(tables, promote_options="permissive")
pq.write_table(merged, "merged.parquet", compression="zstd")
```

Even `"permissive"` gives up on a true type conflict and raises
`ArrowTypeError: Unable to merge: Field id has incompatible types: int64 vs string`.
That one has no automatic answer. You have to decide which type the column
should have.

## Step 3: cast to a target schema you choose

For full control, and to handle files too large to concatenate in memory,
define the output schema once and cast every table to it while streaming:

```python
target = pa.schema([
    ("id", pa.int64()),
    ("v", pa.string()),
    ("ts", pa.timestamp("us")),
])

with pq.ParquetWriter("merged.parquet", target, compression="zstd") as w:
    for f in files:
        t = pq.read_table(f)
        for name in target.names:          # add columns a file lacks
            if name not in t.column_names:
                t = t.append_column(name, pa.nulls(len(t), target.field(name).type))
        w.write_table(t.select(target.names).cast(target))
```

`select` fixes the order, and `cast` fixes types and nullability. If a
value cannot be cast, such as the string `"N/A"` in an `int64` column, the
cast raises an error and names the value. That is the row to fix at the
source. Casting `timestamp[ns]` to `timestamp[us]` also refuses to drop
sub-microsecond precision silently. Only one file is in memory at a time.

## The DuckDB alternative

DuckDB unifies schemas for you when you ask it to:

```sql
COPY (
  SELECT * FROM read_parquet('part-*.parquet', union_by_name = true)
) TO 'merged.parquet' (FORMAT parquet, COMPRESSION zstd);
```

With `union_by_name = true`, an `int64` vs `string` conflict becomes
`VARCHAR` instead of an error. Run `DESCRIBE` on the query first to see the
resulting types. Leave the option out and DuckDB takes the first file's
schema and casts the rest to it, which fails or silently converts depending
on the values.

In the browser, the [SQL Workbench](/sql) does the same with
`UNION ALL BY NAME` across the files you drop in. See
[How to Merge Multiple Parquet Files into One](/docs/merge-multiple-parquet-files)
for the full workflow. If the merged dataset is then read by Spark, check
[PARQUET_COLUMN_DATA_TYPE_MISMATCH](/docs/parquet-column-data-type-mismatch)
for the same problem on the Spark side.

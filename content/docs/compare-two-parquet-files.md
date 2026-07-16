---
slug: compare-two-parquet-files
title: "How to Compare Two Parquet Files and See What Changed"
description: "Diff two Parquet files by key to find added, removed and changed rows — in your browser, with DuckDB SQL, or with a short pandas script."
date: "2026-07-16"
faq:
  - question: "Why do byte-level diff tools say my Parquet files differ when the data is the same?"
    answer: "Parquet bytes depend on row-group layout, compression codec, encoding choices and writer metadata. Two files with identical rows can differ at the byte level, so a meaningful comparison has to join and compare the data itself."
  - question: "Can I compare two Parquet files without installing anything?"
    answer: "Yes. The Parquet Diff tool on this site joins both files on a key column inside your browser and lists added, removed and changed rows. Everything runs locally on WebAssembly; nothing is uploaded."
  - question: "What if my files have no unique key column?"
    answer: "Pick the column (or combination) closest to a primary key. If keys repeat, rows join many-to-many and counts inflate — the tool warns you when the chosen key is not unique so you can pick a better one."
  - question: "How do I check whether the schema changed between two Parquet files?"
    answer: "Schema lives in the file footer, so it can be compared without reading any rows. The Parquet Diff tool reports added, removed and re-typed columns instantly when you drop two files."
---

## The situation

You have two versions of the same dataset — yesterday's export and today's,
the output of a pipeline before and after a code change, or a file a
colleague sent back "with a few fixes" — and you need to know exactly what
changed. Renaming one of them `_final` does not answer that, and a byte
comparison is useless with Parquet: row-group layout, compression and
encodings change the bytes without changing a single value.

What you actually want is a semantic diff: join the two files on a key and
classify every row as added, removed, changed or unchanged.

## Option 1: diff in the browser (no install)

The [Parquet Diff](/diff) tool on this site does the join locally:

1. Drop the two files (old and new) onto the page.
2. Schema changes — added, removed or re-typed columns — appear immediately,
   read from the file footers before any rows are touched.
3. Pick the join key (an `id`-like column is preselected) and hit
   *Compare rows*.
4. You get counts of added / removed / changed / unchanged rows, and each
   changed row shows exactly which cells differ as `old → new`.

The comparison runs in an in-browser DuckDB database via WebAssembly, so
nothing is uploaded — fine for confidential data, and multi-hundred-MB files
work because the counting happens inside the database rather than in page
memory.

## Option 2: DuckDB SQL

The same idea expressed directly in SQL, if you already have DuckDB
installed (or want to run it in the [SQL Workbench](/sql)):

```sql
-- Rows in new but not old (added)
SELECT * FROM read_parquet('new.parquet')
EXCEPT
SELECT * FROM read_parquet('old.parquet');

-- Changed rows for a key column `id`, showing both sides
SELECT o.id, o.amount AS amount_old, n.amount AS amount_new
FROM read_parquet('old.parquet') o
JOIN read_parquet('new.parquet') n USING (id)
WHERE o.amount IS DISTINCT FROM n.amount;
```

`EXCEPT` treats entire rows as the unit of comparison, so it cannot tell a
"changed" row from a removed-plus-added pair. The join version can — that is
why keyed comparison is the more useful shape, and it is what the browser
tool automates for every column at once.

## Option 3: pandas

```python
import pandas as pd

old = pd.read_parquet("old.parquet").set_index("id")
new = pd.read_parquet("new.parquet").set_index("id")

added = new.loc[new.index.difference(old.index)]
removed = old.loc[old.index.difference(new.index)]

both = old.index.intersection(new.index)
changed_mask = (old.loc[both] != new.loc[both]).any(axis=1)
changed = new.loc[both][changed_mask]
```

This works, and it is what most people end up writing — but it loads both
files fully into memory, needs care around NaN comparisons (`NaN != NaN` is
`True`, so untouched null cells count as "changed" unless you handle them),
and the script gets rewritten from scratch every time the schema is
different.

## Watch out for

- **Non-unique keys.** If the key repeats, the join multiplies rows and
  every count inflates. Verify uniqueness first
  (`SELECT count(*), count(DISTINCT id) FROM ...`).
- **Type drift.** A column that changed from `DOUBLE` to `INT64` can make
  the join itself fail or silently compare unequal values. Compare schemas
  before comparing rows.
- **Floats and timestamps.** Exact equality on floating-point columns can
  flag rows that differ only by representation; decide whether a tolerance
  matters for your data before trusting a large "changed" count.

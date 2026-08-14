---
slug: parquet-to-jsonl-for-llm-fine-tuning
title: "Convert Parquet to JSONL for LLM Fine-Tuning"
description: "Fine-tuning APIs expect JSONL, but datasets ship as Parquet. Filter, reshape and export training data as JSONL — in the browser or with one DuckDB command."
date: "2026-08-15"
faq:
  - question: "Why do fine-tuning APIs use JSONL instead of JSON or Parquet?"
    answer: "JSONL puts one self-contained example per line, so the training service can stream, split and validate the file without parsing it whole. Every malformed example is addressable by line number, which makes upload errors debuggable."
  - question: "Can I convert a Hugging Face Parquet dataset to JSONL without pandas?"
    answer: "Yes. Download the .parquet shard and drop it into the browser Parquet to JSONL converter on this site, or run a one-line DuckDB COPY command. Neither requires Python, pandas or the datasets library."
  - question: "How do I reshape flat columns into the messages format for chat fine-tuning?"
    answer: "Build the structure in SQL: select a list of role/content structs from your prompt and response columns, then export with FORMAT JSON. DuckDB serializes lists and structs as proper JSON arrays and objects on each line."
  - question: "How do I split training and validation sets during the export?"
    answer: "Hash a stable ID column and filter: WHERE hash(id) % 20 != 0 for ~95% train, = 0 for the rest. Unlike random(), the split is reproducible, and no example can land in both files."
---

## The mismatch

Public datasets — Hugging Face hosts its datasets as Parquet shards, and
most warehouses export the same way — arrive as `.parquet`, but every
mainstream fine-tuning pipeline wants JSONL: one JSON object per line,
usually in a chat `messages` shape. The gap is small enough that reaching
for pandas and a virtualenv is overkill.

## Straight conversion, no code

If your Parquet columns already match the target shape, drop the file into
the [Parquet to JSONL converter](/convert/parquet-to-jsonl). It runs DuckDB
compiled to WebAssembly inside the tab — the dataset never leaves your
machine, which matters when the training data contains customer text.
Nested lists and structs come out as real JSON arrays and objects, so a
dataset that already has a `messages` column converts losslessly.

Before converting, it is worth a two-minute look at what is actually in the
file: open it in the [Parquet Viewer](/parquet-viewer) to check the schema,
spot empty columns and confirm the row count matches what the dataset card
claims.

## Reshaping into the messages format

More often the Parquet file is flat — `prompt` and `response` columns, say —
and the API wants each line as
`{"messages": [{"role": "user", ...}, {"role": "assistant", ...}]}`.
That reshape is one query. In the [SQL Workbench](/sql) or the DuckDB CLI:

```sql
SELECT [
  {'role': 'user',      'content': prompt},
  {'role': 'assistant', 'content': response}
] AS messages
FROM 'train.parquet'
WHERE response IS NOT NULL
  AND length(response) BETWEEN 20 AND 8000;
```

DuckDB's struct and list literals serialize to exactly the JSON you need.
The `WHERE` clause is where most of the quality work happens: dropping
empty completions, near-zero-length examples and pathological outliers is
the cheapest fine-tuning improvement available.

To write the result as JSONL locally, wrap the query in a `COPY`:

```bash
duckdb -c "COPY (
  SELECT [{'role':'user','content':prompt},{'role':'assistant','content':response}] AS messages
  FROM 'train.parquet' WHERE response IS NOT NULL
) TO 'train.jsonl' (FORMAT JSON);"
```

DuckDB's JSON export is newline-delimited by default — no extra flags.

## Train/validation split that stays put

Avoid `ORDER BY random()` for splitting: it produces a different split on
every run. Hash a stable key instead:

```sql
-- ~95% of rows -> training set
... WHERE hash(id) % 20 != 0

-- the remaining ~5% -> validation set
... WHERE hash(id) % 20 = 0
```

The two predicates are exact complements, so no example can leak into both
files, and re-running the export months later reproduces the same split.

## Final checks before upload

- `wc -l train.jsonl` — the line count is the example count; make sure it
  matches expectations.
- `jq -c 'select(.messages == null)' train.jsonl` — should print nothing.
- Skim a sample: `shuf -n 5 train.jsonl | jq .` catches swapped
  prompt/response columns faster than any validator.
- Deduplicate if the source is scraped data — repeated examples overweight
  themselves in training. `SELECT DISTINCT` during the export above handles
  exact duplicates for free.

If a provider rejects the file, the error usually names a line number —
which is precisely why the format is JSONL in the first place.

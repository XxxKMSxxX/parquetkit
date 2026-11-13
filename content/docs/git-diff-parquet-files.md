---
slug: git-diff-parquet-files
title: "Readable git diff for Parquet Files with textconv and DuckDB"
description: "git diff only says \"Binary files differ\" for Parquet. Configure a DuckDB textconv driver so git diff, git log -p and PR reviews show schema and row changes."
date: "2026-11-14"
faq:
  - question: "Does the textconv driver change what git stores?"
    answer: "No. textconv only affects how git displays a diff. The committed blob is still the original binary Parquet file, byte for byte, and checkouts, merges and hashes are unaffected."
  - question: "Why does the diff show every row as changed after a rewrite?"
    answer: "A rewrite often changes row order. The textconv output follows storage order, so add an ORDER BY on a key column in the driver script to make the text stable and the diff minimal."
  - question: "Will this work on GitHub or GitLab pull requests?"
    answer: "No. Web UIs ignore local textconv configuration and still show the file as binary. Use git diff locally, or compare the two versions in the browser with the Parquet Diff tool."
  - question: "Is this practical for large Parquet files?"
    answer: "Dumping every row only makes sense for small fixtures and reference tables. For large files, have the driver print the schema, the row count and an aggregate summary instead of the full data."
---

## The problem

Small Parquet files end up in git all the time: test fixtures, seed data,
lookup tables, golden outputs for a pipeline test. Then someone changes one
and the review shows:

```text
diff --git a/tests/fixtures/orders.parquet b/tests/fixtures/orders.parquet
Binary files a/tests/fixtures/orders.parquet and b/tests/fixtures/orders.parquet differ
```

Git has a built-in fix for this: a **textconv** driver. Git converts each
version of the file to text with a command you choose, then diffs the text.
DuckDB makes a good converter because it reads Parquet with a single command.

## Step 1: a small converter script

Save this as `parquet-textconv` somewhere on your `PATH` (for example
`~/bin`) and make it executable with `chmod +x`:

```sh
#!/bin/sh
# git passes the path of a temporary copy of the file as $1
f="$1"
echo "## schema"
duckdb -csv -c "SELECT column_name, column_type FROM (DESCRIBE SELECT * FROM read_parquet('$f'))"
echo "## rows"
duckdb -csv -c "SELECT * FROM read_parquet('$f') ORDER BY ALL"
```

Two choices here matter:

- **Schema first.** A changed column type or a dropped column shows up at the
  top of the diff, even when no row values changed.
- **ORDER BY ALL.** Writers do not guarantee row order. Sorting by every column
  means a file rewritten in a different order produces no diff at all. If the
  table has a key, `ORDER BY id` is faster and gives cleaner hunks.

`-csv` prints one line per row, which is exactly what line-based diff wants.

## Step 2: tell git which files use it

Map the extension to a diff driver in `.gitattributes`, and commit that file
so the whole team gets the mapping:

```text
*.parquet diff=parquet
```

Then define the driver. This part lives in git config, not in the repo,
because it names a local program:

```sh
git config --global diff.parquet.textconv parquet-textconv
git config --global diff.parquet.cachetextconv true
```

`cachetextconv` stores the converted text in git notes, so `git log -p` over
a long history does not rerun DuckDB for every old version.

## Step 3: diff as usual

Now the ordinary commands produce readable output:

```sh
git diff tests/fixtures/orders.parquet
git log -p -- tests/fixtures/orders.parquet
git cat-file --textconv HEAD~3:tests/fixtures/orders.parquet
```

A changed value now looks like any other one-line change:

```text
 ## rows
 id,customer,amount
-1042,acme,19.90
+1042,acme,21.90
```

If you need the original bytes, `git diff --no-textconv` disables the driver
for one command.

## Large files: summarize instead of dumping

For anything beyond a few thousand rows, a full dump makes diffs slow and
unreadable. Swap the rows query for a profile:

```sh
duckdb -csv -c "SELECT count(*) AS row_count FROM read_parquet('$f')"
duckdb -csv -c "SELECT column_name, min, max, null_percentage FROM (SUMMARIZE SELECT * FROM read_parquet('$f'))"
```

You still see when a column's range or null rate shifts, which is usually
what a reviewer needs. Large data files usually belong in object storage
rather than in git history anyway.

## When you need a real row-level diff

Text diffs compare lines, not records. If many values changed, or you want
counts of added, removed and changed rows by key, check out both versions
(`git show HEAD~1:path/file.parquet > old.parquet`) and drop them into the
[Parquet Diff](/diff) tool. It joins on a key in your browser and lists
changed cells as old → new, with nothing uploaded. The SQL behind that
approach is covered in
[How to Compare Two Parquet Files](/docs/compare-two-parquet-files). To
look at a single version first, open it in the
[Parquet Viewer](/parquet-viewer).

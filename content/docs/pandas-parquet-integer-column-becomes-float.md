---
slug: pandas-parquet-integer-column-becomes-float
title: "Why pandas Reads Parquet Integer Columns as Float (and the Fix)"
description: "An int column with nulls comes back from pd.read_parquet as float64, and large IDs lose digits. Find whether the file or the reader is at fault, and fix it."
date: "2026-10-03"
faq:
  - question: "Why does pd.read_parquet turn my integer column into float64?"
    answer: "The column contains at least one null. Classic NumPy int64 has no way to represent a missing value, so pandas converts the column to float64 and uses NaN. Parquet itself stores nullable integers without any problem."
  - question: "How do I keep integers as integers when reading Parquet in pandas?"
    answer: "Pass dtype_backend='numpy_nullable' to get pandas Int64 columns, or dtype_backend='pyarrow' to get int64[pyarrow]. Both keep nulls as NA and the values as exact integers. This needs pandas 2.0 or later and the pyarrow engine."
  - question: "Does the fastparquet engine support dtype_backend?"
    answer: "No, pandas raises a ValueError. Calling fastparquet.ParquetFile(path).to_pandas() directly does return nullable Int64 and boolean columns, so use that if you must stay on fastparquet."
  - question: "Can converting to float corrupt my IDs?"
    answer: "Yes. float64 represents integers exactly only up to 2**53. A 64-bit ID such as 9007199254740993 reads back as 9007199254740992, and the change is silent."
---

## The symptom

You write a table of user IDs, read it back, and `user_id` shows up as
`1.0, NaN, 3.0`. Or a downstream job joins on an ID column and some rows
stop matching. The usual reaction is to blame Parquet, but Parquet has
native nullable integers. The float comes from one of two places, and the
fix depends on which.

## Step 1: find out what the file really stores

Open the file in the [Parquet Viewer](/parquet-viewer) and look at the
column's type, or run `DESCRIBE` in the [SQL Workbench](/sql):

```sql
DESCRIBE SELECT * FROM 'users.parquet';
```

- `BIGINT` / `INTEGER`: the file is fine. pandas converts it on **read**.
- `DOUBLE`: the file was **written** as float. Fixing the reader will not
  help; the writer has to change.

## Case A: integers in the file, float in pandas

With the default NumPy dtypes, pandas has no integer type that can hold a
missing value. Any integer column with at least one null becomes
`float64`. Columns without nulls stay `int64`, which is why the problem
appears in some files and not others.

Ask for nullable dtypes instead:

```python
import pandas as pd

df = pd.read_parquet("users.parquet", dtype_backend="numpy_nullable")
df.dtypes   # user_id: Int64, is_active: boolean

# or Arrow-backed columns end to end
df = pd.read_parquet("users.parquet", dtype_backend="pyarrow")
df.dtypes   # user_id: int64[pyarrow], is_active: bool[pyarrow]
```

Nullable booleans have the same issue: by default they come back as
`object` (pyarrow engine) or `float64` (fastparquet engine).

Do not "fix" it afterwards with `df["user_id"].astype("Int64")`. By then
the values have already passed through float64, which is exact only up to
2**53. In a quick test, `9007199254740993` came back as
`9007199254740992` — a different user, no warning.

### If you are on the fastparquet engine

`pd.read_parquet(..., engine="fastparquet", dtype_backend=...)` raises
`ValueError: The 'dtype_backend' argument is not supported for the
fastparquet engine`, and without it you get `float64`. fastparquet's own
API behaves better:

```python
from fastparquet import ParquetFile

df = ParquetFile("users.parquet").to_pandas()
df.dtypes   # user_id: Int64, is_active: boolean
```

Or switch the engine to pyarrow; see
[fastparquet vs pyarrow](/docs/fastparquet-vs-pyarrow) for the trade-offs.

## Case B: the file itself stores DOUBLE

This happens when the DataFrame was already float at write time —
typically because it came from `read_csv` with an empty cell, or from a
merge that introduced NaN:

```python
df = pd.read_csv("users.csv")        # id has a blank -> float64
df.to_parquet("users.parquet")        # column written as DOUBLE
```

Cast to a nullable integer before writing:

```python
df = pd.read_csv("users.csv", dtype_backend="numpy_nullable")
# or, for an existing frame:
df["id"] = df["id"].astype("Int64")
df.to_parquet("users.parquet")        # column written as INT64
```

The `astype` route is only safe if the floats never exceeded 2**53. When
IDs are large, read the CSV with nullable dtypes from the start.

Alternatively, skip pandas for the conversion. DuckDB infers a nullable
`BIGINT` from a CSV column with blanks, and so does the
[CSV to Parquet converter](/convert/csv-to-parquet), which runs DuckDB in
your browser:

```sql
COPY (SELECT * FROM 'users.csv') TO 'users.parquet' (FORMAT parquet);
```

## Why it matters beyond looks

A file that stores `DOUBLE` in one batch and `INT64` in the next is the
classic cause of schema drift across a dataset. Spark and Databricks then
fail the whole read — see
[PARQUET_COLUMN_DATA_TYPE_MISMATCH](/docs/parquet-column-data-type-mismatch)
for tracking down which file drifted. Fixing the dtype at write time stops
that before it starts.

## Quick checklist

1. `DESCRIBE` the file: integer or double?
2. Integer in the file: read with `dtype_backend="numpy_nullable"` or
   `"pyarrow"`.
3. Double in the file: cast to `Int64` before `to_parquet`, or let DuckDB
   do the conversion.
4. Never round-trip 64-bit IDs through float64.

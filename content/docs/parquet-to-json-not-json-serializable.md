---
slug: parquet-to-json-not-json-serializable
title: "Parquet to JSON: Fix \"Object Is Not JSON Serializable\""
description: "json.dumps fails on Timestamp, Decimal, bytes and int64 values read from Parquet. Why each type breaks, and three ways to get valid JSON out."
date: "2026-09-26"
faq:
  - question: "Why does df.to_json work when json.dumps fails?"
    answer: "pandas ships its own JSON encoder that understands Timestamps, numpy integers and NaN. Python's json module only knows dict, list, str, int, float, bool and None, so anything else raises TypeError unless you supply a default= hook."
  - question: "Is default=str a safe fix?"
    answer: "It stops the error but hides type decisions: Decimals become strings, bytes become \"b'...'\" literals, and numpy arrays become their printed repr. Use it for debugging output, not for files another system will parse."
  - question: "Why does my JSON contain NaN, and why does the parser reject it?"
    answer: "json.dumps writes float NaN as the bare token NaN, which is not valid JSON. Strict parsers such as JSON.parse in browsers or jq reject it. Convert missing values to None first, or export with a tool that writes null."
  - question: "Can I convert Parquet to JSON without Python at all?"
    answer: "Yes. The Parquet to JSON converter on this site exports the file with DuckDB inside your browser. Timestamps become ISO-8601 strings, nulls become null and nested columns stay nested, with no upload."
---

## The error

You read a Parquet file, turn it into records and dump it:

```python
import json, pandas as pd

df = pd.read_parquet("orders.parquet")
json.dumps(df.to_dict(orient="records"))
# TypeError: Object of type Timestamp is not JSON serializable
```

Parquet is strongly typed and JSON is not. Python's `json` module only
encodes `dict`, `list`, `str`, `int`, `float`, `bool` and `None`. Everything
pandas and pyarrow hand you out of a typed Parquet column is something else.

## Which Parquet types break it

| Parquet type | Python object you get | Error message mentions |
| --- | --- | --- |
| TIMESTAMP / DATE | `pandas.Timestamp`, `datetime.date` | `Timestamp`, `date` |
| DECIMAL | `decimal.Decimal` | `Decimal` |
| BINARY (non-UTF8) | `bytes` | `bytes` |
| LIST | `numpy.ndarray` | `ndarray` |
| INT64 via numpy | `numpy.int64` | `int64` |

The last row is the confusing one: `to_dict()` usually converts numpy
scalars back to Python ints, but values pulled out with `.iloc`, `.values` or
inside list columns often stay as `numpy.int64`, which `json` refuses.

## Fix 1: let pandas do the encoding

pandas has its own encoder that knows these types:

```python
df.to_json("orders.json", orient="records", date_format="iso")
# or one object per line
df.to_json("orders.jsonl", orient="records", lines=True, date_format="iso")
```

Pass `date_format="iso"` explicitly. With `orient="records"` the default is
`epoch`, which writes timestamps as millisecond integers — valid JSON, but
rarely what the consumer expects. `to_json` also writes missing values as
`null` instead of the invalid `NaN` token that `json.dumps` produces.

## Fix 2: a `default=` hook that makes deliberate choices

If you need `json.dumps` (to post to an API, say), decide per type instead
of reaching for `default=str`:

```python
import base64, datetime, decimal
import numpy as np

def encode(obj):
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    if isinstance(obj, decimal.Decimal):
        return str(obj)          # keep exact precision; use float(obj) if lossy is OK
    if isinstance(obj, bytes):
        return base64.b64encode(obj).decode("ascii")
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, np.generic):
        return obj.item()
    raise TypeError(f"Unhandled type: {type(obj).__name__}")

records = df.astype(object).where(df.notna(), None).to_dict(orient="records")
payload = json.dumps(records, default=encode)
```

`pandas.Timestamp` subclasses `datetime.datetime`, so the first branch
covers it. The `where(df.notna(), None)` step replaces NaN and NaT with
`None`, so the output contains `null`. Raising on unknown types is on
purpose: a new column type should fail loudly, not turn into a string
nobody asked for.

## Fix 3: skip Python and export with DuckDB

DuckDB maps every Parquet type to JSON itself:

```sql
COPY (SELECT * FROM 'orders.parquet')
TO 'orders.json' (FORMAT JSON, ARRAY true);
```

Timestamps come out as ISO strings, lists as JSON arrays, structs as nested
objects and nulls as `null`. To control the representation of a column,
cast it in the `SELECT`: `CAST(amount AS VARCHAR)` keeps a DECIMAL exact,
and `strftime(created_at, '%Y-%m-%dT%H:%M:%SZ')` fixes the timestamp format.

You can run the same statement in the [SQL Workbench](/sql), or use the
[Parquet to JSON converter](/convert/parquet-to-json) (or
[Parquet to JSONL](/convert/parquet-to-jsonl) for line-delimited output)
to convert the whole file in your browser without writing any code.

## Check the output

Before handing the file to someone else, check that a strict parser
accepts it:

```bash
python -c "import json,sys; json.load(open(sys.argv[1]))" orders.json
jq length orders.json
```

If either one complains about `NaN` or `Infinity`, some float column still
has non-finite values. Find them with
`SELECT count(*) FROM 'orders.parquet' WHERE isnan(price) OR isinf(price)`
and decide whether they should be `null` or dropped.

---
slug: pandas-read-parquet-no-engine-error
title: "Fix pandas read_parquet: Unable to Find a Usable Engine"
description: "pandas raises ImportError: Unable to find a usable engine when no Parquet reader is installed. What actually causes it, and how to fix it for good."
date: "2026-08-22"
faq:
  - question: "What does 'Unable to find a usable engine' mean in pandas?"
    answer: "pandas has no Parquet reader of its own. read_parquet delegates to pyarrow or fastparquet, and this ImportError means neither could be imported in the interpreter that is running your code."
  - question: "I already ran pip install pyarrow and the error persists. Why?"
    answer: "The package almost certainly landed in a different interpreter than the one running the script. Run python -m pip install pyarrow with the same python you use to execute the code, and check sys.executable inside a notebook kernel."
  - question: "Should I install pyarrow or fastparquet?"
    answer: "Install pyarrow. It is the default engine in pandas 2.x, supports nested types and modern encodings, and is actively developed. Use fastparquet only when no pyarrow wheel exists for your platform."
  - question: "Can I read a Parquet file without fixing the Python environment at all?"
    answer: "Yes. A browser-based viewer or a DuckDB one-liner reads the file with no pandas engine involved, which is often faster than debugging the environment when you only need to look at the data once."
---

## The error

```text
ImportError: Unable to find a usable engine; tried using: 'pyarrow', 'fastparquet'.
A suitable version of pyarrow or fastparquet is required for parquet support.
Trying to import the above resulted in these errors:
 - Missing optional dependency 'pyarrow'. pyarrow is required for parquet support.
 - Missing optional dependency 'fastparquet'. fastparquet is required for parquet support.
```

pandas cannot read Parquet by itself. `pd.read_parquet` and `df.to_parquet`
are thin wrappers that hand the work to **pyarrow** or **fastparquet**. This
error means neither import succeeded — it says nothing about your file.

Read the lines after *"resulted in these errors"* before doing anything
else. They contain the real failure for each engine, and that is what
decides which fix below applies.

## Fix 1: install into the right interpreter

The common case is a plain missing dependency:

```bash
python -m pip install pyarrow
python -c "import pandas, pyarrow; print(pandas.__version__, pyarrow.__version__)"
```

Use `python -m pip`, not bare `pip`. A bare `pip` on `PATH` frequently
belongs to a different environment than the `python` that runs your script,
which is why "I already installed it" is the most common follow-up. With uv:

```bash
uv add pyarrow          # project
uv pip install pyarrow  # active venv
```

In a notebook, confirm the kernel first:

```python
import sys; print(sys.executable)
```

If that path is not your project venv, switch the kernel — installing again
will not help.

## Fix 2: the import failed for a different reason

If the error tail shows something other than *Missing optional dependency* —
a `DLL load failed`, a version conflict, or a build error — pyarrow is
present but broken. Two frequent causes:

- **No wheel for your Python version or platform.** Just-released Python
  minors, musl-based images (Alpine), and unusual architectures may have no
  prebuilt wheel, so pip tries a source build and fails. Force the issue to
  surface with `pip install --only-binary=:all: pyarrow`, then either pin to
  a Python version that has wheels or switch base image.
- **A pyarrow too old for your pandas.** pandas enforces a minimum version
  and reports the same "usable engine" message. `python -m pip install -U pyarrow`
  resolves it.

Mixing conda and pip installs of pyarrow in one environment also produces
broken imports; keep to one installer.

## Fix 3: pick the engine explicitly

Since pandas 2.0, pyarrow is the default when installed. If you must use the
other engine — typically because no pyarrow wheel exists — install it and
say so:

```python
df = pd.read_parquet("data.parquet", engine="fastparquet")
```

Expect gaps: fastparquet handles plain columnar data well but struggles with
nested structs and newer logical types. The trade-offs are covered in
[fastparquet vs pyarrow](/docs/fastparquet-vs-pyarrow).

## Skip the engine entirely

If you only need to inspect the file, no Python engine is required at all.
DuckDB reads Parquet natively:

```bash
duckdb -c "SELECT * FROM 'data.parquet' LIMIT 20"
```

Or open the file in the [Parquet Viewer](/parquet-viewer) to see schema,
types and a row sample, run aggregates in the [SQL Workbench](/sql), or
export it with the [Parquet to CSV converter](/convert/parquet-to-csv).
These run locally in the browser on WebAssembly — no install, no upload,
and no dependency on the environment that just broke.

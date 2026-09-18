---
slug: fastparquet-install-and-import-errors
title: "Fix fastparquet Install and Import Errors"
description: "pip install fastparquet fails to build a wheel, or importing it raises a numpy binary incompatibility. What each error means and how to get to a working reader."
date: "2026-09-19"
faq:
  - question: "Why does pip try to build fastparquet from source?"
    answer: "fastparquet ships compiled extension modules, so pip needs a prebuilt wheel matching your Python version, OS and CPU architecture. When no wheel matches — usually on a Python release that is newer than the package — pip falls back to building from source and needs a C toolchain."
  - question: "What does 'numpy.dtype size changed, may indicate binary incompatibility' mean?"
    answer: "A compiled package was built against a different numpy ABI than the numpy currently installed, most often an old pinned fastparquet with numpy 2.x. Reinstall fastparquet so it is rebuilt or refetched against the numpy in the environment, or pin numpy back."
  - question: "How do I make pip fail fast instead of attempting a source build?"
    answer: "Run pip install --only-binary=:all: fastparquet. If no compatible wheel exists, pip says so immediately instead of producing a long compiler error, which tells you the problem is wheel availability rather than your toolchain."
  - question: "Do I need fastparquet at all?"
    answer: "Usually not. pandas 2.x defaults to pyarrow, which has wheels on every platform pandas supports and full support for nested and modern logical types. fastparquet is worth fixing mainly when an existing pipeline already depends on it."
---

## Three errors, three different causes

"fastparquet won't install" covers three unrelated failures. Reading the
error carefully saves the afternoon.

### 1. pip tries to compile it

```text
error: command 'gcc' failed: No such file or directory
error: Microsoft Visual C++ 14.0 or greater is required
ERROR: Failed building wheel for fastparquet
```

fastparquet contains compiled extension modules, so pip needs a wheel built
for your exact Python version, OS and architecture. When none matches, pip
downloads the source tarball and tries to compile — which fails on any
machine without a C toolchain. The usual trigger is a Python release newer
than the package: upgrade to 3.14 the week it ships and half your compiled
dependencies have no wheels yet.

Confirm that is what is happening instead of guessing:

```bash
python -c "import sys, platform; print(sys.version, platform.machine())"
python -m pip install --only-binary=:all: fastparquet
```

With `--only-binary=:all:`, pip refuses to build from source. A clean "could
not find a version that satisfies the requirement" means the problem is wheel
availability, not your compiler. The fixes, in order of effort: upgrade pip
first (`python -m pip install -U pip`, since old pip skips newer wheel tags),
then install into a Python version the package actually supports, or use
conda-forge, which publishes prebuilt binaries earlier for many platforms:

```bash
conda install -c conda-forge fastparquet
```

### 2. numpy ABI mismatch at import time

```text
ValueError: numpy.dtype size changed, may indicate binary incompatibility.
Expected 96 from C header, got 88 from PyObject
```

Nothing is wrong with your Parquet file — this is a compiled package linked
against a different numpy ABI than the numpy in the environment. It shows up
when an old pinned `fastparquet==0.x` meets numpy 2.x, or when a wheel cached
from a previous environment gets reused. Force a fresh resolution:

```bash
python -m pip install --force-reinstall --no-cache-dir fastparquet numpy
```

If the project pins fastparquet for a reason, pin numpy to the matching major
version instead of fighting the rebuild.

### 3. Import fails inside pandas only

```text
ImportError: Missing optional dependency 'fastparquet'.
```

This one is almost always an environment mismatch — the install landed in a
different interpreter than the one running your code. Check `sys.executable`
in the process that raised the error; the
[pandas engine error guide](/docs/pandas-read-parquet-no-engine-error) walks
through the notebook-kernel version of the same trap.

## Codec dependencies

fastparquet delegates compression to `cramjam`, a separate compiled package
covering Snappy, Zstd, LZ4, Brotli and Gzip. On an unusual platform the
failing wheel may be cramjam rather than fastparquet itself, so read which
package pip actually named in the error before searching for the wrong one.

## The faster path

If you are fixing this only to read one file, consider not fixing it.
Installing pyarrow is normally a single working wheel away, and
[pyarrow is the better engine anyway](/docs/fastparquet-vs-pyarrow):

```bash
python -m pip install pyarrow
```

And if the goal is just to see the schema, a sample or a row count, skip
Python altogether: the [Parquet Viewer](/parquet-viewer) reads the footer in
your browser, and the [SQL Workbench](/sql) runs DuckDB queries against the
same file — no environment, no wheels, and nothing uploaded.

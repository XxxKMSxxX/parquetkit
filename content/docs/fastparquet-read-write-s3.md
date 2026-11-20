---
slug: fastparquet-read-write-s3
title: "Read and Write Parquet on S3 with fastparquet and s3fs"
description: "Open Parquet files on S3 with fastparquet: pass an s3fs filesystem to ParquetFile, write with open_with, set credentials, and fetch only the columns you need."
date: "2026-11-21"
faq:
  - question: "How do I read a Parquet file from S3 with fastparquet?"
    answer: "Create an s3fs.S3FileSystem and pass it as fs: ParquetFile('bucket/key.parquet', fs=fs).to_pandas(). Through pandas, pd.read_parquet('s3://bucket/key.parquet', engine='fastparquet') does the same, provided s3fs is installed."
  - question: "Does fastparquet download the whole file from S3?"
    answer: "No. It reads the footer first, then issues range requests for the column chunks you ask for. Selecting three columns out of fifty transfers roughly those three columns' bytes, and row-group filters skip chunks whose statistics cannot match."
  - question: "How do I pass AWS credentials to fastparquet?"
    answer: "fastparquet itself takes none; s3fs resolves them. It uses the standard AWS chain of environment variables, ~/.aws/credentials and instance roles, or explicit key, secret and profile arguments on S3FileSystem. From pandas, pass the same values in storage_options."
  - question: "Can fastparquet use MinIO or Cloudflare R2 instead of AWS S3?"
    answer: "Yes. Any S3-compatible store works by pointing s3fs at it: S3FileSystem(key=..., secret=..., client_kwargs={'endpoint_url': 'https://...'}). The fastparquet calls stay exactly the same."
---

## fastparquet does not speak S3 by itself

fastparquet reads and writes through whatever file-opening function you
hand it. Out of the box that is Python's built-in `open`, which only knows
local paths. For S3 you need [s3fs](https://s3fs.readthedocs.io/), the
fsspec implementation for S3:

```bash
pip install fastparquet s3fs
```

Without it, pandas fails with `ImportError: Install s3fs to access S3`.

## Read one file

```python
import s3fs
from fastparquet import ParquetFile

fs = s3fs.S3FileSystem()
pf = ParquetFile("my-bucket/exports/orders.parquet", fs=fs)

print(pf.count(), pf.columns)
df = pf.to_pandas(columns=["order_id", "amount", "created_at"])
```

Creating the `ParquetFile` fetches only the footer. `to_pandas(columns=...)`
then requests the byte ranges of those columns, so a narrow read of a wide
file is fast and cheap even when the object is several gigabytes. Paths are
written without the `s3://` prefix when you pass `fs` explicitly. Older
code uses `open_with=fs.open` instead of `fs=fs`; both work.

## Read many files as one dataset

```python
paths = fs.glob("my-bucket/events/country=*/*.parquet")
pf = ParquetFile(paths, fs=fs)

df = pf.to_pandas(
    columns=["user_id", "event"],
    filters=[("country", "==", "jp")],
)
```

A list of paths is treated as a single dataset, and `key=value` directory
names become columns you can filter on. If the list covers one partition
value only, pass `root="my-bucket/events"` so fastparquet knows where the
dataset starts. A directory written with a `_metadata` file can be opened by
its path alone. Column selection and filters are covered in detail in
[reading columns, filters and row groups](/docs/fastparquet-parquetfile-read-columns-filters).

## Write to S3

`write()` has no `fs` argument; it takes the opener:

```python
from fastparquet import write

write("my-bucket/out/orders.parquet", df,
      compression="ZSTD", open_with=fs.open)
```

For a partitioned dataset, also pass `mkdirs`:

```python
write("my-bucket/out/events", df,
      file_scheme="hive", partition_on=["country"],
      open_with=fs.open, mkdirs=lambda path: None)
```

S3 has no real directories, so there is nothing to create. Leave `mkdirs`
out and fastparquet falls back to `os.makedirs`, which quietly creates an
empty `my-bucket/out/events/country=...` tree in your local working directory
while the data goes to S3.

## Through pandas

```python
import pandas as pd

df = pd.read_parquet(
    "s3://my-bucket/exports/orders.parquet",
    engine="fastparquet",
    columns=["order_id", "amount"],
    storage_options={"profile": "analytics"},
)
df.to_parquet("s3://my-bucket/out/orders.parquet", engine="fastparquet")
```

`storage_options` is forwarded to `S3FileSystem`, so it accepts the same
keys: `key` and `secret`, `profile`, `anon`, `client_kwargs`. Note that
pandas 3 emits a deprecation warning for `engine="fastparquet"`. Calling
fastparquet directly, as above, is unaffected; whether to stay on it at all
is the subject of [fastparquet vs pyarrow](/docs/fastparquet-vs-pyarrow).

## Credentials and endpoints

```python
fs = s3fs.S3FileSystem(profile="analytics")          # named AWS profile
fs = s3fs.S3FileSystem(anon=True)                     # public buckets
fs = s3fs.S3FileSystem(                               # MinIO, R2, etc.
    key="...", secret="...",
    client_kwargs={"endpoint_url": "https://minio.internal:9000"},
)
```

Read keys from the environment rather than pasting them into a script.

## Errors you will meet

- **`NoCredentialsError`**: s3fs found nothing in the AWS chain. Set a
  profile, or `anon=True` for a public bucket.
- **`PermissionError: Access Denied`**: reading one object needs
  `s3:GetObject`; globbing or opening a directory also needs
  `s3:ListBucket` on the bucket.
- **`FileNotFoundError` for a key that exists**: usually a wrong region or
  endpoint, or a stale listing. s3fs caches directory listings, so after
  another process writes new files call `fs.invalidate_cache()` before
  globbing again.

## Just need a look?

To check a schema or a few rows, a Python session is more than you need.
Download the object and drop it into the [Parquet Viewer](/parquet-viewer),
which reads it locally in the browser. To query it in place with SQL
instead, see
[querying Parquet on S3 without downloading](/docs/query-parquet-on-s3-without-downloading).

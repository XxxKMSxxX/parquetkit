---
slug: query-parquet-on-s3-without-downloading
title: "Query Parquet Files on S3 Without Downloading Them"
description: "Read Parquet straight from S3, GCS or any HTTPS URL with DuckDB httpfs — credentials, globs, partition pruning, and how to keep the bytes you pay for down."
date: "2026-09-19"
faq:
  - question: "Can DuckDB read a Parquet file directly from S3?"
    answer: "Yes. Load the httpfs extension, register credentials with CREATE SECRET, then query the object path like a table: SELECT * FROM 's3://my-bucket/events.parquet' LIMIT 20. DuckDB fetches only the byte ranges the query needs."
  - question: "Does querying a remote Parquet file download the whole thing?"
    answer: "No. DuckDB reads the footer with a small ranged request, then fetches only the column chunks and row groups the query touches. Selecting two columns out of fifty transfers roughly two columns' worth of bytes."
  - question: "How do I query a whole partitioned dataset in a bucket?"
    answer: "Use a glob with hive partitioning: read_parquet('s3://my-bucket/events/**/*.parquet', hive_partitioning = true). Partition keys in the paths become columns, and a WHERE clause on them skips non-matching files entirely."
  - question: "Why does my S3 query fail with a 403 or 400 error?"
    answer: "Most often a region mismatch or missing s3:ListBucket permission. A single-object read needs only GetObject, but a glob has to list the prefix, so a credential that reads one file can still fail on a wildcard path."
---

## The 40 GB problem

The dataset lives in a bucket, you want twenty rows, and the reflex is
`aws s3 cp`. That downloads gigabytes to answer a question the file's own
metadata could have answered. Parquet is designed for the opposite: its
footer lists row groups and column chunks with exact byte offsets, so a
reader that can issue HTTP range requests fetches only what a query touches.
DuckDB's `httpfs` extension does exactly that.

## Setup

```sql
INSTALL httpfs;
LOAD httpfs;

SELECT * FROM 's3://my-bucket/events/2026-09-01/part-000.parquet' LIMIT 20;
```

Any public HTTPS URL works with no credentials at all:

```sql
SELECT count(*) FROM 'https://data.example.com/exports/events.parquet';
```

## Credentials without hardcoding them

Use the credential chain so DuckDB picks up the same profile, environment
variables or instance role the AWS CLI uses. No keys in the SQL, nothing to
leak into a notebook checked into git:

```sql
CREATE SECRET aws_default (TYPE s3, PROVIDER credential_chain);
```

The chain covers the usual sources in order, including the standard
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` environment variables, so a CI
job needs no keys in the SQL either — only the region, whose absence is the
single most common cause of an opaque failure:

```sql
CREATE SECRET aws_ci (
  TYPE s3,
  PROVIDER credential_chain,
  CHAIN 'env;config;instance',
  REGION 'ap-northeast-1'
);
```

The same mechanism covers other object stores: `TYPE gcs` for Google Cloud
Storage with HMAC keys, `TYPE r2` for Cloudflare R2, `TYPE azure` for Azure
Blob Storage.

## Globs and partition pruning

A prefix full of daily exports is one query:

```sql
SELECT dt, event_type, count(*) AS n
FROM read_parquet('s3://my-bucket/events/**/*.parquet', hive_partitioning = true)
WHERE dt BETWEEN '2026-09-01' AND '2026-09-07'
GROUP BY dt, event_type
ORDER BY dt;
```

With `hive_partitioning = true`, path segments like `dt=2026-09-01/` become a
real column, and the `WHERE` clause eliminates non-matching files before a
single byte of their data is requested. Within the files that survive,
row-group statistics in the footer prune further.

Two habits keep the transfer small, and therefore the query fast and the
egress bill low:

- **Name the columns.** `SELECT user_id, amount` reads two column chunks;
  `SELECT *` reads all of them. On wide tables this is a 10x difference.
- **Filter on partition keys first.** A predicate on a regular column still
  requires opening every file's footer; a predicate on a partition key skips
  the files outright.

## Gotchas

- `s3a://` and `s3n://` are Hadoop-specific schemes. DuckDB wants `s3://`.
- A glob needs `s3:ListBucket` on the prefix. Credentials that happily read
  one explicit key will fail on `*.parquet` with an access error.
- S3-compatible stores (MinIO, Ceph) need `ENDPOINT` and usually
  `URL_STYLE 'path'` in the secret, or every request goes to AWS instead.
- Repeated interactive queries re-request ranges. If you are iterating on the
  same slice, materialize it once: `CREATE TABLE sample AS SELECT ...`.

## Once the file is local

When you do pull a file down — a sample, a single partition, an export from a
colleague — the browser tools take it from there with no install: the
[Parquet Viewer](/parquet-viewer) shows the schema and row count from the
footer, and the [SQL Workbench](/sql) runs the same DuckDB SQL locally, with
nothing uploaded. For the CLI and desktop options, see the
[DuckDB viewer comparison](/docs/duckdb-parquet-viewer).

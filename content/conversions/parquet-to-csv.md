---
slug: parquet-to-csv
title: "Convert Parquet to CSV Online — Free & Private"
description: "Convert Parquet files to CSV locally in your browser. Free, no upload, no file size limits — your data never leaves your device."
faq:
  - question: "Is there a file size limit?"
    answer: "No hard limit is imposed by this tool. Because the file is read by reference inside your browser rather than uploaded, multi-gigabyte files work — the practical limit is your machine's memory for the converted output."
  - question: "Is my data uploaded to a server?"
    answer: "No. The conversion runs inside your browser using DuckDB compiled to WebAssembly. You can disconnect from the internet after the page loads and the conversion still works."
  - question: "How are nested columns (lists, structs) converted to CSV?"
    answer: "CSV is a flat format, so nested Parquet values are serialized to their text representation in a single cell. If you need to preserve structure, convert to JSON or JSONL instead."
  - question: "Which Parquet compression codecs are supported?"
    answer: "Snappy, Gzip, Zstandard, LZ4 and uncompressed files are all supported — the codec is detected automatically from the file metadata."
---

## Why convert Parquet to CSV?

Parquet is the standard storage format in data engineering — columnar,
compressed and fast to scan. But the moment a file needs to leave the data
platform, CSV wins: Excel, Google Sheets, CRMs and most business tools still
speak CSV first. Converting a Parquet extract to CSV is often the last step
before handing data to a non-engineering stakeholder.

## How this converter works

1. Drop a `.parquet` file into the box above.
2. The file is registered with an in-browser DuckDB engine **by reference** —
   it is not copied, not uploaded, and only the pages needed are read.
3. DuckDB streams the data out as CSV with a header row, and the result
   downloads automatically.

The whole pipeline runs in a Web Worker, so the page stays responsive even
for large files.

## Things to know before converting

- **Types are flattened.** Timestamps become ISO-8601 strings, decimals become
  plain numbers. CSV has no type system, so a round-trip back to Parquet needs
  type inference.
- **Compression disappears.** A 100 MB Snappy-compressed Parquet file can
  easily become a 500 MB+ CSV — columnar compression is that effective.
- **Column order is preserved** exactly as stored in the Parquet schema.

If you only need to *inspect* the file rather than convert it, the
[Parquet Viewer](/parquet-viewer) shows schema and data instantly, and the
[SQL Workbench](/sql) lets you filter before exporting.

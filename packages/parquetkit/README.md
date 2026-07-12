# parquetkit

This package name is **reserved** and does not ship a working library yet.

ParquetKit is a browser-based Parquet viewer, SQL workbench and converter —
see [parquetkit.com](https://parquetkit.com) and the
[source repository](https://github.com/XxxKMSxxX/parquetkit). Its read/convert
engine (`lib/engine/`) is deliberately written free of React/Next
dependencies so it can be extracted as a standalone npm package and CLI in
the future. This name was published early to prevent squatting once that
extraction happens.

If you depend on this package today, `require`/`import`-ing it throws. There
is nothing here to install.

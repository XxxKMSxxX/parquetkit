import * as duckdb from "@duckdb/duckdb-wasm";
import { getBundles, type BundleSource } from "./bundles";

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  numRows: number;
}

let instance: Promise<duckdb.AsyncDuckDB> | null = null;

/**
 * Lazily initialized DuckDB-WASM singleton.
 * Single-threaded mode (no COOP/COEP required). DuckDB runs inside its own worker,
 * so the main thread is never blocked.
 */
export function initDuckDB(source: BundleSource = "cdn"): Promise<duckdb.AsyncDuckDB> {
  instance ??= (async () => {
    const bundle = await duckdb.selectBundle(getBundles(source));
    if (!bundle.mainWorker) {
      throw new Error("DuckDB-WASM: no worker bundle selected");
    }
    // Cross-origin (jsDelivr) worker JS cannot be passed to new Worker() directly,
    // so wrap it in a blob URL (the approach from DuckDB's official docs).
    // Relative paths do not resolve inside blob-URL workers, so use absolute URLs
    const workerAbsoluteUrl = new URL(
      bundle.mainWorker,
      globalThis.location.href,
    ).toString();
    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${workerAbsoluteUrl}");`], {
        type: "text/javascript",
      }),
    );
    try {
      const worker = new Worker(workerUrl);
      const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
      // The wasm binary path is also resolved inside the blob worker — absolute URL required
      const mainModuleUrl = new URL(
        bundle.mainModule,
        globalThis.location.href,
      ).toString();
      await db.instantiate(mainModuleUrl, bundle.pthreadWorker);
      return db;
    } finally {
      URL.revokeObjectURL(workerUrl);
    }
  })();
  return instance;
}

/** Test helper: dispose the singleton. */
export async function resetDuckDB(): Promise<void> {
  if (instance) {
    const db = await instance.catch(() => null);
    await db?.terminate();
    instance = null;
  }
}

/** Register a local File into DuckDB's virtual file system (by reference, no copy). */
export async function registerFile(
  db: duckdb.AsyncDuckDB,
  name: string,
  file: File,
): Promise<void> {
  await db.registerFileHandle(
    name,
    file,
    duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
    true,
  );
}

export async function dropFile(db: duckdb.AsyncDuckDB, name: string): Promise<void> {
  await db.dropFile(name);
}

/** Run SQL and return the rows as plain JS objects. */
export async function runQuery(
  db: duckdb.AsyncDuckDB,
  sql: string,
): Promise<QueryResult> {
  const conn = await db.connect();
  try {
    const table = await conn.query(sql);
    const columns = table.schema.fields.map((field) => field.name);
    const rows = table.toArray().map((row) => row.toJSON() as Record<string, unknown>);
    return { columns, rows, numRows: table.numRows };
  } finally {
    await conn.close();
  }
}

/**
 * Run SQL, COPY the result to a file inside DuckDB, and read the bytes back.
 * The core of the converters. Callers wrap the bytes in a Blob for download.
 */
export async function runCopy(
  db: duckdb.AsyncDuckDB,
  copySql: string,
  outputFileName: string,
): Promise<Uint8Array> {
  const conn = await db.connect();
  try {
    await conn.query(copySql);
    return await db.copyFileToBuffer(outputFileName);
  } finally {
    await db.dropFile(outputFileName).catch(() => undefined);
    await conn.close();
  }
}

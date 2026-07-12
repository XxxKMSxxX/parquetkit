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

// Arrow decimals arrive as raw 128-bit little-endian words with the scale on
// the field type; naive JSON conversion drops the decimal point entirely.
function decimalToString(value: unknown, scale: number): string {
  let digits: bigint;
  if (typeof value === "bigint") {
    digits = value;
  } else if (value instanceof Uint32Array) {
    let unsigned = 0n;
    for (let i = value.length - 1; i >= 0; i--) {
      unsigned = (unsigned << 32n) | BigInt(value[i]);
    }
    const bits = BigInt(value.length * 32);
    const signBit = 1n << (bits - 1n);
    digits = (unsigned & signBit) !== 0n ? unsigned - (1n << bits) : unsigned;
  } else {
    return String(value);
  }
  const negative = digits < 0n;
  const abs = (negative ? -digits : digits).toString().padStart(scale + 1, "0");
  const whole = abs.slice(0, abs.length - scale) || "0";
  const fraction = scale > 0 ? `.${abs.slice(abs.length - scale)}` : "";
  return `${negative ? "-" : ""}${whole}${fraction}`;
}

/** Run SQL and return the rows as plain JS objects. */
export async function runQuery(
  db: duckdb.AsyncDuckDB,
  sql: string,
): Promise<QueryResult> {
  const conn = await db.connect();
  try {
    const table = await conn.query(sql);
    const fields = table.schema.fields;
    const columns = fields.map((field) => field.name);
    const decimals = fields.filter(
      (field): boolean =>
        typeof (field.type as { scale?: unknown }).scale === "number" &&
        typeof (field.type as { precision?: unknown }).precision === "number",
    );
    // Arrow normalizes timestamp values to epoch milliseconds; render as ISO
    // like the viewer does instead of a raw number
    const timestamps = fields.filter(
      (field): boolean =>
        "timezone" in (field.type as object) &&
        typeof (field.type as { unit?: unknown }).unit === "number",
    );
    const rows = table.toArray().map((row) => {
      const obj = row.toJSON() as Record<string, unknown>;
      for (const field of decimals) {
        obj[field.name] = decimalToString(
          (row as Record<string, unknown>)[field.name],
          (field.type as { scale: number }).scale,
        );
      }
      for (const field of timestamps) {
        const value = (row as Record<string, unknown>)[field.name];
        if (value !== null && value !== undefined) {
          obj[field.name] = new Date(Number(value)).toISOString();
        }
      }
      return obj;
    });
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

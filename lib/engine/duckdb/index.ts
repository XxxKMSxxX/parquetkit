import * as duckdb from "@duckdb/duckdb-wasm";
import { getBundles, type BundleSource } from "./bundles";

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  numRows: number;
}

let instance: Promise<duckdb.AsyncDuckDB> | null = null;

/**
 * DuckDB-WASMを遅延初期化するシングルトン。
 * シングルスレッドモード(COOP/COEP不要)。DuckDB自体が専用Worker内で動くため
 * メインスレッドはブロックされない。
 */
export function initDuckDB(source: BundleSource = "cdn"): Promise<duckdb.AsyncDuckDB> {
  instance ??= (async () => {
    const bundle = await duckdb.selectBundle(getBundles(source));
    if (!bundle.mainWorker) {
      throw new Error("DuckDB-WASM: no worker bundle selected");
    }
    // クロスオリジン(jsDelivr)のworker JSは直接 new Worker() できないため
    // blob URLでラップする(DuckDB公式ドキュメントの手法)。
    // blob URLワーカー内では相対パスが解決できないため絶対URLにする
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
      // wasm本体のパスもblobワーカー内で解決されるため絶対URL必須
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

/** テスト用: シングルトンを破棄する。 */
export async function resetDuckDB(): Promise<void> {
  if (instance) {
    const db = await instance.catch(() => null);
    await db?.terminate();
    instance = null;
  }
}

/** ローカルFileをDuckDBの仮想ファイルシステムに登録する(コピーせず参照)。 */
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

/** SQLを実行し、プレーンなJSオブジェクトの配列で返す。 */
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
 * SQLを実行して結果をDuckDB内のファイルへCOPYし、その内容を取り出す。
 * 変換ツールの中核。呼び出し側でBlob化してダウンロードさせる。
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

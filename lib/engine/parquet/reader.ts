import {
  parquetMetadataAsync,
  parquetReadObjects,
  parquetSchema,
} from "hyparquet";
import { compressors as baseCompressors } from "hyparquet-compressors";
import { decompressBlock } from "lz4js";
import type { AsyncBuffer, FileMetaData } from "hyparquet";

// hyparquet-compressors 1.1.1 のLZ4_RAW実装は、pyarrow等が生成する辞書ページで
// "lz4 offset out of range" を投げる(lz4jsでは同一ページが正常にデコードできる
// ことを確認済み=上流バグ)。lz4jsの実装で差し替える。
const compressors = {
  ...baseCompressors,
  LZ4_RAW: (input: Uint8Array, outputLength: number): Uint8Array => {
    const output = new Uint8Array(outputLength);
    decompressBlock(input, output, 0, input.length, 0);
    return output;
  },
};

export interface ColumnInfo {
  name: string;
  type: string;
  logicalType: string | null;
}

export interface ParquetFileInfo {
  numRows: bigint;
  numRowGroups: number;
  numColumns: number;
  createdBy: string | null;
  compressions: string[];
  columns: ColumnInfo[];
}

export interface ParquetHandle {
  metadata: FileMetaData;
  buffer: AsyncBuffer;
  info: ParquetFileInfo;
}

/** Blob/File から hyparquet の AsyncBuffer を作る(全体をメモリに載せない)。 */
export function asyncBufferFromBlob(blob: Blob): AsyncBuffer {
  return {
    byteLength: blob.size,
    slice: (start: number, end?: number) => blob.slice(start, end).arrayBuffer(),
  };
}

/** メタデータのみを読み、スキーマ・統計情報を要約する。データ本体は読まない。 */
export async function openParquet(buffer: AsyncBuffer): Promise<ParquetHandle> {
  const metadata = await parquetMetadataAsync(buffer);
  const tree = parquetSchema(metadata);

  const columns: ColumnInfo[] = tree.children.map((child) => {
    const element = child.element;
    return {
      name: element.name,
      type: element.type ?? (child.children.length > 0 ? "GROUP" : "UNKNOWN"),
      logicalType: element.logical_type?.type ?? element.converted_type ?? null,
    };
  });

  const compressions = [
    ...new Set(
      metadata.row_groups.flatMap((group) =>
        group.columns.map((column) => column.meta_data?.codec ?? "UNKNOWN"),
      ),
    ),
  ].map(String);

  return {
    metadata,
    buffer,
    info: {
      numRows: metadata.num_rows,
      numRowGroups: metadata.row_groups.length,
      numColumns: columns.length,
      createdBy: metadata.created_by ?? null,
      compressions,
      columns,
    },
  };
}

/** 指定行範囲をオブジェクト配列で読む(ページネーション用)。 */
export async function readRows(
  handle: ParquetHandle,
  rowStart: number,
  rowEnd: number,
): Promise<Record<string, unknown>[]> {
  return parquetReadObjects({
    file: handle.buffer,
    metadata: handle.metadata,
    compressors,
    rowStart,
    rowEnd,
  });
}

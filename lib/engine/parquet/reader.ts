import {
  parquetMetadataAsync,
  parquetReadObjects,
  parquetSchema,
} from "hyparquet";
import { compressors as baseCompressors } from "hyparquet-compressors";
import { decompressBlock } from "lz4js";
import type { AsyncBuffer, FileMetaData } from "hyparquet";

// The LZ4_RAW implementation in hyparquet-compressors 1.1.1 throws "lz4 offset out of
// range" on dictionary pages produced by pyarrow and friends (the same pages decode
// fine with lz4js, i.e. an upstream bug). Swap in the lz4js implementation.
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

/** Build a hyparquet AsyncBuffer from a Blob/File (never loads the whole file into memory). */
export function asyncBufferFromBlob(blob: Blob): AsyncBuffer {
  return {
    byteLength: blob.size,
    slice: (start: number, end?: number) => blob.slice(start, end).arrayBuffer(),
  };
}

/** Read metadata only and summarize schema and statistics. Never reads the data itself. */
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

/** Read a row range as an array of objects (for pagination). */
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

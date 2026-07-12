declare module "lz4js" {
  /** Decompress an LZ4 block and return the number of bytes written. */
  export function decompressBlock(
    src: Uint8Array,
    dst: Uint8Array,
    sIndex: number,
    sLength: number,
    dIndex: number,
  ): number;
}

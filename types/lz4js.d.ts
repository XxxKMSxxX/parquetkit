declare module "lz4js" {
  /** LZ4ブロックを伸長し、書き込んだバイト数を返す。 */
  export function decompressBlock(
    src: Uint8Array,
    dst: Uint8Array,
    sIndex: number,
    sLength: number,
    dIndex: number,
  ): number;
}

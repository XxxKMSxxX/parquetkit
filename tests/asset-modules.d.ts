// vitest(vite)の ?url アセットimport用の型宣言
declare module "*.parquet?url" {
  const url: string;
  export default url;
}
declare module "*.csv?url" {
  const url: string;
  export default url;
}
declare module "*.jsonl?url" {
  const url: string;
  export default url;
}

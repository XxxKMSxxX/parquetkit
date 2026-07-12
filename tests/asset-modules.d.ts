// Type declarations for vitest (vite) ?url asset imports
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

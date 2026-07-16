"use client";

import dynamic from "next/dynamic";

function ToolSkeleton() {
  return (
    <div className="flex animate-pulse items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 px-6 py-12 text-sm text-neutral-400 dark:border-neutral-800">
      Loading tool…
    </div>
  );
}

// Tool UIs depend on WASM and cannot be server-rendered. Serve the static HTML
// (explanations, FAQ) first, then mount the tool after hydration
export const ViewerTool = dynamic(
  () => import("./ViewerClient").then((m) => m.ViewerClient),
  { ssr: false, loading: ToolSkeleton },
);

export const SqlTool = dynamic(
  () => import("./SqlClient").then((m) => m.SqlClient),
  { ssr: false, loading: ToolSkeleton },
);

export const ConvertTool = dynamic(
  () => import("./ConvertClient").then((m) => m.ConvertClient),
  { ssr: false, loading: ToolSkeleton },
);

export const DiffTool = dynamic(
  () => import("./DiffClient").then((m) => m.DiffClient),
  { ssr: false, loading: ToolSkeleton },
);

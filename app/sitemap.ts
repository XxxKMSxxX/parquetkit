import type { MetadataRoute } from "next";
import { loadConversions, loadDocs } from "@/lib/content/loader";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/parquet-viewer", "/sql", "/diff", "/docs"];
  const conversionRoutes = loadConversions().map((entry) => ({
    route: `/convert/${entry.meta.slug}`,
    lastModified: entry.meta.date,
  }));
  const docRoutes = loadDocs().map((entry) => ({
    route: `/docs/${entry.meta.slug}`,
    lastModified: entry.meta.date,
  }));

  return [
    ...staticRoutes.map((route) => ({ route, lastModified: undefined })),
    ...conversionRoutes,
    ...docRoutes,
  ].map(({ route, lastModified }) => ({
    url: `${BASE}${route}`,
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.8,
    ...(lastModified ? { lastModified } : {}),
  }));
}

import type { MetadataRoute } from "next";
import { loadConversions, loadDocs } from "@/lib/content/loader";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/parquet-viewer", "/sql", "/docs"];
  const conversionRoutes = loadConversions().map(
    (entry) => `/convert/${entry.meta.slug}`,
  );
  const docRoutes = loadDocs().map((entry) => `/docs/${entry.meta.slug}`);

  return [...staticRoutes, ...conversionRoutes, ...docRoutes].map((route) => ({
    url: `${BASE}${route}`,
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.8,
  }));
}

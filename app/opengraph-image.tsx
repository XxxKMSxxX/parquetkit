import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "ParquetKit — View, Query & Convert Parquet Files in Your Browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0f172a",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: 48 }}>
          <div style={{ width: 34, height: 120, borderRadius: 8, background: "#38bdf8" }} />
          <div style={{ width: 34, height: 90, borderRadius: 8, background: "#7dd3fc" }} />
          <div style={{ width: 34, height: 140, borderRadius: 8, background: "#0ea5e9" }} />
          <div style={{ width: 34, height: 70, borderRadius: 8, background: "#bae6fd" }} />
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, display: "flex" }}>ParquetKit</div>
        <div style={{ fontSize: 34, color: "#94a3b8", marginTop: 20, display: "flex" }}>
          View, query &amp; convert Parquet files — entirely in your browser
        </div>
        <div style={{ fontSize: 26, color: "#38bdf8", marginTop: 28, display: "flex" }}>
          No upload · No signup · No server
        </div>
      </div>
    ),
    size,
  );
}

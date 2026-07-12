import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "ParquetKit — View, Query & Convert Parquet Files in Your Browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 寄木ブロック(parquet block)のブランドマーク。ヘッダー/ファビコンと同一モチーフ
function Mark({ tile, gap }: { tile: number; gap: number }) {
  const shades = ["#7dd3fc", "#38bdf8", "#0ea5e9", "#0369a1"];
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        width: tile * 2 + gap,
        height: tile * 2 + gap,
        gap,
        transform: "rotate(45deg)",
      }}
    >
      {shades.map((shade) => (
        <div
          key={shade}
          style={{
            width: tile,
            height: tile,
            borderRadius: tile * 0.18,
            background: shade,
            display: "flex",
          }}
        />
      ))}
    </div>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #0a0f1c 0%, #0f172a 60%, #082f49 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 右端に大きなマークが1つだけ静かに覗く */}
        <div
          style={{
            position: "absolute",
            right: -110,
            top: 115,
            display: "flex",
            opacity: 0.28,
          }}
        >
          <Mark tile={190} gap={26} />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "80px",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 52 }}>
            <Mark tile={44} gap={8} />
            <div style={{ display: "flex", fontSize: 64, fontWeight: 700, marginLeft: 14 }}>
              Parquet
              <span style={{ color: "#38bdf8", display: "flex" }}>Kit</span>
            </div>
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              lineHeight: 1.25,
              display: "flex",
              flexDirection: "column",
              maxWidth: 760,
            }}
          >
            <span>View, query &amp; convert Parquet files</span>
            <span style={{ color: "#94a3b8" }}>— entirely in your browser</span>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 44 }}>
            {["No upload", "No signup", "No server"].map((chip) => (
              <div
                key={chip}
                style={{
                  display: "flex",
                  padding: "10px 22px",
                  borderRadius: 999,
                  border: "2px solid #0ea5e9",
                  color: "#7dd3fc",
                  fontSize: 24,
                  fontWeight: 600,
                }}
              >
                {chip}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}

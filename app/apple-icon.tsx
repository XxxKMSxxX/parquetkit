import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// 寄木ブロック(parquet block)のブランドマーク。favicon/OG画像と同一モチーフ。
// iOS側で角丸マスクが自動適用されるため、ここでは背景を角丸にしない。
export default function AppleIcon() {
  const tile = 48;
  const gap = 11;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
        }}
      >
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
          {["#7dd3fc", "#38bdf8", "#0ea5e9", "#0369a1"].map((shade) => (
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
      </div>
    ),
    size,
  );
}

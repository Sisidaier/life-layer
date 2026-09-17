import { ImageResponse } from "next/og";

export function renderAppIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111827",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
          fontSize: Math.round(size * 0.48),
          fontWeight: 700,
          letterSpacing: "-0.06em",
        }}
      >
        L
      </div>
    ),
    { width: size, height: size },
  );
}

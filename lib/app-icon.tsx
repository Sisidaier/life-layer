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
          background: "linear-gradient(145deg, #ffad68 0%, #f48242 48%, #e66b2e 100%)",
        }}
      >
        <svg
          width={Math.round(size * 0.76)}
          height={Math.round(size * 0.76)}
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
        >
          <path d="M30 15c-2-8 4-13 11-12 5 1 8 5 7 9 6-4 12-3 15 1-8 0-13 3-17 8z" fill="#6d984b" />
          <path d="M30 12c-1-4 1-7 4-9" stroke="#527d38" strokeWidth="2" strokeLinecap="round" />
          <circle cx="31" cy="37" r="24" fill="#f59a3d" />
          <circle cx="31" cy="37" r="19.5" fill="#fffaf0" />
          <path d="M31 23v14l11 7" stroke="#eb7832" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="31" cy="37" r="3.2" fill="#eb7832" />
          <path d="M14 30c2-5 6-9 11-11" stroke="#fff" strokeOpacity=".65" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}

import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #22d3ee 0%, #0f172a 100%)",
          color: "white",
          fontSize: 18,
          fontWeight: 900,
          letterSpacing: "-0.06em",
        }}
      >
        M
      </div>
    ),
    size
  );
}

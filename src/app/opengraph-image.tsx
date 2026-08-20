import { ImageResponse } from "next/og";

export const alt = "Docket — every application you send, on the record";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The share card. Built with next/og rather than a static file so the stamp is
 * drawn from the same tokens as the app — paper ground, violet double outline,
 * nothing else competing with it.
 *
 * Deliberately no webfont fetch: the CSP blocks external hosts at runtime and a
 * failed font here degrades to a card that looks nothing like the product.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#DBD9D1",
        color: "#191A17",
        padding: "72px 80px",
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div
          style={{
            fontSize: 22,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#6C3FA8",
            display: "flex",
          }}
        >
          Personal register
        </div>

        {/* The signature element: violet, double outlined, slightly askew. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            border: "4px solid #6C3FA8",
            boxShadow: "inset 0 0 0 2px #6C3FA8",
            borderRadius: 6,
            padding: "14px 22px",
            color: "#6C3FA8",
            transform: "rotate(-3deg)",
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>Nº 001</div>
          <div style={{ fontSize: 18, letterSpacing: 4, marginTop: 6 }}>STAMPED</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            fontSize: 82,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1.02,
            maxWidth: 940,
            display: "flex",
          }}
        >
          Every application you send, on the record.
        </div>
        <div style={{ fontSize: 30, color: "#5F5C54", maxWidth: 820, display: "flex" }}>
          Drop the job link. We track the rest — number, date, time and the tech stack.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "3px solid #191A17",
          paddingTop: 22,
          fontSize: 26,
        }}
      >
        <div style={{ fontWeight: 700, display: "flex" }}>Docket</div>
        <div style={{ color: "#5F5C54", display: "flex" }}>docket.click</div>
      </div>
    </div>,
    size,
  );
}

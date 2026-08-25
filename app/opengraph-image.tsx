import { ImageResponse } from "next/og";

export const alt = "ManagerPro | Tu rutina personalizada";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logoUrl = "https://tvrwpwmuqxhqgjtmjoip.supabase.co/storage/v1/object/public/logos/Manager%20Pro%20Logo.png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ alignItems: "center", background: "linear-gradient(135deg, #061127 0%, #0a2547 58%, #075d65 100%)", color: "white", display: "flex", height: "100%", justifyContent: "space-between", padding: "72px 86px", width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 690 }}>
          <div style={{ alignItems: "center", display: "flex", fontSize: 26, fontWeight: 700, gap: 14, letterSpacing: 1 }}><span style={{ background: "#49dfc5", borderRadius: 99, height: 14, width: 14 }} />ENTRENAMIENTO PERSONALIZADO</div>
          <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05, marginTop: 42 }}>Tu rutina, siempre a mano.</div>
          <div style={{ color: "#cbd5e1", fontSize: 30, lineHeight: 1.35, marginTop: 28 }}>Consultá tu plan, coordiná tus reuniones y seguí avanzando.</div>
        </div>
        <div style={{ alignItems: "center", background: "white", borderRadius: 42, display: "flex", height: 260, justifyContent: "center", padding: 34, width: 260 }}>
          <img alt="ManagerPro" height="192" src={logoUrl} style={{ objectFit: "contain" }} width="192" />
        </div>
      </div>
    ),
    size,
  );
}

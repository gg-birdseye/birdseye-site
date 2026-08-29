import { Img, Interactive, staticFile } from "remotion";
import { fontFamily } from "../fonts";

export const BrowserFrame: React.FC<{
  children: React.ReactNode;
  opacity?: number;
  scale?: number;
}> = ({ children, opacity = 1, scale = 1 }) => {
  return (
    <Interactive.Div
      name="Browser frame"
      style={{
        position: "absolute",
        left: 90,
        top: 78,
        width: 1740,
        height: 924,
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: "#0c0b09",
        boxShadow: "0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
        opacity,
        scale,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Interactive.Div
        name="Browser chrome"
        style={{
          height: 52,
          backgroundColor: "#161410",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          paddingLeft: 18,
          paddingRight: 18,
          gap: 14,
          flexShrink: 0,
        }}
      >
        <Interactive.Div
          name="Traffic lights"
          style={{ display: "flex", gap: 8 }}
        >
          <Interactive.Div
            name="Close"
            style={{
              width: 12,
              height: 12,
              borderRadius: 99,
              backgroundColor: "#c45c4a",
            }}
          />
          <Interactive.Div
            name="Minimize"
            style={{
              width: 12,
              height: 12,
              borderRadius: 99,
              backgroundColor: "#c9a15b",
            }}
          />
          <Interactive.Div
            name="Maximize"
            style={{
              width: 12,
              height: 12,
              borderRadius: 99,
              backgroundColor: "#4a7c59",
            }}
          />
        </Interactive.Div>
        <Interactive.Div
          name="URL bar"
          style={{
            flex: 1,
            height: 32,
            borderRadius: 8,
            backgroundColor: "#1f1c18",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            paddingLeft: 14,
            paddingRight: 14,
            gap: 10,
            fontFamily,
            color: "#c9c2b4",
            fontSize: 18,
            fontWeight: 500,
          }}
        >
          <Img
            src={staticFile("logo-birdseye.svg")}
            style={{
              width: 18,
              height: 18,
              objectFit: "contain",
              filter: "brightness(0) invert(1)",
              opacity: 0.7,
            }}
          />
          birdseye.golf/birchcreek
        </Interactive.Div>
      </Interactive.Div>
      <Interactive.Div
        name="Browser content"
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#0d120f",
        }}
      >
        {children}
      </Interactive.Div>
    </Interactive.Div>
  );
};

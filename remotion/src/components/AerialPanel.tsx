import { Img, Interactive, staticFile } from "remotion";
import { fontFamily } from "../fonts";

export const AerialPanel: React.FC<{
  progress: number;
  hole: 1 | 7;
}> = ({ progress, hole }) => {
  return (
    <Interactive.Div
      name="Aerial panel"
      style={{
        position: "absolute",
        left: 28,
        right: 28,
        bottom: 88,
        height: 470,
        borderRadius: 16,
        backgroundColor: "rgba(14, 18, 15, 0.94)",
        border: "1px solid rgba(245, 240, 232, 0.12)",
        opacity: progress,
        translate: `0px ${Math.round((1 - progress) * 36)}px`,
        overflow: "hidden",
        fontFamily,
      }}
    >
      <Interactive.Div
        name="Aerial header"
        style={{
          position: "absolute",
          left: 22,
          top: 16,
          zIndex: 2,
          color: "#f5f0e8",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        {`Hole ${hole} graphic · landing zone`}
      </Interactive.Div>
      <Img
        src={staticFile(`hole-${hole}.svg`)}
        style={{
          position: "absolute",
          left: "50%",
          top: 28,
          height: 430,
          width: "auto",
          translate: "-50% 0px",
        }}
      />
      <Interactive.Div
        name="Landing zone"
        style={{
          position: "absolute",
          left: "48%",
          top: "18%",
          width: 86,
          height: 86,
          marginLeft: -43,
          borderRadius: 99,
          border: "2px solid rgba(245, 240, 232, 0.85)",
          boxShadow: "0 0 0 10px rgba(74, 124, 89, 0.22)",
          backgroundColor: "rgba(74, 124, 89, 0.18)",
        }}
      />
      <Interactive.Div
        name="Yardage ring 150"
        style={{
          position: "absolute",
          left: "48%",
          top: "28%",
          width: 210,
          height: 160,
          marginLeft: -105,
          borderRadius: "50%",
          border: "1.5px dashed rgba(245, 240, 232, 0.35)",
        }}
      />
      <Interactive.Div
        name="Yardage label"
        style={{
          position: "absolute",
          right: 28,
          bottom: 22,
          color: "#f5f0e8",
          fontSize: 16,
          fontWeight: 600,
          opacity: 0.85,
        }}
      >
        150 · 100 · 50 yds to green
      </Interactive.Div>
    </Interactive.Div>
  );
};

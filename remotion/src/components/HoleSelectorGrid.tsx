import { Img, Interactive, staticFile } from "remotion";
import { HOLE_PAR } from "../data";
import { fontFamily } from "../fonts";

const pad = (n: number) => String(n).padStart(2, "0");

export const HoleSelectorGrid: React.FC<{
  activeHole: number;
  highlightHole: number;
  opacity: number;
  scale: number;
}> = ({ activeHole, highlightHole, opacity, scale }) => {
  return (
    <Interactive.Div
      name="Hole selector grid"
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(10, 9, 7, 0.55)",
        opacity,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Interactive.Div
        name="Hole grid"
        style={{
          width: 1180,
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 10,
          scale,
        }}
      >
        {Array.from({ length: 18 }, (_, i) => {
          const hole = i + 1;
          const isActive = hole === activeHole;
          const isHighlight = hole === highlightHole;
          return (
            <Interactive.Div
              key={hole}
              name={`Hole ${hole} cell`}
              style={{
                position: "relative",
                height: 118,
                borderRadius: 10,
                overflow: "hidden",
                border: isHighlight
                  ? "2.5px solid #f5f0e8"
                  : isActive
                    ? "2px solid rgba(255,255,255,0.7)"
                    : "1px solid rgba(255,255,255,0.18)",
                boxShadow: isHighlight
                  ? "0 0 0 4px rgba(74, 124, 89, 0.45)"
                  : "none",
                scale: isHighlight ? 1.04 : 1,
              }}
            >
              <Img
                src={staticFile(`thumbs/${pad(hole)}.webp`)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
              <Interactive.Div
                name={`Hole ${hole} scrim`}
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.08) 55%)",
                }}
              />
              <Interactive.Div
                name={`Hole ${hole} label`}
                style={{
                  position: "absolute",
                  left: 10,
                  bottom: 8,
                  fontFamily,
                  color: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  lineHeight: 1.1,
                }}
              >
                <Interactive.Div
                  name={`Hole ${hole} number`}
                  style={{ fontSize: 22, fontWeight: 700 }}
                >
                  {hole}
                </Interactive.Div>
                <Interactive.Div
                  name={`Hole ${hole} par`}
                  style={{ fontSize: 12, fontWeight: 600, opacity: 0.82 }}
                >
                  {`Par ${HOLE_PAR[i]}`}
                </Interactive.Div>
              </Interactive.Div>
            </Interactive.Div>
          );
        })}
      </Interactive.Div>
    </Interactive.Div>
  );
};

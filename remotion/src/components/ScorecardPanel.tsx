import { Interactive } from "remotion";
import { MAX_YARDS, TEES } from "../data";
import { fontFamily } from "../fonts";

export const ScorecardPanel: React.FC<{
  progress: number;
  teeIndex: number;
  activeHole: number;
}> = ({ progress, teeIndex, activeHole }) => {
  const tee = TEES[teeIndex] ?? TEES[2];
  const yards = tee.yards;

  return (
    <Interactive.Div
      name="Scorecard panel"
      style={{
        position: "absolute",
        left: 28,
        right: 28,
        bottom: 88,
        height: 430,
        borderRadius: 16,
        backgroundColor: "rgba(18, 16, 13, 0.92)",
        border: "1px solid rgba(245, 240, 232, 0.12)",
        opacity: progress,
        translate: `0px ${Math.round((1 - progress) * 36)}px`,
        padding: 22,
        fontFamily,
        color: "#f5f0e8",
      }}
    >
      <Interactive.Div
        name="Scorecard header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <Interactive.Div
          name="Scorecard title"
          style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}
        >
          Yardages
        </Interactive.Div>
        <Interactive.Div
          name="Tee selector"
          style={{ display: "flex", gap: 8 }}
        >
          {TEES.map((item, i) => (
            <Interactive.Div
              key={item.name}
              name={`${item.name} tee`}
              style={{
                paddingTop: 7,
                paddingBottom: 7,
                paddingLeft: 14,
                paddingRight: 14,
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 600,
                backgroundColor: i === teeIndex ? item.color : "rgba(255,255,255,0.08)",
                color:
                  i === teeIndex && item.name === "White" ? "#111" : "#f5f0e8",
                border:
                  i === teeIndex
                    ? "1px solid rgba(255,255,255,0.35)"
                    : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {item.name}
            </Interactive.Div>
          ))}
        </Interactive.Div>
      </Interactive.Div>

      <svg viewBox="0 0 1000 300" width="100%" height="300">
        {yards.map((y, i) => {
          const x = 28 + i * 53.5;
          const h = (y / MAX_YARDS) * 230 * progress;
          const isActive = i + 1 === activeHole;
          return (
            <g key={i}>
              <rect
                x={x}
                y={248 - h}
                width={38}
                height={h}
                rx={4}
                fill={isActive ? "#4a7c59" : tee.color === "#f4f1ea" ? "#c9c2b4" : tee.color}
                opacity={isActive ? 1 : 0.72}
              />
              <text
                x={x + 19}
                y={272}
                textAnchor="middle"
                fill={isActive ? "#f5f0e8" : "rgba(245,240,232,0.55)"}
                fontSize={13}
                fontFamily={fontFamily}
                fontWeight={600}
              >
                {i + 1}
              </text>
              {isActive ? (
                <text
                  x={x + 19}
                  y={248 - h - 8}
                  textAnchor="middle"
                  fill="#f5f0e8"
                  fontSize={13}
                  fontFamily={fontFamily}
                  fontWeight={700}
                >
                  {y}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </Interactive.Div>
  );
};

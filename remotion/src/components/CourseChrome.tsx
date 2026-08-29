import { Img, Interactive, staticFile } from "remotion";
import { fontFamily } from "../fonts";

export const CourseChrome: React.FC<{
  hole: number;
  par: number;
  activePanel: "none" | "scorecard" | "aerial";
  showScrollHint: boolean;
  scrollHintOpacity?: number;
}> = ({
  hole,
  par,
  activePanel,
  showScrollHint,
  scrollHintOpacity = 1,
}) => {
  return (
    <>
      <Img
        src={staticFile("logo-birdseye.svg")}
        style={{
          position: "absolute",
          left: 22,
          top: 10,
          width: 92,
          height: 92,
          objectFit: "contain",
          filter: "brightness(0) invert(1)",
          opacity: 0.92,
        }}
      />
      <Img
        src={staticFile("logo-birchcreek.svg")}
        style={{
          position: "absolute",
          right: 22,
          top: 18,
          width: 150,
          height: 56,
          objectFit: "contain",
        }}
      />

      {showScrollHint ? (
        <Interactive.Div
          name="Scroll to fly"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "38%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            opacity: scrollHintOpacity,
            pointerEvents: "none",
          }}
        >
          <Interactive.Div
            name="Chevron up"
            style={{
              width: 0,
              height: 0,
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderBottom: "12px solid rgba(255,255,255,0.7)",
            }}
          />
          <Interactive.Div
            name="Scroll label"
            style={{
              fontFamily,
              color: "rgba(255,255,255,0.88)",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 6,
            }}
          >
            SCROLL TO FLY
          </Interactive.Div>
          <Interactive.Div
            name="Chevron down"
            style={{
              width: 0,
              height: 0,
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderTop: "12px solid rgba(255,255,255,0.7)",
            }}
          />
        </Interactive.Div>
      ) : null}

      <Interactive.Div
        name="Hole badge"
        style={{
          position: "absolute",
          left: 22,
          bottom: 92,
          width: 78,
          height: 78,
          borderRadius: 10,
          backgroundColor: "rgba(255,255,255,0.18)",
          border: "1.5px solid rgba(255,255,255,0.4)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily,
          color: "#fff",
        }}
      >
        <Interactive.Div
          name="Hole number"
          style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}
        >
          {hole}
        </Interactive.Div>
        <Interactive.Div
          name="Hole par"
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1.2,
            opacity: 0.82,
            marginTop: 4,
          }}
        >
          {`PAR ${par}`}
        </Interactive.Div>
      </Interactive.Div>

      <Interactive.Div
        name="Bottom nav"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 72,
          backgroundColor: "rgba(12, 11, 9, 0.82)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontFamily,
        }}
      >
        <NavItem label="Scorecard" active={activePanel === "scorecard"} />
        <NavItem label="Aerial" active={activePanel === "aerial"} />
        <NavItem label="Book Tee Time" active={false} accent />
      </Interactive.Div>
    </>
  );
};

const NavItem: React.FC<{
  label: string;
  active: boolean;
  accent?: boolean;
}> = ({ label, active, accent }) => {
  return (
    <Interactive.Div
      name={label}
      style={{
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 22,
        paddingRight: 22,
        borderRadius: 999,
        fontSize: 20,
        fontWeight: 600,
        color: accent ? "#f5f0e8" : active ? "#ffffff" : "rgba(245,240,232,0.72)",
        backgroundColor: accent
          ? "#4a7c59"
          : active
            ? "rgba(255,255,255,0.12)"
            : "transparent",
        border: active && !accent ? "1px solid rgba(255,255,255,0.22)" : "1px solid transparent",
      }}
    >
      {label}
    </Interactive.Div>
  );
};

import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "../fonts";

export const Callout: React.FC<{
  name: string;
  label: string;
}> = ({ name, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <Interactive.Div
      name={name}
      style={{
        opacity: interpolate(frame, [0, 0.45 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
        translate: interpolate(frame, [0, 0.55 * fps], ["0px 22px", "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.spring({ damping: 200 }),
        }),
        display: "flex",
        alignItems: "center",
        gap: 14,
        paddingTop: 14,
        paddingBottom: 14,
        paddingLeft: 18,
        paddingRight: 22,
        borderRadius: 999,
        backgroundColor: "rgba(26, 24, 20, 0.78)",
        border: "1px solid rgba(231, 224, 212, 0.16)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
        fontFamily,
        color: "#f5f0e8",
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: -0.3,
        whiteSpace: "nowrap",
      }}
    >
      <Interactive.Div
        name={`${name} accent`}
        style={{
          width: 8,
          height: 8,
          borderRadius: 99,
          backgroundColor: "#4a7c59",
          boxShadow: "0 0 0 4px rgba(74, 124, 89, 0.28)",
        }}
      />
      {label}
    </Interactive.Div>
  );
};

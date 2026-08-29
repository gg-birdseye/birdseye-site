import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "../fonts";

export const TeeSheetEndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1a1814",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
      }}
    >
      <Interactive.Div
        name="Accent line"
        style={{
          width: 64,
          height: 3,
          backgroundColor: "#4a7c59",
          borderRadius: 99,
          opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      />
      <Interactive.Div
        name="End card title"
        style={{
          fontFamily,
          color: "#f5f0e8",
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: -1.8,
          textAlign: "center",
          lineHeight: 1.1,
          maxWidth: 1800,
          opacity: interpolate(frame, [0.1 * fps, 0.85 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(
            frame,
            [0.1 * fps, 0.95 * fps],
            ["0px 28px", "0px 0px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 200 }),
            },
          ),
        }}
      >
        Straight to your tee sheet
      </Interactive.Div>
    </AbsoluteFill>
  );
};

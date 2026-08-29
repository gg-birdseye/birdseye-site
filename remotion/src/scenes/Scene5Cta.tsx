import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "../fonts";

export const Scene5Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1814" }}>
      <Img
        src={staticFile("hero.webp")}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: interpolate(frame, [0, 0.8 * fps], [0.18, 0.28], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [0, 7 * fps], [1.06, 1.12], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            output: "perceptual-scale",
          }),
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(26,24,20,0.55) 0%, rgba(26,24,20,0.88) 100%)",
        }}
      />

      <Interactive.Div
        name="CTA logos"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 210,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
          opacity: interpolate(frame, [0.2 * fps, 0.9 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <Img
          src={staticFile("logo-birchcreek.svg")}
          style={{ width: 220, height: 88, objectFit: "contain" }}
        />
        <Interactive.Div
          name="Logo divider"
          style={{
            width: 1,
            height: 48,
            backgroundColor: "rgba(245,240,232,0.28)",
          }}
        />
        <Img
          src={staticFile("logo-birdseye.svg")}
          style={{
            width: 110,
            height: 110,
            objectFit: "contain",
            filter: "brightness(0) invert(1)",
          }}
        />
      </Interactive.Div>

      <Interactive.Div
        name="CTA headline"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 380,
          textAlign: "center",
          fontFamily,
          color: "#f5f0e8",
          fontSize: 72,
          fontWeight: 700,
          letterSpacing: -1.6,
          opacity: interpolate(frame, [0.5 * fps, 1.2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(
            frame,
            [0.5 * fps, 1.3 * fps],
            ["0px 20px", "0px 0px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 200 }),
            },
          ),
        }}
      >
        Your course. Fully branded.
      </Interactive.Div>
      <Interactive.Div
        name="CTA subtext"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 472,
          textAlign: "center",
          fontFamily,
          color: "rgba(245, 240, 232, 0.72)",
          fontSize: 32,
          fontWeight: 500,
          letterSpacing: 3,
          opacity: interpolate(frame, [0.9 * fps, 1.6 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        birdseye.golf
      </Interactive.Div>

      <Interactive.Div
        name="CTA button"
        style={{
          position: "absolute",
          left: "50%",
          top: 560,
          marginLeft: -170,
          width: 340,
          height: 64,
          borderRadius: 999,
          backgroundColor: "#4a7c59",
          color: "#f5f0e8",
          fontFamily,
          fontSize: 26,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
          opacity: interpolate(frame, [1.3 * fps, 2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [1.3 * fps, 2.1 * fps], [0.92, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 200 }),
            output: "perceptual-scale",
          }),
        }}
      >
        See a live demo
      </Interactive.Div>

      <AbsoluteFill
        style={{
          backgroundColor: "#1a1814",
          opacity: interpolate(
            frame,
            [durationInFrames - 28, durationInFrames - 1],
            [0, 0.55],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      />
    </AbsoluteFill>
  );
};

import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { Callout } from "../components/Callout";
import { CourseChrome } from "../components/CourseChrome";
import { FlyoverFrames } from "../components/FlyoverFrames";
import { fontFamily } from "../fonts";

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
          scale: interpolate(frame, [0, 5 * fps], [1.08, 1.18], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: "perceptual-scale",
          }),
          opacity: interpolate(frame, [0, 0.6 * fps], [0.35, 0.7], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
      <BrowserFrame
        opacity={interpolate(frame, [0.4 * fps, 1.1 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}
        scale={interpolate(frame, [0.4 * fps, 1.2 * fps], [0.96, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.spring({ damping: 200 }),
          output: "perceptual-scale",
        })}
      >
        <FlyoverFrames
          hole={1}
          progress={interpolate(frame, [0, 5.4 * fps], [0.08, 0.22], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
          scale={interpolate(frame, [0, 5.4 * fps], [1.04, 1.12], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            output: "perceptual-scale",
          })}
        />
        <CourseChrome
          hole={1}
          par={5}
          activePanel="none"
          showScrollHint
          scrollHintOpacity={interpolate(frame, [1.2 * fps, 1.8 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
        />
      </BrowserFrame>

      <Interactive.Div
        name="Hook headline"
        style={{
          position: "absolute",
          left: 120,
          top: 118,
          fontFamily,
          color: "#f5f0e8",
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: -1.4,
          lineHeight: 1.05,
          maxWidth: 980,
          textShadow: "0 10px 40px rgba(0,0,0,0.45)",
          opacity: interpolate(frame, [0.5 * fps, 1.3 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(
            frame,
            [0.5 * fps, 1.4 * fps],
            ["0px 24px", "0px 0px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 200 }),
            },
          ),
        }}
      >
        Preview every hole before you tee off
      </Interactive.Div>
      <Interactive.Div
        name="Hook subtext"
        style={{
          position: "absolute",
          left: 124,
          top: 268,
          fontFamily,
          color: "rgba(245, 240, 232, 0.78)",
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: 4,
          textTransform: "uppercase",
          opacity: interpolate(frame, [1 * fps, 1.8 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Birdseye Golf
      </Interactive.Div>

      <Sequence from={48} name="Hook callout">
        <Interactive.Div
          name="Hook callout wrap"
          style={{ position: "absolute", right: 130, bottom: 150 }}
        >
          <Callout name="Hook callout" label="Birch Creek · Smithfield, Utah" />
        </Interactive.Div>
      </Sequence>
    </AbsoluteFill>
  );
};

import {
  AbsoluteFill,
  Easing,
  Interactive,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { Callout } from "../components/Callout";
import { CourseChrome } from "../components/CourseChrome";
import { FlyoverFrames } from "../components/FlyoverFrames";
import { fontFamily } from "../fonts";

export const Scene2ScrollFlyover: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1814" }}>
      <BrowserFrame>
        <FlyoverFrames
          hole={1}
          progress={interpolate(frame, [0.3 * fps, 5.8 * fps], [0.05, 0.97], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 0.61, 0.36, 1),
          })}
        />
        <CourseChrome
          hole={1}
          par={5}
          activePanel="none"
          showScrollHint
          scrollHintOpacity={interpolate(frame, [0, 0.4 * fps, 4.8 * fps, 5.4 * fps], [1, 1, 0.35, 0.15], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
        />
        <Interactive.Div
          name="Hole caption"
          style={{
            position: "absolute",
            left: 118,
            bottom: 108,
            fontFamily,
            color: "#f5f0e8",
            fontSize: 26,
            fontWeight: 600,
            opacity: interpolate(frame, [0.2 * fps, 0.7 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Hole 1 · Par 5
        </Interactive.Div>
      </BrowserFrame>
      <Sequence from={18} name="Scroll callout">
        <Interactive.Div
          name="Scroll callout wrap"
          style={{ position: "absolute", left: 120, top: 100 }}
        >
          <Callout name="Scroll callout" label="Scroll-controlled aerial flyovers" />
        </Interactive.Div>
      </Sequence>
    </AbsoluteFill>
  );
};

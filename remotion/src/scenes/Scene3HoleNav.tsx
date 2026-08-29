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
import { HoleSelectorGrid } from "../components/HoleSelectorGrid";

export const Scene3HoleNav: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hole = frame < 3.1 * fps ? 1 : 7;
  const par = hole === 1 ? 5 : 3;
  const flyoverHole = hole === 1 ? 1 : 7;

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1814" }}>
      <BrowserFrame>
        <FlyoverFrames
          hole={flyoverHole}
          progress={
            hole === 1
              ? interpolate(frame, [0, 2.4 * fps], [0.35, 0.48], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : interpolate(frame, [3.1 * fps, 5.4 * fps], [0.12, 0.55], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
          }
        />
        <CourseChrome
          hole={hole}
          par={par}
          activePanel="none"
          showScrollHint={false}
        />
        <HoleSelectorGrid
          activeHole={hole}
          highlightHole={7}
          opacity={interpolate(
            frame,
            [0.6 * fps, 1.1 * fps, 2.9 * fps, 3.25 * fps],
            [0, 1, 1, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          )}
          scale={interpolate(
            frame,
            [0.6 * fps, 1.2 * fps, 2.9 * fps, 3.25 * fps],
            [0.92, 1, 1, 0.96],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 200 }),
              output: "perceptual-scale",
            },
          )}
        />
      </BrowserFrame>
      <Sequence from={22} name="Nav callout">
        <Interactive.Div
          name="Nav callout wrap"
          style={{ position: "absolute", left: 120, top: 100 }}
        >
          <Callout name="Nav callout" label="Instant hole-by-hole navigation" />
        </Interactive.Div>
      </Sequence>
    </AbsoluteFill>
  );
};

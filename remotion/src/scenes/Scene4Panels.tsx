import {
  AbsoluteFill,
  Easing,
  Interactive,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AerialPanel } from "../components/AerialPanel";
import { BrowserFrame } from "../components/BrowserFrame";
import { Callout } from "../components/Callout";
import { CourseChrome } from "../components/CourseChrome";
import { FlyoverFrames } from "../components/FlyoverFrames";
import { ScorecardPanel } from "../components/ScorecardPanel";

export const Scene4Panels: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const showAerial = frame >= 3.5 * fps;

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1814" }}>
      <BrowserFrame>
        <FlyoverFrames
          hole={7}
          progress={interpolate(frame, [0, 7.4 * fps], [0.45, 0.62], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
        />
        <CourseChrome
          hole={7}
          par={3}
          activePanel={showAerial ? "aerial" : "scorecard"}
          showScrollHint={false}
        />
        <ScorecardPanel
          progress={interpolate(
            frame,
            [0.15 * fps, 0.7 * fps, 3.2 * fps, 3.6 * fps],
            [0, 1, 1, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          )}
          teeIndex={frame < 2.2 * fps ? 2 : 3}
          activeHole={7}
        />
        <AerialPanel
          hole={7}
          progress={interpolate(frame, [3.45 * fps, 4 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })}
        />
      </BrowserFrame>
      <Sequence from={18} durationInFrames={90} name="Scorecard callout">
        <Interactive.Div
          name="Scorecard callout wrap"
          style={{ position: "absolute", left: 120, top: 100 }}
        >
          <Callout name="Scorecard callout" label="Interactive scorecard & yardages" />
        </Interactive.Div>
      </Sequence>
      <Sequence from={108} name="Aerial callout">
        <Interactive.Div
          name="Aerial callout wrap"
          style={{ position: "absolute", left: 120, top: 100 }}
        >
          <Callout name="Aerial callout" label="Aerial course map & hole graphics" />
        </Interactive.Div>
      </Sequence>
    </AbsoluteFill>
  );
};

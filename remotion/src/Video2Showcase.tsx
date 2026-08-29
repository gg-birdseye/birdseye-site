import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { ShowcaseEndCard } from "./scenes/ShowcaseEndCard";
import { Video2Footage } from "./scenes/Video2Footage";

export const Video2Showcase: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1814" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={902} name="Original video">
          <Video2Footage />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 30 })}
        />
        <TransitionSeries.Sequence durationInFrames={60} name="Showcase end card">
          <ShowcaseEndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

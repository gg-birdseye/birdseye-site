import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { FilmGrain, Vignette } from "./components/FilmGrain";
import { TeeSheetEndCard } from "./scenes/TeeSheetEndCard";
import { Video2Footage } from "./scenes/Video2Footage";

export const Video2TeeSheet: React.FC = () => {
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
        <TransitionSeries.Sequence durationInFrames={150} name="Tee sheet end card">
          <TeeSheetEndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <FilmGrain />
      <Vignette />
    </AbsoluteFill>
  );
};

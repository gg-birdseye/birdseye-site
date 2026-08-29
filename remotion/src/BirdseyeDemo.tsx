import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { FilmGrain, Vignette } from "./components/FilmGrain";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2ScrollFlyover } from "./scenes/Scene2ScrollFlyover";
import { Scene3HoleNav } from "./scenes/Scene3HoleNav";
import { Scene4Panels } from "./scenes/Scene4Panels";
import { Scene5Cta } from "./scenes/Scene5Cta";

export const BirdseyeDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1814" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={162} name="Hook">
          <Scene1Hook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={192} name="Scroll flyover">
          <Scene2ScrollFlyover />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={162} name="Hole navigation">
          <Scene3HoleNav />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={222} name="Scorecard and aerial">
          <Scene4Panels />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={222} name="CTA">
          <Scene5Cta />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <FilmGrain />
      <Vignette />
    </AbsoluteFill>
  );
};

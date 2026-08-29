import "./index.css";
import "./fonts";
import { Composition, Folder } from "remotion";
import { BirdseyeDemo } from "./BirdseyeDemo";
import { Video2TeeSheet } from "./Video2TeeSheet";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2ScrollFlyover } from "./scenes/Scene2ScrollFlyover";
import { Scene3HoleNav } from "./scenes/Scene3HoleNav";
import { Scene4Panels } from "./scenes/Scene4Panels";
import { Scene5Cta } from "./scenes/Scene5Cta";
import { TeeSheetEndCard } from "./scenes/TeeSheetEndCard";
import { Video2Showcase } from "./Video2Showcase";
import { ShowcaseEndCard } from "./scenes/ShowcaseEndCard";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="BirdseyeDemo-Scenes">
        <Composition
          id="Scene1Hook"
          component={Scene1Hook}
          durationInFrames={162}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene2ScrollFlyover"
          component={Scene2ScrollFlyover}
          durationInFrames={192}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene3HoleNav"
          component={Scene3HoleNav}
          durationInFrames={162}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene4Panels"
          component={Scene4Panels}
          durationInFrames={222}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene5Cta"
          component={Scene5Cta}
          durationInFrames={222}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
      <Composition
        id="BirdseyeDemo"
        component={BirdseyeDemo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Video2TeeSheet"
        component={Video2TeeSheet}
        durationInFrames={1022}
        fps={30}
        width={2494}
        height={1444}
      />
      <Composition
        id="TeeSheetEndCard"
        component={TeeSheetEndCard}
        durationInFrames={150}
        fps={30}
        width={2494}
        height={1444}
      />
      <Composition
        id="Video2Showcase"
        component={Video2Showcase}
        durationInFrames={932}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="ShowcaseEndCard"
        component={ShowcaseEndCard}
        durationInFrames={60}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};

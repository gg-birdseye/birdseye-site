import { Video } from "@remotion/media";
import { AbsoluteFill, staticFile } from "remotion";

export const VIDEO2_SRC = staticFile("video2.mp4");

export const Video2Footage: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1814" }}>
      <Video
        src={VIDEO2_SRC}
        style={{
          width: "100%",
          height: "100%",
        }}
        objectFit="cover"
      />
    </AbsoluteFill>
  );
};

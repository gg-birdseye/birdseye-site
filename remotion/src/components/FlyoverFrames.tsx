import { AbsoluteFill, Img, staticFile } from "remotion";
import { HOLE1_FRAME_COUNT, HOLE7_FRAME_COUNT } from "../data";

const pad = (n: number) => String(n).padStart(2, "0");

export const FlyoverFrames: React.FC<{
  hole: 1 | 7;
  progress: number;
  scale?: number;
}> = ({ hole, progress, scale = 1 }) => {
  const count = hole === 1 ? HOLE1_FRAME_COUNT : HOLE7_FRAME_COUNT;
  const folder = hole === 1 ? "hole-1" : "hole-7";
  const idx = Math.max(0, Math.min(count - 1, Math.round(progress * (count - 1))));

  return (
    <AbsoluteFill
      name={`Hole ${hole} flyover`}
      style={{
        backgroundColor: "#0d120f",
        overflow: "hidden",
        scale,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Img
          key={`${folder}-${i}`}
          src={staticFile(`frames/${folder}/${pad(i + 1)}.webp`)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: i === idx ? 1 : 0,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

import { AbsoluteFill } from "remotion";

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export const FilmGrain: React.FC = () => {
  return (
    <AbsoluteFill
      name="Film grain"
      style={{
        pointerEvents: "none",
        opacity: 0.09,
        mixBlendMode: "overlay",
        backgroundImage: GRAIN,
        backgroundSize: "180px 180px",
      }}
    />
  );
};

export const Vignette: React.FC = () => {
  return (
    <AbsoluteFill
      name="Vignette"
      style={{
        pointerEvents: "none",
        background:
          "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 42%, rgba(26,24,20,0.55) 100%)",
      }}
    />
  );
};

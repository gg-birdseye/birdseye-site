export const HOLE_PAR = [
  5, 4, 3, 4, 5, 4, 3, 4, 4, 4, 3, 4, 5, 4, 4, 4, 3, 5,
] as const;

export const TEES = [
  { name: "Red", color: "#c2372e", yards: [347, 196, 125, 285, 417, 233, 115, 220, 305, 300, 100, 222, 381, 267, 260, 234, 94, 320] },
  { name: "Black", color: "#1a1a1a", yards: [402, 243, 125, 345, 473, 331, 125, 342, 360, 300, 100, 328, 438, 348, 372, 300, 168, 391] },
  { name: "White", color: "#f4f1ea", yards: [511, 296, 153, 433, 520, 349, 183, 374, 393, 350, 185, 427, 488, 409, 379, 379, 192, 482] },
  { name: "Blue", color: "#39496b", yards: [522, 310, 171, 462, 557, 362, 195, 387, 404, 360, 208, 438, 502, 421, 426, 390, 214, 495] },
] as const;

export const HOLE1_FRAME_COUNT = 24;
export const HOLE7_FRAME_COUNT = 20;
export const MAX_YARDS = 580;

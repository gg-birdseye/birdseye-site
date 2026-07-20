/** Demo scorecard + hole data for the example course preview. */

export const DEMO_ACCENT = "#CF8018";

export const DEMO_HOLE_PAR = [
  0, 4, 3, 5, 4, 4, 3, 4, 4, 5, 4, 4, 3, 5, 4, 3, 4, 4, 5,
] as const;

export const DEMO_HOLE_HDCP = [
  0, 13, 15, 3, 5, 1, 17, 7, 11, 9, 8, 2, 18, 6, 16, 14, 10, 12, 4,
] as const;

/** Preferred tee (gold) yardages per hole */
export const DEMO_YARDAGES = [
  0, 352, 155, 489, 362, 400, 153, 372, 342, 520, 339, 351, 153, 537, 332,
  131, 345, 375, 513,
] as const;

export const DEMO_COURSE_INFO =
  "This links-style course unfolds along pristine native dunes where expansive ocean views are revealed on nearly every hole. Winds are ever-present, and the varying elements create a new experience each time you play.";

export const DEMO_HOLE_INFO: Record<number, string> = {
  1: "Tee shots should favor the left side of the fairway and an approach that favors the right side of the green will avoid the enormous hump in the left middle of the green.",
  2: "A medium length par 3 that requires a significantly uphill shot. The prevailing northwest wind will blow the ball from left to right.",
  3: "This first par 5 represents the first real opportunity for a birdie. Analyze the second shot landing area — it may be blind from the fairway.",
};

import { DEFAULT_TEE_COLORS } from "@/lib/constants/teeColors";

export const TEE_COLORS = DEFAULT_TEE_COLORS;

export const TEE_YARDAGES = [
  [0, 293, 130, 370, 308, 321, 111, 317, 290, 464, 251, 284, 98, 447, 288, 102, 250, 324, 424],
  [0, 332, 136, 467, 340, 374, 126, 332, 321, 510, 302, 315, 129, 498, 320, 113, 301, 329, 471],
  [0, 352, 155, 489, 362, 400, 153, 372, 342, 520, 339, 351, 153, 537, 332, 131, 345, 375, 513],
  [0, 386, 189, 543, 410, 428, 161, 383, 359, 558, 362, 384, 199, 553, 359, 163, 363, 389, 543],
  [0, 398, 220, 563, 443, 445, 217, 411, 385, 585, 380, 452, 238, 553, 390, 206, 363, 405, 558],
] as const;

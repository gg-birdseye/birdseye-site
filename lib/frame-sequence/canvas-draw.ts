/** Draw a frame bitmap with CSS object-cover behavior on a canvas. */

export type CoverDrawRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
};

export function computeCoverDrawRect(
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
): CoverDrawRect {
  const srcAspect = srcW / srcH;
  const destAspect = destW / destH;

  // Overdraw by 1px on each edge to avoid subpixel hairlines at the stage bounds.
  const dx = -1;
  const dy = -1;
  const dw = destW + 2;
  const dh = destH + 2;

  if (srcAspect > destAspect) {
    const sh = srcH;
    const sw = srcH * destAspect;
    const sx = (srcW - sw) / 2;
    return { sx, sy: 0, sw, sh, dx, dy, dw, dh };
  }

  const sw = srcW;
  const sh = srcW / destAspect;
  const sy = (srcH - sh) / 2;
  return { sx: 0, sy, sw, sh, dx, dy, dw, dh };
}

export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): {
  width: number;
  height: number;
} {
  const parent = canvas.parentElement;
  const cssW = parent?.clientWidth ?? canvas.clientWidth;
  const cssH = parent?.clientHeight ?? canvas.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  return { width: w, height: h };
}

export function drawCoverFrame(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  canvasW: number,
  canvasH: number,
) {
  const rect = computeCoverDrawRect(
    bitmap.width,
    bitmap.height,
    canvasW,
    canvasH,
  );
  ctx.drawImage(
    bitmap,
    rect.sx,
    rect.sy,
    rect.sw,
    rect.sh,
    rect.dx,
    rect.dy,
    rect.dw,
    rect.dh,
  );
}

/** Pixel rect of media rendered with object-fit: contain inside a container. */
export type ContainedMediaRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function containedMediaRect(
  containerWidth: number,
  containerHeight: number,
  mediaWidth: number,
  mediaHeight: number,
): ContainedMediaRect | null {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    mediaWidth <= 0 ||
    mediaHeight <= 0
  ) {
    return null;
  }

  const scale = Math.min(containerWidth / mediaWidth, containerHeight / mediaHeight);
  const width = mediaWidth * scale;
  const height = mediaHeight * scale;

  return {
    left: (containerWidth - width) / 2,
    top: (containerHeight - height) / 2,
    width,
    height,
  };
}

export function pointerToMediaPercent(
  clientX: number,
  clientY: number,
  containerRect: DOMRectReadOnly,
  mediaRect: ContainedMediaRect,
): { x: number; y: number } | null {
  const localX = clientX - containerRect.left - mediaRect.left;
  const localY = clientY - containerRect.top - mediaRect.top;

  if (
    localX < 0 ||
    localY < 0 ||
    localX > mediaRect.width ||
    localY > mediaRect.height
  ) {
    return null;
  }

  return {
    x: clampPercent((localX / mediaRect.width) * 100),
    y: clampPercent((localY / mediaRect.height) * 100),
  };
}

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

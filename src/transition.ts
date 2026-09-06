/**
 * The open/close transition: growing the thumbnail into a full-screen image and
 * back. Pure geometry, so it can be tested without a renderer.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * How the image fits the screen. `contain` is what a lightbox wants: the whole
 * image visible, letterboxed rather than cropped.
 */
export function fitContain(content: { width: number; height: number }, container: Rect): Rect {
  'worklet';
  if (content.width <= 0 || content.height <= 0) {
    return { x: container.x, y: container.y, width: container.width, height: container.height };
  }
  const scale = Math.min(container.width / content.width, container.height / content.height);
  const width = content.width * scale;
  const height = content.height * scale;
  return {
    x: container.x + (container.width - width) / 2,
    y: container.y + (container.height - height) / 2,
    width,
    height,
  };
}

/**
 * Transform that places a full-screen target rect exactly over the thumbnail.
 *
 * The overlay image is laid out at its final size and then transformed back onto
 * the trigger, so the transition is one interpolation from this transform to the
 * identity — no layout happens per frame.
 */
export function transformFromRect(
  target: Rect,
  origin: Rect,
): { translateX: number; translateY: number; scaleX: number; scaleY: number } {
  'worklet';
  const scaleX = target.width > 0 ? origin.width / target.width : 1;
  const scaleY = target.height > 0 ? origin.height / target.height : 1;
  const targetCenterX = target.x + target.width / 2;
  const targetCenterY = target.y + target.height / 2;
  const originCenterX = origin.x + origin.width / 2;
  const originCenterY = origin.y + origin.height / 2;
  return {
    translateX: originCenterX - targetCenterX,
    translateY: originCenterY - targetCenterY,
    scaleX,
    scaleY,
  };
}

export function interpolateNumber(progress: number, from: number, to: number): number {
  'worklet';
  return from + (to - from) * progress;
}

/**
 * Whether the position-and-size transition should be used at all.
 *
 * Reduce motion asks for no large movement across the screen, so the viewer
 * cross-fades in place instead. A missing measurement gets the same treatment —
 * a fade is always better than a jump from the top-left corner.
 */
export function shouldAnimateFromOrigin(origin: Rect | null, reduceMotion: boolean): boolean {
  'worklet';
  if (reduceMotion) return false;
  if (origin === null) return false;
  return origin.width > 0 && origin.height > 0;
}

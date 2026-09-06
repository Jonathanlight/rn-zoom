/**
 * Gesture arbitration for the full-screen viewer.
 *
 * This is the only genuinely hard part of a lightbox. A vertical drag means
 * "close" when the image sits at its natural size, and "move the image" once it
 * is zoomed in — and at the edges of a zoomed image the two have to hand over to
 * each other cleanly, or the viewer feels stuck. Getting that wrong is why most
 * apps roll their own and why people keep asking for it.
 *
 * All of it is expressed here as pure arithmetic so the rules can be tested
 * exhaustively instead of being poked at on a device. Every function is a
 * worklet so the same code runs on the UI thread.
 */

/** Float comparisons on gesture values need a tolerance; sub-pixel is invisible. */
const EPSILON = 0.01;

export type PanIntent =
  /** Close the viewer. */
  | 'dismiss'
  /** Move the zoomed image inside the frame. */
  | 'move-image'
  /** Hand the drag to the gallery pager. */
  | 'change-page';

export interface Bounds {
  /** Largest absolute horizontal offset the image may take at this scale. */
  maxX: number;
  /** Largest absolute vertical offset the image may take at this scale. */
  maxY: number;
}

/**
 * How far a scaled image may be moved before its edge comes into frame.
 *
 * Zero when the image is not larger than its container in that axis, which is
 * what tells the caller there is nothing to pan.
 */
export function panBounds(
  contentWidth: number,
  contentHeight: number,
  containerWidth: number,
  containerHeight: number,
  scale: number,
): Bounds {
  'worklet';
  const scaledWidth = contentWidth * scale;
  const scaledHeight = contentHeight * scale;
  return {
    maxX: Math.max(0, (scaledWidth - containerWidth) / 2),
    maxY: Math.max(0, (scaledHeight - containerHeight) / 2),
  };
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Keeps an offset inside the pannable area for the current scale. */
export function clampToBounds(x: number, y: number, bounds: Bounds): { x: number; y: number } {
  'worklet';
  return {
    x: clamp(x, -bounds.maxX, bounds.maxX),
    y: clamp(y, -bounds.maxY, bounds.maxY),
  };
}

export interface PanIntentInput {
  /** Current image scale. `1` means "at natural size". */
  scale: number;
  /** Smallest scale the viewer allows, normally 1. */
  minScale: number;
  /** Drag so far, relative to where the finger went down. */
  dx: number;
  dy: number;
  /** Where the image currently sits. */
  translateX: number;
  translateY: number;
  bounds: Bounds;
  /** Whether a horizontal drag has a pager to hand off to. */
  galleryEnabled: boolean;
}

/**
 * Decides what a drag currently means.
 *
 * The rules, in order:
 *
 * 1. At natural size, a mostly-vertical drag closes the viewer and a mostly
 *    horizontal one moves to the next image (when there is a gallery).
 * 2. Zoomed in, a drag moves the image — *except* at an edge. Dragging further
 *    past the left or right edge hands over to the pager, and dragging down when
 *    the top edge is already in frame closes the viewer, exactly as it would at
 *    natural size.
 * 3. Zoomed in with no room to move in the dragged axis, the drag falls straight
 *    through to whatever that axis means at natural size — otherwise a tall thin
 *    image would trap the gesture and nothing would happen.
 */
export function resolvePanIntent(input: PanIntentInput): PanIntent {
  'worklet';
  const { scale, minScale, dx, dy, translateX, translateY, bounds, galleryEnabled } = input;

  const horizontal = Math.abs(dx) > Math.abs(dy);
  const isZoomed = scale > minScale + EPSILON;

  if (!isZoomed) {
    if (horizontal && galleryEnabled) return 'change-page';
    if (horizontal) return 'move-image';
    return 'dismiss';
  }

  if (horizontal) {
    if (!galleryEnabled) return 'move-image';
    // No horizontal room at all: the pager should take the whole drag.
    if (bounds.maxX <= EPSILON) return 'change-page';
    const atLeftEdge = translateX >= bounds.maxX - EPSILON;
    const atRightEdge = translateX <= -bounds.maxX + EPSILON;
    // Dragging right while the left edge is already in frame, or left while the
    // right edge is, means the image cannot go further: hand over to the pager.
    if (dx > 0 && atLeftEdge) return 'change-page';
    if (dx < 0 && atRightEdge) return 'change-page';
    return 'move-image';
  }

  // Vertical, zoomed.
  if (bounds.maxY <= EPSILON) return 'dismiss';
  const atTopEdge = translateY >= bounds.maxY - EPSILON;
  if (dy > 0 && atTopEdge) return 'dismiss';
  return 'move-image';
}

export interface DismissInput {
  /** Vertical drag distance; either direction closes the viewer. */
  dy: number;
  /** Vertical velocity at release, in points per second. */
  velocityY: number;
  /** Distance past which a release closes, as a fraction of the screen height. */
  dismissThreshold: number;
  containerHeight: number;
}

/**
 * Whether releasing here should close the viewer.
 *
 * Distance alone is not enough: a short, fast flick reads as "dismiss" to
 * everyone who has used a photo viewer, and requiring the full distance for it
 * makes the gesture feel heavy.
 */
export function shouldDismiss({
  dy,
  velocityY,
  dismissThreshold,
  containerHeight,
}: DismissInput): boolean {
  'worklet';
  const distance = Math.abs(dy);
  const travelled = distance > containerHeight * dismissThreshold;
  const flicked = Math.abs(velocityY) > 800 && distance > 20;
  // A fast flick counts only when it is going the same way as the drag, so that
  // dragging down and flicking back up cancels instead of closing.
  const sameDirection = velocityY === 0 || dy === 0 || Math.sign(velocityY) === Math.sign(dy);
  return travelled || (flicked && sameDirection);
}

/**
 * Backdrop opacity while a dismiss drag is in progress: the further the image
 * has travelled, the more of the page behind shows through.
 */
export function backdropOpacity(dy: number, containerHeight: number, minimum = 0): number {
  'worklet';
  if (containerHeight <= 0) return 1;
  const progress = Math.min(1, Math.abs(dy) / containerHeight);
  return Math.max(minimum, 1 - progress);
}

/** Image scale while a dismiss drag is in progress: it shrinks slightly as it goes. */
export function dismissScale(dy: number, containerHeight: number, floor = 0.7): number {
  'worklet';
  if (containerHeight <= 0) return 1;
  const progress = Math.min(1, Math.abs(dy) / containerHeight);
  return Math.max(floor, 1 - progress * (1 - floor));
}

/**
 * Scale after a double tap: out to the minimum if already zoomed, in otherwise.
 */
export function nextScaleOnDoubleTap(
  currentScale: number,
  minScale: number,
  doubleTapScale: number,
): number {
  'worklet';
  return currentScale > minScale + EPSILON ? minScale : doubleTapScale;
}

/**
 * Offset that keeps the point under the fingers still while the scale changes.
 *
 * Without this a pinch drifts towards the centre of the screen and zooming in on
 * a face walks it out of frame.
 */
export function focalTranslation(
  focalX: number,
  focalY: number,
  containerWidth: number,
  containerHeight: number,
  fromScale: number,
  toScale: number,
  translateX: number,
  translateY: number,
): { x: number; y: number } {
  'worklet';
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;
  // Where the focal point sits in the un-scaled image.
  const pointX = (focalX - centerX - translateX) / fromScale;
  const pointY = (focalY - centerY - translateY) / fromScale;
  return {
    x: focalX - centerX - pointX * toScale,
    y: focalY - centerY - pointY * toScale,
  };
}

/**
 * Rubber-band resistance past a limit: the further out of bounds, the less each
 * further point of drag moves things, so the edge feels like a soft wall.
 */
export function withResistance(value: number, limit: number, resistance = 0.55): number {
  'worklet';
  if (value > limit) return limit + (value - limit) * resistance;
  if (value < -limit) return -limit + (value + limit) * resistance;
  return value;
}

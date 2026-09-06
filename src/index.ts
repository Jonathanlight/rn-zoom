/**
 * rn-zoom-next — tap to open, pinch to zoom, swipe to dismiss.
 *
 * Independent community rewrite. Not affiliated with, nor endorsed by, the
 * authors of react-native-lightbox. See NOTICE for attribution.
 */
export { Zoom } from './Zoom.js';
export { ZoomGallery } from './ZoomGallery.js';
export { ZoomableContent, type ZoomableContentProps } from './ZoomableContent.js';

export {
  backdropOpacity,
  clamp,
  clampToBounds,
  dismissScale,
  focalTranslation,
  nextScaleOnDoubleTap,
  panBounds,
  resolvePanIntent,
  shouldDismiss,
  withResistance,
  type Bounds,
  type PanIntent,
  type PanIntentInput,
} from './gestures.js';

export {
  fitContain,
  shouldAnimateFromOrigin,
  transformFromRect,
  type Rect,
} from './transition.js';

export { useReduceMotion } from './useReduceMotion.js';

export type { ZoomProps, ZoomGalleryImage, ZoomGalleryProps } from './types.js';

import { Zoom } from './Zoom.js';

/** Default export, matching how react-native-lightbox is usually imported. */
export default Zoom;

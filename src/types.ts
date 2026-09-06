import type { ReactNode } from 'react';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';

export interface ZoomProps {
  /** Props applied to the content only while it is full screen — typically a
   *  higher-resolution `source`. */
  activeProps?: Record<string, unknown>;
  /** Custom header for the overlay. Receives the close callback. */
  renderHeader?: (close: () => void) => ReactNode;
  /** Custom full-screen content. Without it, the trigger's children are reused. */
  renderContent?: () => ReactNode;
  onOpen?: () => void;
  didOpen?: () => void;
  willClose?: () => void;
  onClose?: () => void;
  backgroundColor?: string;
  underlayColor?: string;
  swipeToDismiss?: boolean;
  /** Spring config for the open and close transitions. */
  springConfig?: { damping?: number; stiffness?: number; mass?: number };
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;

  /** Smallest scale pinching allows. */
  minZoom?: number;
  /** Largest scale pinching allows. */
  maxZoom?: number;
  /** Scale a double tap zooms to. Defaults to `min(maxZoom, 2)`. */
  doubleTapScale?: number;
  /** Fraction of the screen height a swipe must cover to dismiss. */
  dismissThreshold?: number;
  /** Natural size of the content, used to fit it to the screen and to bound panning. */
  contentSize?: { width: number; height: number };
  accessibilityLabel?: string;
  /** Announced when the viewer opens. */
  accessibilityHint?: string;
}

export interface ZoomGalleryImage {
  source: ImageSourcePropType;
  /** Natural size, when known. Improves the fit and the pan bounds. */
  width?: number;
  height?: number;
  accessibilityLabel?: string;
  key?: string;
}

export interface ZoomGalleryProps {
  images: readonly ZoomGalleryImage[];
  initialIndex?: number;
  visible?: boolean;
  onClose?: () => void;
  onIndexChange?: (index: number) => void;
  backgroundColor?: string;
  renderHeader?: (close: () => void, index: number) => ReactNode;
  swipeToDismiss?: boolean;
  minZoom?: number;
  maxZoom?: number;
  doubleTapScale?: number;
  dismissThreshold?: number;
}

import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  backdropOpacity,
  clampToBounds,
  dismissScale,
  focalTranslation,
  nextScaleOnDoubleTap,
  panBounds,
  resolvePanIntent,
  shouldDismiss,
  withResistance,
  type PanIntent,
} from './gestures.js';

export interface ZoomableContentProps {
  children: React.ReactNode;
  /** Natural size of the content, for pan bounds. Defaults to the window. */
  contentWidth: number;
  contentHeight: number;
  minZoom: number;
  maxZoom: number;
  doubleTapScale: number;
  dismissThreshold: number;
  swipeToDismiss: boolean;
  /** Set when this content sits inside a gallery that can take horizontal drags. */
  galleryEnabled?: boolean;
  onRequestClose: () => void;
  onRequestPage?: (direction: 1 | -1) => void;
  /** Backdrop opacity, written to by the dismiss drag. */
  backdrop?: SharedValue<number>;
  style?: ViewStyle;
  reduceMotion: boolean;
  /** Spring used to settle the image after a gesture. */
  springConfig?: { damping?: number; stiffness?: number; mass?: number };
}

/**
 * The zoomable surface: pinch, pan, double tap and swipe-to-dismiss, with the
 * arbitration between them decided by `resolvePanIntent`.
 *
 * The pan handler picks its intent once, on the first meaningful movement of a
 * drag, and keeps it for the rest of that gesture. Re-deciding every frame is
 * what makes a viewer feel like it is fighting you: cross the edge of a zoomed
 * image mid-drag and the image would stop and the page would start sliding under
 * your finger.
 */
export function ZoomableContent({
  children,
  contentWidth,
  contentHeight,
  minZoom,
  maxZoom,
  doubleTapScale,
  dismissThreshold,
  swipeToDismiss,
  galleryEnabled = false,
  onRequestClose,
  onRequestPage,
  backdrop,
  style,
  reduceMotion,
  springConfig,
}: ZoomableContentProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const scale = useSharedValue(minZoom);
  const savedScale = useSharedValue(minZoom);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  // The intent for the drag currently in progress. Decided once, then held.
  const intent = useSharedValue<PanIntent | null>(null);
  const dismissOffset = useSharedValue(0);

  const spring = useMemo(
    () => ({ damping: 22, stiffness: 220, mass: 0.6, ...springConfig }),
    [springConfig],
  );

  const settle = (value: number) => {
    'worklet';
    return reduceMotion ? withTiming(value, { duration: 0 }) : withSpring(value, spring);
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = Math.min(maxZoom, Math.max(minZoom * 0.8, savedScale.value * event.scale));
      // Keep whatever is between the fingers where it is.
      const focal = focalTranslation(
        event.focalX,
        event.focalY,
        windowWidth,
        windowHeight,
        savedScale.value,
        next,
        savedX.value,
        savedY.value,
      );
      scale.value = next;
      translateX.value = focal.x;
      translateY.value = focal.y;
    })
    .onEnd(() => {
      // A pinch below the minimum is allowed during the gesture and springs back.
      const target = Math.max(minZoom, Math.min(maxZoom, scale.value));
      const bounds = panBounds(contentWidth, contentHeight, windowWidth, windowHeight, target);
      const clamped = clampToBounds(translateX.value, translateY.value, bounds);
      scale.value = settle(target);
      translateX.value = settle(clamped.x);
      translateY.value = settle(clamped.y);
      savedScale.value = target;
      savedX.value = clamped.x;
      savedY.value = clamped.y;
    });

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
      intent.value = null;
      dismissOffset.value = 0;
    })
    .onUpdate((event) => {
      const bounds = panBounds(contentWidth, contentHeight, windowWidth, windowHeight, scale.value);

      if (intent.value === null) {
        // Wait for a few points of movement before committing, so a slightly
        // crooked vertical drag is not read as horizontal.
        if (Math.abs(event.translationX) < 6 && Math.abs(event.translationY) < 6) return;
        intent.value = resolvePanIntent({
          scale: scale.value,
          minScale: minZoom,
          dx: event.translationX,
          dy: event.translationY,
          translateX: savedX.value,
          translateY: savedY.value,
          bounds,
          galleryEnabled,
        });
      }

      if (intent.value === 'move-image') {
        translateX.value = withResistance(savedX.value + event.translationX, bounds.maxX);
        translateY.value = withResistance(savedY.value + event.translationY, bounds.maxY);
        return;
      }

      if (intent.value === 'dismiss' && swipeToDismiss) {
        dismissOffset.value = event.translationY;
        if (backdrop) backdrop.value = backdropOpacity(event.translationY, windowHeight);
      }
      // 'change-page' is handled by the pager, which owns its own gesture.
    })
    .onEnd((event) => {
      const bounds = panBounds(contentWidth, contentHeight, windowWidth, windowHeight, scale.value);

      if (intent.value === 'move-image') {
        const clamped = clampToBounds(translateX.value, translateY.value, bounds);
        translateX.value = settle(clamped.x);
        translateY.value = settle(clamped.y);
        savedX.value = clamped.x;
        savedY.value = clamped.y;
        intent.value = null;
        return;
      }

      if (intent.value === 'dismiss' && swipeToDismiss) {
        const dismiss = shouldDismiss({
          dy: event.translationY,
          velocityY: event.velocityY,
          dismissThreshold,
          containerHeight: windowHeight,
        });
        if (dismiss) {
          runOnJS(onRequestClose)();
        } else {
          dismissOffset.value = settle(0);
          if (backdrop) backdrop.value = withTiming(1, { duration: 180 });
        }
      }

      if (intent.value === 'change-page' && onRequestPage) {
        const direction = event.translationX < 0 ? 1 : -1;
        if (Math.abs(event.translationX) > windowWidth * 0.2 || Math.abs(event.velocityX) > 600) {
          runOnJS(onRequestPage)(direction);
        }
      }

      intent.value = null;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      const target = nextScaleOnDoubleTap(scale.value, minZoom, doubleTapScale);
      if (target === minZoom) {
        scale.value = settle(minZoom);
        translateX.value = settle(0);
        translateY.value = settle(0);
        savedScale.value = minZoom;
        savedX.value = 0;
        savedY.value = 0;
        return;
      }
      // Zoom towards the tapped point rather than the centre.
      const focal = focalTranslation(
        event.x,
        event.y,
        windowWidth,
        windowHeight,
        scale.value,
        target,
        translateX.value,
        translateY.value,
      );
      const bounds = panBounds(contentWidth, contentHeight, windowWidth, windowHeight, target);
      const clamped = clampToBounds(focal.x, focal.y, bounds);
      scale.value = settle(target);
      translateX.value = settle(clamped.x);
      translateY.value = settle(clamped.y);
      savedScale.value = target;
      savedX.value = clamped.x;
      savedY.value = clamped.y;
    });

  // Pinch and pan run together (a two-finger drag while pinching); the double
  // tap has to lose to nothing, so it composes on top.
  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value + dismissOffset.value },
      { scale: scale.value * dismissScale(dismissOffset.value, windowHeight) },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, style, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});

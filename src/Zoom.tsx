import { Children, cloneElement, isValidElement, useCallback, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type View as RNView,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ZoomableContent } from './ZoomableContent.js';
import { shouldAnimateFromOrigin, type Rect } from './transition.js';
import { useReduceMotion } from './useReduceMotion.js';
import type { ZoomProps } from './types.js';

/**
 * Tap to open, pinch to zoom, swipe to dismiss.
 *
 * Wraps any content. Tapping it opens a full-screen overlay that grows from the
 * trigger's own position, which is why the trigger is measured on press rather
 * than on layout — its position on screen can change between the two.
 */
export function Zoom({
  activeProps,
  renderHeader,
  renderContent,
  onOpen,
  didOpen,
  willClose,
  onClose,
  backgroundColor = 'black',
  underlayColor,
  swipeToDismiss = true,
  springConfig,
  style,
  children,
  minZoom = 1,
  maxZoom = 4,
  doubleTapScale,
  dismissThreshold = 0.25,
  contentSize,
  accessibilityLabel,
  accessibilityHint = 'Opens full screen. Pinch to zoom, swipe to close.',
}: ZoomProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();

  const triggerRef = useRef<RNView>(null);
  const [visible, setVisible] = useState(false);
  const [origin, setOrigin] = useState<Rect | null>(null);

  const progress = useSharedValue(0);
  const backdrop = useSharedValue(1);

  const open = useCallback(() => {
    onOpen?.();
    // Measured at press time rather than on layout: inside a list the trigger's
    // position on screen changes as the user scrolls, and the transition has to
    // start from where it is now. If the callback never fires (web, or a
    // detached view) `origin` stays null and the overlay cross-fades instead.
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setOrigin({ x, y, width, height });
    });
    setVisible(true);
  }, [onOpen]);

  const finishClose = useCallback(() => {
    setVisible(false);
    setOrigin(null);
    backdrop.value = 1;
    onClose?.();
  }, [backdrop, onClose]);

  const close = useCallback(() => {
    willClose?.();
    // The modal has to stay mounted until the shrink-back finishes, or the image
    // vanishes instead of returning to its thumbnail.
    progress.value = withTiming(0, { duration: reduceMotion ? 0 : 220 }, (finished) => {
      'worklet';
      if (finished) scheduleOnRN(finishClose);
    });
  }, [finishClose, progress, reduceMotion, willClose]);

  const handleShow = useCallback(() => {
    progress.value = withTiming(1, { duration: reduceMotion ? 0 : 260 }, () => {
      'worklet';
    });
    didOpen?.();
  }, [didOpen, progress, reduceMotion]);

  const animateFromOrigin = shouldAnimateFromOrigin(origin, reduceMotion);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * backdrop.value,
  }));

  const contentTransitionStyle = useAnimatedStyle(() => {
    if (!animateFromOrigin || origin === null) {
      // Cross-fade in place: reduce motion, or nothing was measured.
      return { opacity: progress.value };
    }
    const scaleX = origin.width / windowWidth;
    const scaleY = origin.height / windowHeight;
    const originCenterX = origin.x + origin.width / 2;
    const originCenterY = origin.y + origin.height / 2;
    const t = progress.value;
    return {
      opacity: 1,
      transform: [
        { translateX: (originCenterX - windowWidth / 2) * (1 - t) },
        { translateY: (originCenterY - windowHeight / 2) * (1 - t) },
        { scaleX: scaleX + (1 - scaleX) * t },
        { scaleY: scaleY + (1 - scaleY) * t },
      ],
    };
  });

  // The full-screen content: `renderContent` wins, otherwise the trigger's own
  // child is reused with `activeProps` merged in — that is how the original
  // swaps in a high-resolution source.
  const overlayContent = renderContent
    ? renderContent()
    : Children.map(children, (child) =>
        isValidElement(child) && activeProps
          ? cloneElement(child, activeProps as Record<string, unknown>)
          : child,
      );

  return (
    <>
      <Pressable
        ref={triggerRef as never}
        onPress={open}
        accessibilityRole="imagebutton"
        {...(accessibilityLabel !== undefined ? { accessibilityLabel } : {})}
        accessibilityHint={accessibilityHint}
        style={style}
        {...(underlayColor !== undefined ? { android_ripple: { color: underlayColor } } : {})}
      >
        {children}
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="none"
        onShow={handleShow}
        onRequestClose={close}
        // Screen readers must not reach the page underneath while this is up.
        accessibilityViewIsModal
        supportedOrientations={['portrait', 'landscape']}
      >
        <GestureHandlerRootView style={styles.flex}>
          <View style={styles.flex}>
            <Animated.View
              style={[StyleSheet.absoluteFill, { backgroundColor }, backdropStyle]}
              pointerEvents="none"
            />

            <Animated.View style={[StyleSheet.absoluteFill, contentTransitionStyle]}>
              <ZoomableContent
                contentWidth={contentSize?.width ?? windowWidth}
                contentHeight={contentSize?.height ?? windowHeight}
                minZoom={minZoom}
                maxZoom={maxZoom}
                doubleTapScale={doubleTapScale ?? Math.min(maxZoom, 2)}
                dismissThreshold={dismissThreshold}
                swipeToDismiss={swipeToDismiss}
                {...(springConfig ? { springConfig } : {})}
                onRequestClose={close}
                backdrop={backdrop}
                reduceMotion={reduceMotion}
              >
                {overlayContent}
              </ZoomableContent>
            </Animated.View>

            <View style={styles.header} pointerEvents="box-none">
              {renderHeader ? (
                renderHeader(close)
              ) : (
                <Pressable
                  onPress={close}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={styles.closeButton}
                >
                  <Text style={styles.closeLabel}>✕</Text>
                </Pressable>
              )}
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { position: 'absolute', top: 48, left: 0, right: 0, paddingHorizontal: 16 },
  closeButton: {
    alignSelf: 'flex-end',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeLabel: { color: 'white', fontSize: 18 },
});

export default Zoom;

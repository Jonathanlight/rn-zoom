import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ZoomableContent } from './ZoomableContent.js';
import { useReduceMotion } from './useReduceMotion.js';
import type { ZoomGalleryProps } from './types.js';

/**
 * A full-screen, swipeable gallery where every image is independently zoomable.
 *
 * Paging is driven by the same `resolvePanIntent` arbitration the single viewer
 * uses, so a horizontal drag only turns the page when the current image has
 * nowhere left to move — which is what makes panning a zoomed photo and swiping
 * between photos feel like two different gestures instead of one ambiguous one.
 */
export function ZoomGallery({
  images,
  initialIndex = 0,
  visible = true,
  onClose,
  onIndexChange,
  backgroundColor = 'black',
  renderHeader,
  swipeToDismiss = true,
  minZoom = 1,
  maxZoom = 4,
  doubleTapScale,
  dismissThreshold = 0.25,
}: ZoomGalleryProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();

  const [index, setIndex] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, images.length - 1)),
  );
  const offset = useSharedValue(0);
  const backdrop = useSharedValue(1);

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, images.length - 1)));
  }, [images.length]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(0, next), images.length - 1);
      if (clamped === index) return;
      setIndex(clamped);
      onIndexChange?.(clamped);
      // The page slide is a short cross-slide rather than a carousel scroll:
      // only the current image is mounted, so there is nothing to scroll past.
      offset.value = clamped > index ? windowWidth : -windowWidth;
      offset.value = withTiming(0, { duration: reduceMotion ? 0 : 220 });
    },
    [images.length, index, offset, onIndexChange, reduceMotion, windowWidth],
  );

  const handlePage = useCallback((direction: 1 | -1) => goTo(index + direction), [goTo, index]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const pageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  const current = images[index];
  const close = useCallback(() => {
    backdrop.value = 1;
    onClose?.();
  }, [backdrop, onClose]);

  if (!current) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={close}
      accessibilityViewIsModal
      supportedOrientations={['portrait', 'landscape']}
    >
      <GestureHandlerRootView style={styles.flex}>
        <View style={styles.flex}>
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor }, backdropStyle]}
            pointerEvents="none"
          />

          <Animated.View style={[StyleSheet.absoluteFill, pageStyle]}>
            <ZoomableContent
              // Remounting per page resets zoom and pan, which is what people
              // expect when they swipe to the next photo.
              key={current.key ?? String(index)}
              contentWidth={current.width ?? windowWidth}
              contentHeight={current.height ?? windowHeight}
              minZoom={minZoom}
              maxZoom={maxZoom}
              doubleTapScale={doubleTapScale ?? Math.min(maxZoom, 2)}
              dismissThreshold={dismissThreshold}
              swipeToDismiss={swipeToDismiss}
              galleryEnabled={images.length > 1}
              onRequestClose={close}
              onRequestPage={handlePage}
              backdrop={backdrop}
              reduceMotion={reduceMotion}
            >
              <Image
                source={current.source}
                resizeMode="contain"
                style={{ width: windowWidth, height: windowHeight }}
                {...(current.accessibilityLabel !== undefined
                  ? { accessibilityLabel: current.accessibilityLabel, accessible: true }
                  : {})}
              />
            </ZoomableContent>
          </Animated.View>

          <View style={styles.header} pointerEvents="box-none">
            {renderHeader ? (
              renderHeader(close, index)
            ) : (
              <>
                <Text style={styles.counter} accessibilityLiveRegion="polite">
                  {index + 1} / {images.length}
                </Text>
                <Pressable
                  onPress={close}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={styles.closeButton}
                >
                  <Text style={styles.closeLabel}>✕</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: { color: 'white', fontSize: 15 },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeLabel: { color: 'white', fontSize: 18 },
});

export default ZoomGallery;

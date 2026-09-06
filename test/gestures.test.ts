import { describe, expect, it } from 'vitest';
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
  type PanIntentInput,
} from '../src/gestures.js';

const SCREEN = { width: 400, height: 800 };

describe('panBounds', () => {
  it('gives no room when the image fits the screen', () => {
    expect(panBounds(400, 300, 400, 800, 1)).toEqual({ maxX: 0, maxY: 0 });
  });

  it('gives half the overflow in each axis', () => {
    // 400x300 at 2x is 800x600 inside a 400x800 screen.
    expect(panBounds(400, 300, 400, 800, 2)).toEqual({ maxX: 200, maxY: 0 });
    expect(panBounds(400, 600, 400, 800, 2)).toEqual({ maxX: 200, maxY: 200 });
  });

  it('never returns a negative bound', () => {
    const bounds = panBounds(100, 100, 400, 800, 0.5);
    expect(bounds.maxX).toBe(0);
    expect(bounds.maxY).toBe(0);
  });
});

describe('clampToBounds', () => {
  it('keeps an offset inside the pannable area', () => {
    const bounds = { maxX: 100, maxY: 50 };
    expect(clampToBounds(0, 0, bounds)).toEqual({ x: 0, y: 0 });
    expect(clampToBounds(250, -90, bounds)).toEqual({ x: 100, y: -50 });
    expect(clampToBounds(-250, 90, bounds)).toEqual({ x: -100, y: 50 });
  });
});

/**
 * The pan-priority rules are the reason this package exists, so they are tested
 * case by case rather than through the component.
 */
describe('resolvePanIntent', () => {
  const base: PanIntentInput = {
    scale: 1,
    minScale: 1,
    dx: 0,
    dy: 0,
    translateX: 0,
    translateY: 0,
    bounds: { maxX: 0, maxY: 0 },
    galleryEnabled: false,
  };
  const intent = (o: Partial<PanIntentInput>) => resolvePanIntent({ ...base, ...o });

  describe('at natural size', () => {
    it('closes on a vertical drag, in either direction', () => {
      expect(intent({ dy: 60 })).toBe('dismiss');
      expect(intent({ dy: -60 })).toBe('dismiss');
    });

    it('changes page on a horizontal drag when there is a gallery', () => {
      expect(intent({ dx: 60, galleryEnabled: true })).toBe('change-page');
      expect(intent({ dx: -60, galleryEnabled: true })).toBe('change-page');
    });

    it('does nothing useful horizontally without a gallery', () => {
      expect(intent({ dx: 60 })).toBe('move-image');
    });

    it('picks the dominant axis, not whichever moved first', () => {
      expect(intent({ dx: 10, dy: 60 })).toBe('dismiss');
      expect(intent({ dx: 60, dy: 10, galleryEnabled: true })).toBe('change-page');
    });
  });

  describe('zoomed in', () => {
    const zoomed = { scale: 2, bounds: { maxX: 200, maxY: 200 } };

    it('moves the image instead of closing', () => {
      expect(intent({ ...zoomed, dy: 60 })).toBe('move-image');
      expect(intent({ ...zoomed, dy: -60 })).toBe('move-image');
    });

    it('moves the image instead of changing page, even with a gallery', () => {
      expect(intent({ ...zoomed, dx: 60, galleryEnabled: true })).toBe('move-image');
    });

    it('hands over to the pager when dragging further past a horizontal edge', () => {
      // translateX at +maxX means the left edge of the image is in frame.
      expect(
        intent({ ...zoomed, dx: 60, translateX: 200, galleryEnabled: true }),
      ).toBe('change-page');
      expect(
        intent({ ...zoomed, dx: -60, translateX: -200, galleryEnabled: true }),
      ).toBe('change-page');
    });

    it('keeps moving the image when dragging away from the edge it is on', () => {
      expect(
        intent({ ...zoomed, dx: -60, translateX: 200, galleryEnabled: true }),
      ).toBe('move-image');
    });

    it('closes when dragging down with the top edge already in frame', () => {
      expect(intent({ ...zoomed, dy: 60, translateY: 200 })).toBe('dismiss');
    });

    it('does not close when dragging up at the top edge', () => {
      expect(intent({ ...zoomed, dy: -60, translateY: 200 })).toBe('move-image');
    });

    it('does not close at the bottom edge, which would fight the drag direction', () => {
      expect(intent({ ...zoomed, dy: -60, translateY: -200 })).toBe('move-image');
    });
  });

  describe('zoomed with no room to move', () => {
    it('closes on a vertical drag when the image cannot move vertically', () => {
      // A wide, short image zoomed in: horizontal room, none vertically.
      expect(
        intent({ scale: 2, bounds: { maxX: 200, maxY: 0 }, dy: 60 }),
      ).toBe('dismiss');
    });

    it('changes page when the image cannot move horizontally', () => {
      expect(
        intent({ scale: 2, bounds: { maxX: 0, maxY: 200 }, dx: 60, galleryEnabled: true }),
      ).toBe('change-page');
    });

    it('does not trap the gesture when the image cannot move at all', () => {
      expect(intent({ scale: 2, bounds: { maxX: 0, maxY: 0 }, dy: 60 })).toBe('dismiss');
      expect(
        intent({ scale: 2, bounds: { maxX: 0, maxY: 0 }, dx: 60, galleryEnabled: true }),
      ).toBe('change-page');
    });
  });

  it('treats a scale a hair above the minimum as not zoomed, so float noise cannot flip it', () => {
    expect(intent({ scale: 1.001, dy: 60 })).toBe('dismiss');
  });
});

describe('shouldDismiss', () => {
  const base = { dismissThreshold: 0.25, containerHeight: 800 };

  it('closes once dragged past the threshold', () => {
    expect(shouldDismiss({ ...base, dy: 260, velocityY: 0 })).toBe(true);
    expect(shouldDismiss({ ...base, dy: -260, velocityY: 0 })).toBe(true);
  });

  it('stays open for a short slow drag', () => {
    expect(shouldDismiss({ ...base, dy: 40, velocityY: 0 })).toBe(false);
  });

  it('closes on a short fast flick', () => {
    expect(shouldDismiss({ ...base, dy: 40, velocityY: 1500 })).toBe(true);
  });

  it('does not close when the flick reverses the drag', () => {
    // Dragged down, then flicked back up: the user changed their mind.
    expect(shouldDismiss({ ...base, dy: 40, velocityY: -1500 })).toBe(false);
  });

  it('ignores a fast flick that barely moved, which is really a tap', () => {
    expect(shouldDismiss({ ...base, dy: 5, velocityY: 2000 })).toBe(false);
  });
});

describe('backdropOpacity and dismissScale', () => {
  it('is fully opaque at rest and clears as the image travels', () => {
    expect(backdropOpacity(0, 800)).toBe(1);
    expect(backdropOpacity(400, 800)).toBeCloseTo(0.5, 5);
    expect(backdropOpacity(800, 800)).toBe(0);
  });

  it('treats both drag directions the same', () => {
    expect(backdropOpacity(-400, 800)).toBeCloseTo(backdropOpacity(400, 800), 5);
  });

  it('respects a minimum, so the backdrop never fully disappears when asked', () => {
    expect(backdropOpacity(800, 800, 0.2)).toBe(0.2);
  });

  it('shrinks the image towards the floor but never past it', () => {
    expect(dismissScale(0, 800)).toBe(1);
    expect(dismissScale(800, 800)).toBeCloseTo(0.7, 5);
    expect(dismissScale(4000, 800)).toBeCloseTo(0.7, 5);
  });

  it('degrades safely on an unmeasured container', () => {
    expect(backdropOpacity(100, 0)).toBe(1);
    expect(dismissScale(100, 0)).toBe(1);
  });
});

describe('nextScaleOnDoubleTap', () => {
  it('zooms in from natural size', () => {
    expect(nextScaleOnDoubleTap(1, 1, 2)).toBe(2);
  });

  it('zooms back out from anywhere above natural size', () => {
    expect(nextScaleOnDoubleTap(2, 1, 2)).toBe(1);
    expect(nextScaleOnDoubleTap(3.7, 1, 2)).toBe(1);
  });
});

describe('focalTranslation', () => {
  it('holds the screen centre still when pinching on the centre', () => {
    const result = focalTranslation(200, 400, 400, 800, 1, 2, 0, 0);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });

  it('keeps the pinched point under the fingers when pinching off-centre', () => {
    const containerW = 400;
    const containerH = 800;
    const focalX = 300;
    const focalY = 500;

    const result = focalTranslation(focalX, focalY, containerW, containerH, 1, 2, 0, 0);

    // Re-project the same image point at the new scale and offset: it must land
    // back under the finger.
    const pointX = (focalX - containerW / 2 - 0) / 1;
    const pointY = (focalY - containerH / 2 - 0) / 1;
    expect(containerW / 2 + pointX * 2 + result.x).toBeCloseTo(focalX, 5);
    expect(containerH / 2 + pointY * 2 + result.y).toBeCloseTo(focalY, 5);
  });

  it('accounts for an image that is already panned', () => {
    const result = focalTranslation(300, 500, 400, 800, 2, 4, 50, -30);
    const pointX = (300 - 200 - 50) / 2;
    const pointY = (500 - 400 + 30) / 2;
    expect(200 + pointX * 4 + result.x).toBeCloseTo(300, 5);
    expect(400 + pointY * 4 + result.y).toBeCloseTo(500, 5);
  });
});

describe('withResistance', () => {
  it('leaves in-bounds values alone', () => {
    expect(withResistance(50, 100)).toBe(50);
    expect(withResistance(-50, 100)).toBe(-50);
  });

  it('damps movement past the limit rather than stopping it dead', () => {
    const past = withResistance(200, 100, 0.5);
    expect(past).toBe(150);
    expect(past).toBeGreaterThan(100);
    expect(past).toBeLessThan(200);
  });

  it('damps symmetrically', () => {
    expect(withResistance(-200, 100, 0.5)).toBe(-150);
  });

  it('is continuous at the limit, so there is no jump when crossing it', () => {
    // Crossing the boundary must not move the image: the step either side of the
    // limit has to stay on the order of the step itself, not jump.
    const epsilon = 0.001;
    const inside = withResistance(100 - epsilon, 100);
    const outside = withResistance(100 + epsilon, 100);
    expect(Math.abs(outside - inside)).toBeLessThan(epsilon * 2);
  });
});

describe('screen sanity', () => {
  it('uses a realistic screen in these tests', () => {
    expect(SCREEN.height).toBeGreaterThan(SCREEN.width);
  });
});

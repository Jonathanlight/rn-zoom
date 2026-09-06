import { describe, expect, it } from 'vitest';
import {
  fitContain,
  interpolateNumber,
  shouldAnimateFromOrigin,
  transformFromRect,
  type Rect,
} from '../src/transition.js';

const SCREEN: Rect = { x: 0, y: 0, width: 400, height: 800 };

describe('fitContain', () => {
  it('letterboxes a wide image, centring it vertically', () => {
    const fitted = fitContain({ width: 1000, height: 500 }, SCREEN);
    expect(fitted.width).toBe(400);
    expect(fitted.height).toBe(200);
    expect(fitted.x).toBe(0);
    expect(fitted.y).toBe(300);
  });

  it('pillarboxes a tall image, centring it horizontally', () => {
    const fitted = fitContain({ width: 500, height: 1000 }, SCREEN);
    expect(fitted.height).toBe(800);
    expect(fitted.width).toBe(400);
    expect(fitted.y).toBe(0);
    expect(fitted.x).toBe(0);
  });

  it('never crops: the whole image always fits', () => {
    const fitted = fitContain({ width: 1234, height: 987 }, SCREEN);
    expect(fitted.width).toBeLessThanOrEqual(SCREEN.width + 1e-9);
    expect(fitted.height).toBeLessThanOrEqual(SCREEN.height + 1e-9);
  });

  it('preserves the aspect ratio', () => {
    const fitted = fitContain({ width: 1600, height: 900 }, SCREEN);
    expect(fitted.width / fitted.height).toBeCloseTo(1600 / 900, 6);
  });

  it('falls back to filling the container when the size is unknown', () => {
    expect(fitContain({ width: 0, height: 0 }, SCREEN)).toEqual(SCREEN);
  });
});

describe('transformFromRect', () => {
  it('is the identity when the target already sits on the origin', () => {
    const rect: Rect = { x: 10, y: 20, width: 100, height: 50 };
    expect(transformFromRect(rect, rect)).toEqual({
      translateX: 0,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it('shrinks the full-screen image back onto the thumbnail', () => {
    const target: Rect = { x: 0, y: 300, width: 400, height: 200 };
    const origin: Rect = { x: 20, y: 100, width: 100, height: 50 };
    const t = transformFromRect(target, origin);

    expect(t.scaleX).toBe(0.25);
    expect(t.scaleY).toBe(0.25);
    // Centres must coincide: target centre (200, 400), origin centre (70, 125).
    expect(t.translateX).toBe(-130);
    expect(t.translateY).toBe(-275);
  });

  it('maps the transformed target centre exactly onto the origin centre', () => {
    const target: Rect = { x: 0, y: 250, width: 400, height: 300 };
    const origin: Rect = { x: 33, y: 210, width: 80, height: 60 };
    const t = transformFromRect(target, origin);

    const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    expect(targetCenter.x + t.translateX).toBeCloseTo(origin.x + origin.width / 2, 6);
    expect(targetCenter.y + t.translateY).toBeCloseTo(origin.y + origin.height / 2, 6);
  });

  it('does not divide by zero on an unmeasured target', () => {
    const t = transformFromRect({ x: 0, y: 0, width: 0, height: 0 }, SCREEN);
    expect(t.scaleX).toBe(1);
    expect(t.scaleY).toBe(1);
  });
});

describe('interpolateNumber', () => {
  it('hits both ends exactly', () => {
    expect(interpolateNumber(0, 10, 20)).toBe(10);
    expect(interpolateNumber(1, 10, 20)).toBe(20);
  });

  it('interpolates linearly in between', () => {
    expect(interpolateNumber(0.5, 10, 20)).toBe(15);
  });
});

describe('shouldAnimateFromOrigin', () => {
  const origin: Rect = { x: 0, y: 0, width: 100, height: 100 };

  it('animates from the thumbnail when it was measured', () => {
    expect(shouldAnimateFromOrigin(origin, false)).toBe(true);
  });

  it('cross-fades instead under reduce motion', () => {
    expect(shouldAnimateFromOrigin(origin, true)).toBe(false);
  });

  it('cross-fades rather than flying in from the corner when nothing was measured', () => {
    expect(shouldAnimateFromOrigin(null, false)).toBe(false);
    expect(shouldAnimateFromOrigin({ x: 0, y: 0, width: 0, height: 0 }, false)).toBe(false);
  });
});

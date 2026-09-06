# rn-zoom-next

**Tap to open, pinch to zoom, swipe to dismiss. The lightbox React Native never got.**

`react-native-lightbox` is installed about 143,000 times a week. It was last
published in December 2019, and its documentation still asks for a `navigator`
prop on Android "because Android doesn't have a Modal component yet" — a
sentence from React Native 0.19. `Modal` has worked on Android for ten years.

It also never gained the one feature everyone bolts on afterwards:
pinch-to-zoom.

> Independent community rewrite. Not affiliated with, nor endorsed by, the
> authors of react-native-lightbox.

---

## Migration

```diff
- import Lightbox from 'react-native-lightbox';
+ import { Zoom } from 'rn-zoom-next';
```

```diff
- <Lightbox navigator={navigator} activeProps={{ source: hiRes }}>
+ <Zoom activeProps={{ source: hiRes }}>
     <Image source={thumb} style={styles.thumb} />
- </Lightbox>
+ </Zoom>
```

Every prop of the original is supported under its original name, except one.

| | `react-native-lightbox` | `rn-zoom-next` |
|---|---|---|
| `navigator` prop | required on Android | **removed** — unnecessary since RN 0.20 |
| Pinch-to-zoom | not available | built in, with pan, double tap and zoom limits |
| Gallery | not available | `<ZoomGallery>` |
| Animation thread | JS thread | UI thread |
| Accessibility | none | trigger is an image button, overlay is modal to screen readers, close button is reachable |
| Reduce motion | ignored | respected — cross-fades in place instead of flying across the screen |
| Extra peer dependency | none | `react-native-gesture-handler` |
| Architecture | Paper (old) | New Architecture only |
| React Native | any | >= 0.78 |

### Installation

```sh
npm install rn-zoom-next react-native-reanimated react-native-worklets react-native-gesture-handler
```

---

## Gesture priority

This is the part that is hard to get right, and the reason most apps end up
writing their own viewer.

A vertical drag means two different things depending on the zoom level, and the
two have to hand over to each other at the edges of the image or the viewer feels
stuck. The rules `rn-zoom-next` uses:

| State | Drag | Result |
|---|---|---|
| Natural size | vertical | close the viewer |
| Natural size | horizontal | next / previous image (in a gallery) |
| Zoomed | any | move the image |
| Zoomed, at the left/right edge, dragging further out | horizontal | next / previous image |
| Zoomed, top edge in frame, dragging down | vertical | close the viewer |
| Zoomed, but no room to move in that axis | either | falls through to the natural-size meaning |

Two details that matter in the hand:

- The intent is decided **once**, on the first few points of a drag, and held for
  the rest of it. Re-deciding every frame is what makes a viewer feel like it is
  fighting you — cross the edge of a zoomed image mid-drag and the image would
  stop dead while the page started sliding under your finger.
- A short fast flick dismisses, but only if it goes the same way as the drag. Drag
  down, change your mind, flick back up, and the viewer stays open.

All of it is pure arithmetic in [`src/gestures.ts`](src/gestures.ts), and every
row of that table has a test in
[`test/gestures.test.ts`](test/gestures.test.ts).

---

## API

### `<Zoom>`

```tsx
import { Zoom } from 'rn-zoom-next';

<Zoom
  activeProps={{ source: fullResolution }}
  contentSize={{ width: 3000, height: 2000 }}
  accessibilityLabel="Photo of the harbour at dusk"
>
  <Image source={thumbnail} style={styles.thumb} />
</Zoom>
```

| Prop | Type | Default |
|---|---|---|
| `activeProps` | object | — |
| `renderHeader` | `(close) => ReactNode` | close button |
| `renderContent` | `() => ReactNode` | the trigger's children |
| `onOpen` / `didOpen` / `willClose` / `onClose` | `() => void` | — |
| `backgroundColor` | `string` | `'black'` |
| `underlayColor` | `string` | — |
| `swipeToDismiss` | `boolean` | `true` |
| `springConfig` | `{ damping, stiffness, mass }` | tuned default |
| `style` | style | — |
| `minZoom` | `number` | `1` |
| `maxZoom` | `number` | `4` |
| `doubleTapScale` | `number` | `min(maxZoom, 2)` |
| `dismissThreshold` | `number` (fraction of screen height) | `0.25` |
| `contentSize` | `{ width, height }` | window size |

`contentSize` is worth passing when you know it: it is what lets the viewer fit
the image properly and work out how far a zoomed image may be panned.

### `<ZoomGallery>`

```tsx
const [open, setOpen] = useState(false);

<ZoomGallery
  visible={open}
  images={photos.map((p) => ({ source: p.source, width: p.width, height: p.height }))}
  initialIndex={3}
  onClose={() => setOpen(false)}
  onIndexChange={setCurrent}
/>
```

| Prop | Type | Default |
|---|---|---|
| `images` | `{ source, width?, height?, accessibilityLabel?, key? }[]` | required |
| `initialIndex` | `number` | `0` |
| `visible` | `boolean` | `true` |
| `onClose` | `() => void` | — |
| `onIndexChange` | `(index: number) => void` | — |
| `renderHeader` | `(close, index) => ReactNode` | counter + close |
| plus `backgroundColor`, `swipeToDismiss`, `minZoom`, `maxZoom`, `doubleTapScale`, `dismissThreshold` | | |

Each page gets its own zoom state, and swiping to the next image resets it.

### Non-image content

`renderContent` takes anything. Zoom applies to the content whatever it is, and
swipe-to-dismiss keeps working — pass `minZoom === maxZoom` to turn zooming off
for content where it makes no sense.

---

## Accessibility

- the trigger is an `imagebutton` with a hint describing what opening does
- the overlay sets `accessibilityViewIsModal`, so screen readers cannot wander
  into the page behind it
- the close button is a real 44×44 button with a label, reachable by screen
  reader and by keyboard on web
- reduce motion replaces the position-and-size transition with a cross-fade in
  place, and removes the settle springs

---

## Example app

```sh
cd example
npm install
npx expo start
```

A grid of photos, a single zoomable image, and the gallery.

## Licence

MIT. See [NOTICE](NOTICE) for the relationship to react-native-lightbox.

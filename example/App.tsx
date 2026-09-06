import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Zoom, ZoomGallery } from 'rn-zoom';

/** Twenty deterministic placeholder photos, so the grid needs no assets. */
const PHOTOS = Array.from({ length: 20 }, (_, i) => ({
  key: `photo-${i}`,
  source: { uri: `https://picsum.photos/seed/rn-zoom-${i}/1200/800` },
  thumb: { uri: `https://picsum.photos/seed/rn-zoom-${i}/300/200` },
  width: 1200,
  height: 800,
  accessibilityLabel: `Placeholder photo ${i + 1} of 20`,
}));

export default function App() {
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const dark = useColorScheme() === 'dark';

  return (
    <GestureHandlerRootView style={styles.flex}>
      <View style={[styles.root, dark && styles.rootDark]}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.title, dark && styles.textDark]}>rn-zoom</Text>
          <Text style={styles.subtitle}>
            Tap a photo to open it. Pinch to zoom, drag to pan, swipe to close.
          </Text>

          <Text style={[styles.section, dark && styles.textDark]}>Single image</Text>
          <Zoom
            activeProps={{ source: PHOTOS[0]!.source, style: styles.fullImage }}
            contentSize={{ width: PHOTOS[0]!.width, height: PHOTOS[0]!.height }}
            accessibilityLabel={PHOTOS[0]!.accessibilityLabel}
          >
            <Image source={PHOTOS[0]!.thumb} style={styles.hero} />
          </Zoom>

          <Text style={[styles.section, dark && styles.textDark]}>
            Grid — tap to open the gallery
          </Text>
          <View style={styles.grid}>
            {PHOTOS.map((photo, index) => (
              <Pressable
                key={photo.key}
                onPress={() => setGalleryIndex(index)}
                accessibilityRole="imagebutton"
                accessibilityLabel={photo.accessibilityLabel}
                accessibilityHint="Opens the gallery"
              >
                <Image source={photo.thumb} style={styles.cell} />
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {galleryIndex !== null ? (
          <ZoomGallery
            images={PHOTOS}
            initialIndex={galleryIndex}
            onClose={() => setGalleryIndex(null)}
          />
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: '#faf9f7' },
  rootDark: { backgroundColor: '#141413' },
  scroll: { padding: 20, paddingTop: 64, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '700', color: '#141413' },
  subtitle: { fontSize: 14, color: '#63635e', marginTop: 4 },
  textDark: { color: '#f5f4ed' },
  section: { fontSize: 15, fontWeight: '600', marginTop: 28, marginBottom: 10, color: '#141413' },
  hero: { width: '100%', height: 200, borderRadius: 12 },
  fullImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: 104, height: 78, borderRadius: 8 },
});

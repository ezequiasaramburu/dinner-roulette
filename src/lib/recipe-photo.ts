import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

const BUCKET = 'recipe-photos';
const MAX_WIDTH = 1600;

export type PickedPhoto = { uri: string; width: number; height: number };

/** A photo from the camera or the library, cropped to 4:3, then shrunk to a JPEG that is light enough to upload. */
export async function pickRecipePhoto(source: 'camera' | 'library'): Promise<PickedPhoto | 'denied' | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return 'denied';
  }

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 1 };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  // Always resize (to the same width when it's already small): rendering an edit with no steps never finishes, and the
  // re-save is what turns a big HEIC or PNG into a light JPEG.
  context.resize({ width: Math.min(asset.width, MAX_WIDTH) });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Uploads into the person's own folder and returns the public URL to store on the recipe. */
export async function uploadRecipePhoto(userId: string, uri: string): Promise<string> {
  const bytes = await (await fetch(uri)).arrayBuffer();
  const path = `${userId}/${Crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function pathOf(url: string) {
  const marker = `/${BUCKET}/`;
  const at = url.indexOf(marker);
  return at < 0 ? null : url.slice(at + marker.length);
}

/** Best effort: a leftover file is harmless, so failures are ignored. */
export async function removeRecipePhoto(url: string | null) {
  const path = url ? pathOf(url) : null;
  if (path) await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
}

/** Every photo this person uploaded, for when they delete their account. */
export async function removeAllMyPhotos(userId: string) {
  try {
    // Each round removes what it listed, so the next list starts with the rest. Stops on an empty list or an error.
    for (let round = 0; round < 50; round++) {
      const { data, error } = await supabase.storage.from(BUCKET).list(userId, { limit: 100 });
      if (error || !data?.length) return;
      const { error: removeError } = await supabase.storage.from(BUCKET).remove(data.map((f) => `${userId}/${f.name}`));
      if (removeError) return;
    }
  } catch {
    // best effort
  }
}

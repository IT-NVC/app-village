import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';

/** Thu nhỏ ảnh (cạnh dài tối đa `max` px, JPEG 70%) rồi tải lên `bucket/path` */
export async function compressAndUpload(
  bucket: string,
  path: string,
  uri: string,
  width: number,
  height: number,
  max = 1280,
): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > max) ctx.resize(width >= height ? { width: max } : { height: max });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  const body = await (await fetch(saved.uri)).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw new Error(`Tải ảnh lên không thành công: ${error.message}`);
  return path;
}

/** Link xem ảnh trong kho riêng tư (hạn 1 giờ) */
export async function signedUrlsFor(bucket: string, paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

/** Tên file ngẫu nhiên */
export const randomName = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

import { REPORT_CATEGORY_LABEL, REPORT_STATUS_LABEL, type ReportCategory, type ReportStatus } from '@thon/shared';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { IconName } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export const BUCKET = 'report-images';
export const MAX_IMAGES = 3;

export type Report = {
  id: string;
  category: ReportCategory;
  title: string;
  description: string | null;
  images: string[];
  latitude: number | null;
  longitude: number | null;
  address_text: string | null;
  status: ReportStatus;
  rating: number | null;
  rating_comment: string | null;
  created_at: string;
  updated_at: string;
};

export const REPORT_SELECT =
  'id, category, title, description, images, latitude, longitude, address_text, status, rating, rating_comment, created_at, updated_at';

export const CATEGORY_STYLE: Record<ReportCategory, { label: string; icon: IconName; color: string; bg: string }> = {
  dien: { label: REPORT_CATEGORY_LABEL.dien, icon: 'flash', color: '#B26A00', bg: '#FFF4E0' },
  duong: { label: REPORT_CATEGORY_LABEL.duong, icon: 'trail-sign', color: '#795548', bg: '#F3ECE9' },
  nuoc: { label: REPORT_CATEGORY_LABEL.nuoc, icon: 'water', color: Colors.info, bg: Colors.infoSoft },
  ve_sinh: { label: REPORT_CATEGORY_LABEL.ve_sinh, icon: 'trash', color: Colors.primaryText, bg: Colors.primarySoft },
  an_ninh: { label: REPORT_CATEGORY_LABEL.an_ninh, icon: 'shield', color: Colors.purple, bg: Colors.purpleSoft },
  khac: { label: REPORT_CATEGORY_LABEL.khac, icon: 'ellipsis-horizontal-circle', color: Colors.textSecondary, bg: Colors.divider },
};

export const STATUS_STYLE: Record<ReportStatus, { label: string; icon: IconName; color: string; bg: string }> = {
  moi: { label: REPORT_STATUS_LABEL.moi, icon: 'paper-plane', color: Colors.info, bg: Colors.infoSoft },
  dang_xu_ly: { label: REPORT_STATUS_LABEL.dang_xu_ly, icon: 'construct', color: Colors.warning, bg: Colors.warningSoft },
  hoan_thanh: { label: REPORT_STATUS_LABEL.hoan_thanh, icon: 'checkmark-circle', color: Colors.success, bg: Colors.successSoft },
  tu_choi: { label: REPORT_STATUS_LABEL.tu_choi, icon: 'close-circle', color: Colors.danger, bg: Colors.dangerSoft },
};

/** Thu nhỏ ảnh (cạnh dài tối đa 1280px, JPEG 70%) rồi tải lên kho; trả về đường dẫn trong bucket */
export async function uploadReportImage(userId: string, uri: string, width: number, height: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  const longest = Math.max(width, height);
  if (longest > 1280) {
    ctx.resize(width >= height ? { width: 1280 } : { height: 1280 });
  }
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  const body = await (await fetch(saved.uri)).arrayBuffer();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw new Error(`Tải ảnh lên không thành công: ${error.message}`);
  return path;
}

/** Link xem ảnh (bucket riêng tư -> link có hạn 1 giờ) */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

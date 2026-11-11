import { REPORT_CATEGORY_LABEL, REPORT_STATUS_LABEL, type ReportCategory, type ReportStatus } from '@thon/shared';

import type { IconName } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { compressAndUpload, randomName, signedUrlsFor } from '@/lib/images';

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

/** Tải ảnh phản ánh vào thư mục của người gửi */
export function uploadReportImage(userId: string, uri: string, width: number, height: number) {
  return compressAndUpload(BUCKET, `${userId}/${randomName()}`, uri, width, height);
}

/** Link xem ảnh phản ánh (kho riêng tư) */
export const signedUrls = (paths: string[]) => signedUrlsFor(BUCKET, paths);

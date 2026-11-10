// Hệ thống thiết kế: thân thiện với người lớn tuổi — chữ to, nút to, tương phản đủ,
// màu xanh lá nhạt làm chủ đạo, font Be Vietnam Pro (hiển thị dấu tiếng Việt đẹp).
import { Platform, type ViewStyle } from 'react-native';

export const Colors = {
  /** Xanh lá nhạt: nền nút, logo, ô đang chọn (chữ trắng đặt lên trên) */
  primary: '#3BA56A',
  /** Xanh lá đậm hơn: chữ, icon, link trên nền sáng */
  primaryText: '#1F7A45',
  primaryDark: '#1B6B3C',
  primarySoft: '#E6F5EC',
  primaryBorder: '#BFE3CC',
  danger: '#D32F2F',
  dangerSoft: '#FDECEA',
  success: '#2E7D32',
  successSoft: '#E8F5E9',
  warning: '#B26A00',
  warningSoft: '#FFF4E0',
  info: '#1E63B8',
  infoSoft: '#E6F0FB',
  purple: '#6A3FB5',
  purpleSoft: '#F1EAFB',
  text: '#15201A',
  textSecondary: '#5B6660',
  textMuted: '#8A948E',
  border: '#D5DDD8',
  divider: '#EAEFEC',
  background: '#F4F8F5',
  card: '#FFFFFF',
  white: '#FFFFFF',
} as const;

/** Dải màu cho header */
export const Gradients = {
  primary: ['#2E9A5E', '#4DBA7E'] as const,
  danger: ['#E53935', '#C62828'] as const,
};

/** Tên font theo độ đậm (Android không tự làm đậm font tuỳ chỉnh, nên mỗi độ đậm là một font) */
export const Font = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
  extrabold: 'BeVietnamPro_800ExtraBold',
} as const;

export const FontSize = {
  caption: 14,
  small: 15,
  body: 17,
  large: 19,
  title: 24,
  hero: 28,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 28,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

/** Chiều cao tối thiểu của nút / ô nhập để dễ chạm */
export const TouchHeight = 56;

/** Bóng đổ mềm cho thẻ */
export const Shadow: Record<'sm' | 'md' | 'lg', ViewStyle> = {
  sm: Platform.select({
    android: { elevation: 2 },
    default: { shadowColor: '#0B3D22', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  })!,
  md: Platform.select({
    android: { elevation: 4 },
    default: { shadowColor: '#0B3D22', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  })!,
  lg: Platform.select({
    android: { elevation: 8 },
    default: { shadowColor: '#0B3D22', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  })!,
};

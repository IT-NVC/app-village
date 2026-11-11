import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const TOKEN_KEY = 'push_token';

/** Hiện thông báo cả khi app đang mở */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Push chỉ chạy trên bản build riêng (development / production build).
 * Expo Go không hỗ trợ push từ SDK 53 → bỏ qua để không báo lỗi khi đang lập trình.
 */
export const pushSupported = () =>
  Platform.OS !== 'web' && Device.isDevice && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

/** Xin quyền + đăng ký mã thiết bị cho người đang đăng nhập. Trả về lý do nếu không đăng ký được. */
export async function registerForPush(): Promise<string | null> {
  if (!pushSupported()) return 'Thiết bị / môi trường không hỗ trợ push (Expo Go, máy ảo hoặc web)';

  if (Platform.OS === 'android') {
    // Kênh "khẩn": SOS, thông báo khẩn — kêu to, rung mạnh, hiện đè lên màn hình
    await Notifications.setNotificationChannelAsync('urgent', {
      name: 'Khẩn cấp',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Thông báo chung',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'Người dùng chưa cho phép thông báo';

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return 'Chưa cấu hình EAS projectId (chạy: npx eas-cli init)';

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
  if (error) return error.message;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* bỏ qua */
  }
  return null;
}

/** Gọi trước khi đăng xuất: máy này thôi nhận thông báo của tài khoản */
export async function unregisterPush() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) await supabase.rpc('unregister_push_token', { p_token: token });
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* bỏ qua */
  }
}

export type NotifyKind =
  | 'announcement'
  | 'sos'
  | 'sos_update'
  | 'report_new'
  | 'report_update'
  | 'message'
  | 'poll'
  | 'event'
  | 'booking_new'
  | 'booking_review';

/** Báo máy chủ gửi push cho một sự kiện. Không chờ, không báo lỗi cho người dùng (push chỉ là phụ trợ). */
export function notifyEvent(kind: NotifyKind, id: string) {
  supabase.functions.invoke('notify', { body: { kind, id } }).catch(() => {});
}

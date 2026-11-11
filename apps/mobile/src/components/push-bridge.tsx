import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { registerForPush } from '@/lib/push';

/** Đăng ký push khi đã đăng nhập + mở đúng màn hình khi người dùng bấm vào thông báo */
export function PushBridge() {
  useEffect(() => {
    registerForPush().then((reason) => reason && console.log('Push:', reason));

    const open = (resp: Notifications.NotificationResponse | null) => {
      const url = resp?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
    };
    // App đang tắt hẳn, mở lên từ thông báo
    Notifications.getLastNotificationResponseAsync().then(open);
    // App đang chạy nền / đang mở
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
  return null;
}

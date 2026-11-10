import { Alert, Platform } from 'react-native';

/** Hộp thoại thông báo — chạy được cả Android/iOS và web (Alert.alert không hoạt động trên web) */
export function showInfo(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

/** Hộp thoại xác nhận */
export function confirmAction(
  title: string,
  message: string,
  okText: string,
  onOk: () => void,
  destructive = false,
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Huỷ', style: 'cancel' },
    { text: okText, style: destructive ? 'destructive' : 'default', onPress: onOk },
  ]);
}

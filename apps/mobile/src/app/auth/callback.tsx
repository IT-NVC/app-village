import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button, Notice, Txt } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { completeOAuth } from '@/lib/auth';

/**
 * Nơi Google / Supabase quay về sau khi đăng nhập (thonthongnhat://auth/callback, hoặc exp://…/--/auth/callback trong Expo Go).
 * Thường kết quả được bắt ngay trong signInWithGoogle(); màn hình này là đường dự phòng khi kết quả đi theo deep link.
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams();
    if (params.code) query.set('code', params.code);
    if (params.error_description) query.set('error_description', params.error_description);
    completeOAuth(`callback?${query.toString()}`).then((err) => {
      if (err) setError(err);
      // Đăng nhập xong: bộ điều hướng gốc tự chuyển màn hình theo trạng thái tài khoản
      else router.replace('/');
    });
  }, [params.code, params.error_description]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.lg, gap: Spacing.md, backgroundColor: Colors.background }}>
      {error ? (
        <>
          <Notice text={error} />
          <Button title="Quay lại đăng nhập" onPress={() => router.replace('/')} />
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Txt variant="body" center color={Colors.textSecondary}>
            Đang hoàn tất đăng nhập…
          </Txt>
        </>
      )}
    </View>
  );
}

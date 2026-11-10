import { BeVietnamPro_400Regular } from '@expo-google-fonts/be-vietnam-pro/400Regular';
import { BeVietnamPro_500Medium } from '@expo-google-fonts/be-vietnam-pro/500Medium';
import { BeVietnamPro_600SemiBold } from '@expo-google-fonts/be-vietnam-pro/600SemiBold';
import { BeVietnamPro_700Bold } from '@expo-google-fonts/be-vietnam-pro/700Bold';
import { BeVietnamPro_800ExtraBold } from '@expo-google-fonts/be-vietnam-pro/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button, EmptyState, Loading } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
    BeVietnamPro_800ExtraBold,
  });

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        {/* Lỗi tải font thì vẫn chạy bằng font hệ thống */}
        {fontsLoaded || fontError ? <RootNavigator /> : null}
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { phase, refreshMe, signOut } = useAuth();

  useEffect(() => {
    if (phase !== 'loading') SplashScreen.hideAsync();
  }, [phase]);

  if (phase === 'loading') return <Loading />;

  if (phase === 'error') {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, padding: Spacing.lg, justifyContent: 'center' }}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Không tải được thông tin"
          message="Vui lòng kiểm tra kết nối mạng rồi thử lại."
          action={
            <View style={{ alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.md }}>
              <Button title="Thử lại" icon="refresh" onPress={refreshMe} />
              <Button title="Đăng xuất" variant="ghost" onPress={signOut} />
            </View>
          }
        />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
      <Stack.Protected guard={phase === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'onboarding'}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'waiting'}>
        <Stack.Screen name="waiting" />
      </Stack.Protected>
      <Stack.Protected guard={phase === 'active'}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

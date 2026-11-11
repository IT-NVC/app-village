import { BeVietnamPro_400Regular } from '@expo-google-fonts/be-vietnam-pro/400Regular';
import { BeVietnamPro_500Medium } from '@expo-google-fonts/be-vietnam-pro/500Medium';
import { BeVietnamPro_600SemiBold } from '@expo-google-fonts/be-vietnam-pro/600SemiBold';
import { BeVietnamPro_700Bold } from '@expo-google-fonts/be-vietnam-pro/700Bold';
import { BeVietnamPro_800ExtraBold } from '@expo-google-fonts/be-vietnam-pro/800ExtraBold';
import { useFonts } from 'expo-font';
import { router, Stack, useRootNavigationState, useSegments, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PushBridge } from '@/components/push-bridge';
import { Button, EmptyState, Loading } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { AnnouncementsProvider } from '@/lib/announcements';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ChatProvider } from '@/lib/chat';
import { ManageProvider } from '@/lib/manage';

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

/** Nhóm màn hình được phép ở từng trạng thái tài khoản, và màn hình "nhà" khi đang ở chỗ không hợp lệ */
const PHASE_ROUTES: Record<'signedOut' | 'onboarding' | 'waiting', { allowed: string[]; home: Href }> = {
  signedOut: { allowed: ['(auth)', 'auth'], home: '/login' },
  onboarding: { allowed: ['(onboarding)', 'auth'], home: '/activate' },
  waiting: { allowed: ['waiting', 'auth'], home: '/waiting' },
};
const PRE_ACTIVE_GROUPS = ['(auth)', '(onboarding)', 'waiting'];

function RootNavigator() {
  const { phase, me, refreshMe, signOut } = useAuth();
  const segments = useSegments();
  const navReady = !!useRootNavigationState()?.key;

  useEffect(() => {
    if (phase !== 'loading') SplashScreen.hideAsync();
  }, [phase]);

  // Khi trạng thái tài khoản đổi (đăng ký xong, được duyệt, đăng xuất…), chỉ định rõ màn hình cần mở.
  // Không để bộ điều hướng tự về "/" — "/" là Trang chủ, chỉ mở được khi tài khoản đã hoạt động.
  useEffect(() => {
    if (!navReady || phase === 'loading' || phase === 'error') return;
    const top = segments[0] as string | undefined;
    const notFound = !top || top.startsWith('+') || top.startsWith('[');
    if (phase === 'active') {
      if (notFound || PRE_ACTIVE_GROUPS.includes(top)) router.replace('/');
      return;
    }
    const rule = PHASE_ROUTES[phase];
    if (notFound || !rule.allowed.includes(top)) router.replace(rule.home);
  }, [phase, segments, navReady]);

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
    <AnnouncementsProvider userId={phase === 'active' ? (me?.id ?? null) : null}>
      <ChatProvider enabled={phase === 'active'}>
      <ManageProvider>
      {phase === 'active' && <PushBridge />}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        {/* Nơi đăng nhập Google quay về — luôn mở được, không phụ thuộc trạng thái đăng nhập */}
        <Stack.Screen name="auth/callback" />
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
          <Stack.Screen name="announcement/[id]" />
          <Stack.Screen name="sos" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="report/new" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="report/[id]" />
          <Stack.Screen name="news/index" />
          <Stack.Screen name="news/[id]" />
          <Stack.Screen name="group/[id]/index" />
          <Stack.Screen name="group/[id]/members" />
          <Stack.Screen name="polls/index" />
          <Stack.Screen name="polls/[id]" />
          <Stack.Screen name="profile-edit" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="calendar" />
          <Stack.Screen name="booking/new" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="funds/index" />
          <Stack.Screen name="funds/[id]" />
          {/* Khu cán bộ (mỗi màn hình tự kiểm quyền; CSDL cũng chặn) */}
          <Stack.Screen name="manage/sos" />
          <Stack.Screen name="manage/approvals" />
          <Stack.Screen name="manage/reports" />
          <Stack.Screen name="manage/report/[id]" />
          <Stack.Screen name="manage/announce" />
          <Stack.Screen name="manage/bookings" />
          <Stack.Screen name="manage/fund" />
          <Stack.Screen name="manage/residents" />
          <Stack.Screen name="manage/resident/[id]" />
          <Stack.Screen name="manage/accounts" />
          <Stack.Screen name="manage/account/[id]" />
          <Stack.Screen name="manage/areas" />
          <Stack.Screen name="manage/orgs" />
          <Stack.Screen name="manage/org/[id]" />
          <Stack.Screen name="manage/chats" />
          <Stack.Screen name="manage/chat-admin/[id]" />
          <Stack.Screen name="manage/news" />
          <Stack.Screen name="manage/news-edit/[id]" />
          <Stack.Screen name="manage/announcements" />
          <Stack.Screen name="manage/announcement/[id]" />
          <Stack.Screen name="manage/polls" />
          <Stack.Screen name="manage/poll-new" />
          <Stack.Screen name="manage/poll/[id]" />
          <Stack.Screen name="manage/events" />
          <Stack.Screen name="manage/event/[id]" />
          <Stack.Screen name="manage/venues" />
          <Stack.Screen name="manage/funds" />
          <Stack.Screen name="manage/fund-info/[id]" />
          <Stack.Screen name="manage/settings" />
          <Stack.Screen name="manage/audit" />
        </Stack.Protected>
      </Stack>
      </ManageProvider>
      </ChatProvider>
    </AnnouncementsProvider>
  );
}

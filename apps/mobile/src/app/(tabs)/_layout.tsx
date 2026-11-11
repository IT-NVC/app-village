import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui';
import { Colors, Font, Shadow } from '@/constants/theme';
import { useAnnouncements } from '@/lib/announcements';
import { useChat } from '@/lib/chat';

const tabs: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Trang chủ', icon: 'home-outline', iconActive: 'home' },
  { name: 'notifications', title: 'Thông báo', icon: 'notifications-outline', iconActive: 'notifications' },
  { name: 'reports', title: 'Phản ánh', icon: 'construct-outline', iconActive: 'construct' },
  { name: 'chat', title: 'Tin nhắn', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
  { name: 'profile', title: 'Cá nhân', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useAnnouncements();
  const { totalUnread } = useChat();
  const badges: Record<string, number> = { notifications: unreadCount, chat: totalUnread };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: Colors.background },
        tabBarActiveTintColor: Colors.primaryText,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontFamily: Font.semibold, fontSize: 12.5, marginTop: 2 },
        tabBarStyle: {
          height: 70 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
          borderTopWidth: 0,
          backgroundColor: Colors.white,
          ...Shadow.lg,
        },
      }}>
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarBadge: badges[t.name] ? (badges[t.name] > 99 ? '99+' : badges[t.name]) : undefined,
            tabBarBadgeStyle: { backgroundColor: Colors.danger, fontFamily: Font.bold, fontSize: 11 },
            tabBarIcon: ({ color, focused }) => (
              // Viên nền nhạt phía sau icon của tab đang chọn
              <View
                style={{
                  width: 56,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused ? Colors.primarySoft : 'transparent',
                }}>
                <Ionicons name={focused ? t.iconActive : t.icon} size={24} color={color as string} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

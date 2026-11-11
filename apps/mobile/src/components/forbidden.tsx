import { router } from 'expo-router';
import { View } from 'react-native';

import { EmptyState, PageHeader } from '@/components/ui';
import { Colors } from '@/constants/theme';

/** Màn hình báo không có quyền (cho các màn hình của khu cán bộ) */
export function Forbidden({ message = 'Chức năng này dành cho cán bộ thôn.' }: { message?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader title="Quản lý" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <EmptyState icon="lock-closed-outline" title="Không có quyền" message={message} />
    </View>
  );
}

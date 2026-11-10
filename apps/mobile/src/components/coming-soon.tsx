import { View } from 'react-native';

import { EmptyState, PageHeader, type IconName } from '@/components/ui';
import { Colors } from '@/constants/theme';

/** Màn hình tạm cho các tính năng đang xây dựng */
export function ComingSoon({ title, subtitle, icon, message }: { title: string; subtitle?: string; icon: IconName; message?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader title={title} subtitle={subtitle} />
      <EmptyState icon={icon} title="Sắp ra mắt" message={message ?? 'Tính năng đang được xây dựng, bà con vui lòng quay lại sau.'} />
    </View>
  );
}

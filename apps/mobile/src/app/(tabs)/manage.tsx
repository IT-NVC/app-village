import { Ionicons } from '@expo/vector-icons';
import { LEADERSHIP_ROLE_LABEL } from '@thon/shared';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Card, EmptyState, IconCircle, PageHeader, Txt, type IconName } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useManageCounts, useRank } from '@/lib/manage';

type Item = { key: string; icon: IconName; label: string; desc: string; to: Href; color: string; bg: string; count?: number; minRank?: number };

export default function ManageScreen() {
  const { me } = useAuth();
  const rank = useRank();
  const { counts, refresh } = useManageCounts();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  if (rank < 1) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <PageHeader title="Quản lý" />
        <EmptyState icon="lock-closed-outline" title="Chỉ dành cho cán bộ thôn" />
      </View>
    );
  }

  const items: Item[] = [
    { key: 'sos', icon: 'alert-circle', label: 'Khẩn cấp (SOS)', desc: 'Tiếp nhận, gọi điện, xem vị trí', to: '/manage/sos', color: Colors.danger, bg: Colors.dangerSoft, count: counts.sos },
    { key: 'acc', icon: 'person-add', label: 'Duyệt tài khoản', desc: 'Người dân tự khai báo', to: '/manage/approvals', color: Colors.info, bg: Colors.infoSoft, count: counts.accounts },
    { key: 'rep', icon: 'construct', label: 'Phản ánh', desc: 'Cập nhật xử lý, ghi chú', to: '/manage/reports', color: Colors.purple, bg: Colors.purpleSoft, count: counts.reports, minRank: 2 },
    { key: 'ann', icon: 'megaphone', label: 'Gửi thông báo', desc: 'Toàn thôn hoặc theo khu', to: '/manage/announce', color: Colors.warning, bg: Colors.warningSoft },
    { key: 'bk', icon: 'calendar', label: 'Đặt nhà văn hoá', desc: 'Duyệt yêu cầu đặt lịch', to: '/manage/bookings', color: '#00796B', bg: '#E0F2F1', count: counts.bookings },
    { key: 'fund', icon: 'wallet', label: 'Ghi thu chi quỹ', desc: 'Chụp phiếu thu bằng camera', to: '/manage/fund', color: '#5D4037', bg: '#EFEBE9' },
  ];
  const visible = items.filter((i) => rank >= (i.minRank ?? 1));
  // SOS đang chờ luôn nổi lên đầu và đổi màu
  const sosAlert = counts.sos > 0;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader
        title="Quản lý"
        subtitle={`${me?.leadership_role ? LEADERSHIP_ROLE_LABEL[me.leadership_role] : ''} · ${me?.full_name ?? ''}`}
      />
      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[Colors.primary]}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
          />
        }>
        {sosAlert && (
          <Pressable onPress={() => router.push('/manage/sos')} style={styles.sosAlert} accessibilityRole="button">
            <Ionicons name="alert-circle" size={36} color={Colors.white} />
            <View style={{ flex: 1 }}>
              <Txt variant="subtitle" color={Colors.white}>
                {counts.sos} tín hiệu khẩn cấp đang chờ
              </Txt>
              <Txt variant="small" color="rgba(255,255,255,0.92)">
                Bấm để xem vị trí và tiếp nhận ngay
              </Txt>
            </View>
            <Ionicons name="chevron-forward" size={26} color={Colors.white} />
          </Pressable>
        )}

        {visible.map((i) => (
          <Pressable
            key={i.key}
            onPress={() => router.push(i.to)}
            accessibilityRole="button"
            accessibilityLabel={`${i.label}${i.count ? `, ${i.count} việc đang chờ` : ''}`}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.85 }]}>
            <IconCircle icon={i.icon} color={i.color} bg={i.bg} size={56} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">{i.label}</Txt>
              <Txt variant="caption" color={Colors.textSecondary}>
                {i.desc}
              </Txt>
            </View>
            {i.count ? (
              <View style={[styles.count, { backgroundColor: i.key === 'sos' ? Colors.danger : Colors.primary }]}>
                <Txt variant="caption" color={Colors.white} style={{ fontFamily: Font.bold }}>
                  {i.count}
                </Txt>
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
          </Pressable>
        ))}

        <Card style={{ flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.primarySoft }}>
          <Ionicons name="desktop-outline" size={22} color={Colors.primaryText} />
          <Txt variant="small" color={Colors.primaryDark} style={{ flex: 1 }}>
            Nhập danh sách nhân khẩu, in phiếu mã, phân quyền, tạo khảo sát, xuất báo cáo… làm trên trang quản trị (máy tính).
          </Txt>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sosAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.danger,
    ...Shadow.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  count: { minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
});

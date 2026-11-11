import { Ionicons } from '@expo/vector-icons';
import { LEADERSHIP_ROLE_LABEL } from '@thon/shared';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Card, EmptyState, IconCircle, PageHeader, Txt, type IconName } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useManageCounts, useRank } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

type Item = { key: string; icon: IconName; label: string; desc: string; to: Href; color: string; bg: string; count?: number; minRank?: number };
type Section = { title: string; items: Item[] };

async function head(table: 'profiles' | 'residents', apply: (q: any) => any) {
  const { count } = await apply(supabase.from(table).select('id', { count: 'exact', head: true }));
  return (count as number | null) ?? 0;
}

async function fetchOverview() {
  const [active, residents, notActivated] = await Promise.all([
    head('profiles', (q) => q.eq('status', 'active')),
    head('residents', (q) => q),
    head('residents', (q) => q.not('activation_code', 'is', null)),
  ]);
  return { active, residents, notActivated };
}

export default function ManageScreen() {
  const { me } = useAuth();
  const rank = useRank();
  const { counts, refresh } = useManageCounts();
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchOverview>> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
      if (rank >= 1) fetchOverview().then(setOverview);
    }, [refresh, rank]),
  );

  if (rank < 1) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <PageHeader title="Quản lý" />
        <EmptyState icon="lock-closed-outline" title="Chỉ dành cho cán bộ thôn" />
      </View>
    );
  }

  const sections: Section[] = [
    {
      title: 'Cần xử lý',
      items: [
        { key: 'sos', icon: 'alert-circle', label: 'Khẩn cấp (SOS)', desc: 'Tiếp nhận, gọi điện, xem vị trí', to: '/manage/sos', color: Colors.danger, bg: Colors.dangerSoft, count: counts.sos },
        { key: 'acc', icon: 'person-add', label: 'Duyệt tài khoản', desc: 'Người dân tự khai báo', to: '/manage/approvals', color: Colors.info, bg: Colors.infoSoft, count: counts.accounts },
        { key: 'rep', icon: 'construct', label: 'Phản ánh', desc: 'Cập nhật xử lý, ghi chú', to: '/manage/reports', color: Colors.purple, bg: Colors.purpleSoft, count: counts.reports, minRank: 2 },
        { key: 'bk', icon: 'calendar', label: 'Đặt nhà văn hoá / sân', desc: 'Duyệt, huỷ lịch', to: '/manage/bookings', color: '#00796B', bg: '#E0F2F1', count: counts.bookings },
      ],
    },
    {
      title: 'Người dân',
      items: [
        { key: 'res', icon: 'people', label: 'Nhân khẩu', desc: 'Thêm, sửa, mã kích hoạt', to: '/manage/residents', color: Colors.primaryText, bg: Colors.primarySoft },
        { key: 'accs', icon: 'shield-checkmark', label: 'Tài khoản & phân quyền', desc: 'Chức vụ, khoá, đặt lại mật khẩu', to: '/manage/accounts', color: Colors.info, bg: Colors.infoSoft },
      ],
    },
    {
      title: 'Thông tin cho bà con',
      items: [
        { key: 'ann', icon: 'megaphone', label: 'Gửi thông báo', desc: 'Toàn thôn, khu, ban ngành, hẹn giờ', to: '/manage/announce', color: Colors.warning, bg: Colors.warningSoft },
        { key: 'anns', icon: 'mail-open', label: 'Thông báo đã gửi', desc: 'Ai đã đọc, ai chưa', to: '/manage/announcements', color: Colors.warning, bg: Colors.warningSoft },
        { key: 'news', icon: 'newspaper', label: 'Tin tức', desc: 'Viết, đăng, ghim tin', to: '/manage/news', color: Colors.primaryText, bg: Colors.primarySoft },
        { key: 'poll', icon: 'hand-left', label: 'Biểu quyết', desc: 'Lấy ý kiến, xem kết quả', to: '/manage/polls', color: '#C2185B', bg: '#FCE4EC' },
        { key: 'ev', icon: 'calendar-number', label: 'Sự kiện', desc: 'Lịch họp, lễ hội, thu gom rác', to: '/manage/events', color: '#00796B', bg: '#E0F2F1' },
      ],
    },
    {
      title: 'Khu vực & nhóm chat',
      items: [
        { key: 'area', icon: 'map', label: 'Khu vực', desc: 'Tạo khu, nhóm chat của khu', to: '/manage/areas', color: Colors.primaryText, bg: Colors.primarySoft },
        { key: 'org', icon: 'git-network', label: 'Ban ngành đoàn thể', desc: 'Thành viên, trưởng ban', to: '/manage/orgs', color: Colors.info, bg: Colors.infoSoft },
        { key: 'chat', icon: 'chatbubbles', label: 'Nhóm chat', desc: 'Tạo nhóm, quản lý, kiểm duyệt', to: '/manage/chats', color: Colors.purple, bg: Colors.purpleSoft },
      ],
    },
    {
      title: 'Quỹ & địa điểm',
      items: [
        { key: 'fundnew', icon: 'add-circle', label: 'Ghi thu chi nhanh', desc: 'Chụp phiếu thu bằng camera', to: '/manage/fund', color: '#5D4037', bg: '#EFEBE9' },
        { key: 'funds', icon: 'wallet', label: 'Quỹ thôn', desc: 'Số dư, hộ góp, hộ chưa góp', to: '/manage/funds', color: '#5D4037', bg: '#EFEBE9' },
        { key: 'venue', icon: 'business', label: 'Địa điểm cho đặt lịch', desc: 'Nhà văn hoá, sân thể thao', to: '/manage/venues', color: '#00796B', bg: '#E0F2F1' },
      ],
    },
    {
      title: 'Hệ thống',
      items: [
        { key: 'set', icon: 'settings', label: 'Cài đặt & danh bạ', desc: 'Chế độ chờ duyệt, số điện thoại', to: '/manage/settings', color: Colors.textSecondary, bg: Colors.divider },
        { key: 'audit', icon: 'document-text', label: 'Nhật ký thao tác', desc: 'Ai đã làm gì', to: '/manage/audit', color: Colors.textSecondary, bg: Colors.divider, minRank: 2 },
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader title="Quản lý" subtitle={`${me?.leadership_role ? LEADERSHIP_ROLE_LABEL[me.leadership_role] : ''} · ${me?.full_name ?? ''}`} />
      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[Colors.primary]}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([refresh(), fetchOverview().then(setOverview)]);
              setRefreshing(false);
            }}
          />
        }>
        {counts.sos > 0 && (
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

        {overview && (
          <Card style={{ flexDirection: 'row', ...Shadow.sm }}>
            <Stat value={overview.active} label="Tài khoản hoạt động" />
            <Stat value={overview.residents} label="Nhân khẩu" />
            <Stat value={overview.notActivated} label="Chưa kích hoạt" warn />
          </Card>
        )}

        {sections.map((sec) => {
          const items = sec.items.filter((i) => rank >= (i.minRank ?? 1));
          if (items.length === 0) return null;
          return (
            <View key={sec.title} style={{ gap: Spacing.sm }}>
              <Txt variant="subtitle" style={{ marginTop: Spacing.xs }}>
                {sec.title}
              </Txt>
              {items.map((i) => (
                <Pressable
                  key={i.key}
                  onPress={() => router.push(i.to)}
                  accessibilityRole="button"
                  accessibilityLabel={`${i.label}${i.count ? `, ${i.count} việc đang chờ` : ''}`}
                  style={({ pressed }) => [styles.item, pressed && { opacity: 0.85 }]}>
                  <IconCircle icon={i.icon} color={i.color} bg={i.bg} size={48} />
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
                  <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                </Pressable>
              ))}
            </View>
          );
        })}

        <Card style={{ flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.primarySoft }}>
          <Ionicons name="desktop-outline" size={22} color={Colors.primaryText} />
          <Txt variant="small" color={Colors.primaryDark} style={{ flex: 1 }}>
            Chỉ còn các việc nhập / xuất số liệu hàng loạt làm trên trang quản trị (máy tính): nhập danh sách nhân khẩu từ Excel, in hàng loạt phiếu mã kích hoạt, xuất CSV báo cáo quỹ.
          </Txt>
        </Card>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', padding: Spacing.md, gap: 2 }}>
      <Txt variant="title" color={warn && value > 0 ? Colors.warning : Colors.primaryText}>
        {value.toLocaleString('vi-VN')}
      </Txt>
      <Txt variant="caption" color={Colors.textSecondary} center>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  sosAlert: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Colors.danger, ...Shadow.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  count: { minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
});

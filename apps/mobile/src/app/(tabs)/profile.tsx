import { LEADERSHIP_ROLE_LABEL, ORG_ROLE_LABEL } from '@thon/shared';
import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Chip, GradientHeader, ListRow, ScrollPage, SectionTitle, Txt } from '@/components/ui';
import { Colors, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { confirmAction } from '@/lib/dialog';

export default function ProfileScreen() {
  const { me, session, signOut } = useAuth();
  const isGoogle = !me?.username;

  return (
    <ScrollPage
      overlap={36}
      header={
        <GradientHeader extraBottom={44} style={{ alignItems: 'center' }}>
          <View style={styles.avatarWrap}>
            <Avatar name={me?.full_name} size={96} light />
          </View>
          <Txt variant="title" color={Colors.white} center>
            {me?.full_name ?? 'Chưa có tên'}
          </Txt>
          <View style={styles.chips}>
            {me?.leadership_role ? <Chip light icon="ribbon-outline" text={LEADERSHIP_ROLE_LABEL[me.leadership_role]} /> : <Chip light icon="person-outline" text="Người dân" />}
            {me?.area_name ? <Chip light icon="location-outline" text={me.area_name} /> : null}
          </View>
        </GradientHeader>
      }>
      <Card style={styles.card}>
        <ListRow icon="person-outline" title="Họ và tên" subtitle={me?.full_name ?? '—'} />
        <ListRow
          icon={isGoogle ? 'logo-google' : 'at'}
          title={isGoogle ? 'Tài khoản Google' : 'Tên đăng nhập'}
          subtitle={isGoogle ? session?.user.email : me?.username}
        />
        <ListRow icon="call-outline" title="Số điện thoại" subtitle={me?.phone ?? 'Chưa cập nhật'} />
        <ListRow icon="location-outline" title="Khu" subtitle={me?.area_name ?? '—'} divider={false} />
      </Card>

      {me?.orgs.length ? (
        <>
          <SectionTitle title="Ban ngành đoàn thể" />
          <Card style={styles.card}>
            {me.orgs.map((o, i) => (
              <ListRow
                key={o.org_id}
                icon="people-outline"
                iconColor={Colors.info}
                iconBg={Colors.infoSoft}
                title={o.name}
                subtitle={ORG_ROLE_LABEL[o.role]}
                divider={i < me.orgs.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}

      <Button
        title="Đăng xuất"
        variant="dangerOutline"
        icon="log-out-outline"
        style={{ marginTop: Spacing.sm }}
        onPress={() => confirmAction('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', 'Đăng xuất', signOut, true)}
      />
      <Txt variant="caption" color={Colors.textMuted} center>
        Thôn Thống Nhất · Phiên bản {Constants.expoConfig?.version ?? '1.0.0'}
      </Txt>
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  // Không đặt bóng đổ ở đây: avatar nền trong suốt sẽ lộ bóng hình bát giác trên Android
  avatarWrap: { marginTop: Spacing.sm, marginBottom: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  card: { paddingVertical: Spacing.xs, ...Shadow.md },
});

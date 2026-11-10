import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, GradientHeader, IconCircle, ScrollPage, Txt } from '@/components/ui';
import { Colors, Gradients, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

const steps = [
  { icon: 'checkmark', title: 'Đã gửi thông tin' },
  { icon: 'time', title: 'Cán bộ thôn xác nhận' },
  { icon: 'happy', title: 'Bắt đầu sử dụng ứng dụng' },
] as const;

export default function WaitingScreen() {
  const { me, refreshMe, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const locked = me?.status === 'locked';

  return (
    <ScrollPage
      overlap={40}
      header={
        <GradientHeader extraBottom={48} colors={locked ? Gradients.danger : Gradients.primary}>
          <View style={styles.headerIcon}>
            <IconCircle
              icon={locked ? 'lock-closed' : 'hourglass'}
              color={locked ? Colors.danger : Colors.warning}
              bg={Colors.white}
              size={64}
            />
          </View>
          <Txt variant="hero" color={Colors.white}>
            {locked ? 'Tài khoản đã bị khoá' : 'Đang chờ duyệt'}
          </Txt>
          <Txt variant="body" color="rgba(255,255,255,0.9)">
            {locked ? 'Vui lòng liên hệ cán bộ thôn' : `Cảm ơn ${me?.full_name ?? 'bạn'} đã đăng ký`}
          </Txt>
        </GradientHeader>
      }>
      {!locked && (
        <Card style={styles.card}>
          {steps.map((s, i) => {
            const done = i === 0;
            const current = i === 1;
            return (
              <View key={s.title} style={styles.step}>
                <View style={{ alignItems: 'center' }}>
                  <IconCircle
                    icon={s.icon}
                    size={40}
                    color={done ? Colors.white : current ? Colors.warning : Colors.textMuted}
                    bg={done ? Colors.primary : current ? Colors.warningSoft : Colors.divider}
                  />
                  {i < steps.length - 1 && <View style={styles.stepLine} />}
                </View>
                <Txt
                  variant="bodyStrong"
                  color={done || current ? Colors.text : Colors.textMuted}
                  style={{ paddingTop: 8, flex: 1 }}>
                  {s.title}
                </Txt>
              </View>
            );
          })}
          <Txt variant="small" color={Colors.textSecondary} style={{ marginTop: Spacing.sm }}>
            Cán bộ thôn sẽ xác nhận thông tin của bạn sớm nhất. Bạn có thể quay lại kiểm tra sau.
          </Txt>
        </Card>
      )}

      {!locked && (
        <Button
          title="Kiểm tra lại"
          icon="refresh"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            await refreshMe();
            setBusy(false);
          }}
        />
      )}
      <Button title="Đăng xuất" variant="ghost" icon="log-out-outline" onPress={signOut} />
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  headerIcon: { marginTop: Spacing.md, marginBottom: Spacing.md, alignSelf: 'flex-start', borderRadius: 32, ...Shadow.md },
  card: { padding: Spacing.lg, gap: Spacing.xs, ...Shadow.md },
  step: { flexDirection: 'row', gap: Spacing.md },
  stepLine: { width: 2, height: 22, backgroundColor: Colors.divider, marginVertical: 2 },
});

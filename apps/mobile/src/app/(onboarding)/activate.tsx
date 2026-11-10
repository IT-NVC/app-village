import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, GradientHeader, IconCircle, Notice, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function ActivateScreen() {
  const { me, refreshMe, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onActivate() {
    const clean = code.replace(/\s/g, '').toUpperCase();
    if (clean.length !== 8) return setError('Mã kích hoạt gồm 8 ký tự.');
    setError(null);
    setBusy(true);
    const { data, error: rpcErr } = await supabase.rpc('activate_account', { p_code: clean });
    const result = data as { ok: boolean; error?: string } | null;
    if (rpcErr || !result?.ok) {
      setBusy(false);
      return setError(result?.error ?? rpcErr?.message ?? 'Kích hoạt không thành công.');
    }
    await refreshMe(); // chuyển vào app
  }

  return (
    <ScrollPage
      overlap={40}
      header={
        <GradientHeader extraBottom={48}>
          <View style={styles.headerIcon}>
            <IconCircle icon="key" color={Colors.primary} bg={Colors.white} size={64} />
          </View>
          <Txt variant="hero" color={Colors.white}>
            Kích hoạt tài khoản
          </Txt>
          <Txt variant="body" color="rgba(255,255,255,0.9)">
            Bước cuối cùng để sử dụng ứng dụng của thôn
          </Txt>
        </GradientHeader>
      }>
      {me?.status === 'rejected' && (
        <Notice
          tone="warning"
          text={`Hồ sơ khai báo trước đó chưa được duyệt${me.reject_reason ? `: ${me.reject_reason}` : '.'} Bạn có thể nhập mã hoặc khai báo lại.`}
        />
      )}

      <Card style={styles.card}>
        <Txt variant="subtitle">Nhập mã kích hoạt</Txt>
        <Txt variant="small" color={Colors.textSecondary}>
          Mã gồm 8 ký tự, in trên phiếu do cán bộ thôn phát.
        </Txt>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="--------"
          placeholderTextColor={Colors.border}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onActivate}
          accessibilityLabel="Mã kích hoạt"
          style={[styles.codeInput, focused && { borderColor: Colors.primary, backgroundColor: '#FBFEFC' }]}
        />
        <Notice text={error} />
        <Button
          title="Kích hoạt"
          icon="checkmark-circle-outline"
          onPress={onActivate}
          loading={busy}
          disabled={code.length !== 8}
        />
      </Card>

      <Card style={styles.card}>
        <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
          <IconCircle icon="document-text-outline" color={Colors.info} bg={Colors.infoSoft} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">Chưa có mã kích hoạt?</Txt>
            <Txt variant="small" color={Colors.textSecondary}>
              Tự khai báo thông tin để cán bộ thôn xác nhận.
            </Txt>
          </View>
        </View>
        <Button title="Tự khai báo thông tin" variant="secondary" icon="create-outline" onPress={() => router.push('/declare')} />
      </Card>

      <Button title="Đăng xuất" variant="ghost" icon="log-out-outline" onPress={signOut} />
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  headerIcon: { marginTop: Spacing.md, marginBottom: Spacing.md, alignSelf: 'flex-start', borderRadius: 32, ...Shadow.md },
  card: { padding: Spacing.lg, gap: Spacing.md, ...Shadow.md },
  codeInput: {
    height: 72,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    textAlign: 'center',
    fontFamily: Font.bold,
    fontSize: 30,
    letterSpacing: 8,
    color: Colors.text,
  },
});

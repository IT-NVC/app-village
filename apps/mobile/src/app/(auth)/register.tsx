import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Field, IconCircle, Notice, PageHeader, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export default function RegisterScreen() {
  const { signUpWithUsername } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (password.length < 6) return setError('Mật khẩu phải có ít nhất 6 ký tự.');
    if (password !== confirm) return setError('Mật khẩu nhập lại không khớp.');
    setError(null);
    setBusy(true);
    const err = await signUpWithUsername(username, password);
    setBusy(false);
    if (err) setError(err);
    // Thành công: tự đăng nhập, app chuyển sang bước kích hoạt
  }

  return (
    <ScrollPage header={<PageHeader title="Tạo tài khoản" subtitle="Chỉ mất 1 phút" onBack={() => router.back()} />}>
      <Card style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center', backgroundColor: Colors.primarySoft }}>
        <IconCircle icon="information" color={Colors.white} bg={Colors.primary} size={40} />
        <Txt variant="small" color={Colors.primaryDark} style={{ flex: 1 }}>
          Sau khi tạo tài khoản, bạn nhập <Txt variant="small" color={Colors.primaryDark} style={{ fontFamily: Font.bold }}>mã kích hoạt</Txt> do cán bộ thôn cấp, hoặc tự khai báo thông tin.
        </Txt>
      </Card>

      <Card style={{ gap: Spacing.md, padding: Spacing.lg }}>
        <Field
          label="Tên đăng nhập"
          icon="person-outline"
          placeholder="VD: nguyenvana"
          hint="Chữ thường không dấu, số, dấu chấm hoặc gạch dưới"
          value={username}
          onChangeText={(t) => setUsername(t.toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field label="Mật khẩu" icon="lock-closed-outline" hint="Ít nhất 6 ký tự" value={password} onChangeText={setPassword} secure />
        <Field
          label="Nhập lại mật khẩu"
          icon="shield-checkmark-outline"
          value={confirm}
          onChangeText={setConfirm}
          secure
          onSubmitEditing={onSubmit}
        />
        <Notice text={error} />
        <View style={{ marginTop: Spacing.xs }}>
          <Button title="Tạo tài khoản" icon="person-add-outline" onPress={onSubmit} loading={busy} />
        </View>
      </Card>
    </ScrollPage>
  );
}

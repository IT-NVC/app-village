import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Field, GradientHeader, Notice, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { showInfo } from '@/lib/dialog';

export default function LoginScreen() {
  const { signInWithUsername, signInWithGoogle } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'password' | 'google' | null>(null);

  async function onLogin() {
    if (!username.trim() || !password) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }
    setError(null);
    setBusy('password');
    const err = await signInWithUsername(username, password);
    setBusy(null);
    if (err) setError(err);
  }

  async function onGoogle() {
    setError(null);
    setBusy('google');
    const err = await signInWithGoogle();
    setBusy(null);
    if (err) setError(err);
  }

  return (
    <ScrollPage
      overlap={56}
      header={
        <GradientHeader extraBottom={72} style={{ alignItems: 'center' }}>
          <View style={styles.logo}>
            <Image source={require('@/assets/images/logo-mark.png')} style={{ width: 64, height: 64 }} contentFit="contain" accessibilityLabel="Logo Thôn Thống Nhất" />
          </View>
          <Txt variant="hero" color={Colors.white} center>
            Thôn Thống Nhất
          </Txt>
          <Txt variant="body" color="rgba(255,255,255,0.9)" center>
            Xã Sóc Sơn
          </Txt>
        </GradientHeader>
      }>
      <Card style={styles.card}>
        <Txt variant="title">Đăng nhập</Txt>
        <Txt variant="small" color={Colors.textSecondary} style={{ marginTop: -6 }}>
          Chào mừng bà con đến với ứng dụng của thôn
        </Txt>

        <Button
          title="Đăng nhập bằng Google"
          variant="secondary"
          onPress={onGoogle}
          loading={busy === 'google'}
          disabled={busy !== null}
          icon="logo-google"
          style={{ marginTop: Spacing.sm }}
        />

        <View style={styles.divider}>
          <View style={styles.line} />
          <Txt variant="caption" color={Colors.textMuted}>
            hoặc dùng tên đăng nhập
          </Txt>
          <View style={styles.line} />
        </View>

        <Field
          label="Tên đăng nhập"
          icon="person-outline"
          placeholder="VD: nguyenvana"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          returnKeyType="next"
        />
        <Field
          label="Mật khẩu"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          secure
          autoComplete="password"
          returnKeyType="go"
          onSubmitEditing={onLogin}
        />

        <Pressable
          style={{ alignSelf: 'flex-end' }}
          hitSlop={10}
          onPress={() => showInfo('Quên mật khẩu', 'Vui lòng liên hệ cán bộ thôn để được đặt lại mật khẩu.')}>
          <Txt variant="label" color={Colors.primaryText}>
            Quên mật khẩu?
          </Txt>
        </Pressable>

        <Notice text={error} />

        <Button
          title="Đăng nhập"
          icon="log-in-outline"
          onPress={onLogin}
          loading={busy === 'password'}
          disabled={busy !== null}
        />
      </Card>

      <View style={styles.footer}>
        <Txt variant="body" color={Colors.textSecondary}>
          Chưa có tài khoản?
        </Txt>
        <Pressable onPress={() => router.push('/register')} hitSlop={10} accessibilityRole="link">
          <Txt variant="body" color={Colors.primaryText} style={{ fontFamily: Font.bold }}>
            Đăng ký ngay
          </Txt>
        </Pressable>
      </View>
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  card: { padding: Spacing.lg, gap: Spacing.md, ...Shadow.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: Colors.divider },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm },
});

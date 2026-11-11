import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Field, Notice, PageHeader, ScrollPage, Txt } from '@/components/ui';
import { Colors, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { compressAndUpload, randomName } from '@/lib/images';
import { supabase } from '@/lib/supabase';

export default function ProfileEditScreen() {
  const { me, refreshMe } = useAuth();
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [avatar, setAvatar] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAvatar(fromCamera: boolean) {
    setError(null);
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError('Chưa có quyền dùng camera.');
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.8 };
    const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled) {
      const a = res.assets[0];
      setAvatar({ uri: a.uri, width: a.width, height: a.height });
    }
  }

  async function save() {
    if (!me) return;
    const cleanPhone = phone.replace(/\s/g, '');
    if (cleanPhone && !/^0\d{9}$/.test(cleanPhone)) return setError('Số điện thoại gồm 10 số, bắt đầu bằng 0.');
    setBusy(true);
    setError(null);
    try {
      let avatarUrl: string | undefined;
      if (avatar) {
        const path = await compressAndUpload('avatars', `${me.id}/${randomName()}`, avatar.uri, avatar.width, avatar.height, 512);
        avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }
      const { error: err } = await supabase.rpc('update_my_profile', {
        p_avatar_url: avatarUrl,
        p_phone: cleanPhone !== (me.phone ?? '') ? cleanPhone : undefined,
      });
      if (err) throw new Error(err.message);
      await refreshMe();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <ScrollPage header={<PageHeader title="Sửa thông tin" onBack={() => router.back()} />}>
      <Card style={[styles.card, { alignItems: 'center' }]}>
        <Avatar name={me?.full_name} url={avatar?.uri ?? me?.avatar_url} size={120} />
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <PickBtn icon="camera" label="Chụp ảnh" onPress={() => pickAvatar(true)} />
          <PickBtn icon="images" label="Chọn ảnh" onPress={() => pickAvatar(false)} />
        </View>
        <Txt variant="caption" color={Colors.textSecondary} center>
          Ảnh đại diện giúp mọi người nhận ra bạn trong nhóm chat.
        </Txt>
      </Card>

      <Card style={styles.card}>
        <Field label="Họ và tên" icon="person-outline" value={me?.full_name ?? ''} editable={false} hint="Muốn đổi họ tên, vui lòng liên hệ cán bộ thôn." />
        <Field
          label="Số điện thoại"
          icon="call-outline"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={11}
          placeholder="VD: 0912345678"
          hint="Cán bộ thôn dùng số này để liên lạc khi cần."
        />
      </Card>

      <Notice text={error} />
      <Button title="Lưu thay đổi" icon="checkmark" onPress={save} loading={busy} />
    </ScrollPage>
  );
}

function PickBtn({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pick, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={Colors.primaryText} />
      <Txt variant="label" color={Colors.primaryText}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
  },
});

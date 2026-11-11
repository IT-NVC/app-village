import { Ionicons } from '@expo/vector-icons';
import type { ReportCategory } from '@thon/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Field, IconCircle, Notice, PageHeader, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { notifyEvent } from '@/lib/push';
import { CATEGORY_STYLE, MAX_IMAGES, uploadReportImage } from '@/lib/reports';
import { supabase } from '@/lib/supabase';

type Picked = { uri: string; width: number; height: number };
type Coords = { latitude: number; longitude: number };

const CATEGORIES = Object.keys(CATEGORY_STYLE) as ReportCategory[];

/** Lấy vị trí hiện tại (chờ tối đa 10 giây, không được thì dùng vị trí gần nhất) */
async function getCoords(): Promise<Coords | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((r) => setTimeout(() => r(null), 10000)),
    ]).catch(() => null);
    const p = pos ?? (await Location.getLastKnownPositionAsync().catch(() => null));
    return p ? { latitude: p.coords.latitude, longitude: p.coords.longitude } : null;
  } catch {
    return null;
  }
}

export default function NewReportScreen() {
  const { me } = useAuth();
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [images, setImages] = useState<Picked[]>([]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function locate() {
    setLocating(true);
    const c = await getCoords();
    if (c) setCoords(c);
    setLocating(false);
  }

  // Tự lấy vị trí khi mở màn hình (thường người dân đang đứng tại chỗ có sự cố)
  useEffect(() => {
    getCoords().then((c) => {
      if (c) setCoords(c);
      setLocating(false);
    });
  }, []);

  async function pick(fromCamera: boolean) {
    setError(null);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError('Chưa có quyền dùng camera. Vào Cài đặt điện thoại để cấp quyền.');
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: 'images',
      quality: 0.8,
      allowsMultipleSelection: !fromCamera,
      selectionLimit: remaining,
    };
    const res = fromCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (res.canceled) return;
    setImages((prev) =>
      [...prev, ...res.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }))].slice(0, MAX_IMAGES),
    );
  }

  async function submit() {
    if (!me) return;
    if (!category) return setError('Vui lòng chọn loại sự cố.');
    if (title.trim().length < 5) return setError('Vui lòng ghi ngắn gọn sự cố (ít nhất 5 ký tự).');
    setError(null);
    try {
      const paths: string[] = [];
      for (let i = 0; i < images.length; i++) {
        setBusy(`Đang tải ảnh ${i + 1}/${images.length}…`);
        paths.push(await uploadReportImage(me.id, images[i].uri, images[i].width, images[i].height));
      }
      setBusy('Đang gửi…');
      const { data, error: err } = await supabase
        .from('reports')
        .insert({
          reporter_id: me.id,
          category,
          title: title.trim(),
          description: description.trim() || null,
          images: paths,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          address_text: address.trim() || null,
        })
        .select('id')
        .single();
      if (err) throw new Error(err.message);
      notifyEvent('report_new', data.id);
      router.replace({ pathname: '/report/[id]', params: { id: data.id, created: '1' } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <ScrollPage header={<PageHeader title="Gửi phản ánh" subtitle="Gửi thẳng tới Bí thư thôn" onBack={() => router.back()} />}>
      <Card style={styles.card}>
        <Txt variant="subtitle">1. Loại sự cố</Txt>
        <View style={styles.grid}>
          {CATEGORIES.map((c) => {
            const s = CATEGORY_STYLE[c];
            const selected = category === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={s.label}
                style={[styles.cat, selected && { borderColor: s.color, backgroundColor: s.bg }]}>
                <IconCircle icon={s.icon} color={s.color} bg={selected ? Colors.white : s.bg} size={44} />
                <Txt variant="caption" center color={Colors.text} style={{ fontFamily: selected ? Font.bold : Font.medium }}>
                  {s.label}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={styles.card}>
        <Txt variant="subtitle">2. Mô tả</Txt>
        <Field
          label="Sự cố là gì?"
          placeholder="VD: Đèn đường ngõ 3 bị hỏng"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
        />
        <Field
          label="Chi tiết (không bắt buộc)"
          placeholder="Hỏng từ khi nào, ảnh hưởng thế nào…"
          value={description}
          onChangeText={setDescription}
          multiline
          style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 14 }}
        />
      </Card>

      <Card style={styles.card}>
        <Txt variant="subtitle">3. Ảnh ({images.length}/{MAX_IMAGES})</Txt>
        {images.length > 0 && (
          <View style={styles.thumbs}>
            {images.map((img, i) => (
              <View key={img.uri} style={styles.thumbWrap}>
                <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
                <Pressable
                  onPress={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  accessibilityLabel="Bỏ ảnh"
                  hitSlop={8}
                  style={styles.remove}>
                  <Ionicons name="close" size={18} color={Colors.white} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {images.length < MAX_IMAGES && (
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <Button title="Chụp ảnh" icon="camera" variant="secondary" onPress={() => pick(true)} style={{ flex: 1 }} />
            <Button title="Chọn ảnh" icon="images" variant="secondary" onPress={() => pick(false)} style={{ flex: 1 }} />
          </View>
        )}
      </Card>

      <Card style={styles.card}>
        <Txt variant="subtitle">4. Vị trí</Txt>
        <View style={styles.locRow}>
          <IconCircle
            icon={coords ? 'location' : 'location-outline'}
            color={coords ? Colors.success : Colors.textMuted}
            bg={coords ? Colors.successSoft : Colors.divider}
            size={44}
          />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">{locating ? 'Đang lấy vị trí…' : coords ? 'Đã lấy vị trí hiện tại' : 'Chưa có vị trí'}</Txt>
            <Txt variant="caption" color={Colors.textSecondary}>
              {coords ? 'Cán bộ sẽ xem được trên bản đồ' : 'Bạn có thể ghi địa chỉ bên dưới'}
            </Txt>
          </View>
          <Pressable onPress={locate} disabled={locating} hitSlop={10} accessibilityRole="button">
            <Txt variant="label" color={Colors.primaryText}>
              Lấy lại
            </Txt>
          </Pressable>
        </View>
        <Field
          label="Địa chỉ / mô tả vị trí"
          icon="map-outline"
          placeholder="VD: Ngõ 3, gần nhà văn hoá Khu A"
          value={address}
          onChangeText={setAddress}
        />
      </Card>

      <Notice text={error} />
      <Button title={busy ?? 'Gửi phản ánh'} icon="send" onPress={submit} loading={!!busy && busy === 'Đang gửi…'} disabled={!!busy} />
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cat: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    paddingHorizontal: 4,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.divider,
    backgroundColor: Colors.card,
  },
  thumbs: { flexDirection: 'row', gap: Spacing.sm },
  thumbWrap: { width: 96, height: 96 },
  thumb: { width: 96, height: 96, borderRadius: Radius.md, backgroundColor: Colors.divider },
  remove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});

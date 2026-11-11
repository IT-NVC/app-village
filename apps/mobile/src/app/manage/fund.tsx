import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Forbidden } from '@/components/forbidden';
import { Button, Card, Choice, Field, Notice, PageHeader, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { RECEIPT_BUCKET, vnd } from '@/lib/funds';
import { compressAndUpload, randomName } from '@/lib/images';
import { useRank } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

type FundOpt = { id: string; name: string; balance: number };
type Household = { id: string; code: string | null; head_name: string; area_name: string | null };

const QUICK = [50000, 100000, 200000, 500000, 1000000];
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function ManageFundScreen() {
  const rank = useRank();
  const { me } = useAuth();
  const [funds, setFunds] = useState<FundOpt[] | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [fundId, setFundId] = useState<string | null>(null);
  const [kind, setKind] = useState<'thu' | 'chi'>('thu');
  const [amount, setAmount] = useState(0);
  const [day, setDay] = useState<'0' | '1' | '2'>('0');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [household, setHousehold] = useState<Household | null>(null);
  const [payer, setPayer] = useState('');
  const [receipt, setReceipt] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('fund_summaries').then(({ data }) => {
      const active = (data ?? []).filter((f) => f.is_active).map((f) => ({ id: f.id, name: f.name, balance: f.balance }));
      setFunds(active);
      if (active.length === 1) setFundId(active[0].id);
    });
    supabase.rpc('household_options').then(({ data }) => setHouseholds(data ?? []));
  }, []);

  const matches = useMemo(() => {
    const q = norm(search);
    if (q.length < 2) return [];
    return households.filter((h) => norm(`${h.head_name} ${h.code ?? ''}`).includes(q)).slice(0, 6);
  }, [search, households]);

  if (rank < 1) return <Forbidden />;

  async function pickReceipt(camera: boolean) {
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError('Chưa có quyền dùng camera.');
    }
    const res = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (!res.canceled) setReceipt({ uri: res.assets[0].uri, width: res.assets[0].width, height: res.assets[0].height });
  }

  async function save() {
    if (!me || !fundId) return setError('Vui lòng chọn quỹ.');
    if (amount <= 0) return setError('Vui lòng nhập số tiền.');
    if (!description.trim()) return setError('Vui lòng ghi nội dung.');
    setBusy(true);
    setError(null);
    try {
      const receipt_path = receipt
        ? await compressAndUpload(RECEIPT_BUCKET, `${fundId}/${randomName()}`, receipt.uri, receipt.width, receipt.height, 1800)
        : null;
      const { error: err } = await supabase.from('fund_transactions').insert({
        fund_id: fundId,
        kind,
        amount,
        occurred_on: isoDay(Number(day)),
        description: description.trim(),
        household_id: kind === 'thu' ? household?.id ?? null : null,
        payer_name: payer.trim() || null,
        receipt_path,
        created_by: me.id,
      });
      if (err) throw new Error(err.message);
      setDone(`Đã ghi ${kind === 'thu' ? 'khoản thu' : 'khoản chi'} ${vnd(amount)}${household && kind === 'thu' ? ` của hộ ${household.head_name}` : ''}.`);
      setAmount(0);
      setDescription('');
      setHousehold(null);
      setSearch('');
      setPayer('');
      setReceipt(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <ScrollPage header={<PageHeader title="Ghi thu chi quỹ" subtitle="Mọi người dân xem được — ghi chính xác" onBack={() => router.back()} />}>
      {done && <Notice tone="success" text={done} />}
      <Card style={styles.card}>
        {funds === null ? (
          <ActivityIndicator color={Colors.primary} />
        ) : funds.length === 0 ? (
          <Notice tone="warning" text="Chưa có quỹ nào đang hoạt động. Tạo quỹ trên trang quản trị." />
        ) : (
          <Choice label="Quỹ" options={funds.map((f) => ({ value: f.id, label: f.name }))} value={fundId} onChange={setFundId} />
        )}
        <Choice<'thu' | 'chi'>
          label="Loại"
          options={[
            { value: 'thu', label: '⬇ Khoản thu' },
            { value: 'chi', label: '⬆ Khoản chi' },
          ]}
          value={kind}
          onChange={setKind}
        />
      </Card>

      <Card style={styles.card}>
        <Txt variant="label">Số tiền</Txt>
        <View style={styles.amountRow}>
          <TextInput
            value={amount ? amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
            onChangeText={(t) => setAmount(Number(t.replace(/\D/g, '')) || 0)}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={Colors.border}
            style={[styles.amount, { color: kind === 'thu' ? Colors.success : Colors.danger }]}
            accessibilityLabel="Số tiền"
          />
          <Txt variant="title" color={Colors.textSecondary}>
            đ
          </Txt>
        </View>
        <View style={styles.quick}>
          {QUICK.map((q) => (
            <Pressable key={q} onPress={() => setAmount((a) => a + q)} style={styles.quickBtn} accessibilityRole="button" accessibilityLabel={`Cộng ${vnd(q)}`}>
              <Txt variant="caption" color={Colors.primaryText} style={{ fontFamily: Font.semibold }}>
                +{q >= 1e6 ? `${q / 1e6} triệu` : `${q / 1000}k`}
              </Txt>
            </Pressable>
          ))}
          {amount > 0 && (
            <Pressable onPress={() => setAmount(0)} style={[styles.quickBtn, { borderColor: '#F3C2C2' }]} accessibilityRole="button">
              <Txt variant="caption" color={Colors.danger} style={{ fontFamily: Font.semibold }}>
                Xoá
              </Txt>
            </Pressable>
          )}
        </View>
        <Choice<'0' | '1' | '2'>
          label="Ngày"
          options={[
            { value: '0', label: 'Hôm nay' },
            { value: '1', label: 'Hôm qua' },
            { value: '2', label: 'Hôm kia' },
          ]}
          value={day}
          onChange={setDay}
        />
        <Field
          label="Nội dung"
          placeholder={kind === 'thu' ? 'VD: Đóng góp làm đường đợt 1' : 'VD: Mua 50 bao xi măng'}
          value={description}
          onChangeText={setDescription}
        />
      </Card>

      {kind === 'thu' && (
        <Card style={styles.card}>
          <Txt variant="label">Hộ đóng góp</Txt>
          {household ? (
            <View style={styles.selected}>
              <Ionicons name="home" size={20} color={Colors.primaryText} />
              <Txt variant="bodyStrong" style={{ flex: 1 }}>
                Hộ {household.head_name}
                <Txt variant="small" color={Colors.textSecondary}>
                  {[household.code, household.area_name].filter(Boolean).map((x) => ` · ${x}`).join('')}
                </Txt>
              </Txt>
              <Pressable onPress={() => setHousehold(null)} hitSlop={10} accessibilityLabel="Bỏ chọn hộ">
                <Ionicons name="close-circle" size={24} color={Colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <>
              <Field label="" icon="search" placeholder="Gõ tên chủ hộ hoặc mã hộ (không cần dấu)" value={search} onChangeText={setSearch} />
              {matches.map((h) => (
                <Pressable
                  key={h.id}
                  onPress={() => {
                    setHousehold(h);
                    setSearch('');
                  }}
                  style={({ pressed }) => [styles.match, pressed && { backgroundColor: Colors.primarySoft }]}>
                  <Txt variant="bodyStrong">Hộ {h.head_name}</Txt>
                  <Txt variant="caption" color={Colors.textSecondary}>
                    {[h.code, h.area_name].filter(Boolean).join(' · ')}
                  </Txt>
                </Pressable>
              ))}
              {search.length >= 2 && matches.length === 0 && (
                <Txt variant="small" color={Colors.textMuted}>
                  Không tìm thấy hộ. Có thể ghi tên người nộp bên dưới.
                </Txt>
              )}
            </>
          )}
        </Card>
      )}

      <Card style={styles.card}>
        <Field
          label={kind === 'chi' ? 'Người nhận / nơi bán (nếu có)' : 'Người nộp (nếu không thuộc hộ nào)'}
          value={payer}
          onChangeText={setPayer}
        />
        <Txt variant="label">Ảnh chứng từ</Txt>
        {receipt ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
            <Image source={{ uri: receipt.uri }} style={styles.receipt} contentFit="cover" />
            <Button title="Bỏ ảnh" variant="dangerOutline" onPress={() => setReceipt(null)} style={{ flex: 1 }} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <Button title="Chụp phiếu" icon="camera" variant="secondary" onPress={() => pickReceipt(true)} style={{ flex: 1 }} />
            <Button title="Chọn ảnh" icon="images" variant="secondary" onPress={() => pickReceipt(false)} style={{ flex: 1 }} />
          </View>
        )}
      </Card>

      <Notice text={error} />
      <Button
        title={amount ? `Ghi ${kind === 'thu' ? 'thu' : 'chi'} ${vnd(amount)}` : 'Ghi sổ'}
        icon="checkmark-circle"
        variant={kind === 'chi' ? 'danger' : 'primary'}
        onPress={save}
        loading={busy}
      />
    </ScrollPage>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderBottomWidth: 2, borderBottomColor: Colors.divider },
  amount: { flex: 1, fontFamily: Font.extrabold, fontSize: 36, paddingVertical: 6 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primaryBorder },
  selected: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.primarySoft },
  match: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.md, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  receipt: { width: 80, height: 80, borderRadius: Radius.md, backgroundColor: Colors.divider },
});


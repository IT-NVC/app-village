import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Forbidden } from '@/components/forbidden';
import { Button, Card, Choice, Field, Notice, PageHeader, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { confirmAction, showInfo } from '@/lib/dialog';
import { RECEIPT_BUCKET, vnd } from '@/lib/funds';
import { compressAndUpload, randomName, signedUrlsFor } from '@/lib/images';
import { friendlyError, norm, toVnDate } from '@/lib/manage-data';
import { useRank } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

type FundOpt = { id: string; name: string; balance: number };
type Household = { id: string; code: string | null; head_name: string; area_name: string | null };
type Day = '0' | '1' | '2' | 'keep';

const QUICK = [50000, 100000, 200000, 500000, 1000000];
const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Ghi thu / chi nhanh. Mở với ?fund=<mã quỹ> để chọn sẵn quỹ;
 * mở với ?tx=<mã khoản> để SỬA hoặc XOÁ một khoản đã ghi (nhật ký lưu lại số cũ).
 */
export default function ManageFundScreen() {
  const params = useLocalSearchParams<{ fund?: string; tx?: string }>();
  const editingId = params.tx;
  const rank = useRank();
  const { me } = useAuth();
  const [funds, setFunds] = useState<FundOpt[] | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [fundId, setFundId] = useState<string | null>(params.fund ?? null);
  const [kind, setKind] = useState<'thu' | 'chi'>('thu');
  const [amount, setAmount] = useState(0);
  const [day, setDay] = useState<Day>(editingId ? 'keep' : '0');
  const [oldDate, setOldDate] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [household, setHousehold] = useState<Household | null>(null);
  const [payer, setPayer] = useState('');
  const [receipt, setReceipt] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [oldReceipt, setOldReceipt] = useState<{ path: string; url: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [s, h, t] = await Promise.all([
        supabase.rpc('fund_summaries'),
        supabase.rpc('household_options'),
        editingId
          ? supabase.from('fund_transactions').select('id, fund_id, kind, amount, occurred_on, description, household_id, payer_name, receipt_path').eq('id', editingId).single()
          : Promise.resolve(null),
      ]);
      const active = (s.data ?? []).filter((f) => f.is_active || f.id === t?.data?.fund_id).map((f) => ({ id: f.id, name: f.name, balance: f.balance }));
      const hh = h.data ?? [];
      setFunds(active);
      setHouseholds(hh);
      if (t?.data) {
        const x = t.data;
        setFundId(x.fund_id);
        setKind(x.kind);
        setAmount(x.amount);
        setDescription(x.description);
        setOldDate(x.occurred_on);
        setPayer(x.payer_name ?? '');
        setHousehold(hh.find((y) => y.id === x.household_id) ?? null);
        if (x.receipt_path) {
          const urls = await signedUrlsFor(RECEIPT_BUCKET, [x.receipt_path]);
          setOldReceipt({ path: x.receipt_path, url: urls[x.receipt_path] ?? null });
        }
      } else if (!params.fund && active.length === 1) {
        setFundId(active[0].id);
      }
    })();
  }, [editingId, params.fund]);

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
      let receipt_path: string | null = oldReceipt?.path ?? null;
      if (receipt) receipt_path = await compressAndUpload(RECEIPT_BUCKET, `${fundId}/${randomName()}`, receipt.uri, receipt.width, receipt.height, 1800);
      const payload = {
        kind,
        amount,
        occurred_on: day === 'keep' && oldDate ? oldDate : isoDay(day === 'keep' ? 0 : Number(day)),
        description: description.trim(),
        household_id: kind === 'thu' ? (household?.id ?? null) : null,
        payer_name: payer.trim() || null,
        receipt_path,
      };
      if (editingId) {
        const { error: err } = await supabase.from('fund_transactions').update(payload).eq('id', editingId);
        if (err) throw new Error(err.message);
        router.back();
        return;
      }
      const { error: err } = await supabase.from('fund_transactions').insert({ ...payload, fund_id: fundId, created_by: me.id });
      if (err) throw new Error(err.message);
      setDone(`Đã ghi ${kind === 'thu' ? 'khoản thu' : 'khoản chi'} ${vnd(amount)}${household && kind === 'thu' ? ` của hộ ${household.head_name}` : ''}.`);
      setAmount(0);
      setDescription('');
      setHousehold(null);
      setSearch('');
      setPayer('');
      setReceipt(null);
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : String(e)));
    }
    setBusy(false);
  }

  function remove() {
    if (!editingId) return;
    confirmAction('Xoá khoản này?', `${vnd(amount)} · ${description}\nNhật ký vẫn lưu lại khoản đã xoá.`, 'Xoá', async () => {
      const { error: err } = await supabase.from('fund_transactions').delete().eq('id', editingId);
      if (err) return showInfo('Không xoá được', friendlyError(err.message));
      router.back();
    }, true);
  }

  const title = editingId ? 'Sửa khoản thu chi' : 'Ghi thu chi quỹ';
  return (
    <ScrollPage header={<PageHeader title={title} subtitle="Mọi người dân xem được — ghi chính xác" onBack={() => (router.canGoBack() ? router.back() : router.replace('/manage'))} />}>
      {done && <Notice tone="success" text={done} />}
      <Card style={styles.card}>
        {funds === null ? (
          <ActivityIndicator color={Colors.primary} />
        ) : funds.length === 0 ? (
          <Notice tone="warning" text="Chưa có quỹ nào đang hoạt động. Tạo quỹ ở mục Quỹ thôn." />
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
        <Choice<Day>
          label="Ngày"
          options={[
            ...(editingId && oldDate ? [{ value: 'keep' as Day, label: `Giữ ${toVnDate(oldDate)}` }] : []),
            { value: '0', label: 'Hôm nay' },
            { value: '1', label: 'Hôm qua' },
            { value: '2', label: 'Hôm kia' },
          ]}
          value={day}
          onChange={setDay}
        />
        <Field label="Nội dung" placeholder={kind === 'thu' ? 'VD: Đóng góp làm đường đợt 1' : 'VD: Mua 50 bao xi măng'} value={description} onChangeText={setDescription} />
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
        <Field label={kind === 'chi' ? 'Người nhận / nơi bán (nếu có)' : 'Người nộp (nếu không thuộc hộ nào)'} value={payer} onChangeText={setPayer} />
        <Txt variant="label">Ảnh chứng từ</Txt>
        {receipt || oldReceipt ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
            <Image source={receipt ? { uri: receipt.uri } : oldReceipt?.url ? { uri: oldReceipt.url } : undefined} style={styles.receipt} contentFit="cover" />
            <View style={{ flex: 1, gap: Spacing.sm }}>
              <Button title="Chụp lại" icon="camera" variant="secondary" onPress={() => pickReceipt(true)} />
              <Button
                title="Bỏ ảnh"
                variant="dangerOutline"
                onPress={() => {
                  setReceipt(null);
                  setOldReceipt(null);
                }}
              />
            </View>
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
        title={editingId ? 'Lưu thay đổi' : amount ? `Ghi ${kind === 'thu' ? 'thu' : 'chi'} ${vnd(amount)}` : 'Ghi sổ'}
        icon="checkmark-circle"
        variant={kind === 'chi' ? 'danger' : 'primary'}
        onPress={save}
        loading={busy}
      />
      {editingId && <Button title="Xoá khoản này" icon="trash" variant="dangerOutline" onPress={remove} />}
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
  receipt: { width: 96, height: 96, borderRadius: Radius.md, backgroundColor: Colors.divider },
});

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';

import { Async, FormSheet, ManageList, ManageShell, PillTabs, RowCard, ToggleRow, useLoad } from '@/components/manage-kit';
import { Button, Card, Field, IconButton, Notice, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { confirmAction, showInfo } from '@/lib/dialog';
import { vnd } from '@/lib/funds';
import { fetchAreas, friendlyError, toVnDate } from '@/lib/manage-data';
import { supabase } from '@/lib/supabase';

async function load(id: string, areaFilter: string) {
  const [s, tx, contrib, missing, areas] = await Promise.all([
    supabase.rpc('fund_summaries'),
    supabase.rpc('fund_transactions_view', { p_fund_id: id }),
    supabase.rpc('fund_household_contributions', { p_fund_id: id }),
    supabase.rpc('fund_missing_households', { p_fund_id: id, p_area_id: areaFilter === 'all' ? undefined : areaFilter }),
    fetchAreas(),
  ]);
  const fund = (s.data ?? []).find((f) => f.id === id);
  if (!fund) throw new Error('Không tìm thấy quỹ');
  return { fund, txs: tx.data ?? [], contribs: contrib.data ?? [], missing: missing.data ?? [], areas };
}

type Tab = 'tx' | 'contrib' | 'missing';
type Loaded = Awaited<ReturnType<typeof load>>;
/** Gắn nhãn loại dòng để TypeScript phân biệt được ba danh sách */
type Line =
  | ({ t: 'tx' } & Loaded['txs'][number])
  | ({ t: 'contrib' } & Loaded['contribs'][number])
  | ({ t: 'missing' } & Loaded['missing'][number]);

function lines(d: Loaded, tab: Tab): Line[] {
  if (tab === 'tx') return d.txs.map((x) => ({ t: 'tx' as const, ...x }));
  if (tab === 'contrib') return d.contribs.map((x) => ({ t: 'contrib' as const, ...x }));
  return d.missing.map((x) => ({ t: 'missing' as const, ...x }));
}

export default function FundInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('tx');
  const [area, setArea] = useState('all');
  const state = useLoad(() => load(id, area), `${id}-${area}`);

  const [edit, setEdit] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [target, setTarget] = useState(0);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const f = state.data?.fund;

  function openEdit() {
    if (!f) return;
    setName(f.name);
    setDesc(f.description ?? '');
    setTarget(f.target_amount ?? 0);
    setActive(f.is_active);
    setError(null);
    setEdit(true);
  }

  async function saveEdit() {
    if (!name.trim()) return setError('Vui lòng nhập tên quỹ.');
    setBusy(true);
    const { error: err } = await supabase.from('funds').update({ name: name.trim(), description: desc.trim() || null, target_amount: target || null, is_active: active }).eq('id', id);
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    setEdit(false);
    await state.reload();
  }

  function removeFund() {
    confirmAction(`Xoá quỹ "${f?.name}"?`, 'Toàn bộ thu chi của quỹ sẽ bị xoá. Chỉ nên xoá quỹ tạo nhầm.', 'Xoá', async () => {
      const { error: err } = await supabase.from('funds').delete().eq('id', id);
      if (err) return showInfo('Không xoá được', friendlyError(err.message));
      router.back();
    }, true);
  }

  return (
    <ManageShell title={f?.name ?? 'Quỹ'} right={f ? <IconButton icon="create-outline" label="Sửa quỹ" onPress={openEdit} /> : undefined}>
      <Async state={state}>
        {(d) => (
          <>
            <ManageList
              state={state}
              data={lines(d, tab)}
              keyOf={(r) => (r.t === 'tx' ? r.id : r.household_id)}
              empty={{ icon: 'receipt-outline', title: tab === 'tx' ? 'Chưa có khoản thu chi nào' : tab === 'contrib' ? 'Chưa có hộ nào đóng góp' : 'Mọi hộ đã đóng góp 🎉' }}
              header={
                <>
                  <Card style={{ padding: Spacing.lg, gap: 4, ...Shadow.sm }}>
                    <Txt variant="caption" color={Colors.textSecondary}>
                      Số dư hiện tại
                    </Txt>
                    <Txt variant="hero" color={d.fund.balance < 0 ? Colors.danger : Colors.primaryText}>
                      {vnd(d.fund.balance)}
                    </Txt>
                    <Txt variant="small" color={Colors.textSecondary}>
                      Thu {vnd(d.fund.total_thu)} · Chi {vnd(d.fund.total_chi)} · {d.fund.households} hộ đã góp
                    </Txt>
                    {!d.fund.is_active && (
                      <Txt variant="caption" color={Colors.warning} style={{ fontFamily: Font.bold }}>
                        Quỹ đã kết thúc
                      </Txt>
                    )}
                  </Card>
                  <Button title="Ghi thu / chi" icon="add-circle" onPress={() => router.push({ pathname: '/manage/fund', params: { fund: id } })} />
                  <PillTabs<Tab>
                    items={[
                      { key: 'tx', label: `Thu chi (${d.txs.length})` },
                      { key: 'contrib', label: `Hộ đã góp (${d.contribs.length})` },
                      { key: 'missing', label: `Chưa góp (${d.missing.length})` },
                    ]}
                    value={tab}
                    onChange={setTab}
                  />
                  {tab === 'missing' && (
                    <PillTabs items={[{ key: 'all', label: 'Mọi khu' }, ...d.areas.map((a) => ({ key: a.id, label: a.name }))]} value={area} onChange={setArea} />
                  )}
                </>
              }
              renderItem={(r) => {
                if (r.t === 'tx') {
                  const thu = r.kind === 'thu';
                  return (
                    <RowCard onPress={() => router.push({ pathname: '/manage/fund', params: { fund: id, tx: r.id } })}>
                      <View style={{ flex: 1 }}>
                        <Txt variant="bodyStrong">{r.description}</Txt>
                        <Txt variant="caption" color={Colors.textSecondary}>
                          {toVnDate(r.occurred_on)}
                          {r.household_label || r.payer_name ? ` · ${r.household_label ?? r.payer_name}` : ''}
                          {r.receipt_path ? ' · 📎' : ''}
                        </Txt>
                      </View>
                      <Txt variant="bodyStrong" color={thu ? Colors.success : Colors.danger} style={{ fontFamily: Font.bold }}>
                        {thu ? '+' : '−'} {vnd(r.amount)}
                      </Txt>
                    </RowCard>
                  );
                }
                if (r.t === 'contrib') {
                  return (
                    <RowCard>
                      <View style={{ flex: 1 }}>
                        <Txt variant="bodyStrong">Hộ {r.head_name}</Txt>
                        <Txt variant="caption" color={Colors.textSecondary}>
                          {[r.area_name, r.code].filter(Boolean).join(' · ')}
                          {r.times > 1 ? ` · ${r.times} lần` : ''}
                        </Txt>
                      </View>
                      <Txt variant="bodyStrong" color={Colors.success} style={{ fontFamily: Font.bold }}>
                        {vnd(r.total)}
                      </Txt>
                    </RowCard>
                  );
                }
                return (
                  <RowCard>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong">Hộ {r.head_name}</Txt>
                      <Txt variant="caption" color={Colors.textSecondary}>
                        {[r.area_name, r.code].filter(Boolean).join(' · ')}
                      </Txt>
                    </View>
                    {r.phone ? (
                      <Pressable onPress={() => Linking.openURL(`tel:${r.phone}`)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 44, borderRadius: Radius.full, backgroundColor: Colors.primarySoft }}>
                        <Txt variant="label" color={Colors.primaryText}>
                          📞 {r.phone}
                        </Txt>
                      </Pressable>
                    ) : (
                      <Txt variant="caption" color={Colors.textMuted}>
                        Không có SĐT
                      </Txt>
                    )}
                  </RowCard>
                );
              }}
            />
            <FormSheet visible={edit} title="Sửa quỹ" onClose={() => setEdit(false)} onSave={saveEdit} saving={busy}>
              <Field label="Tên quỹ" value={name} onChangeText={setName} />
              <Field label="Mô tả" value={desc} onChangeText={setDesc} multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 14 }} />
              <Txt variant="label">Mục tiêu vận động</Txt>
              <TextInput
                value={target ? target.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                onChangeText={(t) => setTarget(Number(t.replace(/\D/g, '')) || 0)}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={Colors.border}
                style={{ minHeight: 56, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, fontFamily: Font.semibold, fontSize: 22, color: Colors.text }}
              />
              <ToggleRow label="Đang hoạt động" desc="Tắt khi quỹ đã kết thúc" value={active} onChange={setActive} />
              <Notice text={error} />
              <Button title="Xoá quỹ" icon="trash" variant="dangerOutline" onPress={removeFund} />
            </FormSheet>
          </>
        )}
      </Async>
    </ManageShell>
  );
}

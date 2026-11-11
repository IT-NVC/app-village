import { useState } from 'react';
import { View } from 'react-native';

import { Async, FormSheet, ManageList, ManageShell, RowCard, ToggleRow, useLoad } from '@/components/manage-kit';
import { Card, Choice, Field, IconCircle, Notice, SectionTitle, Txt, type IconName } from '@/components/ui';
import { Colors, Shadow, Spacing } from '@/constants/theme';
import { confirmAction, showInfo } from '@/lib/dialog';
import { friendlyError } from '@/lib/manage-data';
import { useRank } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

type Contact = { id: string; name: string; title: string | null; phone: string; category: string; sort_order: number };
const CATEGORY: Record<string, { label: string; icon: IconName; color: string; bg: string }> = {
  khan_cap: { label: 'Khẩn cấp', icon: 'alert-circle', color: Colors.danger, bg: Colors.dangerSoft },
  can_bo: { label: 'Cán bộ thôn', icon: 'person', color: Colors.info, bg: Colors.infoSoft },
  y_te: { label: 'Y tế', icon: 'medkit', color: Colors.success, bg: Colors.successSoft },
  dich_vu: { label: 'Dịch vụ', icon: 'construct', color: Colors.warning, bg: Colors.warningSoft },
};

async function load() {
  const [s, c] = await Promise.all([
    supabase.from('app_settings').select('value').eq('key', 'require_approval').maybeSingle(),
    supabase.from('contacts').select('id, name, title, phone, category, sort_order').order('sort_order'),
  ]);
  if (c.error) throw new Error(c.error.message);
  return { requireApproval: Boolean(s.data?.value ?? true), contacts: (c.data ?? []) as Contact[] };
}

export default function SettingsScreen() {
  const rank = useRank();
  const state = useLoad(load);
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('can_bo');
  const [order, setOrder] = useState('10');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleApproval(v: boolean) {
    const { error: err } = await supabase.from('app_settings').update({ value: v }).eq('key', 'require_approval').select().single();
    if (err) showInfo('Không thay đổi được', friendlyError(err.message));
    await state.reload();
  }

  function open(c: Contact | 'new') {
    setEditing(c);
    setError(null);
    setName(c === 'new' ? '' : c.name);
    setTitle(c === 'new' ? '' : (c.title ?? ''));
    setPhone(c === 'new' ? '' : c.phone);
    setCategory(c === 'new' ? 'can_bo' : c.category);
    setOrder(c === 'new' ? String((state.data?.contacts.length ?? 0) + 10) : String(c.sort_order));
  }

  async function save() {
    if (!name.trim()) return setError('Vui lòng nhập tên.');
    if (!/^[0-9+\s]{3,15}$/.test(phone.trim())) return setError('Số điện thoại không hợp lệ.');
    setBusy(true);
    const payload = { name: name.trim(), title: title.trim() || null, phone: phone.replace(/\s/g, ''), category, sort_order: Number(order) || 0 };
    const { error: err } = editing === 'new' ? await supabase.from('contacts').insert(payload) : await supabase.from('contacts').update(payload).eq('id', (editing as Contact).id);
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    setEditing(null);
    await state.reload();
  }

  function remove(c: Contact) {
    confirmAction(`Xoá ${c.name}?`, c.phone, 'Xoá', async () => {
      const { error: err } = await supabase.from('contacts').delete().eq('id', c.id);
      if (err) return showInfo('Không xoá được', friendlyError(err.message));
      setEditing(null);
      await state.reload();
    }, true);
  }

  return (
    <ManageShell title="Cài đặt & danh bạ">
      <Async state={state}>
        {(d) => (
          <ManageList
            state={state}
            data={d.contacts}
            keyOf={(c) => c.id}
            empty={{ icon: 'call-outline', title: 'Chưa có số điện thoại nào' }}
            header={
              <>
                <Card style={{ padding: Spacing.lg, gap: Spacing.sm, ...Shadow.sm }}>
                  <Txt variant="subtitle">Đăng ký tài khoản</Txt>
                  <ToggleRow
                    label="Chế độ chờ duyệt"
                    desc={d.requireApproval ? 'Người dân tự khai báo phải chờ cán bộ duyệt' : 'Tự khai báo xong là dùng được ngay'}
                    value={d.requireApproval}
                    disabled={rank < 2}
                    onChange={toggleApproval}
                  />
                  {rank < 2 && (
                    <Txt variant="caption" color={Colors.textMuted}>
                      Chỉ Bí thư / Trưởng thôn được thay đổi. Người có mã kích hoạt luôn vào được ngay.
                    </Txt>
                  )}
                </Card>
                <SectionTitle title="Danh bạ hiển thị trên trang chủ" action={<Txt variant="label" color={Colors.primaryText} onPress={() => open('new')}>+ Thêm số</Txt>} />
              </>
            }
            renderItem={(c) => {
              const s = CATEGORY[c.category] ?? CATEGORY.can_bo;
              return (
                <RowCard onPress={() => open(c)}>
                  <IconCircle icon={s.icon} color={s.color} bg={s.bg} size={46} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{c.name}</Txt>
                    <Txt variant="caption" color={Colors.textSecondary}>
                      {[c.title, c.phone].filter(Boolean).join(' · ')}
                    </Txt>
                  </View>
                </RowCard>
              );
            }}
          />
        )}
      </Async>

      <FormSheet visible={!!editing} title={editing === 'new' ? 'Thêm số điện thoại' : 'Sửa số điện thoại'} onClose={() => setEditing(null)} onSave={save} saving={busy}>
        <Field label="Tên" placeholder="VD: Ông Nguyễn Văn A" value={name} onChangeText={setName} />
        <Field label="Chức danh / mô tả" placeholder="VD: Bí thư chi bộ, Trạm y tế xã" value={title} onChangeText={setTitle} />
        <Field label="Số điện thoại" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Choice<string> label="Nhóm" options={Object.entries(CATEGORY).map(([value, c]) => ({ value, label: c.label }))} value={category} onChange={setCategory} />
        <Field label="Thứ tự" value={order} onChangeText={setOrder} keyboardType="number-pad" />
        <Notice text={error} />
        {editing && editing !== 'new' && (
          <Txt variant="label" color={Colors.danger} onPress={() => remove(editing)} style={{ textAlign: 'center', paddingVertical: 8 }}>
            Xoá số này
          </Txt>
        )}
      </FormSheet>
    </ManageShell>
  );
}

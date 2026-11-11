import { useState } from 'react';
import { View } from 'react-native';

import { Async, FormSheet, ManageList, ManageShell, RowCard, ToggleRow, useLoad } from '@/components/manage-kit';
import { Field, IconButton, IconCircle, Notice, Txt } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { friendlyError } from '@/lib/manage-data';
import { supabase } from '@/lib/supabase';

type Venue = { id: string; name: string; description: string | null; is_active: boolean; sort_order: number };

async function load(): Promise<Venue[]> {
  const { data, error } = await supabase.from('venues').select('id, name, description, is_active, sort_order').order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export default function VenuesScreen() {
  const state = useLoad(load);
  const [editing, setEditing] = useState<Venue | 'new' | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [order, setOrder] = useState('0');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(v: Venue | 'new') {
    setEditing(v);
    setError(null);
    setName(v === 'new' ? '' : v.name);
    setDesc(v === 'new' ? '' : (v.description ?? ''));
    setOrder(v === 'new' ? String((state.data?.length ?? 0) + 1) : String(v.sort_order));
    setActive(v === 'new' ? true : v.is_active);
  }

  async function save() {
    if (!name.trim()) return setError('Vui lòng nhập tên địa điểm.');
    setBusy(true);
    const payload = { name: name.trim(), description: desc.trim() || null, sort_order: Number(order) || 0, is_active: active };
    const { error: err } = editing === 'new' ? await supabase.from('venues').insert(payload) : await supabase.from('venues').update(payload).eq('id', (editing as Venue).id);
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    setEditing(null);
    await state.reload();
  }

  return (
    <ManageShell title="Địa điểm cho đặt lịch" right={<IconButton icon="add" label="Thêm địa điểm" onPress={() => open('new')} />}>
      <Async state={state}>
        {(rows) => (
          <ManageList
            state={state}
            data={rows}
            keyOf={(v) => v.id}
            empty={{ icon: 'business-outline', title: 'Chưa có địa điểm nào' }}
            renderItem={(v) => (
              <RowCard onPress={() => open(v)}>
                <IconCircle icon="business" color="#00796B" bg="#E0F2F1" size={48} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{v.name}</Txt>
                  <Txt variant="caption" color={v.is_active ? Colors.textSecondary : Colors.warning}>
                    {v.is_active ? (v.description ?? 'Đang cho đặt lịch') : 'Tạm ngưng đặt lịch'}
                  </Txt>
                </View>
              </RowCard>
            )}
          />
        )}
      </Async>
      <FormSheet visible={!!editing} title={editing === 'new' ? 'Thêm địa điểm' : 'Sửa địa điểm'} onClose={() => setEditing(null)} onSave={save} saving={busy}>
        <Field label="Tên" placeholder="VD: Nhà văn hoá thôn" value={name} onChangeText={setName} />
        <Field label="Mô tả" value={desc} onChangeText={setDesc} />
        <Field label="Thứ tự" value={order} onChangeText={setOrder} keyboardType="number-pad" />
        <ToggleRow label="Cho đặt lịch" value={active} onChange={setActive} />
        <Notice text={error} />
      </FormSheet>
    </ManageShell>
  );
}

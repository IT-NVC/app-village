import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { Async, FormSheet, ManageList, ManageShell, RowCard, useLoad } from '@/components/manage-kit';
import { Button, Field, IconButton, IconCircle, Notice, Txt } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { confirmAction, showInfo } from '@/lib/dialog';
import { fetchAreas, friendlyError, type Area } from '@/lib/manage-data';
import { supabase } from '@/lib/supabase';

type Row = Area & { residents: number };

async function load(): Promise<Row[]> {
  const areas = await fetchAreas();
  const counts = await Promise.all(areas.map((a) => supabase.from('residents').select('id', { count: 'exact', head: true }).eq('area_id', a.id)));
  return areas.map((a, i) => ({ ...a, residents: counts[i].count ?? 0 }));
}

export default function AreasScreen() {
  const state = useLoad(load);
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [order, setOrder] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(a: Row | 'new') {
    setEditing(a);
    setError(null);
    setName(a === 'new' ? '' : a.name);
    setDesc(a === 'new' ? '' : (a.description ?? ''));
    setOrder(a === 'new' ? String((state.data?.length ?? 0) + 1) : String(a.sort_order));
  }

  async function save() {
    if (!name.trim()) return setError('Vui lòng nhập tên khu.');
    setBusy(true);
    setError(null);
    const payload = { name: name.trim(), description: desc.trim() || null, sort_order: Number(order) || 0 };
    const { error: err } = editing === 'new' ? await supabase.from('areas').insert(payload) : await supabase.from('areas').update(payload).eq('id', (editing as Row).id);
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    setEditing(null);
    await state.reload();
  }

  function remove(a: Row) {
    confirmAction(`Xoá ${a.name}?`, 'Ban ngành của khu cũng bị xoá. Nhân khẩu được giữ lại nhưng không còn thuộc khu nào.', 'Xoá', async () => {
      const { error: err } = await supabase.from('areas').delete().eq('id', a.id);
      if (err) return showInfo('Không xoá được', friendlyError(err.message));
      setEditing(null);
      await state.reload();
    }, true);
  }

  async function createGroup(a: Row) {
    const { error: err } = await supabase.rpc('create_chat_group', { p_name: `Nhóm ${a.name}`, p_type: 'area', p_area_id: a.id });
    showInfo(err ? 'Không tạo được nhóm' : 'Đã tạo nhóm chat', err ? friendlyError(err.message) : `Mọi người dân của ${a.name} đã được thêm vào nhóm.`);
  }

  return (
    <ManageShell title="Khu vực" right={<IconButton icon="add" label="Thêm khu" onPress={() => open('new')} />}>
      <Async state={state}>
        {(rows) => (
          <ManageList
            state={state}
            data={rows}
            keyOf={(a) => a.id}
            empty={{ icon: 'map-outline', title: 'Chưa có khu nào', message: 'Bấm dấu + để tạo khu đầu tiên (ví dụ: Khu A).' }}
            renderItem={(a) => (
              <RowCard onPress={() => open(a)}>
                <IconCircle icon="location" color={Colors.primaryText} bg={Colors.primarySoft} size={48} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{a.name}</Txt>
                  <Txt variant="caption" color={Colors.textSecondary}>
                    {a.residents} nhân khẩu{a.description ? ` · ${a.description}` : ''}
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
              </RowCard>
            )}
          />
        )}
      </Async>

      <FormSheet visible={!!editing} title={editing === 'new' ? 'Thêm khu' : 'Sửa khu'} onClose={() => setEditing(null)} onSave={save} saving={busy}>
        <Field label="Tên khu" placeholder="VD: Khu A" value={name} onChangeText={setName} />
        <Field label="Mô tả" value={desc} onChangeText={setDesc} />
        <Field label="Thứ tự hiển thị" value={order} onChangeText={setOrder} keyboardType="number-pad" />
        <Notice text={error} />
        {editing && editing !== 'new' && (
          <>
            <Button title="Tạo nhóm chat của khu" icon="chatbubbles" variant="secondary" onPress={() => createGroup(editing)} />
            <Button title="Xoá khu" icon="trash" variant="dangerOutline" onPress={() => remove(editing)} />
          </>
        )}
      </FormSheet>
    </ManageShell>
  );
}


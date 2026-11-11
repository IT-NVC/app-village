import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Async, FormSheet, ManageList, ManageShell, RowCard, useLoad } from '@/components/manage-kit';
import { Field, IconButton, IconCircle, Notice, Txt } from '@/components/ui';
import { Colors, Font, Radius } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { vnd, vndShort } from '@/lib/funds';
import { friendlyError } from '@/lib/manage-data';
import { supabase } from '@/lib/supabase';

async function load() {
  const { data, error } = await supabase.rpc('fund_summaries');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export default function FundsAdminScreen() {
  const { me } = useAuth();
  const state = useLoad(load);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [target, setTarget] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return setError('Vui lòng nhập tên quỹ.');
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.from('funds').insert({ name: name.trim(), description: desc.trim() || null, target_amount: target || null, created_by: me?.id ?? null }).select('id').single();
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    setOpen(false);
    setName('');
    setDesc('');
    setTarget(0);
    router.push({ pathname: '/manage/fund-info/[id]', params: { id: data.id } });
  }

  return (
    <ManageShell title="Quỹ thôn" right={<IconButton icon="add" label="Tạo quỹ" onPress={() => { setError(null); setOpen(true); }} />}>
      <Async state={state}>
        {(rows) => (
          <ManageList
            state={state}
            data={rows}
            keyOf={(f) => f.id}
            empty={{ icon: 'wallet-outline', title: 'Chưa có quỹ nào', message: 'Bấm dấu + để tạo quỹ (ví dụ: Quỹ làm đường, Quỹ khuyến học).' }}
            renderItem={(f) => (
              <RowCard onPress={() => router.push({ pathname: '/manage/fund-info/[id]', params: { id: f.id } })} style={{ opacity: f.is_active ? 1 : 0.7 }}>
                <IconCircle icon="wallet" color="#5D4037" bg="#EFEBE9" size={52} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{f.name}</Txt>
                  <Txt variant="caption" color={Colors.textSecondary}>
                    Thu {vndShort(f.total_thu)} · Chi {vndShort(f.total_chi)} · {f.households} hộ{f.is_active ? '' : ' · đã kết thúc'}
                  </Txt>
                  <Txt variant="bodyStrong" color={f.balance < 0 ? Colors.danger : Colors.primaryText} style={{ fontFamily: Font.bold }}>
                    Còn {vnd(f.balance)}
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
              </RowCard>
            )}
          />
        )}
      </Async>

      <FormSheet visible={open} title="Tạo quỹ" onClose={() => setOpen(false)} onSave={create} saving={busy} saveText="Tạo quỹ">
        <Field label="Tên quỹ" placeholder="VD: Quỹ bê tông hoá ngõ 3" value={name} onChangeText={setName} />
        <Field label="Mô tả" placeholder="Mục đích, mức đóng góp đề nghị mỗi hộ…" value={desc} onChangeText={setDesc} multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 14 }} />
        <Txt variant="label">Mục tiêu vận động (không bắt buộc)</Txt>
        <TextInput
          value={target ? target.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
          onChangeText={(t) => setTarget(Number(t.replace(/\D/g, '')) || 0)}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={Colors.border}
          style={{ minHeight: 56, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, fontFamily: Font.semibold, fontSize: 22, color: Colors.text }}
        />
        <Notice text={error} />
      </FormSheet>
    </ManageShell>
  );
}


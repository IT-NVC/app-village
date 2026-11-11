import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Async, DateTimePick, ManageShell, ToggleRow, useLoad } from '@/components/manage-kit';
import { Button, Card, Choice, Field, MultiChoice, Notice, ScrollPage } from '@/components/ui';
import { Colors, Shadow, Spacing } from '@/constants/theme';
import { fetchAreas, fetchOrgs } from '@/lib/manage-data';
import { notifyEvent } from '@/lib/push';
import { supabase } from '@/lib/supabase';

type Opt = { id: string; name: string };

export default function PollNewScreen() {
  const state = useLoad(async () => {
    const [areas, orgs] = await Promise.all([fetchAreas(), fetchOrgs()]);
    return { areas, orgs };
  });
  return (
    <ManageShell title="Tạo khảo sát" subtitle="Lấy ý kiến bà con">
      <Async state={state}>{(d) => <Form areas={d.areas} orgs={d.orgs} />}</Async>
    </ManageShell>
  );
}

type Deadline = 'none' | '1' | '3' | '7' | 'pick';

function Form({ areas, orgs }: { areas: Opt[]; orgs: Opt[] }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [scope, setScope] = useState<'person' | 'household'>('person');
  const [multi, setMulti] = useState(false);
  const [anon, setAnon] = useState(false);
  const [deadline, setDeadline] = useState<Deadline>('7');
  const [picked, setPicked] = useState<Date | null>(null);
  const [mode, setMode] = useState<'all' | 'custom'>('all');
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [orgIds, setOrgIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOpt = (i: number, v: string) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));

  async function submit() {
    if (!title.trim()) return setError('Vui lòng nhập câu hỏi.');
    if (options.filter((o) => o.trim()).length < 2) return setError('Cần ít nhất 2 phương án.');
    if (mode === 'custom' && areaIds.length === 0 && orgIds.length === 0) return setError('Vui lòng chọn đối tượng tham gia.');
    let closes: Date | null = null;
    if (deadline === 'pick') {
      if (!picked || picked <= new Date()) return setError('Vui lòng chọn hạn chót ở tương lai.');
      closes = picked;
    } else if (deadline !== 'none') {
      closes = new Date(Date.now() + Number(deadline) * 86400e3);
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('create_poll', {
      p_title: title.trim(),
      p_options: options,
      p_description: desc.trim() || undefined,
      p_allow_multiple: multi,
      p_is_anonymous: anon,
      p_vote_scope: scope,
      p_closes_at: closes ? closes.toISOString() : undefined,
      p_target_all: mode === 'all',
      p_area_ids: mode === 'all' ? [] : areaIds,
      p_org_ids: mode === 'all' ? [] : orgIds,
    });
    setBusy(false);
    if (err) return setError(err.message);
    notifyEvent('poll', data as string);
    router.replace({ pathname: '/manage/poll/[id]', params: { id: data as string } });
  }

  return (
    <ScrollPage header={null}>
      <Card style={{ padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm }}>
        <Field label="Câu hỏi" placeholder="VD: Bà con có đồng ý góp tiền bê tông hoá ngõ 3 không?" value={title} onChangeText={setTitle} maxLength={200} multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 14 }} />
        <Field label="Giải thích thêm" placeholder="Kinh phí dự kiến, mức đóng góp mỗi hộ…" value={desc} onChangeText={setDesc} multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 14 }} />
      </Card>

      <Card style={{ padding: Spacing.lg, gap: Spacing.sm, ...Shadow.sm }}>
        {options.map((o, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field label={`Phương án ${i + 1}`} value={o} onChangeText={(v) => setOpt(i, v)} />
            </View>
            {options.length > 2 && (
              <Pressable onPress={() => setOptions((x) => x.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel={`Xoá phương án ${i + 1}`} style={{ height: 56, justifyContent: 'center' }}>
                <Ionicons name="close-circle" size={28} color={Colors.danger} />
              </Pressable>
            )}
          </View>
        ))}
        {options.length < 10 && <Button title="Thêm phương án" icon="add" variant="secondary" onPress={() => setOptions((o) => [...o, ''])} />}
      </Card>

      <Card style={{ padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm }}>
        <Choice<'person' | 'household'>
          label="Tính phiếu theo"
          options={[
            { value: 'person', label: 'Mỗi người 1 phiếu' },
            { value: 'household', label: 'Mỗi hộ 1 phiếu' },
          ]}
          value={scope}
          onChange={setScope}
        />
        <ToggleRow label="Cho chọn nhiều phương án" value={multi} onChange={setMulti} />
        <ToggleRow label="Ẩn danh" desc="Cán bộ cũng không xem được ai chọn gì" value={anon} onChange={setAnon} />
      </Card>

      <Card style={{ padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm }}>
        <Choice<Deadline>
          label="Hạn chót"
          options={[
            { value: '1', label: '1 ngày' },
            { value: '3', label: '3 ngày' },
            { value: '7', label: '7 ngày' },
            { value: 'pick', label: 'Chọn ngày giờ' },
            { value: 'none', label: 'Không thời hạn' },
          ]}
          value={deadline}
          onChange={setDeadline}
        />
        {deadline === 'pick' && <DateTimePick label="Đóng lúc" value={picked} onChange={setPicked} />}
      </Card>

      <Card style={{ padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm }}>
        <Choice<'all' | 'custom'>
          label="Ai được tham gia"
          options={[
            { value: 'all', label: 'Toàn thôn' },
            { value: 'custom', label: 'Chọn khu / ban ngành' },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === 'custom' && (
          <>
            <MultiChoice label="Khu" options={areas.map((a) => ({ value: a.id, label: a.name }))} value={areaIds} onChange={setAreaIds} />
            <MultiChoice label="Ban ngành" options={orgs.map((o) => ({ value: o.id, label: o.name }))} value={orgIds} onChange={setOrgIds} />
          </>
        )}
      </Card>

      <Notice text={error} />
      <Button title="Tạo và gửi khảo sát" icon="send" onPress={submit} loading={busy} />
    </ScrollPage>
  );
}

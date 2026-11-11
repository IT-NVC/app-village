import type { Database } from '@thon/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Async, DateTimePick, ManageShell, ToggleRow, useLoad } from '@/components/manage-kit';
import { Button, Card, Choice, Field, Notice, ScrollPage } from '@/components/ui';
import { Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { EVENT_STYLE } from '@/lib/calendar';
import { confirmAction, showInfo } from '@/lib/dialog';
import { fetchAreas, friendlyError } from '@/lib/manage-data';
import { notifyEvent } from '@/lib/push';
import { supabase } from '@/lib/supabase';

type Category = Database['public']['Enums']['event_category'];
type Ev = { id: string; title: string; category: Category; location: string | null; description: string | null; starts_at: string; ends_at: string | null; area_id: string | null };

async function load(id: string) {
  const areas = await fetchAreas();
  if (id === 'new') return { areas, ev: null as Ev | null };
  const { data, error } = await supabase.from('events').select('id, title, category, location, description, starts_at, ends_at, area_id').eq('id', id).single();
  if (error) throw new Error(error.message);
  return { areas, ev: data as Ev };
}

const WHOLE = 'whole';

export default function EventEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useLoad(() => load(id), id);
  return (
    <ManageShell title={id === 'new' ? 'Thêm sự kiện' : 'Sửa sự kiện'}>
      <Async state={state}>{(d) => <Form ev={d.ev} areas={d.areas} />}</Async>
    </ManageShell>
  );
}

function Form({ ev, areas }: { ev: Ev | null; areas: { id: string; name: string }[] }) {
  const { me } = useAuth();
  const [title, setTitle] = useState(ev?.title ?? '');
  const [category, setCategory] = useState<Category>(ev?.category ?? 'hop');
  const [areaId, setAreaId] = useState(ev?.area_id ?? WHOLE);
  const [start, setStart] = useState<Date | null>(ev ? new Date(ev.starts_at) : null);
  const [end, setEnd] = useState<Date | null>(ev?.ends_at ? new Date(ev.ends_at) : null);
  const [location, setLocation] = useState(ev?.location ?? '');
  const [desc, setDesc] = useState(ev?.description ?? '');
  const [push, setPush] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) return setError('Vui lòng nhập tên sự kiện.');
    if (!start) return setError('Vui lòng chọn thời gian bắt đầu.');
    if (end && end < start) return setError('Giờ kết thúc phải sau giờ bắt đầu.');
    setBusy(true);
    setError(null);
    const payload = {
      title: title.trim(),
      category,
      location: location.trim() || null,
      description: desc.trim() || null,
      area_id: areaId === WHOLE ? null : areaId,
      starts_at: start.toISOString(),
      ends_at: end ? end.toISOString() : null,
    };
    if (ev) {
      const { error: err } = await supabase.from('events').update(payload).eq('id', ev.id);
      setBusy(false);
      if (err) return setError(friendlyError(err.message));
    } else {
      const { data, error: err } = await supabase.from('events').insert({ ...payload, created_by: me?.id ?? null }).select('id').single();
      setBusy(false);
      if (err) return setError(friendlyError(err.message));
      if (push) notifyEvent('event', data.id);
    }
    router.back();
  }

  function remove() {
    if (!ev) return;
    confirmAction('Xoá sự kiện?', ev.title, 'Xoá', async () => {
      const { error: err } = await supabase.from('events').delete().eq('id', ev.id);
      if (err) return showInfo('Không xoá được', friendlyError(err.message));
      router.back();
    }, true);
  }

  return (
    <ScrollPage header={null}>
      <Card style={{ padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm }}>
        <Field label="Tên sự kiện" placeholder="VD: Họp thôn quý IV" value={title} onChangeText={setTitle} />
        <Choice<Category>
          label="Loại"
          options={(Object.keys(EVENT_STYLE) as Category[]).map((c) => ({ value: c, label: EVENT_STYLE[c].label }))}
          value={category}
          onChange={setCategory}
        />
        <Choice<string> label="Dành cho" options={[{ value: WHOLE, label: 'Toàn thôn' }, ...areas.map((a) => ({ value: a.id, label: a.name }))]} value={areaId} onChange={setAreaId} />
      </Card>
      <Card style={{ padding: Spacing.lg, gap: Spacing.lg, ...Shadow.sm }}>
        <DateTimePick label="Bắt đầu" value={start} onChange={setStart} />
        <DateTimePick label="Kết thúc (không bắt buộc)" value={end} onChange={setEnd} optional />
      </Card>
      <Card style={{ padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm }}>
        <Field label="Địa điểm" placeholder="VD: Nhà văn hoá thôn" value={location} onChangeText={setLocation} />
        <Field label="Ghi chú" value={desc} onChangeText={setDesc} multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 14 }} />
        {!ev && <ToggleRow label="Gửi thông báo đẩy" desc="Báo cho người dân biết có sự kiện mới" value={push} onChange={setPush} />}
      </Card>
      <Notice text={error} />
      <Button title={ev ? 'Lưu thay đổi' : 'Thêm sự kiện'} icon="checkmark" onPress={save} loading={busy} />
      {ev && <Button title="Xoá sự kiện" icon="trash" variant="dangerOutline" onPress={remove} />}
    </ScrollPage>
  );
}

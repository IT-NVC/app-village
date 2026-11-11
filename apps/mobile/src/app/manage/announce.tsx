import type { PriorityLevel } from '@thon/shared';
import { useState } from 'react';
import { TextInput } from 'react-native';

import { Async, DateTimePick, formatDateTime, ManageShell, useLoad } from '@/components/manage-kit';
import { Button, Card, Choice, Field, MultiChoice, Notice, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { confirmAction } from '@/lib/dialog';
import { fetchAreas, fetchOrgs } from '@/lib/manage-data';
import { notifyEvent } from '@/lib/push';
import { supabase } from '@/lib/supabase';

async function load() {
  const [areas, orgs] = await Promise.all([fetchAreas(), fetchOrgs()]);
  return { areas, orgs };
}

export default function ManageAnnounceScreen() {
  const state = useLoad(load);
  return (
    <ManageShell title="Gửi thông báo" subtitle="Bà con nhận ngay trên điện thoại">
      <Async state={state}>{(d) => <Form areas={d.areas} orgs={d.orgs} />}</Async>
    </ManageShell>
  );
}

type Opt = { id: string; name: string };

function Form({ areas, orgs }: { areas: Opt[]; orgs: Opt[] }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('thuong');
  const [mode, setMode] = useState<'all' | 'custom'>('all');
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [orgIds, setOrgIds] = useState<string[]>([]);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [at, setAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function submit() {
    if (!title.trim() || !content.trim()) return setError('Vui lòng nhập tiêu đề và nội dung.');
    if (mode === 'custom' && areaIds.length === 0 && orgIds.length === 0) return setError('Vui lòng chọn ít nhất một khu hoặc ban ngành.');
    if (when === 'later' && (!at || at <= new Date())) return setError('Vui lòng chọn thời điểm gửi ở tương lai.');
    setError(null);
    const target = mode === 'all' ? 'toàn thôn' : [...areas.filter((a) => areaIds.includes(a.id)), ...orgs.filter((o) => orgIds.includes(o.id))].map((x) => x.name).join(', ');
    confirmAction('Gửi thông báo?', `"${title.trim()}" sẽ ${when === 'later' && at ? `hiện lúc ${formatDateTime(at)}` : 'gửi ngay'} tới ${target}.`, 'Gửi', async () => {
      setBusy(true);
      const { data, error: err } = await supabase.rpc('send_announcement', {
        p_title: title.trim(),
        p_content: content.trim(),
        p_priority: priority,
        p_target_all: mode === 'all',
        p_area_ids: mode === 'all' ? [] : areaIds,
        p_org_ids: mode === 'all' ? [] : orgIds,
        p_scheduled_at: when === 'later' && at ? at.toISOString() : undefined,
      });
      setBusy(false);
      if (err) return setError(err.message);
      if (when === 'now') notifyEvent('announcement', data as string);
      setDone(when === 'later' ? `Đã hẹn giờ gửi tới ${target}.` : `Đã gửi tới ${target}.`);
      setTitle('');
      setContent('');
      setPriority('thuong');
      setWhen('now');
      setAt(null);
    });
  }

  return (
    <ScrollPage header={null}>
      {done && <Notice tone="success" text={done} />}
      <Card style={{ padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm }}>
        <Field label="Tiêu đề" placeholder="VD: Họp thôn tối thứ Bảy" value={title} onChangeText={setTitle} maxLength={150} />
        <Txt variant="label">Nội dung</Txt>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Thời gian, địa điểm, việc cần làm…"
          placeholderTextColor={Colors.textMuted}
          multiline
          style={{ minHeight: 140, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: 14, fontFamily: Font.regular, fontSize: FontSize.large, color: Colors.text, textAlignVertical: 'top' }}
        />
        <Choice<PriorityLevel>
          label="Mức độ"
          options={[
            { value: 'thuong', label: 'Thông thường' },
            { value: 'quan_trong', label: 'Quan trọng' },
            { value: 'khan', label: 'Khẩn' },
          ]}
          value={priority}
          onChange={setPriority}
        />
      </Card>

      <Card style={{ padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm }}>
        <Choice<'all' | 'custom'>
          label="Gửi tới"
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

      <Card style={{ padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm }}>
        <Choice<'now' | 'later'>
          label="Thời điểm gửi"
          options={[
            { value: 'now', label: 'Gửi ngay' },
            { value: 'later', label: 'Hẹn giờ' },
          ]}
          value={when}
          onChange={setWhen}
        />
        {when === 'later' && <DateTimePick label="Gửi lúc" value={at} onChange={setAt} hint="Người dân thấy thông báo từ thời điểm này. Thông báo đẩy không tự gửi khi hẹn giờ." />}
      </Card>

      <Notice text={error} />
      <Button title={when === 'later' ? 'Hẹn giờ gửi' : 'Gửi thông báo'} icon="send" onPress={submit} loading={busy} variant={priority === 'khan' ? 'danger' : 'primary'} />
    </ScrollPage>
  );
}

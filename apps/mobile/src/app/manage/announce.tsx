import type { PriorityLevel } from '@thon/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';

import { Forbidden } from '@/components/forbidden';
import { Button, Card, Choice, Field, MultiChoice, Notice, PageHeader, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { confirmAction } from '@/lib/dialog';
import { useRank } from '@/lib/manage';
import { notifyEvent } from '@/lib/push';
import { supabase } from '@/lib/supabase';

type Area = { id: string; name: string };

export default function ManageAnnounceScreen() {
  const rank = useRank();
  const [areas, setAreas] = useState<Area[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('thuong');
  const [mode, setMode] = useState<'all' | 'areas'>('all');
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('areas').select('id, name').order('sort_order').order('name').then(({ data }) => setAreas(data ?? []));
  }, []);

  if (rank < 1) return <Forbidden />;

  function submit() {
    if (!title.trim() || !content.trim()) return setError('Vui lòng nhập tiêu đề và nội dung.');
    if (mode === 'areas' && areaIds.length === 0) return setError('Vui lòng chọn ít nhất một khu.');
    setError(null);
    const target = mode === 'all' ? 'toàn thôn' : areas.filter((a) => areaIds.includes(a.id)).map((a) => a.name).join(', ');
    confirmAction('Gửi thông báo?', `"${title.trim()}" sẽ gửi tới ${target}.`, 'Gửi', async () => {
      setBusy(true);
      const { data, error: err } = await supabase.rpc('send_announcement', {
        p_title: title.trim(),
        p_content: content.trim(),
        p_priority: priority,
        p_target_all: mode === 'all',
        p_area_ids: mode === 'all' ? [] : areaIds,
        p_org_ids: [],
      });
      setBusy(false);
      if (err) return setError(err.message);
      notifyEvent('announcement', data as string);
      setDone(`Đã gửi tới ${target}.`);
      setTitle('');
      setContent('');
      setPriority('thuong');
    });
  }

  return (
    <ScrollPage header={<PageHeader title="Gửi thông báo" subtitle="Bà con nhận ngay trên điện thoại" onBack={() => router.back()} />}>
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
          style={{
            minHeight: 140,
            borderWidth: 1.5,
            borderColor: Colors.border,
            borderRadius: Radius.md,
            padding: 14,
            fontFamily: Font.regular,
            fontSize: FontSize.large,
            color: Colors.text,
            textAlignVertical: 'top',
          }}
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
        <Choice<'all' | 'areas'>
          label="Gửi tới"
          options={[
            { value: 'all', label: 'Toàn thôn' },
            { value: 'areas', label: 'Chọn khu' },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === 'areas' && (
          <MultiChoice label="Khu" options={areas.map((a) => ({ value: a.id, label: a.name }))} value={areaIds} onChange={setAreaIds} />
        )}
        <Txt variant="caption" color={Colors.textMuted}>
          Gửi theo ban ngành, hẹn giờ, xem ai chưa đọc: dùng trang quản trị trên máy tính.
        </Txt>
      </Card>
      <Notice text={error} />
      <Button title="Gửi thông báo" icon="send" onPress={submit} loading={busy} variant={priority === 'khan' ? 'danger' : 'primary'} />
    </ScrollPage>
  );
}

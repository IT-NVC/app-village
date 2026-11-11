import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Async, ManageShell, ToggleRow, useLoad } from '@/components/manage-kit';
import { Button, Card, Field, Notice, ScrollPage, Txt } from '@/components/ui';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { confirmAction, showInfo } from '@/lib/dialog';
import { compressAndUpload, randomName } from '@/lib/images';
import { errText, friendlyError } from '@/lib/manage-data';
import { supabase } from '@/lib/supabase';

type News = { id: string; title: string; summary: string | null; content: string; cover_url: string | null; is_published: boolean; is_pinned: boolean; published_at: string | null };

async function load(id: string): Promise<News | null> {
  if (id === 'new') return null;
  const { data, error } = await supabase.from('news').select('id, title, summary, content, cover_url, is_published, is_pinned, published_at').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

export default function NewsEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useLoad(() => load(id), id);
  return (
    <ManageShell title={id === 'new' ? 'Viết tin mới' : 'Sửa tin'}>
      {id === 'new' ? <Form news={null} /> : <Async state={state}>{(n) => <Form news={n} />}</Async>}
    </ManageShell>
  );
}

function Form({ news }: { news: News | null }) {
  const { me } = useAuth();
  const [title, setTitle] = useState(news?.title ?? '');
  const [summary, setSummary] = useState(news?.summary ?? '');
  const [content, setContent] = useState(news?.content ?? '');
  const [cover, setCover] = useState<string | null>(news?.cover_url ?? null);
  const [published, setPublished] = useState(news?.is_published ?? true);
  const [pinned, setPinned] = useState(news?.is_pinned ?? false);
  const [busy, setBusy] = useState<'save' | 'upload' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pickCover(camera: boolean) {
    setError(null);
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError('Chưa có quyền dùng camera.');
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.85 };
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    setBusy('upload');
    try {
      const a = res.assets[0];
      const path = await compressAndUpload('news', `covers/${randomName()}`, a.uri, a.width, a.height, 1600);
      setCover(supabase.storage.from('news').getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setError(errText(e));
    }
    setBusy(null);
  }

  async function save() {
    if (!title.trim() || !content.trim()) return setError('Vui lòng nhập tiêu đề và nội dung.');
    setBusy('save');
    setError(null);
    const payload = {
      title: title.trim(),
      summary: summary.trim() || null,
      content: content.trim(),
      cover_url: cover,
      is_published: published,
      is_pinned: pinned,
      // Lần đầu đăng thì ghi thời điểm đăng; gỡ đăng thì giữ nguyên để đăng lại không đổi thứ tự
      published_at: published ? (news?.published_at ?? new Date().toISOString()) : (news?.published_at ?? null),
    };
    const { error: err } = news
      ? await supabase.from('news').update(payload).eq('id', news.id)
      : await supabase.from('news').insert({ ...payload, author_id: me?.id ?? null });
    setBusy(null);
    if (err) return setError(friendlyError(err.message));
    router.back();
  }

  function remove() {
    if (!news) return;
    confirmAction('Xoá tin này?', 'Người dân sẽ không còn thấy tin.', 'Xoá', async () => {
      const { error: err } = await supabase.from('news').delete().eq('id', news.id);
      if (err) return showInfo('Không xoá được', friendlyError(err.message));
      router.back();
    }, true);
  }

  return (
    <ScrollPage header={null}>
      <Card style={{ padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm }}>
        <Txt variant="label">Ảnh bìa</Txt>
        {cover ? <Image source={{ uri: cover }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.md, backgroundColor: Colors.divider }} contentFit="cover" /> : null}
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <Button title="Chụp ảnh" icon="camera" variant="secondary" onPress={() => pickCover(true)} loading={busy === 'upload'} style={{ flex: 1 }} />
          <Button title={cover ? 'Đổi ảnh' : 'Chọn ảnh'} icon="images" variant="secondary" onPress={() => pickCover(false)} loading={busy === 'upload'} style={{ flex: 1 }} />
        </View>
        {cover ? <Button title="Bỏ ảnh bìa" variant="ghost" onPress={() => setCover(null)} /> : null}
      </Card>

      <Card style={{ padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm }}>
        <Field label="Tiêu đề" placeholder="VD: Thôn tổ chức ra quân làm sạch đường làng" value={title} onChangeText={setTitle} maxLength={150} />
        <Field label="Tóm tắt (1–2 câu)" value={summary} onChangeText={setSummary} maxLength={300} multiline style={{ minHeight: 70, textAlignVertical: 'top', paddingTop: 14 }} />
        <Field
          label="Nội dung"
          hint="Để một dòng trống giữa các đoạn văn."
          value={content}
          onChangeText={setContent}
          multiline
          style={{ minHeight: 220, textAlignVertical: 'top', paddingTop: 14 }}
        />
        <ToggleRow label="Đăng ngay" desc={published ? 'Người dân thấy tin này trên app' : 'Lưu bản nháp, chưa hiện với người dân'} value={published} onChange={setPublished} />
        <ToggleRow label="Ghim lên đầu" desc="Tin nổi bật đứng đầu danh sách" value={pinned} onChange={setPinned} />
      </Card>

      <Notice text={error} />
      <Button title={news ? 'Lưu thay đổi' : published ? 'Đăng tin' : 'Lưu bản nháp'} icon="checkmark" onPress={save} loading={busy === 'save'} />
      {news && <Button title="Xoá tin" icon="trash" variant="dangerOutline" onPress={remove} />}
    </ScrollPage>
  );
}

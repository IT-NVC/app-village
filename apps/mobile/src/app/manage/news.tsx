import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Async, ManageList, ManageShell, RowCard, useLoad } from '@/components/manage-kit';
import { IconButton, IconCircle, Txt } from '@/components/ui';
import { Colors, Font, Radius } from '@/constants/theme';
import { timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';

async function load() {
  const { data, error } = await supabase
    .from('news')
    .select('id, title, summary, cover_url, is_published, is_pinned, published_at, created_at')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export default function NewsAdminScreen() {
  const state = useLoad(load);
  return (
    <ManageShell title="Tin tức" right={<IconButton icon="add" label="Viết tin mới" onPress={() => router.push({ pathname: '/manage/news-edit/[id]', params: { id: 'new' } })} />}>
      <Async state={state}>
        {(rows) => (
          <ManageList
            state={state}
            data={rows}
            keyOf={(n) => n.id}
            empty={{ icon: 'newspaper-outline', title: 'Chưa có tin nào', message: 'Bấm dấu + để viết tin đầu tiên.' }}
            renderItem={(n) => (
              <RowCard onPress={() => router.push({ pathname: '/manage/news-edit/[id]', params: { id: n.id } })}>
                {n.cover_url ? (
                  <Image source={{ uri: n.cover_url }} style={{ width: 64, height: 64, borderRadius: Radius.md, backgroundColor: Colors.divider }} contentFit="cover" />
                ) : (
                  <IconCircle icon="newspaper" color={Colors.primaryText} bg={Colors.primarySoft} size={64} />
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="bodyStrong" numberOfLines={2}>
                    {n.is_pinned ? '📌 ' : ''}
                    {n.title}
                  </Txt>
                  <Txt variant="caption" color={n.is_published ? Colors.success : Colors.warning} style={{ fontFamily: Font.bold }}>
                    {n.is_published ? `Đã đăng · ${timeAgo(n.published_at)}` : 'Bản nháp'}
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
              </RowCard>
            )}
          />
        )}
      </Async>
    </ManageShell>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { setStringAsync } from 'expo-clipboard';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientHeader, IconButton, Txt, initials, type IconName } from '@/components/ui';
import { Colors, Font, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import {
  CHAT_BUCKET,
  MESSAGE_SELECT,
  PAGE_SIZE,
  fetchMessages,
  nameColor,
  useChat,
  type Message,
} from '@/lib/chat';
import { showInfo } from '@/lib/dialog';
import { compressAndUpload, randomName, signedUrlsFor } from '@/lib/images';
import { notifyEvent } from '@/lib/push';
import { newChannel, supabase } from '@/lib/supabase';

type Member = { id: string; full_name: string | null };

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hôm nay';
  if (d.toDateString() === y.toDateString()) return 'Hôm qua';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const { groups, refresh: refreshInbox } = useChat();
  const group = groups?.find((g) => g.id === id);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[] | null>(null);
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [menuFor, setMenuFor] = useState<Message | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const urlsRef = useRef<Record<string, string>>({});

  const isAdmin = group?.my_role === 'admin';
  const muted = !!group?.is_muted;

  /** Lấy link ảnh cho các tin nhắn có ảnh chưa có link */
  const ensureUrls = useCallback(
    async (list: Message[]) => {
      const need = list.map((m) => m.image_path).filter((p): p is string => !!p && !urlsRef.current[p]);
      if (need.length === 0) return;
      const got = await signedUrlsFor(CHAT_BUCKET, need);
      urlsRef.current = { ...urlsRef.current, ...got };
      setUrls(urlsRef.current);
    },
    [],
  );

  const markRead = useCallback(async () => {
    await supabase.rpc('mark_group_read', { p_group_id: id });
    refreshInbox();
  }, [id, refreshInbox]);

  // Tải tin nhắn + thành viên, nghe tin mới theo thời gian thực
  useEffect(() => {
    fetchMessages(id).then((list) => {
      setMessages(list);
      setHasMore(list.length === PAGE_SIZE);
      ensureUrls(list);
    });
    supabase
      .from('chat_group_members')
      .select('user_id')
      .eq('group_id', id)
      .then(async ({ data }) => {
        const ids = (data ?? []).map((m) => m.user_id);
        if (ids.length === 0) return;
        const { data: dir } = await supabase.from('member_directory').select('id, full_name').in('id', ids);
        setMembers(Object.fromEntries((dir ?? []).map((d) => [d.id!, { id: d.id!, full_name: d.full_name }])));
      });
    supabase.rpc('mark_group_read', { p_group_id: id }).then(() => refreshInbox());

    const upsert = (m: Message) => {
      setMessages((prev) => {
        if (!prev) return [m];
        const i = prev.findIndex((x) => x.id === m.id);
        if (i >= 0) {
          const next = [...prev];
          next[i] = m;
          return next;
        }
        return [m, ...prev];
      });
      ensureUrls([m]);
    };

    const channel = newChannel(`group-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${id}` }, (p) => {
        upsert(p.new as Message);
        supabase.rpc('mark_group_read', { p_group_id: id });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `group_id=eq.${id}` }, (p) =>
        upsert(p.new as Message),
      )
      .subscribe();

    // Dự phòng khi Realtime lỡ sự kiện: hỏi lại tin mới mỗi 20 giây
    const timer = setInterval(async () => {
      const latest = await fetchMessages(id);
      setMessages((prev) => {
        if (!prev) return latest;
        const known = new Map(prev.map((m) => [m.id, m]));
        for (const m of latest) known.set(m.id, m);
        return [...known.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
      });
      ensureUrls(latest);
    }, 20_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
      // Rời màn hình: đánh dấu đã đọc lần cuối
      supabase.rpc('mark_group_read', { p_group_id: id }).then(() => refreshInbox());
    };
  }, [id, ensureUrls, refreshInbox]);

  async function loadOlder() {
    if (!messages || loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    const older = await fetchMessages(id, messages[messages.length - 1].created_at);
    setMessages((prev) => [...(prev ?? []), ...older.filter((o) => !prev?.some((p) => p.id === o.id))]);
    setHasMore(older.length === PAGE_SIZE);
    ensureUrls(older);
    setLoadingOlder(false);
  }

  async function send(content: string | null, imagePath: string | null) {
    if (!me) return;
    const { data, error } = await supabase
      .from('messages')
      .insert({ group_id: id, sender_id: me.id, content, image_path: imagePath })
      .select(MESSAGE_SELECT)
      .single();
    if (error) {
      showInfo('Không gửi được', error.message.includes('row-level security') ? 'Bạn không có quyền gửi tin trong nhóm này.' : error.message);
      return false;
    }
    setMessages((prev) => (prev?.some((m) => m.id === data.id) ? prev : [data, ...(prev ?? [])]));
    notifyEvent('message', data.id);
    ensureUrls([data]);
    markRead();
    return true;
  }

  async function sendText() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    const ok = await send(t, null);
    if (ok) setText('');
    setSending(false);
  }

  async function sendImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (res.canceled || !me) return;
    const a = res.assets[0];
    setSending(true);
    try {
      const path = await compressAndUpload(CHAT_BUCKET, `${id}/${me.id}-${randomName()}`, a.uri, a.width, a.height);
      await send(null, path);
    } catch (e) {
      showInfo('Không gửi được ảnh', e instanceof Error ? e.message : String(e));
    }
    setSending(false);
  }

  const pinned = useMemo(() => messages?.find((m) => m.is_pinned && !m.deleted_at), [messages]);

  async function action(kind: 'copy' | 'delete' | 'pin' | 'unpin', m: Message) {
    setMenuFor(null);
    if (kind === 'copy' && m.content) await setStringAsync(m.content);
    if (kind === 'delete') {
      const { error } = await supabase.rpc('delete_message', { p_message_id: m.id });
      if (error) showInfo('Không thu hồi được', error.message);
    }
    if (kind === 'pin' || kind === 'unpin') {
      const { error } = await supabase.rpc('pin_message', { p_message_id: m.id, p_pinned: kind === 'pin' });
      if (error) showInfo('Không ghim được', error.message);
    }
  }

  const nameOf = (uid: string | null) => (uid && members[uid]?.full_name) || 'Thành viên';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <GradientHeader style={{ paddingBottom: Spacing.md }}>
        <View style={styles.headerRow}>
          <IconButton icon="arrow-back" label="Quay lại" onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat'))} size={44} />
          <View style={{ flex: 1 }}>
            <Txt variant="subtitle" color={Colors.white} numberOfLines={1}>
              {group?.name ?? 'Nhóm chat'}
            </Txt>
            <Txt variant="caption" color="rgba(255,255,255,0.88)">
              {group ? `${group.member_count} thành viên` : ''}
            </Txt>
          </View>
          <IconButton
            icon="people-outline"
            label="Thành viên nhóm"
            onPress={() => router.push({ pathname: '/group/[id]/members', params: { id } })}
            size={44}
          />
        </View>
      </GradientHeader>

      {pinned && (
        <Pressable style={styles.pinned} onPress={() => pinned.content && showInfo('Tin đã ghim', pinned.content)}>
          <Ionicons name="pin" size={18} color={Colors.warning} />
          <Txt variant="small" numberOfLines={1} style={{ flex: 1 }}>
            {pinned.content ?? '📷 Ảnh'}
          </Txt>
        </Pressable>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {messages === null ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : (
          <FlatList
            data={messages}
            inverted
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: Spacing.md, gap: 6 }}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingOlder ? <ActivityIndicator color={Colors.primary} /> : undefined}
            ListEmptyComponent={
              <View style={{ transform: [{ scaleY: -1 }], alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm }}>
                <Ionicons name="chatbubbles-outline" size={48} color={Colors.border} />
                <Txt variant="body" color={Colors.textSecondary} center>
                  Chưa có tin nhắn. Hãy gửi lời chào tới nhóm!
                </Txt>
              </View>
            }
            renderItem={({ item: m, index }) => {
              const mine = m.sender_id === me?.id;
              const older = messages[index + 1];
              const newer = messages[index - 1];
              const newDay = !older || dayLabel(older.created_at) !== dayLabel(m.created_at);
              // Gom tin liên tiếp của cùng một người: chỉ hiện tên ở tin đầu, avatar ở tin cuối
              const firstOfRun = newDay || older?.sender_id !== m.sender_id;
              const lastOfRun = !newer || newer.sender_id !== m.sender_id || dayLabel(newer.created_at) !== dayLabel(m.created_at);
              return (
                <View>
                  {newDay && (
                    <View style={styles.day}>
                      <Txt variant="caption" color={Colors.textSecondary}>
                        {dayLabel(m.created_at)}
                      </Txt>
                    </View>
                  )}
                  <View style={[styles.line, mine ? { justifyContent: 'flex-end' } : null]}>
                    {!mine && (
                      <View style={{ width: 36 }}>
                        {lastOfRun && (
                          <View style={[styles.avatar, { backgroundColor: nameColor(m.sender_id) }]}>
                            <Txt variant="caption" color={Colors.white} style={{ fontFamily: Font.bold, fontSize: 12 }}>
                              {initials(nameOf(m.sender_id))}
                            </Txt>
                          </View>
                        )}
                      </View>
                    )}
                    <Pressable
                      onLongPress={() => !m.deleted_at && setMenuFor(m)}
                      delayLongPress={350}
                      onPress={() => m.image_path && urls[m.image_path] && setViewer(urls[m.image_path])}
                      accessibilityHint="Giữ để mở thêm thao tác"
                      style={[
                        styles.bubble,
                        mine ? styles.mine : styles.theirs,
                        m.deleted_at && styles.deleted,
                        m.is_pinned && !m.deleted_at && { borderWidth: 2, borderColor: '#F5C46B' },
                      ]}>
                      {!mine && firstOfRun && (
                        <Txt variant="caption" color={nameColor(m.sender_id)} style={{ fontFamily: Font.bold }}>
                          {nameOf(m.sender_id)}
                        </Txt>
                      )}
                      {m.deleted_at ? (
                        <Txt variant="body" color={Colors.textMuted} style={{ fontStyle: 'italic' }}>
                          Tin nhắn đã thu hồi
                        </Txt>
                      ) : (
                        <>
                          {m.image_path ? (
                            <Image
                              source={urls[m.image_path] ? { uri: urls[m.image_path] } : undefined}
                              style={styles.image}
                              contentFit="cover"
                              transition={200}
                            />
                          ) : null}
                          {m.content ? (
                            <Txt variant="body" color={mine ? Colors.white : Colors.text} selectable>
                              {m.content}
                            </Txt>
                          ) : null}
                        </>
                      )}
                      <Txt
                        variant="caption"
                        color={mine ? 'rgba(255,255,255,0.8)' : Colors.textMuted}
                        style={{ alignSelf: 'flex-end', fontSize: 12, lineHeight: 16 }}>
                        {m.is_pinned && !m.deleted_at ? '📌 ' : ''}
                        {hhmm(m.created_at)}
                      </Txt>
                    </Pressable>
                  </View>
                </View>
              );
            }}
          />
        )}

        {muted ? (
          <View style={[styles.mutedBar, { paddingBottom: insets.bottom + Spacing.md }]}>
            <Ionicons name="volume-mute" size={20} color={Colors.warning} />
            <Txt variant="small" color={Colors.warning} style={{ flex: 1 }}>
              Bạn đang bị quản trị nhóm tạm khoá gửi tin. Bạn vẫn đọc được tin nhắn.
            </Txt>
          </View>
        ) : (
          <SafeAreaView edges={['bottom']} style={styles.inputBar}>
            <Pressable onPress={sendImage} disabled={sending} accessibilityLabel="Gửi ảnh" hitSlop={8} style={styles.iconBtn}>
              <Ionicons name="image-outline" size={28} color={Colors.primaryText} />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Nhập tin nhắn…"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={2000}
              style={styles.input}
              accessibilityLabel="Nội dung tin nhắn"
            />
            <Pressable
              onPress={sendText}
              disabled={sending || !text.trim()}
              accessibilityLabel="Gửi"
              style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.45 }]}>
              {sending ? <ActivityIndicator color={Colors.white} /> : <Ionicons name="send" size={22} color={Colors.white} />}
            </Pressable>
          </SafeAreaView>
        )}
      </KeyboardAvoidingView>

      {/* Menu thao tác khi giữ tay lên tin nhắn */}
      <Modal visible={!!menuFor} transparent animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuFor(null)}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}>
            {menuFor?.content ? <MenuItem icon="copy-outline" label="Sao chép" onPress={() => action('copy', menuFor)} /> : null}
            {isAdmin && menuFor && (
              <MenuItem
                icon={menuFor.is_pinned ? 'pin-outline' : 'pin'}
                label={menuFor.is_pinned ? 'Bỏ ghim' : 'Ghim lên đầu nhóm'}
                onPress={() => action(menuFor.is_pinned ? 'unpin' : 'pin', menuFor)}
              />
            )}
            {menuFor && (menuFor.sender_id === me?.id || isAdmin) && (
              <MenuItem icon="trash-outline" label="Thu hồi tin nhắn" danger onPress={() => action('delete', menuFor)} />
            )}
            <MenuItem icon="close" label="Đóng" onPress={() => setMenuFor(null)} />
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewer(null)} accessibilityLabel="Đóng ảnh">
          {viewer && <Image source={{ uri: viewer }} style={{ width: '100%', height: '80%' }} contentFit="contain" />}
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuItem({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: Colors.background }]}>
      <Ionicons name={icon} size={24} color={danger ? Colors.danger : Colors.text} />
      <Txt variant="bodyStrong" color={danger ? Colors.danger : Colors.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pinned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.warningSoft,
  },
  day: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.sm,
  },
  line: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, gap: 2 },
  mine: { backgroundColor: Colors.primary, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: Colors.card, borderBottomLeftRadius: 6, ...Shadow.sm },
  deleted: { backgroundColor: Colors.divider },
  image: { width: 220, height: 220, borderRadius: 12, backgroundColor: Colors.divider, marginVertical: 2 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  iconBtn: { height: 48, justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 130,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: Colors.background,
    fontFamily: Font.regular,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.warningSoft,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 16 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
});

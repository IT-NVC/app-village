import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Forbidden } from '@/components/forbidden';
import { Button, EmptyState, PageHeader, Txt } from '@/components/ui';
import { Colors, Font, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { dayTitle, shortWeekday } from '@/lib/calendar';
import { fetchAllRows, norm } from '@/lib/manage-data';
import { useRank } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Tải dữ liệu
// ---------------------------------------------------------------------------

export type LoadState<T> = {
  data: T | null;
  failed: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
};

/**
 * Tải dữ liệu khi mở màn hình và MỖI KHI QUAY LẠI màn hình (vd. sau khi sửa xong ở màn hình con).
 * `key` đổi giá trị (vd. đổi bộ lọc) thì tải lại.
 */
export function useLoad<T>(fn: () => Promise<T>, key: string | number = 0): LoadState<T> {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void key;
      let alive = true;
      fnRef.current()
        .then((d) => {
          if (!alive) return;
          setFailed(false);
          setData(d);
        })
        .catch(() => alive && setFailed(true));
      return () => {
        alive = false;
      };
    }, [key]),
  );

  const reload = useCallback(async () => {
    try {
      setData(await fnRef.current());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  return { data, failed, refreshing, reload, refresh };
}

/** Hiện vòng quay / lỗi + nút thử lại, rồi mới hiện nội dung khi đã có dữ liệu */
export function Async<T>({ state, children }: { state: LoadState<T>; children: (data: T) => ReactNode }) {
  if (state.data === null) {
    if (state.failed) {
      return (
        <EmptyState
          icon="cloud-offline-outline"
          title="Không tải được dữ liệu"
          message="Vui lòng kiểm tra mạng rồi thử lại."
          action={<Button title="Thử lại" icon="refresh" onPress={state.reload} />}
        />
      );
    }
    return <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />;
  }
  return <>{children(state.data)}</>;
}

export function refreshControl<T>(state: LoadState<T>) {
  return <RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} colors={[Colors.primary]} />;
}

// ---------------------------------------------------------------------------
// Khung màn hình quản lý
// ---------------------------------------------------------------------------

/** Kiểm quyền + tiêu đề có nút quay lại. `minRank`: 1 = cán bộ thôn, 2 = Bí thư / Trưởng thôn. */
export function ManageShell({
  title,
  subtitle,
  minRank = 1,
  right,
  children,
  forbidden,
}: {
  title: string;
  subtitle?: string;
  minRank?: number;
  right?: ReactNode;
  children: ReactNode;
  forbidden?: string;
}) {
  const rank = useRank();
  if (rank < minRank) return <Forbidden message={forbidden ?? (minRank >= 2 ? 'Chức năng này dành cho Bí thư / Trưởng thôn.' : undefined)} />;
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PageHeader title={title} subtitle={subtitle} right={right} onBack={() => (router.canGoBack() ? router.back() : router.replace('/manage'))} />
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Thành phần nhỏ
// ---------------------------------------------------------------------------

export function SearchBox({ value, onChange, placeholder = 'Tìm kiếm…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={22} color={Colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        style={styles.searchInput}
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityLabel="Xoá tìm kiếm">
          <Ionicons name="close-circle" size={22} color={Colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Dải lọc dạng viên thuốc, cuộn ngang */
export function PillTabs<T extends string>({
  items,
  value,
  onChange,
  scroll = true,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
  scroll?: boolean;
}) {
  const pills = items.map((it) => {
    const active = it.key === value;
    return (
      <Pressable
        key={it.key}
        onPress={() => onChange(it.key)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        style={[styles.pill, active && styles.pillActive]}>
        <Txt variant="caption" color={active ? Colors.white : Colors.primaryText} style={{ fontFamily: Font.semibold }}>
          {it.label}
        </Txt>
      </Pressable>
    );
  });
  if (!scroll) return <View style={styles.pillRow}>{pills}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.pillRow, { paddingHorizontal: Spacing.lg }]} style={{ flexGrow: 0 }}>
      {pills}
    </ScrollView>
  );
}

export function ToggleRow({ label, desc, value, onChange, disabled }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong">{label}</Txt>
        {desc ? (
          <Txt variant="caption" color={Colors.textSecondary}>
            {desc}
          </Txt>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: Colors.border, true: Colors.primaryBorder }}
        thumbColor={value ? Colors.primary : '#f4f4f4'}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** Thẻ danh sách chuẩn: viền mềm + đổ bóng nhẹ, bấm được */
export function RowCard({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: object }) {
  if (!onPress) return <View style={[styles.rowCard, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.rowCard, style, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

/** Danh sách có thanh tìm kiếm / bộ lọc ở trên, kéo xuống để tải lại */
export function ManageList<T>({
  state,
  data,
  header,
  renderItem,
  keyOf,
  empty,
}: {
  state: LoadState<unknown>;
  data: T[];
  header?: ReactNode;
  renderItem: (item: T) => ReactNode;
  keyOf: (item: T) => string;
  empty: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; message?: string };
}) {
  return (
    <FlatList
      data={data}
      keyExtractor={keyOf}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm, flexGrow: 1, paddingBottom: Spacing.xl }}
      refreshControl={refreshControl(state)}
      ListHeaderComponent={header ? <View style={{ gap: Spacing.sm, marginBottom: Spacing.xs }}>{header}</View> : undefined}
      ListEmptyComponent={<EmptyState icon={empty.icon} title={empty.title} message={empty.message} />}
      renderItem={({ item }) => <>{renderItem(item)}</>}
      initialNumToRender={20}
      windowSize={9}
    />
  );
}

// ---------------------------------------------------------------------------
// Biểu mẫu trượt từ dưới lên
// ---------------------------------------------------------------------------

export function FormSheet({
  visible,
  title,
  onClose,
  onSave,
  saving,
  saveText = 'Lưu',
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  saveText?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Đóng" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}>
          <Txt variant="title">{title}</Txt>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }} contentContainerStyle={{ gap: Spacing.md, paddingVertical: Spacing.sm }}>
            {children}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <Button title="Huỷ" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title={saveText} onPress={onSave} loading={saving} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Chọn ngày giờ (không cần thư viện: dải ngày + ô giờ / phút)
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

export function formatDateTime(d: Date) {
  return `${dayTitle(d)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateTimePick({
  label,
  value,
  onChange,
  optional,
  hint,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
  optional?: boolean;
  hint?: string;
}) {
  const days = useMemo(() => {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    return Array.from({ length: 90 }, (_, i) => new Date(s.getTime() + i * 86400e3));
  }, []);

  function pickDay(d: Date) {
    const n = new Date(d);
    n.setHours(value?.getHours() ?? 8, value?.getMinutes() ?? 0, 0, 0);
    onChange(n);
  }
  function pickHour(h: number) {
    const n = new Date(value ?? days[0]);
    n.setHours(h, value ? value.getMinutes() : 0, 0, 0);
    onChange(n);
  }
  function pickMinute(m: number) {
    const n = new Date(value ?? days[0]);
    if (!value) n.setHours(8);
    n.setMinutes(m, 0, 0);
    onChange(n);
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt variant="label">{label}</Txt>
        {optional && value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={10}>
            <Txt variant="caption" color={Colors.danger} style={{ fontFamily: Font.semibold }}>
              Bỏ chọn
            </Txt>
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.dtSummary, value && { backgroundColor: Colors.primarySoft, borderColor: Colors.primaryBorder }]}>
        <Ionicons name="calendar" size={20} color={value ? Colors.primaryText : Colors.textMuted} />
        <Txt variant="bodyStrong" color={value ? Colors.primaryDark : Colors.textMuted}>
          {value ? formatDateTime(value) : 'Chưa chọn'}
        </Txt>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map((d) => {
          const sel = value?.toDateString() === d.toDateString();
          return (
            <Pressable key={d.getTime()} onPress={() => pickDay(d)} accessibilityRole="radio" accessibilityState={{ selected: sel }} accessibilityLabel={dayTitle(d)} style={[styles.dtDay, sel && styles.dtSel]}>
              <Txt variant="caption" color={sel ? Colors.white : Colors.textSecondary}>
                {shortWeekday(d)}
              </Txt>
              <Txt variant="subtitle" color={sel ? Colors.white : Colors.text}>
                {d.getDate()}
              </Txt>
              <Txt variant="caption" color={sel ? Colors.white : Colors.textMuted} style={{ fontSize: 12, lineHeight: 16 }}>
                Th{d.getMonth() + 1}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>
      <Txt variant="caption" color={Colors.textSecondary}>
        Giờ
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {HOURS.map((h) => {
          const sel = value?.getHours() === h;
          return (
            <Pressable key={h} onPress={() => pickHour(h)} accessibilityRole="radio" accessibilityState={{ selected: sel }} style={[styles.dtChip, sel && styles.dtSel]}>
              <Txt variant="bodyStrong" color={sel ? Colors.white : Colors.text}>
                {pad(h)}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>
      <Txt variant="caption" color={Colors.textSecondary}>
        Phút
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {MINUTES.map((m) => {
          const sel = value?.getMinutes() === m;
          return (
            <Pressable key={m} onPress={() => pickMinute(m)} accessibilityRole="radio" accessibilityState={{ selected: sel }} style={[styles.dtChip, { flex: 1 }, sel && styles.dtSel]}>
              <Txt variant="bodyStrong" color={sel ? Colors.white : Colors.text}>
                {pad(m)}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      {hint ? (
        <Txt variant="caption" color={Colors.textMuted}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Chọn người (tìm không dấu, chọn một hoặc nhiều)
// ---------------------------------------------------------------------------

export type Person = { id: string; full_name: string; area_name: string | null };

let peopleCache: Person[] | null = null;
async function fetchPeople(): Promise<Person[]> {
  const rows = await fetchAllRows((from, to) => supabase.from('member_directory').select('id, full_name, area_name').range(from, to));
  peopleCache = rows
    .filter((r): r is typeof r & { id: string } => !!r.id)
    .map((r) => ({ id: r.id, full_name: r.full_name ?? '(chưa có tên)', area_name: r.area_name }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
  return peopleCache;
}

export function PersonPicker({
  visible,
  title,
  exclude = [],
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  exclude?: string[];
  onClose: () => void;
  onPick: (ids: string[]) => void | Promise<void>;
}) {
  const [people, setPeople] = useState<Person[] | null>(peopleCache);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) fetchPeople().then(setPeople);
  }, [visible]);

  const list = useMemo(() => {
    const k = norm(q);
    return (people ?? []).filter((p) => !exclude.includes(p.id) && (!k || norm(p.full_name).includes(k)));
  }, [people, q, exclude]);

  async function confirm() {
    setBusy(true);
    await onPick(selected);
    setBusy(false);
    setSelected([]);
    setQ('');
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <PageHeader title={title} subtitle="Chỉ người đã có tài khoản hoạt động" onBack={onClose} />
        <View style={{ padding: Spacing.lg, paddingBottom: Spacing.sm }}>
          <SearchBox value={q} onChange={setQ} placeholder="Gõ tên (không cần dấu)" />
        </View>
        {people === null ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : (
          <FlatList
            data={list}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 6, paddingBottom: 120 }}
            ListEmptyComponent={<EmptyState icon="people-outline" title="Không tìm thấy" />}
            renderItem={({ item }) => {
              const on = selected.includes(item.id);
              return (
                <Pressable
                  onPress={() => setSelected((s) => (on ? s.filter((x) => x !== item.id) : [...s, item.id]))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[styles.person, on && { borderColor: Colors.primary, backgroundColor: Colors.primarySoft }]}>
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={26} color={on ? Colors.primary : Colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{item.full_name}</Txt>
                    {item.area_name ? (
                      <Txt variant="caption" color={Colors.textSecondary}>
                        {item.area_name}
                      </Txt>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
        <View style={styles.pickerBar}>
          <Button title={selected.length ? `Thêm ${selected.length} người` : 'Chọn người để thêm'} icon="person-add" disabled={selected.length === 0} loading={busy} onPress={confirm} />
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Chọn NHÂN KHẨU (kể cả người chưa có tài khoản) — dùng cho hộ gia đình
// ---------------------------------------------------------------------------

export type ResidentOpt = { id: string; full_name: string; area_name: string | null; household_id: string | null; household_label: string | null };

async function fetchResidentOptions(): Promise<ResidentOpt[]> {
  const rows = await fetchAllRows((from, to) =>
    supabase.from('residents').select('id, full_name, household_id, areas(name), households(code, head_name)').order('full_name').range(from, to),
  );
  return rows.map((r) => {
    const a = Array.isArray(r.areas) ? r.areas[0] : r.areas;
    const h = Array.isArray(r.households) ? r.households[0] : r.households;
    return { id: r.id, full_name: r.full_name, household_id: r.household_id, area_name: a?.name ?? null, household_label: h ? `Hộ ${h.head_name}${h.code ? ` (${h.code})` : ''}` : null };
  });
}

export function ResidentPicker({
  visible,
  title,
  exclude = [],
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  exclude?: string[];
  onClose: () => void;
  onPick: (ids: string[]) => void | Promise<void>;
}) {
  const [people, setPeople] = useState<ResidentOpt[] | null>(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) fetchResidentOptions().then(setPeople);
  }, [visible]);

  const list = useMemo(() => {
    const k = norm(q);
    return (people ?? []).filter((p) => !exclude.includes(p.id) && (!k || norm(p.full_name).includes(k))).slice(0, 80);
  }, [people, q, exclude]);

  async function confirm() {
    setBusy(true);
    await onPick(selected);
    setBusy(false);
    setSelected([]);
    setQ('');
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <PageHeader title={title} subtitle="Gõ tên để tìm (không cần dấu)" onBack={onClose} />
        <View style={{ padding: Spacing.lg, paddingBottom: Spacing.sm }}>
          <SearchBox value={q} onChange={setQ} placeholder="Tên nhân khẩu" />
        </View>
        {people === null ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : (
          <FlatList
            data={list}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 6, paddingBottom: 120 }}
            ListEmptyComponent={<EmptyState icon="people-outline" title={q ? 'Không tìm thấy' : 'Gõ tên để tìm'} />}
            renderItem={({ item }) => {
              const on = selected.includes(item.id);
              return (
                <Pressable
                  onPress={() => setSelected((s) => (on ? s.filter((x) => x !== item.id) : [...s, item.id]))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[styles.person, on && { borderColor: Colors.primary, backgroundColor: Colors.primarySoft }]}>
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={26} color={on ? Colors.primary : Colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{item.full_name}</Txt>
                    <Txt variant="caption" color={Colors.textSecondary}>
                      {[item.area_name, item.household_label ? `đang ở ${item.household_label}` : 'chưa thuộc hộ nào'].filter(Boolean).join(' · ')}
                    </Txt>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
        <View style={styles.pickerBar}>
          <Button title={selected.length ? `Thêm ${selected.length} người` : 'Chọn người để thêm'} icon="person-add" disabled={selected.length === 0} loading={busy} onPress={confirm} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  searchInput: { flex: 1, fontFamily: Font.medium, fontSize: FontSize.body, color: Colors.text, paddingVertical: 8 },
  pillRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 2 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primaryBorder, backgroundColor: Colors.card },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 56 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md },
  dtSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card },
  dtDay: { width: 62, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.divider, backgroundColor: Colors.card },
  dtChip: { minWidth: 46, height: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.divider, backgroundColor: Colors.card },
  dtSel: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.divider, backgroundColor: Colors.card },
  pickerBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Spacing.lg, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.divider },
});

import type { Database } from '@thon/shared';

import type { IconName } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type EventCategory = Database['public']['Enums']['event_category'];
export type BookingStatus = Database['public']['Enums']['booking_status'];

export const EVENT_STYLE: Record<EventCategory, { label: string; icon: IconName; color: string; bg: string }> = {
  hop: { label: 'Họp', icon: 'people', color: Colors.info, bg: Colors.infoSoft },
  van_hoa: { label: 'Văn hoá, lễ hội', icon: 'musical-notes', color: '#C2185B', bg: '#FCE4EC' },
  ve_sinh: { label: 'Vệ sinh môi trường', icon: 'leaf', color: Colors.primaryText, bg: Colors.primarySoft },
  y_te: { label: 'Y tế, tiêm chủng', icon: 'medkit', color: Colors.danger, bg: Colors.dangerSoft },
  the_thao: { label: 'Thể thao', icon: 'football', color: Colors.warning, bg: Colors.warningSoft },
  khac: { label: 'Khác', icon: 'calendar', color: Colors.purple, bg: Colors.purpleSoft },
};

export const BOOKING_STATUS: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  cho_duyet: { label: 'Chờ duyệt', color: Colors.warning, bg: Colors.warningSoft },
  da_duyet: { label: 'Đã duyệt', color: Colors.success, bg: Colors.successSoft },
  tu_choi: { label: 'Không được duyệt', color: Colors.danger, bg: Colors.dangerSoft },
  da_huy: { label: 'Đã huỷ', color: Colors.textMuted, bg: Colors.divider },
};

/** Một mục trên lịch: sự kiện của thôn, hoặc lịch đặt nhà văn hoá đã duyệt */
export type AgendaItem = {
  key: string;
  kind: 'event' | 'booking';
  title: string;
  detail: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  icon: IconName;
  color: string;
  bg: string;
};

export type Venue = { id: string; name: string; description: string | null };
export type MyBooking = {
  id: string;
  purpose: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  review_note: string | null;
  venue: string;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export async function fetchAgenda(days = 60): Promise<AgendaItem[]> {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + days * 86400e3);
  const [ev, bk] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, description, category, location, starts_at, ends_at, areas(name)')
      .gte('starts_at', from.toISOString())
      .lt('starts_at', to.toISOString())
      .order('starts_at'),
    supabase
      .from('venue_bookings')
      .select('id, purpose, starts_at, ends_at, venues(name)')
      .eq('status', 'da_duyet')
      .gte('ends_at', from.toISOString())
      .lt('starts_at', to.toISOString())
      .order('starts_at'),
  ]);
  const items: AgendaItem[] = [
    ...(ev.data ?? []).map((e) => {
      const s = EVENT_STYLE[e.category];
      const area = one(e.areas)?.name;
      return {
        key: `e-${e.id}`,
        kind: 'event' as const,
        title: e.title,
        detail: [area ? `Dành cho ${area}` : null, e.description].filter(Boolean).join(' · ') || null,
        location: e.location,
        starts_at: e.starts_at,
        ends_at: e.ends_at,
        ...s,
      };
    }),
    ...(bk.data ?? []).map((b) => ({
      key: `b-${b.id}`,
      kind: 'booking' as const,
      title: `${one(b.venues)?.name ?? 'Địa điểm'} đã có người đặt`,
      detail: b.purpose,
      location: one(b.venues)?.name ?? null,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      icon: 'lock-closed' as IconName,
      color: Colors.textSecondary,
      bg: Colors.divider,
    })),
  ];
  return items.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export async function fetchMyBookings(userId: string): Promise<MyBooking[]> {
  const { data } = await supabase
    .from('venue_bookings')
    .select('id, purpose, starts_at, ends_at, status, review_note, venues(name)')
    .eq('requester_id', userId)
    .gte('ends_at', new Date(Date.now() - 7 * 86400e3).toISOString())
    .order('starts_at');
  return (data ?? []).map((b) => ({ ...b, venue: one(b.venues)?.name ?? '' }));
}

export async function fetchVenues(): Promise<Venue[]> {
  const { data } = await supabase.from('venues').select('id, name, description').eq('is_active', true).order('sort_order');
  return data ?? [];
}

/** Lịch đã duyệt của một địa điểm trong một ngày (để biết khung giờ bận) */
export async function fetchBusy(venueId: string, day: Date) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400e3);
  const { data } = await supabase
    .from('venue_bookings')
    .select('starts_at, ends_at')
    .eq('venue_id', venueId)
    .eq('status', 'da_duyet')
    .lt('starts_at', end.toISOString())
    .gt('ends_at', start.toISOString());
  return data ?? [];
}

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const pad = (n: number) => String(n).padStart(2, '0');
export const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export function dayTitle(d: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const base = `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  if (d.toDateString() === today.toDateString()) return `Hôm nay · ${base}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Ngày mai · ${base}`;
  return base;
}
export const shortWeekday = (d: Date) => (d.getDay() === 0 ? 'CN' : `T${d.getDay() + 1}`);

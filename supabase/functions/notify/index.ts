// Gửi thông báo đẩy (Expo Push) sau một sự kiện.
// Người gọi chỉ báo "sự kiện gì, mã nào" — MÁY CHỦ tự kiểm tra quyền và tự xác định người nhận,
// nên không thể dùng hàm này để gửi tin tới người tuỳ ý.
// Mỗi sự kiện chỉ gửi một lần (bảng push_log).
// Đặt PUSH_DRY_RUN=1 để chạy thử: không gửi thật, trả về danh sách người nhận (dùng cho kiểm thử).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Kind = 'announcement' | 'sos' | 'sos_update' | 'report_new' | 'report_update' | 'message' | 'poll' | 'event' | 'booking_new' | 'booking_review';
type Push = { title: string; body: string; url: string; urgent?: boolean };
type Plan = { logKind: string; refId: string; recipients: string[]; push: Push } | { error: string; status: number };

const RECENT_MS = 10 * 60 * 1000; // chỉ báo cho sự kiện vừa xảy ra
const isRecent = (iso: string) => Date.now() - new Date(iso).getTime() < RECENT_MS;
const PRIORITY_PREFIX: Record<string, string> = { khan: '🔴 KHẨN: ', quan_trong: '⭐ ', thuong: '' };
const REPORT_STATUS: Record<string, string> = { moi: 'Mới gửi', dang_xu_ly: 'Đang xử lý', hoan_thanh: 'Đã hoàn thành', tu_choi: 'Từ chối' };
const SOS_STATUS: Record<string, string> = {
  da_tiep_nhan: 'Cán bộ thôn đã tiếp nhận tín hiệu khẩn cấp của bạn và đang tới hỗ trợ.',
  da_xu_ly: 'Tín hiệu khẩn cấp của bạn đã được xử lý xong.',
};
const BOOKING_STATUS: Record<string, string> = { da_duyet: '✅ Đã duyệt', tu_choi: '❌ Không được duyệt' };
const pad = (n: number) => String(n).padStart(2, '0');
/** Giờ Việt Nam (UTC+7) dạng 14:00 20/11 */
const vnTime = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 7 * 3600e3);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
};
const short = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

async function activeUsers(db: SupabaseClient, filter: (q: any) => any): Promise<string[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await filter(db.from('profiles').select('id').eq('status', 'active'));
  return (data ?? []).map((r: { id: string }) => r.id);
}

async function nameOf(db: SupabaseClient, userId: string | null) {
  if (!userId) return 'Người dân';
  const { data } = await db.from('profiles').select('username, residents(full_name)').eq('id', userId).maybeSingle();
  const r = Array.isArray(data?.residents) ? data?.residents[0] : data?.residents;
  return (r as { full_name?: string } | null)?.full_name ?? data?.username ?? 'Người dân';
}

async function plan(db: SupabaseClient, kind: Kind, id: string, caller: string, rank: number): Promise<Plan> {
  switch (kind) {
    case 'announcement': {
      const { data: a } = await db.from('announcements').select('id, title, content, priority, sender_id, scheduled_at').eq('id', id).maybeSingle();
      if (!a) return { error: 'Không tìm thấy thông báo', status: 404 };
      if (a.sender_id !== caller && rank < 1) return { error: 'Không có quyền', status: 403 };
      if (new Date(a.scheduled_at) > new Date()) return { error: 'Thông báo hẹn giờ chưa tới giờ gửi', status: 409 };
      const { data: ids } = await db.rpc('announcement_recipients', { p_announcement: id });
      return {
        logKind: kind,
        refId: id,
        recipients: ((ids ?? []) as string[]).filter((u) => u !== a.sender_id),
        push: { title: `${PRIORITY_PREFIX[a.priority] ?? ''}${a.title}`, body: short(a.content), url: `/announcement/${id}`, urgent: a.priority === 'khan' },
      };
    }
    case 'sos': {
      const { data: e } = await db.from('sos_events').select('id, user_id, message, created_at').eq('id', id).maybeSingle();
      if (!e) return { error: 'Không tìm thấy tín hiệu', status: 404 };
      if (e.user_id !== caller || !isRecent(e.created_at)) return { error: 'Không có quyền', status: 403 };
      const who = await nameOf(db, e.user_id);
      return {
        logKind: kind,
        refId: id,
        recipients: await activeUsers(db, (q) => q.not('leadership_role', 'is', null)),
        push: { title: '🚨 CÓ TÍN HIỆU KHẨN CẤP', body: `${who}${e.message ? ` — ${e.message}` : ''}. Mở trang quản trị để xử lý.`, url: '/', urgent: true },
      };
    }
    case 'sos_update': {
      if (rank < 1) return { error: 'Không có quyền', status: 403 };
      const { data: e } = await db.from('sos_events').select('id, user_id, status').eq('id', id).maybeSingle();
      if (!e || !SOS_STATUS[e.status]) return { error: 'Không có gì để báo', status: 409 };
      return {
        logKind: `sos_${e.status}`,
        refId: id,
        recipients: [e.user_id],
        push: { title: 'Khẩn cấp', body: SOS_STATUS[e.status], url: '/sos', urgent: true },
      };
    }
    case 'report_new': {
      const { data: r } = await db.from('reports').select('id, reporter_id, title, created_at').eq('id', id).maybeSingle();
      if (!r) return { error: 'Không tìm thấy phản ánh', status: 404 };
      if (r.reporter_id !== caller || !isRecent(r.created_at)) return { error: 'Không có quyền', status: 403 };
      return {
        logKind: kind,
        refId: id,
        recipients: await activeUsers(db, (q) => q.in('leadership_role', ['bi_thu', 'truong_thon'])),
        push: { title: '🛠️ Phản ánh mới', body: `${await nameOf(db, r.reporter_id)}: ${short(r.title)}`, url: '/' },
      };
    }
    case 'report_update': {
      if (rank < 2) return { error: 'Không có quyền', status: 403 };
      // Báo cho lần cập nhật mới nhất do chính người gọi thực hiện
      const { data: u } = await db
        .from('report_updates')
        .select('id, status, note, created_at, reports(reporter_id, title)')
        .eq('report_id', id)
        .eq('actor_id', caller)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!u || !isRecent(u.created_at)) return { error: 'Không có cập nhật mới', status: 409 };
      const rep = (Array.isArray(u.reports) ? u.reports[0] : u.reports) as { reporter_id: string; title: string };
      return {
        logKind: kind,
        refId: u.id,
        recipients: [rep.reporter_id],
        push: {
          title: `Phản ánh: ${REPORT_STATUS[u.status] ?? u.status}`,
          body: short(`${rep.title}${u.note ? ` — ${u.note}` : ''}`),
          url: `/report/${id}`,
        },
      };
    }
    case 'message': {
      const { data: m } = await db.from('messages').select('id, group_id, sender_id, content, image_path, deleted_at, created_at, chat_groups(name)').eq('id', id).maybeSingle();
      if (!m || m.deleted_at) return { error: 'Không tìm thấy tin nhắn', status: 404 };
      if (m.sender_id !== caller || !isRecent(m.created_at)) return { error: 'Không có quyền', status: 403 };
      const { data: members } = await db.from('chat_group_members').select('user_id').eq('group_id', m.group_id);
      const g = (Array.isArray(m.chat_groups) ? m.chat_groups[0] : m.chat_groups) as { name: string } | null;
      const who = (await nameOf(db, m.sender_id)).split(' ').slice(-2).join(' ');
      return {
        logKind: kind,
        refId: id,
        recipients: (members ?? []).map((x) => x.user_id).filter((u) => u !== caller),
        push: { title: g?.name ?? 'Tin nhắn mới', body: `${who}: ${m.content ? short(m.content) : '📷 Ảnh'}`, url: `/group/${m.group_id}` },
      };
    }
    case 'poll': {
      if (rank < 1) return { error: 'Không có quyền', status: 403 };
      const { data: p } = await db.from('polls').select('id, title').eq('id', id).maybeSingle();
      if (!p) return { error: 'Không tìm thấy khảo sát', status: 404 };
      const { data: ids } = await db.rpc('poll_recipients', { p_poll: id });
      return {
        logKind: kind,
        refId: id,
        recipients: (ids ?? []) as string[],
        push: { title: '🗳️ Thôn đang lấy ý kiến', body: short(p.title), url: `/polls/${id}` },
      };
    }
    case 'event': {
      if (rank < 1) return { error: 'Không có quyền', status: 403 };
      const { data: ev } = await db.from('events').select('id, title, location, starts_at, area_id').eq('id', id).maybeSingle();
      if (!ev) return { error: 'Không tìm thấy sự kiện', status: 404 };
      // Sự kiện của một khu -> báo người khu đó; sự kiện toàn thôn -> báo mọi người
      let recipients = await activeUsers(db, (q) => q);
      if (ev.area_id) {
        const { data: rs } = await db.from('profiles').select('id, residents!inner(area_id)').eq('status', 'active').eq('residents.area_id', ev.area_id);
        recipients = (rs ?? []).map((r) => r.id);
      }
      return {
        logKind: kind,
        refId: id,
        recipients: recipients.filter((u) => u !== caller),
        push: { title: `📅 ${ev.title}`, body: `${vnTime(ev.starts_at)}${ev.location ? ` · ${ev.location}` : ''}`, url: '/calendar' },
      };
    }
    case 'booking_new': {
      const { data: b } = await db.from('venue_bookings').select('id, requester_id, purpose, starts_at, created_at, venues(name)').eq('id', id).maybeSingle();
      if (!b) return { error: 'Không tìm thấy yêu cầu', status: 404 };
      if (b.requester_id !== caller || !isRecent(b.created_at)) return { error: 'Không có quyền', status: 403 };
      const v = (Array.isArray(b.venues) ? b.venues[0] : b.venues) as { name: string } | null;
      return {
        logKind: kind,
        refId: id,
        recipients: await activeUsers(db, (q) => q.not('leadership_role', 'is', null)),
        push: { title: `Yêu cầu đặt ${v?.name ?? 'địa điểm'}`, body: `${await nameOf(db, b.requester_id)}: ${short(b.purpose, 80)} — ${vnTime(b.starts_at)}`, url: '/' },
      };
    }
    case 'booking_review': {
      if (rank < 1) return { error: 'Không có quyền', status: 403 };
      const { data: b } = await db.from('venue_bookings').select('id, requester_id, status, review_note, starts_at, venues(name)').eq('id', id).maybeSingle();
      if (!b || !BOOKING_STATUS[b.status]) return { error: 'Không có gì để báo', status: 409 };
      const v = (Array.isArray(b.venues) ? b.venues[0] : b.venues) as { name: string } | null;
      return {
        logKind: `booking_${b.status}`,
        refId: id,
        recipients: [b.requester_id],
        push: {
          title: `${BOOKING_STATUS[b.status]}: ${v?.name ?? 'đặt lịch'}`,
          body: `Lịch ${vnTime(b.starts_at)}${b.review_note ? ` — ${b.review_note}` : ''}`,
          url: '/calendar',
        },
      };
    }
    default:
      return { error: 'Loại sự kiện không hợp lệ', status: 400 };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await caller.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
  if (!u.user) return reply(401, { error: 'Chưa đăng nhập' });
  const { data: rank } = await caller.rpc('my_rank');

  let body: { kind?: Kind; id?: string };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Dữ liệu không hợp lệ' });
  }
  if (!body.kind || !body.id) return reply(400, { error: 'Thiếu kind hoặc id' });

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const p = await plan(db, body.kind, body.id, u.user.id, (rank as number) ?? 0);
  if ('error' in p) return reply(p.status, { error: p.error });

  // Chống gửi trùng: ghi nhật ký trước; đã có thì bỏ qua
  const { error: dup } = await db.from('push_log').insert({ kind: p.logKind, ref_id: p.refId, recipients: p.recipients.length });
  if (dup) return reply(200, { ok: true, skipped: 'Đã gửi trước đó' });

  const { data: tokens } = p.recipients.length
    ? await db.from('push_tokens').select('token, user_id').in('user_id', p.recipients)
    : { data: [] };

  if (Deno.env.get('PUSH_DRY_RUN') === '1') {
    return reply(200, { ok: true, dryRun: true, recipients: p.recipients, tokens: (tokens ?? []).length, push: p.push });
  }

  const messages = (tokens ?? []).map((t) => ({
    to: t.token,
    title: p.push.title,
    body: p.push.body,
    data: { url: p.push.url },
    sound: 'default',
    priority: 'high',
    channelId: p.push.urgent ? 'urgent' : 'default',
  }));

  let sent = 0;
  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(expoToken ? { Authorization: `Bearer ${expoToken}` } : {}),
      },
      body: JSON.stringify(chunk),
    });
    const json = await res.json().catch(() => ({}));
    const tickets = (json?.data ?? []) as { status: string; details?: { error?: string } }[];
    // Thiết bị đã gỡ app / đổi máy -> xoá mã cũ
    const dead = tickets.map((t, j) => (t.details?.error === 'DeviceNotRegistered' ? chunk[j].to : null)).filter(Boolean) as string[];
    if (dead.length) await db.from('push_tokens').delete().in('token', dead);
    sent += tickets.filter((t) => t.status === 'ok').length;
  }

  return reply(200, { ok: true, recipients: p.recipients.length, devices: messages.length, sent });
});

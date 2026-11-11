// Kiểm thử truy vấn của "Khu cán bộ" trong app (tab Quản lý) — chạy trên Supabase LOCAL.
// Chạy: npm run db:seed && node supabase/tests/manage.mjs
import { createClient } from '@supabase/supabase-js';

const URL = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const RUN = Date.now().toString(36);
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra ?? ''); } };

const bithu = createClient(URL, ANON, opts);
const li = await bithu.auth.signInWithPassword({ email: 'bithu@thongnhat.local', password: '123456' });
if (li.error) throw new Error('Chạy npm run db:seed trước');
const khuA = (await bithu.from('areas').select('id').eq('name', 'Khu A').single()).data;

async function resident(name) {
  const { data: r } = await bithu.from('residents').insert({ full_name: `${name} ${RUN}`, area_id: khuA.id, phone: '0909000111' }).select('activation_code').single();
  const c = createClient(URL, ANON, opts);
  const su = await c.auth.signUp({ email: `${name}${RUN}@thongnhat.local`, password: 'matkhau1', options: { data: { username: `${name}${RUN}` } } });
  await c.rpc('activate_account', { p_code: r.activation_code });
  c.id = su.data.user.id;
  return c;
}
const photon = await resident('mp');
await bithu.rpc('set_leadership_role', { p_user_id: photon.id, p_role: 'pho_thon' });
const dan = await resident('md');
const self = createClient(URL, ANON, opts);
const sr = await self.auth.signUp({ email: `ms${RUN}@thongnhat.local`, password: 'matkhau1', options: { data: { username: `ms${RUN}` } } });
await self.rpc('register_resident', { p_full_name: `Tự Khai ${RUN}`, p_area_id: khuA.id, p_phone: '0909000222' });

console.log('\nSố việc đang chờ (tab Quản lý)');
const cnt = async (c, t, col, v) => (await c.from(t).select('id', { count: 'exact', head: true }).eq(col, v)).count ?? 0;
check('Phó thôn đếm được tài khoản chờ duyệt', (await cnt(photon, 'profiles', 'status', 'pending')) >= 1);
check('Người dân đếm tài khoản chờ duyệt = 0 (không lộ)', (await cnt(dan, 'profiles', 'status', 'pending')) === 0);

console.log('\nSOS');
const sos = (await dan.from('sos_events').insert({ user_id: dan.id, message: 'Tai nạn', latitude: 21.2, longitude: 105.8 }).select('id').single()).data;
const since = new Date(Date.now() - 3 * 86400e3).toISOString();
const sosQ = (c) => c.from('sos_events')
  .select('id, status, message, latitude, longitude, created_at, sender:profiles!sos_events_user_id_fkey(username, residents(full_name, phone, areas(name))), handler:profiles!sos_events_handled_by_fkey(username, residents(full_name))')
  .or(`status.neq.da_xu_ly,created_at.gte.${since}`).order('created_at', { ascending: false }).limit(50);
const s1 = await sosQ(photon);
const mine = s1.data?.find((e) => e.id === sos.id);
check('Phó thôn thấy SOS kèm tên, SĐT, khu', mine?.sender?.residents?.full_name && mine.sender.residents.phone && mine.sender.residents.areas?.name === 'Khu A', s1.error?.message);
const s2 = await sosQ(createClient(URL, ANON, opts));
check('Khách không thấy SOS', !!s2.error || s2.data.length === 0);
check('Phó thôn tiếp nhận SOS từ app', !(await photon.rpc('handle_sos', { p_sos_id: sos.id, p_status: 'da_tiep_nhan' })).error);
const after = (await sosQ(photon)).data?.find((e) => e.id === sos.id);
check('Hiện người xử lý', !!after?.handler?.residents?.full_name);

console.log('\nDuyệt tài khoản');
const pend = await photon.from('profiles').select('id, username, created_at, residents(full_name, phone, birth_date, gender, note, areas(name), households(code, head_name))').eq('status', 'pending');
check('Phó thôn xem tài khoản chờ duyệt kèm SĐT', pend.data?.some((p) => p.id === sr.data.user.id && p.residents?.phone), pend.error?.message);
const dup = await photon.from('residents').select('id', { count: 'exact', head: true }).ilike('full_name', `Tự Khai ${RUN}`).eq('source', 'import').not('activation_code', 'is', null);
check('Dò trùng tên chạy được', !dup.error, dup.error?.message);
check('Phó thôn duyệt từ app', !(await photon.rpc('review_account', { p_user_id: sr.data.user.id, p_approve: true })).error);
check('Người dân KHÔNG duyệt được', !!(await dan.rpc('review_account', { p_user_id: sr.data.user.id, p_approve: true })).error);

console.log('\nPhản ánh');
const rep = (await dan.from('reports').insert({ reporter_id: dan.id, category: 'duong', title: `Ổ gà ${RUN}` }).select('id').single()).data;
const repQ = (c) => c.from('reports').select('id, category, title, images, status, created_at, reporter:profiles!reports_reporter_id_fkey(username, residents(full_name, areas(name)))').in('status', ['moi', 'dang_xu_ly']);
const r1 = await repQ(bithu);
check('Bí thư thấy phản ánh kèm tên + khu', r1.data?.some((r) => r.id === rep.id && r.reporter?.residents?.full_name), r1.error?.message);
check('Phó thôn KHÔNG thấy phản ánh (app ẩn mục này)', (await repQ(photon)).data?.length === 0);
const who = await bithu.from('reports').select('reporter:profiles!reports_reporter_id_fkey(username, residents(full_name, phone, areas(name)))').eq('id', rep.id).maybeSingle();
check('Chi tiết: lấy SĐT người gửi để gọi', who.data?.reporter?.residents?.phone === '0909000111', who.error?.message);
const ups = await bithu.from('report_updates').select('id, status, note, created_at, actor:profiles!report_updates_actor_id_fkey(username, residents(full_name))').eq('report_id', rep.id);
check('Chi tiết: tiến trình kèm người thực hiện', ups.data?.length === 1, ups.error?.message);

console.log('\nGửi thông báo');
const ann = await photon.rpc('send_announcement', { p_title: `Thông báo nhanh ${RUN}`, p_content: 'x', p_priority: 'thuong', p_target_all: false, p_area_ids: [khuA.id], p_org_ids: [] });
check('Phó thôn gửi thông báo theo khu từ app', !ann.error && typeof ann.data === 'string', ann.error?.message);

console.log('\nDuyệt đặt lịch');
const venue = (await dan.from('venues').select('id').order('sort_order')).data[0];
const at = (d, h) => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, 0, 0, 0); return t.toISOString(); };
const bk = (await dan.rpc('request_booking', { p_venue_id: venue.id, p_purpose: 'Họp họ', p_starts_at: at(9, 18), p_ends_at: at(9, 22) })).data;
const bq = await photon.from('venue_bookings').select('id, venue_id, purpose, starts_at, ends_at, venues(name), requester:profiles!venue_bookings_requester_id_fkey(username, residents(full_name, phone, areas(name)))').eq('status', 'cho_duyet');
check('Phó thôn thấy yêu cầu kèm tên, SĐT, địa điểm', bq.data?.some((b) => b.id === bk && b.venues?.name && b.requester?.residents?.phone), bq.error?.message);
check('Phó thôn duyệt từ app', !(await photon.rpc('review_booking', { p_booking_id: bk, p_approve: true, p_note: 'OK' })).error);
await photon.rpc('cancel_booking', { p_booking_id: bk });

console.log('\nGhi thu chi');
const fund = (await bithu.from('funds').insert({ name: `Quỹ test ${RUN}`, created_by: li.data.user.id }).select('id').single()).data;
const funds = await photon.rpc('fund_summaries');
check('Phó thôn chọn được quỹ', funds.data?.some((f) => f.id === fund.id && f.is_active));
const hh = await photon.rpc('household_options');
check('Phó thôn tìm được hộ', !hh.error && Array.isArray(hh.data), hh.error?.message);
const ins = await photon.from('fund_transactions').insert({ fund_id: fund.id, kind: 'thu', amount: 150000, occurred_on: new Date().toISOString().slice(0, 10), description: 'Đóng góp', payer_name: 'Ông A', created_by: photon.id });
check('Phó thôn ghi khoản thu từ app', !ins.error, ins.error?.message);
check('Người dân KHÔNG ghi thu chi', !!(await dan.from('fund_transactions').insert({ fund_id: fund.id, kind: 'thu', amount: 1, description: 'x', created_by: dan.id })).error);
await bithu.from('funds').delete().eq('id', fund.id);

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi\n`);
process.exit(fail ? 1 : 0);

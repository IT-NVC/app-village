// Kiểm thử end-to-end phân quyền & nghiệp vụ trên Supabase LOCAL.
// Chạy: npx supabase start && npx supabase db reset && node supabase/tests/e2e.mjs
// CẢNH BÁO: chỉ chạy với môi trường local — script tạo/xoá dữ liệu.
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
if (!URL.includes('127.0.0.1') && !URL.includes('localhost')) throw new Error('Chỉ chạy trên local!');

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(URL, SERVICE, opts);
const anon = createClient(URL, ANON, opts);
const RUN = Date.now().toString(36);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra ?? ''); }
}
const ok = (name, res) => check(name, !res.error, res.error?.message);
const denied = (name, res) => check(name, !!res.error, 'lẽ ra phải bị từ chối');

async function user(name) {
  const c = createClient(URL, ANON, opts);
  const { data, error } = await c.auth.signUp({
    email: `${name}-${RUN}@thongnhat.local`, password: 'matkhau123',
    options: { data: { username: `${name}_${RUN}` } },
  });
  if (error) throw error;
  c.id = data.user.id;
  return c;
}

console.log('\n1. Tạo tài khoản & bootstrap Bí thư');
const [bithu, truongthon, photon, dan1, dan2, dan3, dan4] =
  await Promise.all(['bithu', 'truongthon', 'photon', 'dan1', 'dan2', 'dan3', 'dan4'].map(user));
const p0 = await dan1.from('profiles').select('*').eq('id', dan1.id).single();
check('profile tự tạo, trạng thái unverified, có username', p0.data?.status === 'unverified' && p0.data?.username === `dan1_${RUN}`);
ok('bootstrap Bí thư bằng service role',
  await service.from('profiles').update({ leadership_role: 'bi_thu', status: 'active' }).eq('id', bithu.id));
const anonAreas = await anon.from('areas').select('id').limit(1);
check('khách (anon) không đọc được khu vực', !!anonAreas.error || anonAreas.data.length === 0);

console.log('\n2. Khu vực & nhân khẩu');
const areaA = await bithu.from('areas').insert({ name: `Khu A ${RUN}` }).select().single();
const areaB = await bithu.from('areas').insert({ name: `Khu B ${RUN}` }).select().single();
ok('Bí thư tạo khu', areaA);
denied('người dân chưa kích hoạt không tạo được khu', await dan1.from('areas').insert({ name: `X ${RUN}` }));
const res = await bithu.from('residents').insert([
  { full_name: 'Nguyễn Văn Một', area_id: areaA.data.id },
  { full_name: 'Trần Văn Trưởng', area_id: areaA.data.id },
  { full_name: 'Lê Văn Phó', area_id: areaB.data.id },
]).select();
check('nhân khẩu nhập sẵn có mã kích hoạt 8 ký tự', res.data?.every(r => /^[A-Z2-9]{8}$/.test(r.activation_code)), res.error?.message);
const [r1, r2, r3] = res.data;

console.log('\n3. Kích hoạt bằng mã');
const bad = await dan1.rpc('activate_account', { p_code: 'SAIMA123' });
check('mã sai → báo lỗi, không ném exception', bad.data?.ok === false);
const att = await dan1.from('profiles').select('activation_attempts').eq('id', dan1.id).single();
check('số lần thử sai được lưu lại', att.data?.activation_attempts === 1);
const good = await dan1.rpc('activate_account', { p_code: r1.activation_code.toLowerCase() });
check('mã đúng (không phân biệt hoa thường) → active', good.data?.ok === true && good.data?.status === 'active', JSON.stringify(good));
const reuse = await truongthon.rpc('activate_account', { p_code: r1.activation_code });
check('mã đã dùng không dùng lại được', reuse.data?.ok === false);
await truongthon.rpc('activate_account', { p_code: r2.activation_code });
await photon.rpc('activate_account', { p_code: r3.activation_code });

console.log('\n4. Tự đăng ký & chế độ chờ duyệt');
const reg2 = await dan2.rpc('register_resident', { p_full_name: 'Phạm Thị Hai', p_area_id: areaA.data.id });
check('đang bật chờ duyệt → pending', reg2.data?.status === 'pending', reg2.error?.message);
const dirPending = await dan2.from('member_directory').select('id');
check('tài khoản pending không xem được danh bạ thành viên', dirPending.data?.length === 0);
denied('người dân không duyệt được tài khoản', await dan1.rpc('review_account', { p_user_id: dan2.id, p_approve: true }));
ok('Bí thư duyệt tài khoản', await bithu.rpc('review_account', { p_user_id: dan2.id, p_approve: true }));
const upd = await dan1.from('app_settings').update({ value: false }).eq('key', 'require_approval').select();
check('người dân không tắt được chế độ chờ duyệt', !!upd.error || upd.data.length === 0);
ok('Bí thư tắt chế độ chờ duyệt', await bithu.from('app_settings').update({ value: false }).eq('key', 'require_approval'));
const reg3 = await dan3.rpc('register_resident', { p_full_name: 'Đỗ Văn Ba', p_area_id: areaB.data.id });
check('tắt chờ duyệt → active ngay', reg3.data?.status === 'active', reg3.error?.message);
await bithu.from('app_settings').update({ value: true }).eq('key', 'require_approval');

console.log('\n5. Phân quyền theo cấp bậc');
ok('Bí thư gán Trưởng thôn', await bithu.rpc('set_leadership_role', { p_user_id: truongthon.id, p_role: 'truong_thon' }));
ok('Trưởng thôn gán Phó thôn', await truongthon.rpc('set_leadership_role', { p_user_id: photon.id, p_role: 'pho_thon' }));
denied('Trưởng thôn không gán được Bí thư', await truongthon.rpc('set_leadership_role', { p_user_id: dan1.id, p_role: 'bi_thu' }));
denied('Trưởng thôn không gán được Trưởng thôn khác', await truongthon.rpc('set_leadership_role', { p_user_id: dan1.id, p_role: 'truong_thon' }));
denied('Trưởng thôn không hạ chức Bí thư', await truongthon.rpc('set_leadership_role', { p_user_id: bithu.id, p_role: null }));
denied('Phó thôn không phân quyền cán bộ', await photon.rpc('set_leadership_role', { p_user_id: dan1.id, p_role: 'pho_thon' }));
denied('Trưởng thôn không khoá được Bí thư', await truongthon.rpc('set_account_locked', { p_user_id: bithu.id, p_locked: true }));
const plog = await photon.from('audit_logs').select('id');
check('Phó thôn không xem được nhật ký', !!plog.error || plog.data.length === 0);
const logs = await bithu.from('audit_logs').select('action, entity').eq('entity', 'profiles');
check('nhật ký ghi lại thay đổi chức vụ/trạng thái', logs.data?.length >= 3);

console.log('\n6. Ban ngành đoàn thể');
const org = await photon.from('organizations').insert({ name: `Tổ đoàn A ${RUN}`, area_id: areaA.data.id }).select().single();
ok('Phó thôn tạo ban ngành', org);
ok('Phó thôn giao trưởng ban cho dan1', await photon.rpc('set_org_member', { p_org_id: org.data.id, p_user_id: dan1.id, p_role: 'truong_ban' }));
ok('Trưởng ban thêm thành viên dan2', await dan1.rpc('set_org_member', { p_org_id: org.data.id, p_user_id: dan2.id }));
denied('Trưởng ban không tự phong trưởng ban khác', await dan1.rpc('set_org_member', { p_org_id: org.data.id, p_user_id: dan2.id, p_role: 'truong_ban' }));
denied('Thành viên thường không thêm được người', await dan2.rpc('set_org_member', { p_org_id: org.data.id, p_user_id: dan3.id }));
denied('Không thêm được tài khoản chưa active', await dan1.rpc('set_org_member', { p_org_id: org.data.id, p_user_id: dan4.id }));

console.log('\n7. Chat nhóm tự đồng bộ');
const gArea = await photon.rpc('create_chat_group', { p_name: 'Nhóm Khu A', p_type: 'area', p_area_id: areaA.data.id });
ok('Phó thôn tạo nhóm khu A', gArea);
const memA = await photon.from('chat_group_members').select('user_id').eq('group_id', gArea.data);
const idsA = memA.data?.map(m => m.user_id) ?? [];
check('nhóm khu A tự có dan1, dan2, trưởng thôn (ở khu A)', [dan1.id, dan2.id, truongthon.id, photon.id].every(i => idsA.includes(i)), idsA.length);
check('nhóm khu A không có dan3 (khu B)', !idsA.includes(dan3.id));
denied('người dân không tạo được nhóm khu', await dan1.rpc('create_chat_group', { p_name: 'X', p_type: 'area', p_area_id: areaA.data.id }));
const gOrg = await dan1.rpc('create_chat_group', { p_name: 'Tổ đoàn A', p_type: 'org', p_org_id: org.data.id });
ok('Trưởng ban tạo nhóm ban ngành', gOrg);
await dan1.rpc('set_org_member', { p_org_id: org.data.id, p_user_id: dan3.id });
const inOrg = await dan1.from('chat_group_members').select('user_id').eq('group_id', gOrg.data).eq('user_id', dan3.id);
check('thêm vào ban ngành → tự vào nhóm chat', inOrg.data?.length === 1);
await dan1.rpc('remove_org_member', { p_org_id: org.data.id, p_user_id: dan3.id });
const outOrg = await dan1.from('chat_group_members').select('user_id').eq('group_id', gOrg.data).eq('user_id', dan3.id);
check('rời ban ngành → tự rời nhóm chat', outOrg.data?.length === 0);
ok('dan2 nhắn tin trong nhóm ban ngành', await dan2.from('messages').insert({ group_id: gOrg.data, sender_id: dan2.id, content: 'Chào cả tổ' }));
denied('dan3 không nhắn được vào nhóm khu A', await dan3.from('messages').insert({ group_id: gArea.data, sender_id: dan3.id, content: 'x' }));
const peek = await dan3.from('messages').select('id').eq('group_id', gOrg.data);
check('dan3 không đọc được tin nhóm mình không tham gia', peek.data?.length === 0);
await dan1.rpc('update_group_member', { p_group_id: gOrg.data, p_user_id: dan2.id, p_is_muted: true });
denied('thành viên bị cấm chat không gửi được', await dan2.from('messages').insert({ group_id: gOrg.data, sender_id: dan2.id, content: 'x' }));
await service.from('profiles').update({ resident_id: null }).eq('id', dan4.id);
await bithu.from('residents').update({ area_id: areaB.data.id }).eq('id', r2.id);
const moved = await photon.from('chat_group_members').select('user_id').eq('group_id', gArea.data).eq('user_id', truongthon.id);
check('chuyển khu → tự rời nhóm khu cũ', moved.data?.length === 0);
await bithu.from('residents').update({ area_id: areaA.data.id }).eq('id', r2.id);

console.log('\n8. Thông báo');
const annA = await photon.rpc('send_announcement', { p_title: 'Họp khu A', p_content: 'Tối nay 19h', p_area_ids: [areaA.data.id], p_priority: 'quan_trong' });
ok('Phó thôn gửi thông báo cho khu A', annA);
const seeA1 = await dan1.from('announcements').select('id').eq('id', annA.data);
const seeA3 = await dan3.from('announcements').select('id').eq('id', annA.data);
check('dan1 (khu A) thấy, dan3 (khu B) không thấy', seeA1.data?.length === 1 && seeA3.data?.length === 0);
ok('dan1 đánh dấu đã đọc', await dan1.from('announcement_reads').insert({ announcement_id: annA.data, user_id: dan1.id }));
denied('dan3 không đánh dấu đọc thông báo không dành cho mình', await dan3.from('announcement_reads').insert({ announcement_id: annA.data, user_id: dan3.id }));
const stats = await photon.rpc('announcement_read_stats', { p_announcement: annA.data });
check('thống kê đọc: 1 đã đọc / 3 người nhận (Phó thôn ở khu B nên không nhận)', stats.data?.[0]?.read_count === 1 && stats.data?.[0]?.total === 3, JSON.stringify(stats.data ?? stats.error));
const unread = await photon.rpc('announcement_unread_list', { p_announcement: annA.data });
check('danh sách chưa đọc có tên để gọi nhắc', unread.data?.length === 2 && unread.data.every(u => u.full_name));
ok('Trưởng ban gửi thông báo cho ban ngành mình', await dan1.rpc('send_announcement', { p_title: 'Sinh hoạt đoàn', p_content: 'CN này', p_org_ids: [org.data.id] }));
denied('Trưởng ban không gửi toàn thôn', await dan1.rpc('send_announcement', { p_title: 'x', p_content: 'x', p_target_all: true }));
denied('Trưởng ban không gửi thông báo khẩn', await dan1.rpc('send_announcement', { p_title: 'x', p_content: 'x', p_org_ids: [org.data.id], p_priority: 'khan' }));
denied('Người dân không gửi được thông báo', await dan3.rpc('send_announcement', { p_title: 'x', p_content: 'x', p_org_ids: [org.data.id] }));
const future = await bithu.rpc('send_announcement', { p_title: 'Hẹn giờ', p_content: 'x', p_target_all: true, p_scheduled_at: new Date(Date.now() + 3600e3).toISOString() });
const seeFuture = await dan3.from('announcements').select('id').eq('id', future.data);
check('thông báo hẹn giờ chưa hiện với người dân', seeFuture.data?.length === 0);

console.log('\n9. Phản ánh sự cố');
const rep = await dan1.from('reports').insert({ reporter_id: dan1.id, category: 'dien', title: 'Hỏng đèn đường ngõ 3' }).select().single();
ok('Người dân gửi phản ánh', rep);
denied('không tự đặt trạng thái hoàn thành khi gửi', await dan1.from('reports').insert({ reporter_id: dan1.id, category: 'dien', title: 'x', status: 'hoan_thanh' }));
const seeRep2 = await dan2.from('reports').select('id').eq('id', rep.data.id);
const seeRepP = await photon.from('reports').select('id').eq('id', rep.data.id);
check('người dân khác & Phó thôn không xem được phản ánh', seeRep2.data?.length === 0 && seeRepP.data?.length === 0);
denied('Phó thôn không xử lý được phản ánh', await photon.rpc('update_report_status', { p_report_id: rep.data.id, p_status: 'dang_xu_ly' }));
ok('Bí thư nhận xử lý', await bithu.rpc('update_report_status', { p_report_id: rep.data.id, p_status: 'dang_xu_ly', p_note: 'Đã báo điện lực' }));
denied('chưa hoàn thành thì chưa đánh giá được', await dan1.rpc('rate_report', { p_report_id: rep.data.id, p_rating: 5 }));
await bithu.rpc('update_report_status', { p_report_id: rep.data.id, p_status: 'hoan_thanh' });
ok('người gửi đánh giá sau khi hoàn thành', await dan1.rpc('rate_report', { p_report_id: rep.data.id, p_rating: 5, p_comment: 'Nhanh' }));
const hist = await dan1.from('report_updates').select('status').eq('report_id', rep.data.id);
check('người gửi xem được lịch sử 3 bước', hist.data?.length === 3);

console.log('\n10. SOS');
ok('Người dân gửi SOS', await dan2.from('sos_events').insert({ user_id: dan2.id, latitude: 21.25, longitude: 105.85 }));
denied('gửi lại trong 60 giây bị chặn', await dan2.from('sos_events').insert({ user_id: dan2.id }));
const sosP = await photon.from('sos_events').select('id').eq('user_id', dan2.id);
check('Phó thôn thấy SOS', sosP.data?.length === 1);
const sos3 = await dan3.from('sos_events').select('id').eq('user_id', dan2.id);
check('người dân khác không thấy SOS', sos3.data?.length === 0);

console.log('\n11. Quyền riêng tư');
const resPeek = await dan1.from('residents').select('id');
check('người dân chỉ xem được hồ sơ của chính mình', resPeek.data?.length === 1);
const profPeek = await dan1.from('profiles').select('id');
check('người dân chỉ xem được tài khoản của chính mình', profPeek.data?.length === 1);
const dir = await dan1.from('member_directory').select('*').limit(50);
check('danh bạ thành viên không lộ số điện thoại', dir.data?.length > 0 && !('phone' in dir.data[0]));
const me = await dan1.rpc('get_me');
check('get_me trả về họ tên, khu, ban ngành', me.data?.full_name === 'Nguyễn Văn Một' && me.data?.orgs?.[0]?.role === 'truong_ban', JSON.stringify(me.data));

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi\n`);
process.exit(fail ? 1 : 0);

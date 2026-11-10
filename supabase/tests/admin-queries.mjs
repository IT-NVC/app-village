// Kiểm thử các truy vấn của trang admin + Edge Function đặt lại mật khẩu trên Supabase LOCAL.
// Chạy: npx supabase functions serve (cửa sổ khác) && node supabase/scripts/seed-dev.mjs && node supabase/tests/admin-queries.mjs
import { createClient } from '@supabase/supabase-js';

const URL = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const RUN = Date.now().toString(36);

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra ?? ''); }
};

const bithu = createClient(URL, ANON, opts);
const login = await bithu.auth.signInWithPassword({ email: 'bithu@thongnhat.local', password: '123456' });
if (login.error) throw new Error('Chạy seed-dev.mjs trước: ' + login.error.message);

console.log('\nTruy vấn trang admin');
const residents = await bithu.from('residents')
  .select('id, full_name, birth_date, gender, phone, note, area_id, activation_code, activation_expires_at, source, areas(name), households(code), profiles(id, status, username)')
  .order('full_name').range(0, 999);
check('Nhân khẩu: nhúng khu, hộ, tài khoản', !residents.error && residents.data.length > 0, residents.error?.message);
const withAcc = residents.data?.find((r) => r.full_name === 'Nguyễn Văn Bí Thư');
check('Nhân khẩu: tài khoản nhúng là object 1-1', withAcc && !Array.isArray(withAcc.profiles) && withAcc.profiles?.status === 'active', JSON.stringify(withAcc?.profiles));

const accounts = await bithu.from('profiles')
  .select('id, username, status, leadership_role, created_at, residents(full_name, phone, areas(name))').range(0, 999);
check('Tài khoản: nhúng nhân khẩu + khu', !accounts.error && accounts.data.some((a) => a.residents?.areas?.name), accounts.error?.message);

const pending = await bithu.from('profiles')
  .select('id, username, created_at, residents(full_name, phone, birth_date, gender, note, areas(name), households(code, head_name))')
  .eq('status', 'pending');
check('Duyệt: truy vấn chờ duyệt', !pending.error, pending.error?.message);

const people = await bithu.from('profiles').select('id, username, residents(full_name, areas(name))').eq('status', 'active');
check('Danh sách người active', !people.error && people.data.length > 0, people.error?.message);

const cnt = await bithu.from('residents').select('id', { count: 'exact', head: true }).not('activation_code', 'is', null);
check('Đếm nhân khẩu chưa kích hoạt', !cnt.error && cnt.count >= 1, cnt.error?.message);

console.log('\nNhập hàng loạt & hộ gia đình');
const areas = (await bithu.from('areas').select('id, name')).data;
const hh = await bithu.from('households').insert([{ code: `T${RUN}`, head_name: 'Chủ hộ test', area_id: areas[0].id }]).select('id, code');
check('Tạo hộ hàng loạt', !hh.error && hh.data[0].code === `T${RUN}`, hh.error?.message);
const bulk = await bithu.from('residents').insert([
  { full_name: `Người A ${RUN}`, area_id: areas[0].id, household_id: hh.data[0].id, source: 'import' },
  { full_name: `Người B ${RUN}`, area_id: areas[0].id, household_id: hh.data[0].id, source: 'import' },
]).select('id, activation_code');
check('Nhập 2 nhân khẩu, tự có mã', !bulk.error && bulk.data.every((r) => r.activation_code), bulk.error?.message);

console.log('\nBan ngành & nhóm chat');
const org = await bithu.from('organizations').insert({ name: `Tổ đoàn ${RUN}`, area_id: areas[0].id }).select().single();
check('Tạo ban ngành', !org.error, org.error?.message);
const meId = login.data.user.id;
const sm = await bithu.rpc('set_org_member', { p_org_id: org.data.id, p_user_id: meId, p_role: 'truong_ban' });
check('Giao trưởng ban', !sm.error, sm.error?.message);
const om = await bithu.from('org_members').select('user_id, role, profiles(username, residents(full_name))').eq('org_id', org.data.id);
check('Thành viên ban: nhúng tên', !om.error && om.data[0]?.profiles?.residents?.full_name, om.error?.message ?? JSON.stringify(om.data));
const g1 = await bithu.rpc('create_chat_group', { p_name: org.data.name, p_type: 'org', p_org_id: org.data.id });
check('Tạo nhóm chat ban ngành', !g1.error, g1.error?.message);
const g2 = await bithu.rpc('create_chat_group', { p_name: org.data.name, p_type: 'org', p_org_id: org.data.id });
check('Tạo lại nhóm trùng → lỗi duplicate (admin hiện thông báo thân thiện)', g2.error?.message.includes('duplicate key') && g2.error.message.includes('chat_groups'), g2.error?.message);

console.log('\nCài đặt & nhật ký');
const st = await bithu.from('app_settings').select('value').eq('key', 'require_approval').single();
check('Đọc công tắc chờ duyệt', !st.error && typeof st.data.value === 'boolean');
const audit = await bithu.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(0, 49);
check('Nhật ký có dữ liệu', !audit.error && audit.count > 0, audit.error?.message);

console.log('\nEdge Function đặt lại mật khẩu');
const dan = createClient(URL, ANON, opts);
const su = await dan.auth.signUp({ email: `dan${RUN}@thongnhat.local`, password: 'cu123456', options: { data: { username: `dan${RUN}` } } });
await dan.rpc('activate_account', { p_code: bulk.data[0].activation_code });
const danId = su.data.user.id;

async function reset(client, user_id, new_password) {
  const { error } = await client.functions.invoke('admin-reset-password', { body: { user_id, new_password } });
  if (!error) return null;
  try { return (await error.context.json()).error; } catch { return error.message; }
}
check('Bí thư đặt lại mật khẩu người dân', (await reset(bithu, danId, 'moi123456')) === null);
// Đổi mật khẩu sẽ thu hồi phiên cũ -> dùng phiên đăng nhập mới
const danNew = createClient(URL, ANON, opts);
const relog = await danNew.auth.signInWithPassword({ email: `dan${RUN}@thongnhat.local`, password: 'moi123456' });
check('Người dân đăng nhập bằng mật khẩu mới', !relog.error, relog.error?.message);
const oldPw = await createClient(URL, ANON, opts).auth.signInWithPassword({ email: `dan${RUN}@thongnhat.local`, password: 'cu123456' });
check('Mật khẩu cũ không dùng được nữa', !!oldPw.error);
check('Người dân không đặt lại được mật khẩu người khác', (await reset(danNew, meId, 'hack1234'))?.includes('cán bộ'));
check('Không tự đặt lại mật khẩu mình', (await reset(bithu, meId, 'abc12345'))?.includes('Không thể tự'));
check('Mật khẩu quá ngắn bị chặn', (await reset(bithu, danId, '123'))?.includes('6 ký tự'));
const anonErr = await reset(createClient(URL, ANON, opts), danId, 'abc12345');
check('Khách không gọi được', !!anonErr, anonErr);
const logs = await bithu.from('audit_logs').select('id').eq('action', 'reset_password').eq('entity_id', danId);
check('Nhật ký ghi lại việc đặt lại mật khẩu', logs.data?.length === 1);

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi\n`);
process.exit(fail ? 1 : 0);

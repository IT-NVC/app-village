// Kiểm thử các thao tác Tạo / Sửa / Xoá bổ sung (migration 0009 + Edge Function admin-account) trên Supabase LOCAL.
// Chạy: npm run functions:serve:test (cửa sổ riêng) → npm run db:seed → node supabase/tests/crud.mjs
import { createClient } from '@supabase/supabase-js';

const URL = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const RUN = Date.now().toString(36);
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra ?? ''); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const bithu = createClient(URL, ANON, opts);
const li = await bithu.auth.signInWithPassword({ email: 'bithu@thongnhat.local', password: '123456' });
if (li.error) throw new Error('Chạy npm run db:seed trước');
const khuA = (await bithu.from('areas').select('id').eq('name', 'Khu A').single()).data;

async function resident(name, areaId = khuA.id) {
  const { data: r } = await bithu.from('residents').insert({ full_name: `${name} ${RUN}`, area_id: areaId, phone: '0909111222' }).select('id, activation_code').single();
  const c = createClient(URL, ANON, opts);
  const su = await c.auth.signUp({ email: `${name}${RUN}@thongnhat.local`, password: 'matkhau1', options: { data: { username: `${name}${RUN}` } } });
  await c.rpc('activate_account', { p_code: r.activation_code });
  c.id = su.data.user.id;
  c.residentId = r.id;
  return c;
}
async function fnCall(c, action, body) {
  const { data, error } = await c.functions.invoke('admin-account', { body: { action, ...body } });
  if (!error) return { ok: true, ...data };
  let b = {};
  try { b = await error.context.json(); } catch { /* bỏ qua */ }
  return { ok: false, status: error.context?.status, error: b.error };
}

const photon = await resident('cp');
await bithu.rpc('set_leadership_role', { p_user_id: photon.id, p_role: 'pho_thon' });
const truongthon = await resident('ct');
await bithu.rpc('set_leadership_role', { p_user_id: truongthon.id, p_role: 'truong_thon' });
const dan = await resident('cd');
const dan2 = await resident('ce');

console.log('\nSửa thông báo');
const annId = (await photon.rpc('send_announcement', { p_title: `Họp ${RUN}`, p_content: 'Nội dung cũ', p_priority: 'thuong', p_target_all: false, p_area_ids: [khuA.id], p_org_ids: [] })).data;
const upd1 = await photon.from('announcements').update({ title: `Họp thôn ${RUN}`, content: 'Nội dung mới', priority: 'quan_trong' }).eq('id', annId).select('id, title, content, priority');
check('Người gửi sửa thông báo của mình', upd1.data?.[0]?.content === 'Nội dung mới' && upd1.data[0].priority === 'quan_trong', upd1.error?.message);
const upd2 = await bithu.from('announcements').update({ title: `Cán bộ khác sửa ${RUN}` }).eq('id', annId).select('title');
check('Cán bộ thôn khác sửa được', upd2.data?.[0]?.title.startsWith('Cán bộ khác sửa'), upd2.error?.message);
const upd3 = await dan.from('announcements').update({ title: 'hack' }).eq('id', annId).select('id');
check('Người dân KHÔNG sửa được thông báo', !!upd3.error || upd3.data?.length === 0);
const upd4 = await photon.from('announcements').update({ title: '   ' }).eq('id', annId);
check('Không cho để trống tiêu đề', !!upd4.error);
const imm = await photon.from('announcements').update({ target_all: true, sender_id: bithu.id ?? li.data.user.id }).eq('id', annId).select('target_all, sender_id');
check('Không đổi được đối tượng nhận / người gửi', imm.data?.[0]?.target_all === false && imm.data[0].sender_id === photon.id, JSON.stringify(imm.data));
const logA = await bithu.from('audit_logs').select('action').eq('entity', 'announcements').eq('entity_id', annId).eq('action', 'update');
check('Nhật ký ghi lại việc sửa thông báo', (logA.data?.length ?? 0) >= 1);

// Trưởng ban (không phải cán bộ thôn) gửi cho ban mình rồi thử nâng lên "khẩn"
const org = (await bithu.from('organizations').insert({ name: `Tổ CRUD ${RUN}`, area_id: khuA.id }).select('id').single()).data;
await bithu.rpc('set_org_member', { p_org_id: org.id, p_user_id: dan.id, p_role: 'truong_ban' });
const annOrg = (await dan.rpc('send_announcement', { p_title: `Sinh hoạt ${RUN}`, p_content: 'x', p_priority: 'thuong', p_target_all: false, p_area_ids: [], p_org_ids: [org.id] })).data;
const up5 = await dan.from('announcements').update({ priority: 'khan' }).eq('id', annOrg);
check('Trưởng ban KHÔNG nâng thông báo lên "khẩn"', !!up5.error, up5.error?.message);
const up6 = await dan.from('announcements').update({ content: 'Đã sửa nội dung' }).eq('id', annOrg).select('content');
check('Trưởng ban sửa nội dung thông báo của mình', up6.data?.[0]?.content === 'Đã sửa nội dung', up6.error?.message);

console.log('\nXoá phản ánh / SOS');
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const img = `${dan.id}/${RUN}.jpg`;
await dan.storage.from('report-images').upload(img, jpeg, { contentType: 'image/jpeg' });
const rep = (await dan.from('reports').insert({ reporter_id: dan.id, category: 'khac', title: `Spam ${RUN}`, images: [img] }).select('id').single()).data;
const delR1 = await photon.from('reports').delete().eq('id', rep.id).select('id');
check('Phó thôn KHÔNG xoá được phản ánh', !!delR1.error || delR1.data?.length === 0);
const delR2 = await dan.from('reports').delete().eq('id', rep.id).select('id');
check('Người gửi KHÔNG tự xoá phản ánh', !!delR2.error || delR2.data?.length === 0);
const rm1 = await dan.storage.from('report-images').remove([img]);
check('Người dân KHÔNG xoá được ảnh phản ánh', (rm1.data?.length ?? 0) === 0);
const rm2 = await bithu.storage.from('report-images').remove([img]);
check('Bí thư xoá được ảnh phản ánh', rm2.data?.length === 1, rm2.error?.message);
const delR3 = await bithu.from('reports').delete().eq('id', rep.id).select('id');
check('Bí thư xoá phản ánh', delR3.data?.length === 1, delR3.error?.message);
const histR = await bithu.from('report_updates').select('id').eq('report_id', rep.id);
check('Lịch sử xử lý của phản ánh bị xoá theo', histR.data?.length === 0);
const logR = await bithu.from('audit_logs').select('action').eq('entity', 'reports').eq('entity_id', rep.id).eq('action', 'delete');
check('Nhật ký ghi lại việc xoá phản ánh', logR.data?.length === 1);

const sos = (await dan.from('sos_events').insert({ user_id: dan.id, message: 'Báo nhầm' }).select('id').single()).data;
const delS1 = await photon.from('sos_events').delete().eq('id', sos.id).select('id');
check('Phó thôn KHÔNG xoá được SOS', !!delS1.error || delS1.data?.length === 0);
const delS2 = await truongthon.from('sos_events').delete().eq('id', sos.id).select('id');
check('Trưởng thôn xoá SOS báo nhầm', delS2.data?.length === 1, delS2.error?.message);

console.log('\nSửa biểu quyết');
const poll = (await bithu.rpc('create_poll', { p_title: `Có đồng ý? ${RUN}`, p_options: ['Có', 'Không', 'Ý kiến khác'] })).data;
const optIds = (await bithu.from('poll_options').select('id, label').eq('poll_id', poll).order('sort_order')).data;
check('Người dân KHÔNG sửa được khảo sát', !!(await dan.rpc('update_poll', { p_poll_id: poll, p_title: 'x' })).error);
check('Phó thôn sửa câu hỏi + mô tả', !(await photon.rpc('update_poll', { p_poll_id: poll, p_title: `Có đồng ý góp tiền? ${RUN}`, p_description: 'Mỗi hộ 200k' })).error);
const p1 = (await bithu.from('polls').select('title, description').eq('id', poll).single()).data;
check('Nội dung đã được cập nhật', p1.title.startsWith('Có đồng ý góp tiền') && p1.description === 'Mỗi hộ 200k');
check('Không cho để trống câu hỏi', !!(await bithu.rpc('update_poll', { p_poll_id: poll, p_title: ' ' })).error);
check('Thêm phương án', !(await bithu.rpc('add_poll_option', { p_poll_id: poll, p_label: 'Chưa biết' })).error);
check('Đổi tên phương án', !(await bithu.rpc('rename_poll_option', { p_option_id: optIds[2].id, p_label: 'Cần bàn thêm' })).error);
check('Người dân KHÔNG thêm / đổi / xoá phương án', !!(await dan.rpc('add_poll_option', { p_poll_id: poll, p_label: 'x' })).error && !!(await dan.rpc('rename_poll_option', { p_option_id: optIds[0].id, p_label: 'x' })).error && !!(await dan.rpc('delete_poll_option', { p_option_id: optIds[0].id })).error);
await dan.rpc('cast_vote', { p_poll_id: poll, p_option_ids: [optIds[0].id] });
const delOpt1 = await bithu.rpc('delete_poll_option', { p_option_id: optIds[0].id });
check('Phương án đã có người chọn thì KHÔNG xoá được', delOpt1.error?.message.includes('đã có người chọn'), delOpt1.error?.message);
check('Xoá phương án chưa ai chọn', !(await bithu.rpc('delete_poll_option', { p_option_id: optIds[2].id })).error);
check('Xoá tiếp phương án thứ 2 chưa ai chọn', !(await bithu.rpc('delete_poll_option', { p_option_id: (await bithu.from('poll_options').select('id, label').eq('poll_id', poll)).data.find((o) => o.label === 'Chưa biết').id })).error);
const delOpt2 = await bithu.rpc('delete_poll_option', { p_option_id: optIds[1].id });
check('Còn 2 phương án thì KHÔNG xoá thêm được', delOpt2.error?.message.includes('ít nhất 2'), delOpt2.error?.message);
await bithu.rpc('close_poll', { p_poll_id: poll });
check('Đóng khảo sát → không bỏ phiếu được', !!(await dan2.rpc('cast_vote', { p_poll_id: poll, p_option_ids: [optIds[0].id] })).error);
check('Hạn chót ở quá khứ bị từ chối', !!(await bithu.rpc('update_poll', { p_poll_id: poll, p_title: 'x', p_closes_at: new Date(Date.now() - 3600e3).toISOString() })).error);
const reopen = await bithu.rpc('update_poll', { p_poll_id: poll, p_title: `Có đồng ý góp tiền? ${RUN}`, p_closes_at: new Date(Date.now() + 3 * 86400e3).toISOString(), p_reopen: true });
check('Mở lại khảo sát với hạn chót mới', !reopen.error, reopen.error?.message);
check('Sau khi mở lại, người dân bỏ phiếu được', !(await dan2.rpc('cast_vote', { p_poll_id: poll, p_option_ids: [optIds[1].id] })).error);
check('Bỏ hạn chót', !(await bithu.rpc('update_poll', { p_poll_id: poll, p_title: 'x', p_no_deadline: true })).error && (await bithu.from('polls').select('closes_at').eq('id', poll).single()).data.closes_at === null);
await bithu.from('polls').delete().eq('id', poll);

console.log('\nHộ gia đình');
const hh = await bithu.from('households').insert({ code: `HC${RUN}`.toUpperCase(), head_name: 'Chủ hộ thử', area_id: khuA.id }).select('id').single();
check('Cán bộ tạo hộ', !hh.error, hh.error?.message);
check('Người dân KHÔNG tạo được hộ', !!(await dan.from('households').insert({ head_name: 'x', area_id: khuA.id })).error);
check('Mã hộ trùng bị từ chối', !!(await bithu.from('households').insert({ code: `HC${RUN}`.toUpperCase(), head_name: 'y', area_id: khuA.id })).error);
const addM = await bithu.from('residents').update({ household_id: hh.data.id }).in('id', [dan.residentId, dan2.residentId]);
check('Gắn 2 nhân khẩu vào hộ', !addM.error, addM.error?.message);
const members = await bithu.from('residents').select('id').eq('household_id', hh.data.id);
check('Danh sách thành viên của hộ', members.data?.length === 2);
check('Sửa hộ (đổi chủ hộ)', !(await bithu.from('households').update({ head_name: 'Chủ hộ mới' }).eq('id', hh.data.id)).error);
check('Bỏ một thành viên khỏi hộ', !(await bithu.from('residents').update({ household_id: null }).eq('id', dan2.residentId)).error);
const delH = await bithu.from('households').delete().eq('id', hh.data.id);
const left = await bithu.from('residents').select('household_id').eq('id', dan.residentId).single();
check('Xoá hộ → thành viên còn nguyên, chỉ không thuộc hộ nào', !delH.error && left.data?.household_id === null, delH.error?.message);
const logH = await bithu.from('audit_logs').select('action').eq('entity', 'households').eq('entity_id', hh.data.id);
check('Nhật ký ghi lại tạo / sửa / xoá hộ', (logH.data?.length ?? 0) >= 3, JSON.stringify(logH.data));

console.log('\nĐổi tên nhóm chat, xoá địa điểm');
const grp = (await photon.rpc('create_chat_group', { p_name: `Nhóm cũ ${RUN}`, p_type: 'custom', p_member_ids: [dan.id] })).data;
const ren = await photon.from('chat_groups').update({ name: `Nhóm mới ${RUN}` }).eq('id', grp).select('name');
check('Quản trị nhóm đổi tên nhóm', ren.data?.[0]?.name.startsWith('Nhóm mới'), ren.error?.message);
const ren2 = await dan.from('chat_groups').update({ name: 'hack' }).eq('id', grp).select('id');
check('Thành viên thường KHÔNG đổi tên được', !!ren2.error || ren2.data?.length === 0);
await bithu.from('chat_groups').delete().eq('id', grp);
const venue = (await bithu.from('venues').insert({ name: `Sân thử ${RUN}` }).select('id').single()).data;
check('Người dân KHÔNG xoá được địa điểm', ((await dan.from('venues').delete().eq('id', venue.id).select('id')).data ?? []).length === 0);
check('Cán bộ xoá địa điểm', ((await photon.from('venues').delete().eq('id', venue.id).select('id')).data ?? []).length === 1);

console.log('\nTạo / xoá tài khoản (Edge Function)');
const resNew = (await bithu.from('residents').insert({ full_name: `Cụ Lão ${RUN}`, area_id: khuA.id, phone: '0912000999' }).select('id, activation_code').single()).data;
const uname = `culao${RUN}`;
check('Người dân KHÔNG gọi được', (await fnCall(dan, 'create', { resident_id: resNew.id, username: uname, password: 'matkhau1' })).status === 403);
check('Khách chưa đăng nhập bị chặn', (await fnCall(createClient(URL, ANON, opts), 'create', { resident_id: resNew.id, username: uname, password: 'matkhau1' })).status === 401);
check('Tên đăng nhập sai định dạng bị từ chối', (await fnCall(photon, 'create', { resident_id: resNew.id, username: 'Cu Lão', password: 'matkhau1' })).status === 400);
check('Mật khẩu quá ngắn bị từ chối', (await fnCall(photon, 'create', { resident_id: resNew.id, username: uname, password: '123' })).status === 400);
const made = await fnCall(photon, 'create', { resident_id: resNew.id, username: uname, password: 'matkhau1' });
check('Phó thôn lập tài khoản cho nhân khẩu', made.ok === true && !!made.user_id, JSON.stringify(made));
const login = await createClient(URL, ANON, opts).auth.signInWithPassword({ email: `${uname}@thongnhat.local`, password: 'matkhau1' });
check('Người được lập tài khoản đăng nhập được ngay', !login.error, login.error?.message);
const me = (await login.data.session && (await createClient(URL, ANON, { ...opts, global: { headers: { Authorization: `Bearer ${login.data.session.access_token}` } } }).rpc('get_me')).data) ?? {};
check('Tài khoản đã kích hoạt, gắn đúng nhân khẩu, đúng khu', me.status === 'active' && me.full_name?.startsWith('Cụ Lão') && me.area_name === 'Khu A', JSON.stringify(me));
const afterCode = (await bithu.from('residents').select('activation_code').eq('id', resNew.id).single()).data;
check('Mã kích hoạt cũ đã bị thu hồi', afterCode.activation_code === null);
check('Lập lần 2 cho cùng nhân khẩu → báo đã có tài khoản', (await fnCall(photon, 'create', { resident_id: resNew.id, username: `${uname}2`, password: 'matkhau1' })).status === 409);
const res2 = (await bithu.from('residents').insert({ full_name: `Cụ Khác ${RUN}`, area_id: khuA.id }).select('id').single()).data;
const dupName = await fnCall(photon, 'create', { resident_id: res2.id, username: uname, password: 'matkhau1' });
check('Tên đăng nhập trùng → báo rõ', dupName.status === 409 && dupName.error?.includes('đã có người dùng'), JSON.stringify(dupName));
const logC = await bithu.from('audit_logs').select('action').eq('action', 'create_account').eq('entity_id', made.user_id);
check('Nhật ký ghi lại việc lập tài khoản', logC.data?.length === 1);
const grpArea = (await bithu.rpc('create_chat_group', { p_name: `Nhóm khu ${RUN}`, p_type: 'area', p_area_id: khuA.id })).data;
const inGrp = await bithu.from('chat_group_members').select('user_id').eq('group_id', grpArea).eq('user_id', made.user_id);
check('Người mới tự vào nhóm chat của khu', inGrp.data?.length === 1);
await bithu.from('chat_groups').delete().eq('id', grpArea);

check('Phó thôn KHÔNG xoá được tài khoản', (await fnCall(photon, 'delete', { user_id: made.user_id })).status === 403);
check('Không tự xoá tài khoản của mình', (await fnCall(truongthon, 'delete', { user_id: truongthon.id })).status === 400);
check('Trưởng thôn KHÔNG xoá được Bí thư', (await fnCall(truongthon, 'delete', { user_id: li.data.user.id })).status === 403);
const del = await fnCall(truongthon, 'delete', { user_id: made.user_id });
check('Trưởng thôn xoá tài khoản người dân', del.ok === true, JSON.stringify(del));
const login2 = await createClient(URL, ANON, opts).auth.signInWithPassword({ email: `${uname}@thongnhat.local`, password: 'matkhau1' });
check('Tài khoản đã xoá không đăng nhập được nữa', !!login2.error);
const kept = (await bithu.from('residents').select('full_name, activation_code').eq('id', resNew.id).single()).data;
check('Nhân khẩu được giữ lại và có mã kích hoạt MỚI', !!kept?.activation_code && /^[A-Z2-9]{8}$/.test(kept.activation_code), JSON.stringify(kept));
const logD = await bithu.from('audit_logs').select('data').eq('action', 'delete_account').eq('entity_id', made.user_id);
check('Nhật ký ghi lại việc xoá (kèm tên người bị xoá)', logD.data?.[0]?.data?.resident?.startsWith('Cụ Lão'));
const delBt = await fnCall(bithu, 'delete', { user_id: truongthon.id });
check('Bí thư xoá được tài khoản Trưởng thôn', delBt.ok === true, JSON.stringify(delBt));

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi\n`);
await sleep(200);
process.exit(fail ? 1 : 0);

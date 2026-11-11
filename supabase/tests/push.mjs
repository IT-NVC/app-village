// Kiểm thử thông báo đẩy: đăng ký mã thiết bị + Edge Function `notify` (chế độ chạy thử, KHÔNG gửi thật).
// Chạy: npx supabase functions serve --env-file supabase/tests/push-dry-run.env   (cửa sổ riêng)
//       npm run db:seed && node supabase/tests/push.mjs
import { createClient } from '@supabase/supabase-js';

const URL = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const RUN = Date.now().toString(36);

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra ?? ''); }
};

async function notify(c, kind, id) {
  const { data, error } = await c.functions.invoke('notify', { body: { kind, id } });
  if (!error) return data;
  let body = {};
  try { body = await error.context.json(); } catch { /* bỏ qua */ }
  return { status: error.context?.status, ...body };
}

const bithu = createClient(URL, ANON, opts);
const li = await bithu.auth.signInWithPassword({ email: 'bithu@thongnhat.local', password: '123456' });
if (li.error) throw new Error('Chạy npm run db:seed trước');
const BT = li.data.user.id;
const areas = (await bithu.from('areas').select('id, name')).data;
const khuA = areas.find((a) => a.name === 'Khu A'), khuB = areas.find((a) => a.name === 'Khu B');

async function resident(name, areaId) {
  const { data: r } = await bithu.from('residents').insert({ full_name: `${name} ${RUN}`, area_id: areaId }).select('activation_code').single();
  const c = createClient(URL, ANON, opts);
  const su = await c.auth.signUp({ email: `${name}${RUN}@thongnhat.local`, password: 'matkhau1', options: { data: { username: `${name}${RUN}` } } });
  await c.rpc('activate_account', { p_code: r.activation_code });
  c.id = su.data.user.id;
  return c;
}
const danA = await resident('pa', khuA.id);
const danB = await resident('pb', khuB.id);
const photon = await resident('pp', khuB.id);
await bithu.rpc('set_leadership_role', { p_user_id: photon.id, p_role: 'pho_thon' });

const ping = await notify(danA, 'announcement', '00000000-0000-0000-0000-000000000000');
if (ping.status === undefined && !ping.error) throw new Error('Edge Function chưa chạy');
if (ping.dryRun === undefined && ping.error === undefined) throw new Error('Hãy chạy functions serve với --env-file supabase/tests/push-dry-run.env');

console.log('\nĐăng ký mã thiết bị');
const tokA = `ExponentPushToken[test-${RUN}-a]`;
check('Đăng ký mã thiết bị', !(await danA.rpc('register_push_token', { p_token: tokA, p_platform: 'android' })).error);
check('Mã không hợp lệ bị từ chối', !!(await danA.rpc('register_push_token', { p_token: 'abc', p_platform: 'android' })).error);
const shared = `ExponentPushToken[test-${RUN}-shared]`;
await danA.rpc('register_push_token', { p_token: shared, p_platform: 'android' });
await danB.rpc('register_push_token', { p_token: shared, p_platform: 'android' });
const owner = await danB.from('push_tokens').select('user_id').eq('token', shared).single();
check('Đổi người đăng nhập trên cùng máy → mã chuyển sang người mới', owner.data?.user_id === danB.id);
const otherSees = await danB.from('push_tokens').select('token').eq('token', tokA);
check('KHÔNG xem được mã thiết bị của người khác', otherSees.data?.length === 0);
await danB.rpc('unregister_push_token', { p_token: shared });
check('Đăng xuất → huỷ mã thiết bị', (await danB.from('push_tokens').select('token').eq('token', shared)).data?.length === 0);

console.log('\nThông báo');
const ann = (await bithu.rpc('send_announcement', { p_title: `Họp khu A ${RUN}`, p_content: 'x', p_priority: 'khan', p_target_all: false, p_area_ids: [khuA.id], p_org_ids: [] })).data;
const n1 = await notify(bithu, 'announcement', ann);
check('Người nhận: đúng Khu A, có thiết bị của dân Khu A', n1.recipients?.includes(danA.id) && !n1.recipients.includes(danB.id) && n1.tokens >= 1, JSON.stringify(n1));
check('Không gửi cho chính người gửi', !n1.recipients?.includes(BT));
check('Thông báo khẩn đánh dấu ưu tiên cao', n1.push?.urgent === true && n1.push.title.includes('KHẨN'));
check('Gọi lại lần 2 → bỏ qua, không gửi trùng', !!(await notify(bithu, 'announcement', ann)).skipped);
check('Người dân KHÔNG kích hoạt push thông báo được', (await notify(danA, 'announcement', ann)).status === 403);
const future = (await bithu.rpc('send_announcement', { p_title: 'Hẹn giờ', p_content: 'x', p_target_all: true, p_area_ids: [], p_org_ids: [], p_scheduled_at: new Date(Date.now() + 3600e3).toISOString() })).data;
check('Thông báo hẹn giờ chưa tới giờ → chưa gửi', (await notify(bithu, 'announcement', future)).status === 409);

console.log('\nSOS');
const sos = (await danA.from('sos_events').insert({ user_id: danA.id, message: 'Cháy nổ' }).select('id').single()).data;
const n2 = await notify(danA, 'sos', sos.id);
check('SOS → gửi tới mọi cán bộ (Bí thư + Phó thôn), không gửi người dân', n2.recipients?.includes(BT) && n2.recipients.includes(photon.id) && !n2.recipients.includes(danB.id), JSON.stringify(n2));
check('SOS ưu tiên cao, có tên người gửi', n2.push?.urgent && n2.push.body.includes('pa '));
check('Người khác KHÔNG kích hoạt push SOS của người khác', (await notify(danB, 'sos', sos.id)).status === 403);
check('Người dân KHÔNG kích hoạt push "đã tiếp nhận"', (await notify(danA, 'sos_update', sos.id)).status === 403);
await bithu.rpc('handle_sos', { p_sos_id: sos.id, p_status: 'da_tiep_nhan' });
const n3 = await notify(bithu, 'sos_update', sos.id);
check('Đã tiếp nhận → báo đúng người bấm SOS', JSON.stringify(n3.recipients) === JSON.stringify([danA.id]), JSON.stringify(n3));
await bithu.rpc('handle_sos', { p_sos_id: sos.id, p_status: 'da_xu_ly' });
check('Đã xử lý xong → báo thêm một lần nữa', (await notify(bithu, 'sos_update', sos.id)).recipients?.[0] === danA.id);

console.log('\nPhản ánh');
const rep = (await danA.from('reports').insert({ reporter_id: danA.id, category: 'dien', title: `Hỏng đèn ${RUN}` }).select('id').single()).data;
const n4 = await notify(danA, 'report_new', rep.id);
check('Phản ánh mới → chỉ Bí thư / Trưởng thôn (không Phó thôn)', n4.recipients?.includes(BT) && !n4.recipients.includes(photon.id), JSON.stringify(n4));
await bithu.rpc('update_report_status', { p_report_id: rep.id, p_status: 'dang_xu_ly', p_note: 'Đã báo điện lực' });
const n5 = await notify(bithu, 'report_update', rep.id);
check('Cập nhật phản ánh → báo người gửi kèm ghi chú', n5.recipients?.[0] === danA.id && n5.push.body.includes('Đã báo điện lực'), JSON.stringify(n5));
check('Phó thôn KHÔNG kích hoạt push cập nhật phản ánh', (await notify(photon, 'report_update', rep.id)).status === 403);
await bithu.rpc('update_report_status', { p_report_id: rep.id, p_status: 'hoan_thanh' });
check('Mỗi lần cập nhật được báo riêng', (await notify(bithu, 'report_update', rep.id)).push?.title.includes('hoàn thành'));

console.log('\nTin nhắn');
const G = (await bithu.rpc('create_chat_group', { p_name: `Nhóm ${RUN}`, p_type: 'custom', p_member_ids: [danA.id, danB.id] })).data;
const msg = (await danA.from('messages').insert({ group_id: G, sender_id: danA.id, content: 'Chào cả nhà' }).select('id').single()).data;
const n6 = await notify(danA, 'message', msg.id);
check('Tin nhắn → các thành viên khác trong nhóm', n6.recipients?.length === 2 && n6.recipients.includes(BT) && n6.recipients.includes(danB.id) && !n6.recipients.includes(danA.id), JSON.stringify(n6));
check('Nội dung có tên người gửi + tên nhóm', n6.push?.title === `Nhóm ${RUN}` && n6.push.body.includes('Chào cả nhà'));
check('KHÔNG kích hoạt push cho tin của người khác', (await notify(danB, 'message', msg.id)).status === 403);

console.log('\nKhảo sát');
const P = (await bithu.rpc('create_poll', { p_title: `Ý kiến ${RUN}`, p_options: ['Có', 'Không'], p_target_all: false, p_area_ids: [khuA.id] })).data;
const n7 = await notify(bithu, 'poll', P);
check('Khảo sát → đúng đối tượng (Khu A)', n7.recipients?.includes(danA.id) && !n7.recipients.includes(danB.id), JSON.stringify(n7));
check('Người dân KHÔNG kích hoạt push khảo sát', (await notify(danA, 'poll', P)).status === 403);
check('Khách chưa đăng nhập bị chặn', (await notify(createClient(URL, ANON, opts), 'poll', P)).status === 401);

console.log('\nLịch & đặt lịch');
const at = (d, h) => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, 0, 0, 0); return t.toISOString(); };
const evA = (await bithu.from('events').insert({ title: `Thu gom rác ${RUN}`, starts_at: at(2, 7), area_id: khuA.id }).select('id').single()).data;
const n8 = await notify(bithu, 'event', evA.id);
check('Sự kiện của khu → chỉ báo người khu đó', n8.recipients?.includes(danA.id) && !n8.recipients.includes(danB.id), JSON.stringify(n8));
check('Người dân KHÔNG kích hoạt push sự kiện', (await notify(danA, 'event', evA.id)).status === 403);
const venueId = (await danA.from('venues').select('id').order('sort_order')).data[0].id;
const bk = (await danA.rpc('request_booking', { p_venue_id: venueId, p_purpose: 'Tổ chức sinh nhật', p_starts_at: at(4, 18), p_ends_at: at(4, 21) })).data;
const n9 = await notify(danA, 'booking_new', bk);
check('Yêu cầu đặt mới → báo cán bộ', n9.recipients?.includes(BT) && n9.recipients.includes(photon.id) && !n9.recipients.includes(danB.id), JSON.stringify(n9));
check('Người khác KHÔNG kích hoạt push cho yêu cầu không phải của mình', (await notify(danB, 'booking_new', bk)).status === 403);
await bithu.rpc('review_booking', { p_booking_id: bk, p_approve: true, p_note: 'OK' });
const n10 = await notify(bithu, 'booking_review', bk);
check('Duyệt → báo người đặt kèm ghi chú', n10.recipients?.[0] === danA.id && n10.push.title.includes('Đã duyệt') && n10.push.body.includes('OK'), JSON.stringify(n10));
await bithu.from('events').delete().eq('id', evA.id);
await bithu.rpc('cancel_booking', { p_booking_id: bk });

await bithu.from('chat_groups').delete().eq('id', G);
await bithu.from('polls').delete().eq('id', P);
console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi\n`);
process.exit(fail ? 1 : 0);

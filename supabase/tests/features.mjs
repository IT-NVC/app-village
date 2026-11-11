// Kiểm thử tính năng Thông báo + SOS (truy vấn của app & admin, kể cả realtime) trên Supabase LOCAL.
// Chạy: npx supabase start && npm run db:seed && node supabase/tests/features.mjs
import { createClient } from '@supabase/supabase-js';

const URL = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const RUN = Date.now().toString(36);

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra ?? ''); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chờ tới khi điều kiện đúng (tối đa ms) */
async function waitFor(fn, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await sleep(150); }
  return false;
}

// Cán bộ
const bithu = createClient(URL, ANON, opts);
const li = await bithu.auth.signInWithPassword({ email: 'bithu@thongnhat.local', password: '123456' });
if (li.error) throw new Error('Chạy npm run db:seed trước: ' + li.error.message);
await bithu.realtime.setAuth(li.data.session.access_token);

const areas = (await bithu.from('areas').select('id, name').order('name')).data;
const khuA = areas.find((a) => a.name === 'Khu A');
const khuB = areas.find((a) => a.name === 'Khu B');

// Người dân khu A (kích hoạt bằng mã)
async function resident(name, areaId) {
  const { data: r } = await bithu.from('residents').insert({ full_name: `${name} ${RUN}`, area_id: areaId, phone: '0987654321' }).select('activation_code').single();
  const c = createClient(URL, ANON, opts);
  const su = await c.auth.signUp({ email: `${name}${RUN}@thongnhat.local`, password: 'matkhau1', options: { data: { username: `${name}${RUN}` } } });
  await c.rpc('activate_account', { p_code: r.activation_code });
  await c.realtime.setAuth(su.data.session.access_token);
  c.id = su.data.user.id;
  return c;
}
const danA = await resident('dana', khuA.id);
const danB = await resident('danb', khuB.id);

// Làm nóng Realtime: lần kết nối đầu sau khi máy nghỉ, Realtime mới mở kết nối tới CSDL và có thể lỡ sự kiện.
// (App đã có cơ chế dự phòng: tải lại định kỳ / khi mở lại app.)
{
  const warm = bithu.channel(`warmup-${RUN}`).on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {});
  await new Promise((r) => warm.subscribe((s) => s === 'SUBSCRIBED' && r()));
  await sleep(3000);
  bithu.removeChannel(warm);
}

console.log('\nThông báo — admin gửi');
const sent = await bithu.rpc('send_announcement', {
  p_title: `Họp khu A ${RUN}`, p_content: 'Tối nay 19h tại nhà văn hoá', p_priority: 'quan_trong', p_target_all: false, p_area_ids: [khuA.id], p_org_ids: [],
});
check('Gửi thông báo cho Khu A', !sent.error, sent.error?.message);
const future = await bithu.rpc('send_announcement', {
  p_title: `Hẹn giờ ${RUN}`, p_content: 'x', p_priority: 'thuong', p_target_all: true, p_area_ids: [], p_org_ids: [],
  p_scheduled_at: new Date(Date.now() + 3600e3).toISOString(),
});
check('Hẹn giờ thông báo', !future.error, future.error?.message);

const adminList = await bithu.from('announcements')
  .select('id, title, content, priority, target_all, scheduled_at, profiles!announcements_sender_id_fkey(username, residents(full_name)), announcement_targets(areas(name), organizations(name))')
  .order('scheduled_at', { ascending: false }).limit(200);
const mine = adminList.data?.find((a) => a.id === sent.data);
check('Admin: danh sách có người gửi + đối tượng nhận', mine?.profiles?.residents?.full_name && mine.announcement_targets[0]?.areas?.name === 'Khu A', adminList.error?.message ?? JSON.stringify(mine));

console.log('\nThông báo — app người dân');
const feed = (c) => c.from('announcements').select('id, title, content, priority, scheduled_at, target_all, sender_id')
  .lte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: false }).limit(100);
const fA = await feed(danA), fB = await feed(danB);
check('Người Khu A thấy thông báo', fA.data?.some((a) => a.id === sent.data), fA.error?.message);
check('Người Khu B không thấy', !fB.data?.some((a) => a.id === sent.data));
check('Thông báo hẹn giờ chưa hiện', !fA.data?.some((a) => a.id === future.data));

const tgt = await danA.from('announcement_targets').select('areas(name), organizations(name)').eq('announcement_id', sent.data);
check('App: xem được "Gửi tới"', tgt.data?.[0]?.areas?.name === 'Khu A', tgt.error?.message);
const snd = await danA.from('member_directory').select('full_name, leadership_role').eq('id', li.data.user.id).maybeSingle();
check('App: xem được người gửi + chức vụ', snd.data?.leadership_role === 'bi_thu', snd.error?.message);

const up1 = await danA.from('announcement_reads').upsert({ announcement_id: sent.data, user_id: danA.id }, { onConflict: 'announcement_id,user_id', ignoreDuplicates: true });
const up2 = await danA.from('announcement_reads').upsert({ announcement_id: sent.data, user_id: danA.id }, { onConflict: 'announcement_id,user_id', ignoreDuplicates: true });
check('Đánh dấu đã đọc (gọi 2 lần không lỗi)', !up1.error && !up2.error, up1.error?.message ?? up2.error?.message);
const stats = await bithu.rpc('announcement_read_stats', { p_announcement: sent.data });
check('Admin: thống kê có người vừa đọc', stats.data?.[0]?.read_count >= 1, JSON.stringify(stats.data));
const unread = await bithu.rpc('announcement_unread_list', { p_announcement: sent.data });
check('Admin: danh sách chưa đọc không có người đã đọc', !unread.data?.some((u) => u.user_id === danA.id), unread.error?.message);

// Realtime: người dân nhận được thông báo mới ngay
let gotAnn = false;
const chA = danA.channel(`t-ann-${RUN}`).on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => { gotAnn = true; });
await new Promise((r) => chA.subscribe((s) => s === 'SUBSCRIBED' && r()));
await sleep(1500); // chờ Realtime đăng ký xong (lần đầu khởi động chậm hơn)
await bithu.rpc('send_announcement', { p_title: `Realtime ${RUN}`, p_content: 'x', p_priority: 'khan', p_target_all: true, p_area_ids: [], p_org_ids: [] });
check('Realtime: app nhận thông báo mới ngay lập tức', await waitFor(() => gotAnn));
danA.removeChannel(chA);

console.log('\nSOS');
// Realtime phía admin: nhận tín hiệu mới
let adminGot = null;
const chAdmin = bithu.channel(`t-sos-admin-${RUN}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sos_events' }, (p) => { adminGot = p.new; });
await new Promise((r) => chAdmin.subscribe((s) => s === 'SUBSCRIBED' && r()));
await sleep(1500); // chờ Realtime đăng ký xong (lần đầu khởi động chậm hơn)

const sos = await danA.from('sos_events').insert({ user_id: danA.id, latitude: 21.25, longitude: 105.85, message: 'Cháy nổ' })
  .select('id, status, created_at, message, latitude').single();
check('Người dân gửi SOS kèm vị trí', !sos.error && sos.data.status === 'dang_cho', sos.error?.message);
check('Realtime: admin nhận tín hiệu mới ngay', await waitFor(() => adminGot?.id === sos.data?.id), JSON.stringify(adminGot));
bithu.removeChannel(chAdmin);

const again = await danA.from('sos_events').insert({ user_id: danA.id }).select().single();
check('Gửi lại trong 60 giây bị chặn với lời nhắn tiếng Việt', again.error?.message.includes('vừa gửi'), again.error?.message);

const recent = await danA.from('sos_events').select('id, status, created_at, message, latitude').eq('user_id', danA.id)
  .gte('created_at', new Date(Date.now() - 3 * 3600e3).toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
check('App: tải lại tín hiệu gần nhất của mình', recent.data?.id === sos.data.id, recent.error?.message);

const adminSos = await bithu.from('sos_events')
  .select('id, created_at, status, message, latitude, longitude, handled_at, sender:profiles!sos_events_user_id_fkey(username, residents(full_name, phone, areas(name))), handler:profiles!sos_events_handled_by_fkey(username, residents(full_name))')
  .eq('status', 'dang_cho').order('created_at', { ascending: false }).limit(200);
const row = adminSos.data?.find((e) => e.id === sos.data.id);
check('Admin: danh sách SOS có tên, SĐT, khu', row?.sender?.residents?.full_name && row.sender.residents.phone && row.sender.residents.areas?.name === 'Khu A', adminSos.error?.message ?? JSON.stringify(row));

// Realtime phía người dân: thấy cán bộ tiếp nhận
let residentGot = null;
const chRes = danA.channel(`t-sos-${RUN}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sos_events', filter: `id=eq.${sos.data.id}` }, (p) => { residentGot = p.new.status; });
await new Promise((r) => chRes.subscribe((s) => s === 'SUBSCRIBED' && r()));
await sleep(1500); // chờ Realtime đăng ký xong (lần đầu khởi động chậm hơn)
const h = await bithu.rpc('handle_sos', { p_sos_id: sos.data.id, p_status: 'da_tiep_nhan' });
check('Cán bộ tiếp nhận SOS', !h.error, h.error?.message);
check('Realtime: người dân thấy "đã tiếp nhận" ngay', await waitFor(() => residentGot === 'da_tiep_nhan'), residentGot);
danA.removeChannel(chRes);

const handled = await bithu.from('sos_events').select('handler:profiles!sos_events_handled_by_fkey(residents(full_name))').eq('id', sos.data.id).single();
check('Admin: ghi nhận người xử lý', !!handled.data?.handler?.residents?.full_name, handled.error?.message);
const peek = await danB.from('sos_events').select('id').eq('id', sos.data.id);
check('Người dân khác không xem được SOS', peek.data?.length === 0);
const hack = await danB.rpc('handle_sos', { p_sos_id: sos.data.id, p_status: 'da_xu_ly' });
check('Người dân không xử lý được SOS', !!hack.error);

console.log('\nPhản ánh');
// Phó thôn: không được xem phản ánh (chỉ Bí thư / Trưởng thôn)
const photon = await resident('photon', khuB.id);
await bithu.rpc('set_leadership_role', { p_user_id: photon.id, p_role: 'pho_thon' });

// Realtime phía admin: phản ánh mới
let adminReport = null;
const chRep = bithu.channel(`t-rep-admin-${RUN}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (p) => { adminReport = p.new; });
await new Promise((r) => chRep.subscribe((s) => s === 'SUBSCRIBED' && r()));
await sleep(1500); // chờ Realtime đăng ký xong

// Ảnh JPEG 1x1 tối giản
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const imgPath = `${danA.id}/${RUN}.jpg`;
const upl = await danA.storage.from('report-images').upload(imgPath, jpeg, { contentType: 'image/jpeg' });
check('Người dân tải ảnh vào thư mục của mình', !upl.error, upl.error?.message);
const uplOther = await danA.storage.from('report-images').upload(`${danB.id}/${RUN}.jpg`, jpeg, { contentType: 'image/jpeg' });
check('Không tải được ảnh vào thư mục người khác', !!uplOther.error);

const rep = await danA.from('reports').insert({
  reporter_id: danA.id, category: 'dien', title: `Đèn đường hỏng ${RUN}`, description: 'Ngõ 3 tối om',
  images: [imgPath], latitude: 21.25, longitude: 105.85, address_text: 'Ngõ 3',
}).select('id').single();
check('Gửi phản ánh kèm ảnh + vị trí', !rep.error, rep.error?.message);
check('Realtime: Bí thư nhận phản ánh mới ngay', await waitFor(() => adminReport?.id === rep.data?.id));
bithu.removeChannel(chRep);

const mineList = await danA.from('reports').select('id, category, title, description, images, latitude, longitude, address_text, status, rating, rating_comment, created_at, updated_at').eq('reporter_id', danA.id);
check('App: danh sách phản ánh của mình', mineList.data?.some((r) => r.id === rep.data.id), mineList.error?.message);

const ownUrl = await danA.storage.from('report-images').createSignedUrls([imgPath], 3600);
check('Người gửi xem được ảnh của mình', !!ownUrl.data?.[0]?.signedUrl, ownUrl.error?.message ?? JSON.stringify(ownUrl.data));
const adminUrl = await bithu.storage.from('report-images').createSignedUrls([imgPath], 3600);
check('Bí thư xem được ảnh', !!adminUrl.data?.[0]?.signedUrl);
const otherUrl = await danB.storage.from('report-images').createSignedUrls([imgPath], 3600);
check('Người dân khác KHÔNG xem được ảnh', !otherUrl.data?.[0]?.signedUrl);
const photonUrl = await photon.storage.from('report-images').createSignedUrls([imgPath], 3600);
check('Phó thôn KHÔNG xem được ảnh phản ánh', !photonUrl.data?.[0]?.signedUrl);
const photonList = await photon.from('reports').select('id').eq('id', rep.data.id);
check('Phó thôn KHÔNG xem được phản ánh', photonList.data?.length === 0);

const adminRep = await bithu.from('reports')
  .select('id, category, title, description, images, latitude, longitude, address_text, status, rating, rating_comment, created_at, reporter:profiles!reports_reporter_id_fkey(username, residents(full_name, phone, areas(name)))')
  .eq('status', 'moi').order('created_at', { ascending: false }).limit(300);
const ar = adminRep.data?.find((r) => r.id === rep.data.id);
check('Admin: danh sách có tên, SĐT, khu người gửi', ar?.reporter?.residents?.full_name && ar.reporter.residents.areas?.name === 'Khu A', adminRep.error?.message);

// Realtime phía người dân: thấy cán bộ cập nhật
let resStatus = null;
const chMine = danA.channel(`t-rep-${RUN}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports', filter: `reporter_id=eq.${danA.id}` }, (p) => { resStatus = p.new.status; });
await new Promise((r) => chMine.subscribe((s) => s === 'SUBSCRIBED' && r()));
await sleep(1500); // chờ Realtime đăng ký xong
const st1 = await bithu.rpc('update_report_status', { p_report_id: rep.data.id, p_status: 'dang_xu_ly', p_note: 'Đã báo điện lực' });
check('Bí thư chuyển "Đang xử lý" kèm ghi chú', !st1.error, st1.error?.message);
check('Realtime: người dân thấy cập nhật ngay', await waitFor(() => resStatus === 'dang_xu_ly'), resStatus);
danA.removeChannel(chMine);

const hist = await bithu.from('report_updates')
  .select('id, status, note, created_at, actor:profiles!report_updates_actor_id_fkey(username, residents(full_name))')
  .eq('report_id', rep.data.id).order('created_at');
check('Admin: tiến trình có người thực hiện + ghi chú', hist.data?.length === 2 && hist.data[1].note === 'Đã báo điện lực' && hist.data[1].actor?.residents?.full_name, hist.error?.message);
const histMine = await danA.from('report_updates').select('id, status, note, created_at').eq('report_id', rep.data.id).order('created_at');
check('Người dân xem được tiến trình + ghi chú', histMine.data?.[1]?.note === 'Đã báo điện lực');

const photonUpd = await photon.rpc('update_report_status', { p_report_id: rep.data.id, p_status: 'hoan_thanh' });
check('Phó thôn KHÔNG cập nhật được phản ánh', !!photonUpd.error);
const earlyRate = await danA.rpc('rate_report', { p_report_id: rep.data.id, p_rating: 5 });
check('Chưa xong thì chưa đánh giá được', !!earlyRate.error);
await bithu.rpc('update_report_status', { p_report_id: rep.data.id, p_status: 'hoan_thanh', p_note: 'Đã thay bóng mới' });
const rate = await danA.rpc('rate_report', { p_report_id: rep.data.id, p_rating: 5, p_comment: 'Nhanh lắm' });
check('Người gửi đánh giá 5 sao sau khi xong', !rate.error, rate.error?.message);
const rateOther = await danB.rpc('rate_report', { p_report_id: rep.data.id, p_rating: 1 });
check('Người khác không đánh giá được', !!rateOther.error);

console.log('\nTin tức');
const coverPath = `covers/${RUN}.jpg`;
const cov = await bithu.storage.from('news').upload(coverPath, jpeg, { contentType: 'image/jpeg' });
check('Cán bộ tải ảnh bìa', !cov.error, cov.error?.message);
const coverUrl = bithu.storage.from('news').getPublicUrl(coverPath).data.publicUrl;
const fetched = await fetch(coverUrl);
check('Ảnh bìa xem được qua link công khai', fetched.status === 200, fetched.status);
const covHack = await danA.storage.from('news').upload(`covers/hack-${RUN}.jpg`, jpeg, { contentType: 'image/jpeg' });
check('Người dân KHÔNG tải ảnh vào kho tin tức được', !!covHack.error);

const draft = await bithu.from('news').insert({
  title: `Ra quân dọn đường làng ${RUN}`, summary: 'Sáng Chủ nhật', content: 'Đoạn 1\n\nĐoạn 2',
  cover_url: coverUrl, is_published: false, author_id: li.data.user.id,
}).select('id').single();
check('Cán bộ lưu bản nháp', !draft.error, draft.error?.message);
const newsQuery = (c) => c.from('news').select('id, title, summary, content, cover_url, is_pinned, published_at')
  .eq('is_published', true).order('is_pinned', { ascending: false }).order('published_at', { ascending: false }).limit(50);
const n1 = await newsQuery(danA);
check('Người dân KHÔNG thấy bản nháp', !n1.data?.some((n) => n.id === draft.data.id), n1.error?.message);
const draftDirect = await danA.from('news').select('id').eq('id', draft.data.id);
check('Người dân KHÔNG đọc được bản nháp kể cả khi biết mã', draftDirect.data?.length === 0);

await bithu.from('news').update({ is_published: true, is_pinned: true, published_at: new Date().toISOString() }).eq('id', draft.data.id);
const n2 = await newsQuery(danA);
check('Đăng tin → người dân thấy, tin ghim đứng đầu', n2.data?.[0]?.id === draft.data.id, JSON.stringify(n2.data?.slice(0, 2)));
const one1 = await danA.from('news').select('id, title, summary, content, cover_url, is_pinned, published_at').eq('id', draft.data.id).eq('is_published', true).maybeSingle();
check('App: mở chi tiết tin', one1.data?.content === 'Đoạn 1\n\nĐoạn 2', one1.error?.message);
const hackNews = await danA.from('news').insert({ title: 'x', content: 'x', is_published: true });
check('Người dân KHÔNG tự đăng tin được', !!hackNews.error);
const hackEdit = await danA.from('news').update({ title: 'bị sửa' }).eq('id', draft.data.id).select();
check('Người dân KHÔNG sửa được tin', !hackEdit.error ? hackEdit.data.length === 0 : true);
const unpub = await bithu.from('news').update({ is_published: false }).eq('id', draft.data.id);
const n3 = await newsQuery(danA);
check('Gỡ đăng → người dân không thấy nữa', !unpub.error && !n3.data?.some((n) => n.id === draft.data.id));
await bithu.from('news').delete().eq('id', draft.data.id);

console.log('\nTin nhắn nhóm');
const grp = await bithu.rpc('create_chat_group', { p_name: `Ban điều hành ${RUN}`, p_type: 'custom', p_member_ids: [danA.id, danB.id] });
check('Cán bộ tạo nhóm tuỳ chọn', !grp.error, grp.error?.message);
const G = grp.data;

const inbox = async (c) => (await c.rpc('my_chat_groups')).data?.find((g) => g.id === G);
let ia = await inbox(danA);
check('Hộp thư: thành viên thấy nhóm, chưa có tin', ia && ia.member_count === 3 && ia.unread === 0 && ia.last_message_at === null, JSON.stringify(ia));
check('Hộp thư: người ngoài nhóm không thấy', !(await inbox(photon)));

let gotMsg = null;
const chChat = danA.channel(`t-chat-${RUN}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${G}` }, (p) => { gotMsg = p.new; });
await new Promise((r) => chChat.subscribe((s) => s === 'SUBSCRIBED' && r()));
await sleep(1500); // chờ Realtime đăng ký xong
const m1 = await bithu.from('messages').insert({ group_id: G, sender_id: li.data.user.id, content: 'Chào cả nhóm' })
  .select('id, group_id, sender_id, content, image_path, is_pinned, deleted_at, created_at').single();
check('Quản trị nhóm gửi tin', !m1.error, m1.error?.message);
check('Realtime: thành viên nhận tin ngay', await waitFor(() => gotMsg?.id === m1.data?.id));
danA.removeChannel(chChat);

ia = await inbox(danA);
check('Hộp thư: 1 tin chưa đọc + tên người gửi + nội dung', ia.unread === 1 && ia.last_content === 'Chào cả nhóm' && !!ia.last_sender_name, JSON.stringify(ia));
await danA.rpc('mark_group_read', { p_group_id: G });
ia = await inbox(danA);
check('Đánh dấu đã đọc → hết chưa đọc', ia.unread === 0);

const list = await danA.from('messages').select('id, group_id, sender_id, content, image_path, is_pinned, deleted_at, created_at')
  .eq('group_id', G).order('created_at', { ascending: false }).limit(40);
check('Thành viên tải được tin nhắn', list.data?.length === 1, list.error?.message);
const spy = await photon.from('messages').select('id').eq('group_id', G);
check('Người ngoài nhóm KHÔNG đọc được tin', spy.data?.length === 0);
const spySend = await photon.from('messages').insert({ group_id: G, sender_id: photon.id, content: 'x' });
check('Người ngoài nhóm KHÔNG gửi được tin', !!spySend.error);

const dir = await danA.from('member_directory').select('id, full_name').in('id', [li.data.user.id, danB.id]);
check('App: lấy được tên thành viên để hiển thị', dir.data?.length === 2, dir.error?.message);

const chatImg = `${G}/${danA.id}-${RUN}.jpg`;
const cu = await danA.storage.from('chat').upload(chatImg, jpeg, { contentType: 'image/jpeg' });
check('Thành viên gửi ảnh vào kho chat của nhóm', !cu.error, cu.error?.message);
const cuSpy = await photon.storage.from('chat').upload(`${G}/spy-${RUN}.jpg`, jpeg, { contentType: 'image/jpeg' });
check('Người ngoài nhóm KHÔNG tải ảnh vào nhóm được', !!cuSpy.error);
const m2 = await danA.from('messages').insert({ group_id: G, sender_id: danA.id, image_path: chatImg }).select('id').single();
check('Gửi tin nhắn ảnh', !m2.error, m2.error?.message);
const urlB = await danB.storage.from('chat').createSignedUrls([chatImg], 3600);
check('Thành viên khác xem được ảnh', !!urlB.data?.[0]?.signedUrl);
const urlSpy = await photon.storage.from('chat').createSignedUrls([chatImg], 3600);
check('Người ngoài nhóm KHÔNG xem được ảnh', !urlSpy.data?.[0]?.signedUrl);

const pinBad = await danA.rpc('pin_message', { p_message_id: m1.data.id, p_pinned: true });
check('Thành viên thường KHÔNG ghim được', !!pinBad.error);
const pinOk = await bithu.rpc('pin_message', { p_message_id: m1.data.id, p_pinned: true });
check('Quản trị nhóm ghim tin', !pinOk.error, pinOk.error?.message);
const delBad = await danB.rpc('delete_message', { p_message_id: m2.data.id });
check('KHÔNG thu hồi được tin của người khác', !!delBad.error);
const delOk = await danA.rpc('delete_message', { p_message_id: m2.data.id });
const delRow = await danB.from('messages').select('deleted_at, content, image_path').eq('id', m2.data.id).single();
check('Người gửi thu hồi tin của mình (xoá nội dung)', !delOk.error && delRow.data?.deleted_at && delRow.data.image_path === null, delOk.error?.message);
ia = await inbox(danB);
check('Hộp thư hiện "đã thu hồi" cho tin cuối', ia.last_deleted === true);

await bithu.rpc('update_group_member', { p_group_id: G, p_user_id: danB.id, p_is_muted: true });
const mutedSend = await danB.from('messages').insert({ group_id: G, sender_id: danB.id, content: 'x' });
check('Thành viên bị khoá chat KHÔNG gửi được', !!mutedSend.error);
check('Hộp thư báo "đang bị khoá chat"', (await inbox(danB)).is_muted === true);

const adminGroups = await bithu.from('chat_groups').select('id, name, type, last_message_at, chat_group_members(count)').eq('id', G);
check('Admin: danh sách nhóm kèm số thành viên', adminGroups.data?.[0]?.chat_group_members?.[0]?.count === 3, adminGroups.error?.message ?? JSON.stringify(adminGroups.data));
const adminMembers = await bithu.from('chat_group_members').select('user_id, role, is_muted, profiles(username, residents(full_name, areas(name)))').eq('group_id', G);
check('Admin: thành viên kèm tên + khu', adminMembers.data?.some((m) => m.profiles?.residents?.full_name), adminMembers.error?.message);
const adminMsgs = await bithu.from('messages').select('id, sender_id, content, image_path, deleted_at, created_at, profiles(username, residents(full_name))').eq('group_id', G);
check('Admin: xem tin nhắn để kiểm duyệt', adminMsgs.data?.length === 2, adminMsgs.error?.message);

const leave = await danA.rpc('remove_group_member', { p_group_id: G, p_user_id: danA.id });
check('Thành viên tự rời nhóm', !leave.error && !(await inbox(danA)), leave.error?.message);
const kick = await danB.rpc('remove_group_member', { p_group_id: G, p_user_id: li.data.user.id });
check('Thành viên thường KHÔNG xoá được người khác', !!kick.error);
await bithu.from('chat_groups').delete().eq('id', G);

console.log('\nKhảo sát / Biểu quyết');
// Hộ gia đình ở Khu A gồm danA và danA2
const { data: hh } = await bithu.from('households').insert({ code: `H${RUN}`, head_name: 'Chủ hộ', area_id: khuA.id }).select('id').single();
const danA2 = await resident('dana2', khuA.id);
const resIds = (await bithu.from('profiles').select('resident_id').in('id', [danA.id, danA2.id])).data.map((p) => p.resident_id);
await bithu.from('residents').update({ household_id: hh.id }).in('id', resIds);

const badPoll = await danA.rpc('create_poll', { p_title: 'x', p_options: ['a', 'b'] });
check('Người dân KHÔNG tạo được khảo sát', !!badPoll.error);
const tooFew = await bithu.rpc('create_poll', { p_title: 'x', p_options: ['a', '  '] });
check('Cần ít nhất 2 phương án', tooFew.error?.message.includes('2 phương án'), tooFew.error?.message);

const poll = await bithu.rpc('create_poll', {
  p_title: `Góp tiền làm đường ngõ 3? ${RUN}`, p_options: ['Đồng ý', 'Không đồng ý', 'Ý kiến khác'],
  p_vote_scope: 'household', p_target_all: false, p_area_ids: [khuA.id],
  p_closes_at: new Date(Date.now() + 7 * 86400e3).toISOString(),
});
check('Cán bộ tạo khảo sát mỗi hộ một phiếu cho Khu A', !poll.error, poll.error?.message);
const P = poll.data;
const pOpts = (await danA.from('poll_options').select('id, label').eq('poll_id', P).order('sort_order')).data;
check('Người Khu A thấy khảo sát + 3 phương án', pOpts?.length === 3 && pOpts[0].label === 'Đồng ý');
const seenB = await danB.from('polls').select('id').eq('id', P);
check('Người Khu B KHÔNG thấy khảo sát', seenB.data?.length === 0);
const resB = await danB.rpc('poll_results', { p_poll_id: P });
check('Người Khu B KHÔNG xem được kết quả', !!resB.error);
const voteB = await danB.rpc('cast_vote', { p_poll_id: P, p_option_ids: [pOpts[0].id] });
check('Người ngoài đối tượng KHÔNG bỏ phiếu được', !!voteB.error);

const v1 = await danA.rpc('cast_vote', { p_poll_id: P, p_option_ids: [pOpts[1].id] });
check('Người dân bỏ phiếu', !v1.error, v1.error?.message);
const v1b = await danA.rpc('cast_vote', { p_poll_id: P, p_option_ids: [pOpts[0].id] });
check('Đổi phiếu khi khảo sát còn mở', !v1b.error, v1b.error?.message);
const multi = await danA.rpc('cast_vote', { p_poll_id: P, p_option_ids: [pOpts[0].id, pOpts[1].id] });
check('Khảo sát một lựa chọn KHÔNG cho chọn nhiều', !!multi.error);
const sameHH = await danA2.rpc('cast_vote', { p_poll_id: P, p_option_ids: [pOpts[1].id] });
check('Người cùng hộ KHÔNG bỏ thêm phiếu được', sameHH.error?.message.includes('Hộ của bạn'), sameHH.error?.message);
const noHH = await resident('nohh', khuA.id);
const noHHVote = await noHH.rpc('cast_vote', { p_poll_id: P, p_option_ids: [pOpts[0].id] });
check('Chưa gắn hộ → được báo rõ lý do', noHHVote.error?.message.includes('chưa gắn với hộ'), noHHVote.error?.message);

const results = (await danA.rpc('poll_results', { p_poll_id: P })).data;
check('Kết quả: "Đồng ý" 1 phiếu, đánh dấu phiếu của tôi, 1 hộ tham gia',
  results?.[0]?.votes === 1 && results[0].my_vote && results[1].votes === 0 && results[0].voters === 1, JSON.stringify(results));
const elig = await bithu.rpc('poll_eligible_count', { p_poll_id: P });
check('Số hộ thuộc đối tượng (để tính tỉ lệ tham gia)', elig.data >= 1, JSON.stringify(elig));
const voters = await bithu.rpc('poll_voters', { p_poll_id: P });
check('Cán bộ xem ai chọn gì (khảo sát công khai)', voters.data?.[0]?.option_label === 'Đồng ý' && !!voters.data[0].full_name, voters.error?.message);
const votersRes = await danA.rpc('poll_voters', { p_poll_id: P });
check('Người dân KHÔNG xem danh sách người bỏ phiếu', !!votersRes.error);
const peekVotes = await danA2.from('poll_votes').select('user_id').eq('poll_id', P);
check('Người dân KHÔNG xem phiếu của người khác', peekVotes.data?.length === 0);
const directVote = await danA2.from('poll_votes').insert({ poll_id: P, option_id: pOpts[1].id, user_id: danA2.id });
check('KHÔNG ghi phiếu trực tiếp vào bảng (phải qua cast_vote)', !!directVote.error);

const cl = await bithu.rpc('close_poll', { p_poll_id: P });
const afterClose = await danA.rpc('cast_vote', { p_poll_id: P, p_option_ids: [pOpts[1].id] });
check('Đóng khảo sát → không bỏ/đổi phiếu được nữa', !cl.error && afterClose.error?.message.includes('đã đóng'), afterClose.error?.message);

const anon = await bithu.rpc('create_poll', {
  p_title: `Chọn ngày hội làng ${RUN}`, p_options: ['Thứ Bảy', 'Chủ nhật', 'Ngày lễ'], p_allow_multiple: true, p_is_anonymous: true,
});
const aOpts = (await danB.from('poll_options').select('id').eq('poll_id', anon.data).order('sort_order')).data;
const aVote = await danB.rpc('cast_vote', { p_poll_id: anon.data, p_option_ids: [aOpts[0].id, aOpts[1].id] });
check('Khảo sát nhiều lựa chọn, toàn thôn: chọn 2 phương án', !aVote.error, aVote.error?.message);
const aRes = (await danB.rpc('poll_results', { p_poll_id: anon.data })).data;
check('Kết quả nhiều lựa chọn: 1 người tham gia, 2 phiếu', aRes?.[0]?.voters === 1 && aRes[0].votes === 1 && aRes[1].votes === 1);
const aVoters = await bithu.rpc('poll_voters', { p_poll_id: anon.data });
check('Khảo sát ẩn danh: cán bộ cũng KHÔNG xem được ai chọn gì', aVoters.error?.message.includes('ẩn danh'), aVoters.error?.message);
const appList = await danA.from('polls').select('id, title, description, allow_multiple, is_anonymous, vote_scope, closes_at, closed_at, created_at').order('created_at', { ascending: false }).limit(100);
const myVotes = await danA.from('poll_votes').select('poll_id').eq('user_id', danA.id);
check('App: danh sách khảo sát + đánh dấu đã bỏ phiếu', appList.data?.some((p) => p.id === P) && myVotes.data?.some((v) => v.poll_id === P), appList.error?.message ?? myVotes.error?.message);
await bithu.from('polls').delete().in('id', [P, anon.data]);

console.log('\nSửa hồ sơ');
const avPath = `${danA.id}/${RUN}.jpg`;
const av = await danA.storage.from('avatars').upload(avPath, jpeg, { contentType: 'image/jpeg' });
check('Tải ảnh đại diện vào thư mục của mình', !av.error, av.error?.message);
const avBad = await danA.storage.from('avatars').upload(`${danB.id}/${RUN}.jpg`, jpeg, { contentType: 'image/jpeg' });
check('KHÔNG tải ảnh đại diện vào thư mục người khác', !!avBad.error);
const avUrl = danA.storage.from('avatars').getPublicUrl(avPath).data.publicUrl;
check('Ảnh đại diện xem được qua link công khai', (await fetch(avUrl)).status === 200);
const upd = await danA.rpc('update_my_profile', { p_avatar_url: avUrl, p_phone: '0911222333' });
const meA = (await danA.rpc('get_me')).data;
check('Cập nhật ảnh + số điện thoại của mình', !upd.error && meA.avatar_url === avUrl && meA.phone === '0911222333', upd.error?.message);
const keep = await danA.rpc('update_my_profile', {});
const meA2 = (await danA.rpc('get_me')).data;
check('Gọi không truyền gì thì giữ nguyên thông tin', !keep.error && meA2.phone === '0911222333' && meA2.avatar_url === avUrl);
const dirAv = await danB.from('member_directory').select('avatar_url').eq('id', danA.id).single();
check('Người khác thấy ảnh đại diện (trong chat / danh bạ)', dirAv.data?.avatar_url === avUrl);

console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi\n`);
await Promise.all([bithu, danA, danB, photon].map((c) => c.removeAllChannels()));
process.exit(fail ? 1 : 0);

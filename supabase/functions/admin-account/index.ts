// Cán bộ tạo / xoá tài khoản cho người dân (cần quyền quản trị Auth nên làm ở máy chủ).
//   create: tạo tài khoản đăng nhập bằng tên đăng nhập + mật khẩu, gắn với một nhân khẩu có sẵn, kích hoạt ngay
//           (dành cho người cao tuổi chưa dùng được điện thoại — cán bộ lập hộ rồi trao mật khẩu).
//   delete: xoá hẳn tài khoản (Bí thư / Trưởng thôn). Nhân khẩu được giữ lại và được cấp mã kích hoạt mới.
// Quy tắc cấp bậc như trang quản trị: không thao tác với người ngang hoặc cao hơn mình.
import { createClient } from 'npm:@supabase/supabase-js@2';

const USERNAME_DOMAIN = '@thongnhat.local';
const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;
const RANK: Record<string, number> = { bi_thu: 3, truong_thon: 2, pho_thon: 1 };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await caller.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
  if (!u.user) return reply(401, { error: 'Chưa đăng nhập' });
  const { data: rankData } = await caller.rpc('my_rank');
  const myRank = (rankData as number | null) ?? 0;
  if (myRank < 1) return reply(403, { error: 'Chỉ cán bộ thôn được thực hiện' });

  let body: { action?: string; resident_id?: string; username?: string; password?: string; user_id?: string };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Dữ liệu không hợp lệ' });
  }
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // ---------------------------------------------------------------- tạo tài khoản
  if (body.action === 'create') {
    const username = (body.username ?? '').trim().toLowerCase();
    const password = body.password ?? '';
    if (!body.resident_id) return reply(400, { error: 'Thiếu nhân khẩu' });
    if (!USERNAME_RE.test(username)) return reply(400, { error: 'Tên đăng nhập gồm 3–30 ký tự: chữ thường không dấu, số, dấu chấm hoặc gạch dưới' });
    if (password.length < 6) return reply(400, { error: 'Mật khẩu phải có ít nhất 6 ký tự' });

    const { data: resident } = await admin.from('residents').select('id, full_name').eq('id', body.resident_id).maybeSingle();
    if (!resident) return reply(404, { error: 'Không tìm thấy nhân khẩu' });
    const { data: existing } = await admin.from('profiles').select('id').eq('resident_id', resident.id).maybeSingle();
    if (existing) return reply(409, { error: 'Nhân khẩu này đã có tài khoản' });

    const { data: created, error } = await admin.auth.admin.createUser({
      email: `${username}${USERNAME_DOMAIN}`,
      password,
      email_confirm: true,
      user_metadata: { username },
    });
    if (error || !created.user) {
      const msg = error?.message ?? '';
      return reply(/already|registered|exists/i.test(msg) ? 409 : 500, {
        error: /already|registered|exists/i.test(msg) ? 'Tên đăng nhập này đã có người dùng. Vui lòng chọn tên khác.' : msg || 'Không tạo được tài khoản',
      });
    }
    // Hồ sơ (profiles) đã được trigger tạo sẵn; gắn nhân khẩu + kích hoạt
    const { error: upErr } = await admin
      .from('profiles')
      .update({ resident_id: resident.id, status: 'active', approved_by: u.user.id, approved_at: new Date().toISOString() })
      .eq('id', created.user.id);
    if (upErr) {
      await admin.auth.admin.deleteUser(created.user.id); // hoàn tác để không để lại tài khoản dở dang
      return reply(500, { error: upErr.message });
    }
    await admin.from('residents').update({ activation_code: null, activation_expires_at: null }).eq('id', resident.id);
    await admin.from('audit_logs').insert({
      actor_id: u.user.id,
      action: 'create_account',
      entity: 'profiles',
      entity_id: created.user.id,
      data: { username, resident: resident.full_name },
    });
    return reply(200, { ok: true, user_id: created.user.id });
  }

  // ---------------------------------------------------------------- xoá tài khoản
  if (body.action === 'delete') {
    if (myRank < 2) return reply(403, { error: 'Chỉ Bí thư / Trưởng thôn được xoá tài khoản' });
    if (!body.user_id) return reply(400, { error: 'Thiếu tài khoản' });
    if (body.user_id === u.user.id) return reply(400, { error: 'Không thể xoá tài khoản của chính mình' });

    const { data: target } = await admin.from('profiles').select('id, username, leadership_role, resident_id').eq('id', body.user_id).maybeSingle();
    if (!target) return reply(404, { error: 'Không tìm thấy tài khoản' });
    if ((RANK[target.leadership_role ?? ''] ?? 0) >= myRank) {
      return reply(403, { error: 'Không thể thao tác với người có chức vụ ngang hoặc cao hơn' });
    }
    const { data: res } = target.resident_id
      ? await admin.from('residents').select('full_name').eq('id', target.resident_id).maybeSingle()
      : { data: null };

    // Ghi nhật ký TRƯỚC khi xoá (sau khi xoá không còn thông tin)
    await admin.from('audit_logs').insert({
      actor_id: u.user.id,
      action: 'delete_account',
      entity: 'profiles',
      entity_id: target.id,
      data: { username: target.username, resident: res?.full_name ?? null, role: target.leadership_role },
    });
    const { error } = await admin.auth.admin.deleteUser(target.id);
    if (error) return reply(500, { error: error.message });

    // Cấp mã kích hoạt mới để người dân có thể đăng ký lại
    if (target.resident_id) {
      const { data: code } = await admin.rpc('gen_activation_code');
      if (code) {
        await admin
          .from('residents')
          .update({ activation_code: code as string, activation_expires_at: new Date(Date.now() + 180 * 86400e3).toISOString() })
          .eq('id', target.resident_id);
      }
    }
    return reply(200, { ok: true });
  }

  return reply(400, { error: 'Thao tác không hợp lệ' });
});

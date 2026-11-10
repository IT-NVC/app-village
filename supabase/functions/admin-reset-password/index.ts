// Cán bộ thôn đặt lại mật khẩu cho người dân (tài khoản đăng nhập bằng username).
// Quy tắc: chỉ cán bộ (Phó thôn trở lên), chỉ với người có chức vụ thấp hơn mình,
// không áp dụng cho tài khoản Google.
import { createClient } from 'npm:@supabase/supabase-js@2';

const USERNAME_DOMAIN = '@thongnhat.local';
const RANK: Record<string, number> = { bi_thu: 3, truong_thon: 2, pho_thon: 1 };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // Người gọi
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await caller.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
  if (!userData.user) return reply(401, { error: 'Chưa đăng nhập' });

  const { data: myRank } = await caller.rpc('my_rank');
  if (!myRank || myRank < 1) return reply(403, { error: 'Chỉ cán bộ thôn được đặt lại mật khẩu' });

  let body: { user_id?: string; new_password?: string };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Dữ liệu không hợp lệ' });
  }
  const { user_id, new_password } = body;
  if (!user_id || !new_password || new_password.length < 6) {
    return reply(400, { error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  }
  if (user_id === userData.user.id) {
    return reply(400, { error: 'Không thể tự đặt lại mật khẩu của mình tại đây' });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: target } = await admin
    .from('profiles')
    .select('leadership_role')
    .eq('id', user_id)
    .maybeSingle();
  if (!target) return reply(404, { error: 'Không tìm thấy tài khoản' });
  if ((RANK[target.leadership_role ?? ''] ?? 0) >= myRank) {
    return reply(403, { error: 'Không thể thao tác với người có chức vụ ngang hoặc cao hơn' });
  }

  const { data: authUser } = await admin.auth.admin.getUserById(user_id);
  if (!authUser.user?.email?.endsWith(USERNAME_DOMAIN)) {
    return reply(400, { error: 'Tài khoản này đăng nhập bằng Google, không có mật khẩu để đặt lại' });
  }

  const { error } = await admin.auth.admin.updateUserById(user_id, { password: new_password });
  if (error) return reply(500, { error: error.message });

  await admin.from('audit_logs').insert({
    actor_id: userData.user.id,
    action: 'reset_password',
    entity: 'profiles',
    entity_id: user_id,
  });

  return reply(200, { ok: true });
});

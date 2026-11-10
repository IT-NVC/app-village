// Tạo dữ liệu mẫu cho Supabase LOCAL để thử app trên máy ảo.
// Chạy: node supabase/scripts/seed-dev.mjs  (chạy lại nhiều lần không sao)
import { createClient } from '@supabase/supabase-js';

const URL = 'http://127.0.0.1:54321';
const SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

async function ensureUser(username, password) {
  const email = `${username}@thongnhat.local`;
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const found = list.users.find((u) => u.email === email);
  if (found) return found.id;
  const { data, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { username },
  });
  if (error) throw error;
  return data.user.id;
}

// Khu vực
const areaNames = ['Khu A', 'Khu B', 'Khu C'];
await db.from('areas').upsert(areaNames.map((name, i) => ({ name, sort_order: i })), { onConflict: 'name' });
const { data: areas } = await db.from('areas').select('id, name');
const areaId = (n) => areas.find((a) => a.name === n).id;

// Bí thư
const bithuId = await ensureUser('bithu', '123456');
let { data: bithu } = await db.from('profiles').select('resident_id').eq('id', bithuId).single();
if (!bithu.resident_id) {
  const { data: r } = await db.from('residents')
    .insert({ full_name: 'Nguyễn Văn Bí Thư', area_id: areaId('Khu A'), phone: '0912000001', source: 'self' })
    .select().single();
  bithu.resident_id = r.id;
}
await db.from('profiles')
  .update({ leadership_role: 'bi_thu', status: 'active', resident_id: bithu.resident_id })
  .eq('id', bithuId);

// Nhân khẩu nhập sẵn (chưa có tài khoản) -> có mã kích hoạt
const people = [
  { full_name: 'Trần Thị Mai', area_id: areaId('Khu A'), phone: '0912000002' },
  { full_name: 'Lê Văn Hùng', area_id: areaId('Khu B'), phone: '0912000003' },
];
for (const p of people) {
  const { data: existing } = await db.from('residents').select('id').eq('full_name', p.full_name).maybeSingle();
  if (!existing) await db.from('residents').insert(p);
}
const { data: codes } = await db.from('residents')
  .select('full_name, activation_code').not('activation_code', 'is', null);

console.log('\nTài khoản Bí thư:  bithu / 123456');
console.log('Mã kích hoạt để thử (đăng ký tài khoản mới rồi nhập mã):');
for (const c of codes) console.log(`  ${c.activation_code}  →  ${c.full_name}`);
console.log('Hoặc đăng ký mới rồi "Tự khai báo" → đăng nhập bithu để duyệt (trang admin sẽ làm sau).\n');

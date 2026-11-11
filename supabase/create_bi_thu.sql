-- =====================================================================
-- TẠO TÀI KHOẢN BÍ THƯ ĐẦU TIÊN (đăng nhập bằng tên đăng nhập + mật khẩu)
--
-- Cách dùng: Supabase Dashboard → SQL Editor → New query → dán TOÀN BỘ file này
--            → SỬA 5 dòng trong phần "THÔNG TIN CẦN SỬA" → bấm Run.
--
-- - Chạy lại nhiều lần vẫn an toàn: tài khoản đã có thì chỉ cập nhật (đổi mật khẩu, gán lại Bí thư).
-- - Đăng nhập trên app / trang quản trị: ô "Tên đăng nhập" gõ đúng v_username, ô "Mật khẩu" gõ v_password.
-- - Chạy xong nên XOÁ mật khẩu khỏi trình soạn thảo SQL (không lưu query này lại).
-- =====================================================================
do $$
declare
  -- ===================== THÔNG TIN CẦN SỬA =====================
  v_username  text   := 'bithu';                  -- chữ thường không dấu, số, dấu chấm, gạch dưới (3–30 ký tự)
  v_password  text   := 'DoiMatKhauNay@2026';      -- ít nhất 6 ký tự — NÊN đặt mật khẩu mạnh
  v_full_name text   := 'Nguyễn Văn A';            -- họ tên thật của Bí thư
  v_phone     text   := '0912345678';              -- số điện thoại (để trống '' nếu không muốn)
  v_areas     text[] := array['Khu A', 'Khu B', 'Khu C'];  -- các khu của thôn (Bí thư ở khu ĐẦU TIÊN)
  -- =============================================================

  v_email    text := lower(trim(v_username)) || '@thongnhat.local';
  v_user_id  uuid;
  v_area_id  uuid;
  v_resident uuid;
  v_i        int := 0;
  v_name     text;
begin
  -- 0. Kiểm tra đầu vào
  if lower(trim(v_username)) !~ '^[a-z0-9_.]{3,30}$' then
    raise exception 'Tên đăng nhập "%" không hợp lệ: chỉ chữ thường không dấu, số, dấu chấm, gạch dưới (3–30 ký tự)', v_username;
  end if;
  if length(v_password) < 6 then
    raise exception 'Mật khẩu phải có ít nhất 6 ký tự';
  end if;

  -- 1. Tạo các khu (bỏ qua khu đã có)
  foreach v_name in array v_areas loop
    v_i := v_i + 1;
    insert into public.areas (name, sort_order) values (trim(v_name), v_i)
    on conflict (name) do nothing;
  end loop;
  select id into v_area_id from public.areas where name = trim(v_areas[1]);

  -- 2. Tài khoản đăng nhập (auth.users + auth.identities)
  select id into v_user_id from auth.users where email = v_email;
  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      -- Các cột chữ dưới đây phải là '' (không để NULL), nếu không máy chủ đăng nhập sẽ báo lỗi
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('username', lower(trim(v_username))), now(), now(),
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_user_id, v_user_id::text, 'email',
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      now(), now(), now()
    );
    raise notice 'Đã tạo tài khoản đăng nhập %', v_username;
  else
    -- Đã có: đặt lại mật khẩu theo giá trị ở trên
    update auth.users
       set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_user_id;
    raise notice 'Tài khoản % đã có — đã đặt lại mật khẩu', v_username;
  end if;

  -- 3. Hồ sơ (trigger thường đã tự tạo profile; phòng trường hợp chưa có)
  insert into public.profiles (id, username) values (v_user_id, lower(trim(v_username)))
  on conflict (id) do nothing;

  -- 4. Nhân khẩu của Bí thư (tạo nếu tài khoản chưa gắn hồ sơ)
  select resident_id into v_resident from public.profiles where id = v_user_id;
  if v_resident is null then
    insert into public.residents (full_name, phone, area_id, source, created_by)
    values (trim(v_full_name), nullif(trim(v_phone), ''), v_area_id, 'self', v_user_id)
    returning id into v_resident;
  else
    update public.residents
       set full_name = trim(v_full_name), phone = nullif(trim(v_phone), ''), area_id = coalesce(area_id, v_area_id)
     where id = v_resident;
  end if;

  -- 5. Kích hoạt + gán chức vụ Bí thư
  update public.profiles
     set username = lower(trim(v_username)),
         resident_id = v_resident,
         status = 'active',
         leadership_role = 'bi_thu',
         activation_attempts = 0,
         approved_at = coalesce(approved_at, now())
   where id = v_user_id;

  raise notice 'XONG: % (%) là Bí thư, thuộc %', v_full_name, v_username, v_areas[1];
end $$;

-- Kiểm tra kết quả: phải thấy 1 dòng, status = active, leadership_role = bi_thu
select p.username, p.status, p.leadership_role, r.full_name, r.phone, a.name as khu
from public.profiles p
left join public.residents r on r.id = p.resident_id
left join public.areas a on a.id = r.area_id
where p.leadership_role = 'bi_thu'
order by p.created_at;

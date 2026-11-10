-- Chạy MỘT LẦN trong SQL Editor (Supabase Dashboard) sau khi Bí thư đã tạo tài khoản.
-- Thay 'ten_dang_nhap' bằng username Bí thư đã đăng ký
-- (nếu đăng nhập bằng Google thì dùng điều kiện theo email ở dòng comment bên dưới).
update public.profiles
   set leadership_role = 'bi_thu', status = 'active'
 where username = 'ten_dang_nhap';
-- where id = (select id from auth.users where email = 'email_cua_bi_thu@gmail.com');

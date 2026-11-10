# Thôn Thống Nhất - Xã Sóc Sơn

Ứng dụng nội bộ cho người dân và cán bộ Thôn Thống Nhất.

| Thư mục | Nội dung |
|---|---|
| `apps/mobile` | App người dùng (React Native + Expo, Android & iOS) |
| `apps/admin` | Trang quản trị (React + Vite) |
| `packages/shared` | Kiểu dữ liệu & nhãn tiếng Việt dùng chung |
| `supabase/migrations` | Cơ sở dữ liệu, phân quyền, nghiệp vụ |
| `supabase/tests/e2e.mjs` | Kiểm thử phân quyền end-to-end |

## Chạy trên máy (local)

Yêu cầu: Node.js, Docker Desktop đang chạy.

```bash
npm install
npx supabase start          # khởi động Supabase local (lần đầu tải image mất vài phút)
npx supabase db reset       # áp dụng lại toàn bộ migration
node supabase/tests/e2e.mjs # chạy kiểm thử
npm run db:types            # sinh lại TypeScript types sau khi sửa schema
```

## Trang quản trị (admin)

```bash
npm run admin               # mở http://localhost:5173
```

Chỉ Bí thư, Trưởng thôn, Phó thôn đăng nhập được. Chức năng: tổng quan, duyệt tài khoản,
nhân khẩu (thêm / sửa / nhập từ Excel / in phiếu mã kích hoạt), tài khoản & phân quyền
(chức vụ, khoá, đặt lại mật khẩu), khu vực & ban ngành (thành viên, tạo nhóm chat),
cài đặt (chế độ chờ duyệt, danh bạ), nhật ký thao tác.

Kiểm thử local: `npm run functions:serve` (cửa sổ riêng) → `npm run db:seed` → `npm run db:test:admin`.

## Đưa lên Supabase cloud

1. Tạo project trên supabase.com, chọn region **Singapore** (gần Việt Nam nhất).
2. Liên kết và đẩy schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <mã-project>
   npx supabase db push
   ```
3. Dashboard → **Authentication → Sign In / Providers → Email**: **tắt "Confirm email"**
   (đăng nhập bằng username được quy đổi thành email nội bộ `username@thongnhat.local`, không có hộp thư thật).
4. Bật Google: xem mục *Đăng nhập Google* (làm ở giai đoạn đăng nhập).
5. Bí thư tạo tài khoản trong app, sau đó chạy `supabase/bootstrap_bi_thu.sql` trong SQL Editor.
   Từ đó Bí thư phân quyền cho mọi người trong app/admin.

## Mô hình phân quyền

- **Bí thư** > **Trưởng thôn** > **Phó thôn**: chức vụ cán bộ (`profiles.leadership_role`).
  - Bí thư, Trưởng thôn: toàn quyền. Trưởng thôn chỉ thao tác được với người cấp thấp hơn.
  - Phó thôn: tạo khu, ban ngành, nhóm chat, gửi thông báo, duyệt tài khoản, phân trưởng ban.
- **Ban ngành** (`org_members`): Trưởng ban quản lý thành viên & nhóm chat của ban mình,
  gửi thông báo (không khẩn) tới ban mình.
- **Người dân**: tài khoản `active`.

Trạng thái tài khoản: `unverified` → (nhập mã kích hoạt → `active`) hoặc (tự khai báo → `pending` / `active` tuỳ công tắc **Chờ duyệt**).

Mọi thao tác nhạy cảm đi qua hàm RPC trong `supabase/migrations/*_functions.sql`;
bảo mật dữ liệu bằng RLS trong `*_rls_storage.sql`.

# Tiến độ dự án — App Thôn Thống Nhất (Xã Sóc Sơn)

> Cập nhật lần cuối: **10/11/2026**
> File này ghi lại **đã làm gì, chưa làm gì, và cách làm tiếp trên máy khác**.
> Khi làm xong một hạng mục, nhớ đánh dấu `[x]` và cập nhật ngày ở trên.

---

## 1. Tổng quan

| | |
|---|---|
| **Mục đích** | App nội bộ cho **một thôn** (~1.000 hộ): thông tin, thông báo, phản ánh, SOS, chat nhóm |
| **Nền tảng** | App Android + iOS (React Native / Expo SDK 58) và trang admin web (React + Vite + Ant Design) |
| **Backend** | Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions) |
| **Supabase cloud** | Project `App-Thon-Thong-Nhat`, mã `ssxeruahwpoutbfhaqbm`, region Singapore |
| **Người làm** | 1 người + Claude Code hỗ trợ |

### Các quyết định đã chốt (đừng đổi nếu không có lý do)

- **Phân quyền**: Bí thư > Trưởng thôn > Phó thôn > Ban ngành (Trưởng ban, Thành viên) > Người dân.
  - Bí thư, Trưởng thôn: toàn quyền. Trưởng thôn chỉ thao tác được với người cấp thấp hơn.
  - Phó thôn: tạo khu, ban ngành, nhóm chat; gửi thông báo; duyệt tài khoản; giao trưởng ban.
  - Trưởng ban: quản lý thành viên + nhóm chat của ban mình, gửi thông báo (không khẩn) cho ban mình.
  - **Không có** cấp trưởng khu / xóm.
- **Đăng nhập**: Google hoặc username + mật khẩu. Username được quy đổi ngầm thành email `username@thongnhat.local`.
  SMS OTP: để sau (chờ đề xuất chi phí). **Không** dùng Sign in with Apple (theo yêu cầu).
- **Vào app**: nhập **mã kích hoạt** do cán bộ phát (vào thẳng) **hoặc** tự khai báo
  (chờ duyệt nếu công tắc "Chờ duyệt" đang bật).
- **Chat**: chỉ trong nhóm do cán bộ tạo (nhóm khu, nhóm ban ngành), **không** nhắn riêng giữa người dân.
- **Phản ánh**: gửi thẳng tới **Bí thư** (Trưởng thôn cũng xem được), không chuyển lên xã.
- **Giao diện**: xanh lá nhạt `#3BA56A` (nền nút), chữ xanh đậm `#1F7A45`; font **Be Vietnam Pro**;
  chữ to, nút cao ≥ 56px cho người lớn tuổi.

---

## 2. Đã làm ✅

### Cơ sở dữ liệu & bảo mật (`supabase/migrations/`)
- [x] Toàn bộ bảng: khu, hộ, nhân khẩu, tài khoản, ban ngành, tin tức, thông báo (+ đối tượng nhận, đã đọc),
      phản ánh (+ lịch sử), SOS, danh bạ, nhóm chat, tin nhắn, push token, nhật ký, cài đặt
- [x] Phân quyền theo cấp bậc bằng RLS + hàm RPC (`set_leadership_role`, `review_account`, `set_org_member`…)
- [x] Mã kích hoạt 8 ký tự tự sinh, hạn 180 ngày, chặn sau 10 lần nhập sai
- [x] Công tắc "Chờ duyệt" (`app_settings.require_approval`)
- [x] Chat **tự đồng bộ thành viên** (vào/rời ban ngành, đổi khu → tự vào/rời nhóm)
- [x] Gửi thông báo theo khu / ban ngành / toàn thôn, hẹn giờ, thống kê **ai đã đọc / chưa đọc**
- [x] Phản ánh: trạng thái + lịch sử + đánh giá; SOS: chống gửi lặp 60 giây
- [x] Nhật ký thao tác (thay đổi chức vụ, trạng thái, ban ngành, cài đặt…)
- [x] Kho ảnh (avatars, news, report-images, chat, attachments) + Realtime cho chat/thông báo/phản ánh/SOS
- [x] **Đã đẩy lên Supabase cloud** và ghi nhận lịch sử migration
- [x] Kiểm thử: `npm run db:test` (71 bài) và `npm run db:test:admin` (23 bài) — đều đạt trên local

### Edge Function
- [x] `admin-reset-password`: cán bộ đặt lại mật khẩu cho người dân (kiểm tra cấp bậc, ghi nhật ký) — **chạy được ở local**

### App mobile (`apps/mobile`)
- [x] Đăng nhập Google + username/mật khẩu, đăng ký, dịch lỗi sang tiếng Việt
- [x] Kích hoạt bằng mã / tự khai báo hồ sơ / màn hình chờ duyệt / bị khoá
- [x] Tự điều hướng theo trạng thái tài khoản (`Stack.Protected`)
- [x] Trang chủ: lời chào, nhãn ngày/khu/chức vụ, nút KHẨN CẤP (**chưa có chức năng**), 4 ô tiện ích, danh bạ gọi điện
- [x] Tab Cá nhân: thông tin, ban ngành, đăng xuất
- [x] Giao diện đã làm đẹp (header gradient, thẻ bóng đổ, font Be Vietnam Pro)
- [x] Chạy được trên máy ảo Android bằng Expo Go, bản web cũng build được

### Trang admin (`apps/admin`)
- [x] Đăng nhập (username + Google), chỉ cán bộ thôn vào được
- [x] Tổng quan (số liệu), Duyệt tài khoản (cảnh báo trùng tên với nhân khẩu đã nhập)
- [x] Nhân khẩu: thêm/sửa/xoá, tìm không dấu, **nhập từ Excel/CSV**, **in phiếu mã kích hoạt** A4
- [x] Tài khoản & phân quyền: đặt chức vụ, khoá/mở, đặt lại mật khẩu
- [x] Khu vực & ban ngành: thành viên, giao trưởng ban, tạo nhóm chat 1 chạm
- [x] Cài đặt (công tắc chờ duyệt, danh bạ), Nhật ký thao tác

### Cấu hình cloud đã xong
- [x] Google provider bật; Email provider bật; **Confirm email tắt**
- [x] Tài khoản Bí thư: `chuongtik2@gmail.com`, `vanchuongsubmail@gmail.com` (đăng nhập Google)

---

## 3. Chưa làm ⏳ (theo thứ tự nên làm)

### Việc nhỏ còn dở
- [ ] **Đưa Edge Function đặt lại mật khẩu lên cloud**: `npm run functions:deploy`
      (hiện cloud trả 404 → nút "Đặt lại mật khẩu" trong admin chưa chạy với bản cloud)
- [ ] Xác nhận đã thêm **Redirect URLs** trong Supabase (Authentication → URL Configuration):
      Site URL `thonthongnhat://`; Redirect URLs: `exp://**`, `thonthongnhat://**`, `http://localhost:5173/**`
- [ ] Đăng ký bằng username trên app từng bị lỗi phía app (chưa rõ lỗi gì) — cần chụp thông báo lỗi để sửa
- [ ] Tạo commit git đầu tiên + đẩy lên GitHub (private) — **cần làm trước khi đổi máy** (xem mục 4)

### Giai đoạn 1 — tính năng lõi còn thiếu
- [ ] **Tab Thông báo** (app): danh sách, chi tiết, đánh dấu đã đọc, lọc theo mức độ
- [ ] **Gửi thông báo** (admin): soạn, chọn khu/ban ngành, hẹn giờ, xem ai chưa đọc
- [ ] **Thông báo đẩy (push)**: lưu push token + Edge Function gửi qua Expo Push khi có thông báo / SOS
- [ ] **Nút SOS chạy thật**: giữ 3 giây mới gửi, lấy vị trí GPS, báo cán bộ; trang admin xem & xử lý SOS
- [ ] **Tab Phản ánh** (app): chụp ảnh, vị trí, chọn loại, theo dõi trạng thái, đánh giá
- [ ] **Xử lý phản ánh** (admin, Bí thư): danh sách, đổi trạng thái, ghi chú
- [ ] **Tin tức**: admin soạn/đăng tin có ảnh bìa, app hiển thị trên trang chủ

### Giai đoạn 2
- [ ] **Tab Tin nhắn**: danh sách nhóm, chat realtime, gửi ảnh, ghim, thu hồi, số tin chưa đọc
- [ ] Sửa hồ sơ cá nhân (ảnh đại diện, số điện thoại) trên app

### Giai đoạn 3 — tiện ích
- [ ] Khảo sát / biểu quyết
- [ ] Lịch sự kiện (họp thôn, thu gom rác, tiêm chủng)
- [ ] Quỹ thôn công khai thu chi
- [ ] Đặt lịch nhà văn hoá

### Phát hành
- [ ] Icon app + màn hình khởi động riêng (hiện đang dùng icon mẫu của Expo)
- [ ] Build bằng EAS (`npx eas-cli build`), thử nội bộ (Play Internal testing / TestFlight)
- [ ] Tài khoản Google Play (25 USD) và Apple Developer (99 USD/năm)
- [ ] Đưa trang admin lên mạng (Vercel / Netlify / Cloudflare Pages) + thêm domain vào Redirect URLs
- [ ] Nâng Supabase lên gói Pro khi chạy thật (sao lưu, không bị tạm dừng)
- [ ] Chính sách quyền riêng tư (Nghị định 13/2023 về bảo vệ dữ liệu cá nhân)
- [ ] (Tuỳ chọn) SMS OTP: Zalo ZNS hoặc SMS brandname

---

## 4. Làm tiếp trên máy khác

### 4.1. Trước khi rời máy cũ
Dự án **chưa có commit nào**. Cần đưa code lên GitHub:
```bash
git add -A
git commit -m "Khởi tạo dự án App Thôn Thống Nhất"
git remote add origin https://github.com/<tài-khoản>/thon-thong-nhat.git   # tạo repo PRIVATE trước
git push -u origin master
```
Các file `.env` **không** được đẩy lên (đã nằm trong `.gitignore`) — ghi lại giá trị ở nơi an toàn,
hoặc lấy lại từ Supabase Dashboard → Project Settings → API.

### 4.2. Cài trên máy mới
1. Cài **Node.js** (≥ 22), **Git**, **Docker Desktop** (chỉ cần nếu chạy Supabase local),
   **Android Studio** (tạo máy ảo trong Device Manager).
2. Đặt biến môi trường Windows: `ANDROID_HOME = %LOCALAPPDATA%\Android\Sdk`,
   thêm `%ANDROID_HOME%\platform-tools` và `%ANDROID_HOME%\emulator` vào `Path`.
3. Lấy code và cài thư viện:
   ```bash
   git clone https://github.com/<tài-khoản>/thon-thong-nhat.git
   cd thon-thong-nhat
   npm install
   ```
4. Tạo file môi trường (giá trị lấy ở Supabase Dashboard → Project Settings → API):
   - `apps/mobile/.env`
     ```
     EXPO_PUBLIC_SUPABASE_URL=https://ssxeruahwpoutbfhaqbm.supabase.co
     EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
     ```
   - `apps/admin/.env`
     ```
     VITE_SUPABASE_URL=https://ssxeruahwpoutbfhaqbm.supabase.co
     VITE_SUPABASE_ANON_KEY=<publishable key>
     ```
5. Liên kết Supabase CLI (để đẩy migration / function):
   ```bash
   npx supabase login
   npx supabase link --project-ref ssxeruahwpoutbfhaqbm
   ```

### 4.3. Chạy hằng ngày
| Việc | Lệnh |
|---|---|
| Chạy app trên máy ảo | Mở máy ảo → `npm run mobile` → bấm `a` |
| Chạy trang admin | `npm run admin` → mở http://localhost:5173 |
| Sửa CSDL | Tạo file mới trong `supabase/migrations/` → thử local `npm run db:reset` → `npx supabase db push` |
| Sinh lại kiểu TypeScript sau khi sửa CSDL | `npm run db:types` |
| Supabase local (tuỳ chọn) | `npx supabase start` → `npm run db:seed` (tài khoản thử `bithu` / `123456`) |
| Kiểm thử phân quyền (local) | `npm run db:test` và `npm run db:test:admin` (cần `npm run functions:serve`) |
| Dùng app với Supabase local | Đổi tên `apps/mobile/.env.local.example` → `.env.local`, điền anon key local |

### 4.4. Khi nhờ Claude Code làm tiếp
Mở Claude Code trong thư mục dự án và nói: *"Đọc docs/TIEN-DO.md và CLAUDE.md rồi làm tiếp mục …"*.
Bộ nhớ của Claude nằm trên máy cũ, **không** đi theo — mọi thứ cần biết đã ghi trong 2 file này.

---

## 5. Bản đồ mã nguồn

```
apps/mobile/src/
  app/                    Màn hình (Expo Router: mỗi file = 1 màn hình)
    _layout.tsx           Tải font, điều hướng theo trạng thái tài khoản
    (auth)/               Đăng nhập, đăng ký
    (onboarding)/         Kích hoạt mã, tự khai báo
    waiting.tsx           Chờ duyệt / bị khoá
    (tabs)/               Trang chủ, Thông báo*, Phản ánh*, Tin nhắn*, Cá nhân   (* = chưa làm)
  components/ui.tsx       Bộ component dùng chung (Txt, Button, Field, Card, GradientHeader…)
  constants/theme.ts      Màu, font, khoảng cách, bóng đổ
  lib/auth.tsx            Đăng nhập, trạng thái tài khoản (get_me)
  lib/supabase.ts         Kết nối Supabase

apps/admin/src/
  pages/                  Các trang quản trị
  components/             Layout, nhập Excel, kiểm tra quyền
  lib/                    Supabase, đăng nhập, truy vấn dùng chung

packages/shared/src/      Kiểu dữ liệu CSDL + nhãn tiếng Việt (dùng chung app & admin)

supabase/
  migrations/             0001 bảng · 0002 hàm/RPC/trigger · 0003 RLS/storage/realtime
  functions/              Edge Functions (admin-reset-password)
  tests/                  Kiểm thử end-to-end
  scripts/seed-dev.mjs    Dữ liệu mẫu cho local
  bootstrap_bi_thu.sql    Cấp quyền Bí thư đầu tiên
```

---

## 6. Lưu ý kỹ thuật đã gặp

- **Expo SDK 58 thay đổi nhiều** — đọc `apps/mobile/AGENTS.md`, cài thư viện bằng `npx expo install`.
- Monorepo phải dùng **TypeScript 6** ở thư mục gốc (TS 7 làm hỏng ESLint của Expo).
- `Alert.alert` không chạy trên web → dùng `showInfo` / `confirmAction` trong `lib/dialog.ts`.
- Font tuỳ chỉnh trên Android **không tự in đậm** bằng `fontWeight` → dùng `fontFamily: Font.bold`.
- Không đặt bóng đổ (`elevation`) sau phần tử nền trong suốt → lộ hình bát giác trên Android.
- Đổi `.env` phải **khởi động lại** `npm run mobile`.
- Lệnh Supabase CLI mặc định nhắm vào **local**; muốn tác động cloud phải thêm `--remote`.
- Dán SQL vào SQL Editor thay vì `db push` sẽ làm mất lịch sử migration → dùng `migration repair`.

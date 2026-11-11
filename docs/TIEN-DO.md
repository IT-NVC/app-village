# Tiến độ dự án — App Thôn Thống Nhất (Xã Sóc Sơn)

> Cập nhật lần cuối: **11/11/2026** (đợt 5: Biểu quyết + Sửa hồ sơ)
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
- [x] **Đã đẩy lên Supabase cloud** và ghi nhận lịch sử migration (0001–0003)
- [x] Migration **0004** (`my_chat_groups` + sửa ràng buộc để thu hồi tin nhắn chạy được) — đã lên cloud
- [x] Migration **0005** Khảo sát / Biểu quyết (`polls`, `poll_options`, `poll_votes`, `create_poll`, `cast_vote`, `poll_results`…) — **đã chạy ở local, CHƯA đẩy lên cloud**
- [x] Kiểm thử: `npm run db:test` (71 bài), `npm run db:test:admin` (23 bài), `npm run db:test:features` (109 bài: thông báo + SOS + phản ánh + tin tức + chat + biểu quyết + hồ sơ + realtime + quyền) — đều đạt trên local

### Edge Function
- [x] `admin-reset-password`: cán bộ đặt lại mật khẩu cho người dân (kiểm tra cấp bậc, ghi nhật ký) — **chạy được ở local**

### App mobile (`apps/mobile`)
- [x] Đăng nhập Google + username/mật khẩu, đăng ký, dịch lỗi sang tiếng Việt
- [x] Kích hoạt bằng mã / tự khai báo hồ sơ / màn hình chờ duyệt / bị khoá
- [x] Tự điều hướng theo trạng thái tài khoản (`Stack.Protected`)
- [x] Trang chủ: lời chào, nhãn ngày/khu/chức vụ, nút KHẨN CẤP, dải báo thông báo khẩn chưa đọc, 3 thông báo mới, 4 ô tiện ích, danh bạ gọi điện, chuông có số chưa đọc
- [x] **Tab Thông báo**: lọc Tất cả / Chưa đọc / Khẩn, "Đọc hết", kéo để tải lại, số chưa đọc trên tab, tự cập nhật realtime (`lib/announcements.tsx`)
- [x] **Chi tiết thông báo** (`app/announcement/[id].tsx`): tự đánh dấu đã đọc, người gửi + chức vụ, gửi tới khu/ban nào
- [x] **SOS** (`app/sos.tsx`): giữ 3 giây mới gửi, rung, kèm vị trí GPS (xin quyền khi mở màn hình), chọn loại sự việc, theo dõi trạng thái realtime (+ hỏi lại mỗi 15 giây), gọi nhanh 113/114/115
- [x] **Tab Phản ánh**: danh sách phản ánh của mình (ảnh nhỏ, trạng thái), tự cập nhật khi cán bộ xử lý
- [x] **Tin tức**: dải tin cuộn ngang trên trang chủ (tin ghim đứng đầu), trang danh sách (`app/news/index.tsx`),
      trang đọc tin chữ to có ảnh bìa (`app/news/[id].tsx`)
- [x] **Tin nhắn nhóm**: tab hộp thư (tin cuối, số chưa đọc, số trên tab), màn hình chat (`app/group/[id]/index.tsx`):
      bong bóng có tên màu riêng, vạch ngày, tải tin cũ khi cuộn, gửi ảnh, giữ tay để Sao chép / Thu hồi / Ghim,
      dải tin ghim, báo bị khoá chat, realtime + hỏi lại 20 giây; màn hình thành viên (`group/[id]/members.tsx`):
      quản trị nhóm khoá chat / cấp quyền / xoá (nhóm tuỳ chọn), tự rời nhóm
- [x] **Biểu quyết** (`app/polls/`): danh sách đang mở / đã kết thúc, đánh dấu chưa bỏ phiếu, bỏ phiếu bằng ô lớn
      (một / nhiều lựa chọn), đổi phiếu khi còn mở, kết quả thanh %, tỉ lệ tham gia; ô "Biểu quyết" + "Tin tức" trên trang chủ
- [x] **Gửi phản ánh** (`app/report/new.tsx`): 6 loại sự cố, chụp/chọn tối đa 3 ảnh (tự nén ≤1280px, JPEG 70%), tự lấy vị trí + ghi địa chỉ
- [x] **Chi tiết phản ánh** (`app/report/[id].tsx`): xem ảnh phóng to, mở bản đồ, dòng thời gian xử lý kèm ghi chú cán bộ, đánh giá 1–5 sao khi hoàn thành
- [x] Tab Cá nhân: thông tin, ban ngành, đăng xuất, **Sửa thông tin** (`app/profile-edit.tsx`: ảnh đại diện cắt vuông, số điện thoại)
- [x] Giao diện đã làm đẹp (header gradient, thẻ bóng đổ, font Be Vietnam Pro)
- [x] Chạy được trên máy ảo Android bằng Expo Go, bản web cũng build được

### Trang admin (`apps/admin`)
- [x] Đăng nhập (username + Google), chỉ cán bộ thôn vào được
- [x] Tổng quan (số liệu), Duyệt tài khoản (cảnh báo trùng tên với nhân khẩu đã nhập)
- [x] Nhân khẩu: thêm/sửa/xoá, tìm không dấu, **nhập từ Excel/CSV**, **in phiếu mã kích hoạt** A4
- [x] Tài khoản & phân quyền: đặt chức vụ, khoá/mở, đặt lại mật khẩu
- [x] Khu vực & ban ngành: thành viên, giao trưởng ban, tạo nhóm chat 1 chạm
- [x] Cài đặt (công tắc chờ duyệt, danh bạ), Nhật ký thao tác
- [x] **Thông báo**: soạn (mức độ, toàn thôn / chọn khu + ban ngành, hẹn giờ), danh sách + % đã đọc, xem danh sách **chưa đọc kèm SĐT** để gọi nhắc, xoá
- [x] **Khẩn cấp (SOS)**: danh sách theo trạng thái, tên/SĐT/khu, mở vị trí trên Google Maps, Tiếp nhận → Đã xử lý
- [x] **Cảnh báo SOS ở mọi trang**: kêu chuông + hộp cảnh báo + đổi tiêu đề tab trình duyệt; menu có số SOS đang chờ;
      dự phòng hỏi lại mỗi 20 giây nếu Realtime lỡ sự kiện
- [x] **Phản ánh** (chỉ Bí thư / Trưởng thôn): lọc theo trạng thái + loại, xem ảnh (phóng to), vị trí trên bản đồ,
      dòng thời gian, cập nhật trạng thái kèm ghi chú gửi người dân, xem đánh giá; thông báo khi có phản ánh mới
- [x] **Tin tức**: viết/sửa tin (tiêu đề, tóm tắt, ảnh bìa tự nén ≤1600px, nội dung), bản nháp / đăng, ghim, bật tắt nhanh, xoá
- [x] **Nhóm chat**: danh sách nhóm, tạo nhóm tuỳ chọn, thành viên (thêm/xoá/quản trị/khoá chat), xem tin gần đây để kiểm duyệt + thu hồi, xoá nhóm
- [x] **Biểu quyết**: tạo khảo sát (2–10 phương án, theo người / **theo hộ**, chọn một / nhiều, ẩn danh, hạn chót, đối tượng),
      tỉ lệ tham gia, kết quả trực tiếp, xem ai chọn gì (khảo sát công khai), đóng sớm, xoá

### Cấu hình cloud đã xong
- [x] Google provider bật; Email provider bật; **Confirm email tắt**
- [x] Tài khoản Bí thư: `chuongtik2@gmail.com`, `vanchuongsubmail@gmail.com` (đăng nhập Google)

---

## 3. Chưa làm ⏳ (theo thứ tự nên làm)

### Việc nhỏ còn dở
- [ ] **Đẩy migration 0005 lên cloud**: `npx supabase db push --remote` (cần cho Biểu quyết)
- [ ] **Đưa Edge Function đặt lại mật khẩu lên cloud**: `npm run functions:deploy`
      (hiện cloud trả 404 → nút "Đặt lại mật khẩu" trong admin chưa chạy với bản cloud)
- [ ] Xác nhận đã thêm **Redirect URLs** trong Supabase (Authentication → URL Configuration):
      Site URL `thonthongnhat://`; Redirect URLs: `exp://**`, `thonthongnhat://**`, `http://localhost:5173/**`
- [ ] Đăng ký bằng username trên app từng bị lỗi phía app (chưa rõ lỗi gì) — cần chụp thông báo lỗi để sửa
- [ ] Tạo commit git đầu tiên + đẩy lên GitHub (private) — **cần làm trước khi đổi máy** (xem mục 4)

### Giai đoạn 1 — tính năng lõi còn thiếu
- [ ] **Thông báo đẩy (push)** — hiện thông báo khi app đang tắt. Cần **development build**
      (Expo Go trên Android không hỗ trợ push từ SDK 53): `expo-notifications` + lưu `push_tokens`
      + Edge Function gửi qua Expo Push khi có thông báo mới / SOS / phản ánh được xử lý.
      Hiện tại: thông báo & SOS cập nhật **realtime khi app đang mở** và tải lại khi mở app.
- [ ] Xem lại giao diện tab Thông báo, chi tiết, SOS, Phản ánh (gửi / chi tiết), Tin tức, Tin nhắn (đặc biệt: bàn phím khi chat trên Android) trên máy ảo hoặc điện thoại thật — đã kiểm thử logic, chưa chụp màn hình
- [ ] (Nhỏ) Đổi/bỏ ảnh bìa tin tức chưa xoá ảnh cũ trong kho `news` — dọn định kỳ nếu kho đầy

### Giai đoạn 2
- [ ] (Nhỏ) Thu hồi tin nhắn ảnh chưa xoá file ảnh trong kho `chat`

### Giai đoạn 3 — tiện ích
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
| Kiểm thử (local) | `npm run db:test`, `npm run db:test:features`, `npm run db:test:admin` (cần `npm run functions:serve`) |
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
    (tabs)/               Trang chủ, Thông báo, Phản ánh, Tin nhắn*, Cá nhân   (* = chưa làm)
    report/new.tsx        Gửi phản ánh
    report/[id].tsx       Chi tiết phản ánh + đánh giá
    news/index.tsx        Danh sách tin tức
    news/[id].tsx         Đọc tin
    group/[id]/index.tsx  Màn hình chat nhóm
    group/[id]/members.tsx Thành viên nhóm
    polls/index.tsx       Danh sách khảo sát
    polls/[id].tsx        Bỏ phiếu + kết quả
    profile-edit.tsx      Sửa ảnh đại diện, số điện thoại
    announcement/[id].tsx Chi tiết thông báo
    sos.tsx               Khẩn cấp (giữ 3 giây để gửi)
  components/ui.tsx       Bộ component dùng chung (Txt, Button, Field, Card, GradientHeader…)
  constants/theme.ts      Màu, font, khoảng cách, bóng đổ
  lib/auth.tsx            Đăng nhập, trạng thái tài khoản (get_me)
  lib/announcements.tsx   Danh sách thông báo + đã đọc + realtime (dùng chung toàn app)
  lib/reports.ts          Loại sự cố, trạng thái, nén + tải ảnh, link xem ảnh
  lib/news.ts             Tải tin tức đã đăng
  lib/chat.tsx            Hộp thư chat (my_chat_groups) + tải tin nhắn + màu tên
  lib/images.ts           Nén + tải ảnh dùng chung, link xem ảnh riêng tư
  lib/polls.ts            Khảo sát: tải danh sách, kết quả, thời hạn
  lib/supabase.ts         Kết nối Supabase

apps/admin/src/
  pages/                  Các trang quản trị
  components/             Layout, nhập Excel, kiểm tra quyền
  lib/                    Supabase, đăng nhập, truy vấn dùng chung

packages/shared/src/      Kiểu dữ liệu CSDL + nhãn tiếng Việt (dùng chung app & admin)

supabase/
  migrations/             0001 bảng · 0002 hàm/RPC/trigger · 0003 RLS/storage/realtime · 0004 hộp thư chat · 0005 biểu quyết
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
- Thêm màn hình mới mà TypeScript báo lỗi route → chạy `npm run mobile` một lần để Expo Router sinh lại kiểu.
- Bảng có 2 khoá ngoại tới `profiles` (vd. `sos_events`) → khi nhúng phải ghi rõ: `profiles!sos_events_user_id_fkey(...)`.
- Máy ảo đôi khi kẹt "device offline" → tắt hẳn máy ảo (Device Manager → Stop) rồi bật lại.
- **Realtime có thể lỡ sự kiện** lúc vừa kết nối (khởi động lạnh) hoặc mạng chập chờn → mọi màn hình quan trọng
  đều có dự phòng tải lại định kỳ. Khi thêm tính năng realtime mới, nhớ làm tương tự.
- Ảnh phản ánh nằm trong kho **riêng tư** `report-images/{user_id}/...` → xem bằng link có hạn (`createSignedUrls`);
  chỉ người gửi + Bí thư/Trưởng thôn xem được.

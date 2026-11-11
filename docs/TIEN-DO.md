# Tiến độ dự án — App Thôn Thống Nhất (Xã Sóc Sơn)

> Cập nhật lần cuối: **11/11/2026** (đợt 10: Khu cán bộ đầy đủ trong app)
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
- [x] Migration **0006** Push (`register_push_token`, `unregister_push_token`, `push_log`, `poll_recipients`) — **đã chạy ở local, CHƯA đẩy lên cloud**
- [x] Migration **0007** Lịch + đặt chỗ (`events`, `venues`, `venue_bookings` có **ràng buộc chống trùng giờ** cho lịch đã duyệt,
      `request_booking`, `review_booking`, `cancel_booking`) — đã lên cloud (0005–0007 đều đã lên)
- [x] Migration **0008** Quỹ thôn (`funds`, `fund_transactions`, `fund_summaries`, `fund_transactions_view`,
      `fund_household_contributions`, `fund_missing_households`, kho `fund-receipts`; nhật ký mọi thay đổi)
      — **đã chạy ở local, CHƯA đẩy lên cloud**
- [x] Kiểm thử: `npm run db:test` (71 bài), `npm run db:test:admin` (23 bài), `npm run db:test:features` (152 bài, thêm lịch + đặt lịch + quỹ thôn; thông báo + SOS + phản ánh + tin tức + chat + biểu quyết + hồ sơ + realtime + quyền), `npm run db:test:manage` (21 bài, khu cán bộ trong app), `npm run db:test:crud` (66 bài, sửa / xoá bổ sung + tạo / xoá tài khoản; cần `npm run functions:serve:test`), `npm run db:test:push` (32 bài, cần `npm run functions:serve:test`) — đều đạt trên local

### Edge Function
- [x] `notify`: gửi push sau sự kiện; máy chủ tự kiểm quyền + tự xác định người nhận, chống gửi trùng, xoá mã thiết bị chết — **chạy được ở local (dry-run), CHƯA lên cloud**
- [x] `admin-reset-password`: cán bộ đặt lại mật khẩu cho người dân (kiểm tra cấp bậc, ghi nhật ký) — **chạy được ở local**
- [x] `admin-account`: **lập tài khoản** cho nhân khẩu (Phó thôn trở lên) và **xoá hẳn tài khoản** (Trưởng thôn trở lên, không xoá người cùng / cao cấp hơn; nhân khẩu được giữ và cấp mã kích hoạt mới) — **chạy được ở local, CHƯA lên cloud**

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
- [x] **Lịch thôn** (`app/calendar.tsx`): lịch 60 ngày tới gom theo ngày (sự kiện + giờ nhà văn hoá đã có người đặt),
      "Lịch đặt của tôi" (trạng thái, ghi chú cán bộ, huỷ); ô "Lịch thôn" trên trang chủ
- [x] **Đặt nhà văn hoá / sân** (`app/booking/new.tsx`): chọn địa điểm, dải 30 ngày, khung giờ có sẵn
      (sáng / chiều / tối / cả ngày; khung đã có người đặt bị làm mờ), ghi mục đích
- [x] **Quỹ thôn** (`app/funds/`): danh sách quỹ (số dư, thu, chi, % mục tiêu), chi tiết: từng khoản thu (+ xanh) /
      chi (− đỏ) kèm ảnh chứng từ, danh sách hộ đã đóng góp (đánh dấu "hộ của bạn"); ô "Quỹ thôn" trên trang chủ
- [x] **Khu cán bộ — tab "Quản lý"** (chỉ hiện với Bí thư / Trưởng thôn / Phó thôn; số việc chờ trên tab; rung khi có SOS).
  Làm được **gần như mọi việc như trang web**, trừ nhập / xuất số liệu hàng loạt. Mỗi mục là một màn hình trong `app/manage/`:
  - *Cần xử lý*: `sos` · `approvals` (duyệt tài khoản, cảnh báo trùng nhân khẩu) · `reports` + `report/[id]` (Bí thư / Trưởng thôn) · `bookings` (duyệt, từ chối, huỷ lịch đã duyệt)
  - *Người dân*: `residents` + `resident/[id]` (thêm / sửa / xoá, **chia sẻ mã kích hoạt**, cấp lại mã) · `accounts` + `account/[id]` (chức vụ theo cấp bậc, khoá / mở khoá, đặt lại mật khẩu, duyệt)
  - *Thông tin cho bà con*: `announce` (toàn thôn / khu / ban ngành, **hẹn giờ**) · `announcements` + `announcement/[id]` (% đã đọc, người chưa đọc kèm nút gọi, xoá) · `news` + `news-edit/[id]` (ảnh bìa, nháp / đăng, ghim) · `polls` + `poll-new` + `poll/[id]` · `events` + `event/[id]`
  - *Khu vực & nhóm chat*: `areas` · `orgs` + `org/[id]` (thành viên, trưởng ban) · `chats` + `chat-admin/[id]` (tạo nhóm, thành viên, khoá chat, thu hồi tin)
  - *Quỹ & địa điểm*: `fund` (ghi / **sửa / xoá** thu chi, chụp phiếu) · `funds` + `fund-info/[id]` (số dư, hộ đã góp, **hộ chưa góp kèm SĐT**) · `venues`
  - *Hộ gia đình*: `households` + `household/[id]` (lập hộ, gắn / bỏ thành viên, sửa, xoá)
  - *Hệ thống*: `settings` (công tắc chờ duyệt, danh bạ) · `audit` (nhật ký, Bí thư / Trưởng thôn)
  - **Ma trận CRUD** (migration 0009): thông báo sửa nội dung được; khảo sát sửa câu hỏi / hạn chót / mở lại + thêm, đổi tên, xoá phương án (chưa ai chọn); phản ánh & SOS xoá được (Bí thư / Trưởng thôn, kèm ảnh); địa điểm xoá; nhóm chat đổi tên; tài khoản lập / xoá; đặt lịch cán bộ "Duyệt luôn" (nút + ở màn Đặt lịch).
  - Dùng chung: `components/manage-kit.tsx` (useLoad, Async, ManageShell, FormSheet, PersonPicker, DateTimePick, PillTabs…), `lib/manage-data.ts`.
  - **Chỉ còn làm trên web**: nhập nhân khẩu từ Excel, in hàng loạt phiếu mã kích hoạt, xuất CSV báo cáo quỹ.
  - ⚠ Mới kiểm tra bằng TypeScript / lint / đóng gói; **chưa chạy thử trên máy** (cần xem kỹ từng màn hình khi dùng thật).
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
- [x] **Lịch & đặt chỗ**: duyệt / từ chối yêu cầu kèm ghi chú (cảnh báo trùng giờ), huỷ lịch; thêm/sửa/xoá sự kiện
      (theo khu hoặc toàn thôn, tuỳ chọn gửi push); quản lý địa điểm
- [x] **Quỹ thôn**: tạo quỹ (mục tiêu), ghi / sửa / xoá thu chi (chọn hộ, ảnh chứng từ tự nén), hộ đã / **chưa** đóng góp
      (kèm SĐT để vận động, lọc theo khu), **xuất CSV** để in công khai; nhật ký hiển thị tên quỹ, sự kiện, đặt lịch, khảo sát

### Cấu hình cloud đã xong
- [x] Google provider bật; Email provider bật; **Confirm email tắt**
- [x] Tài khoản Bí thư: `chuongtik2@gmail.com`, `vanchuongsubmail@gmail.com` (đăng nhập Google)
- [x] Script tạo Bí thư bằng tên đăng nhập + mật khẩu (kèm tạo các khu): `supabase/create_bi_thu.sql` — chạy trong SQL Editor

---

## 3. Chưa làm ⏳ (theo thứ tự nên làm)

### Việc nhỏ còn dở
- [ ] **Đẩy migration 0008 + 0009 lên cloud**: kiểm tra `npx supabase migration list --remote` rồi `npx supabase db push --remote`
- [ ] **Đưa Edge Function `admin-account` lên cloud** (cùng lệnh `npm run functions:deploy`) — cần cho nút "Lập tài khoản hộ" và "Xoá hẳn tài khoản"
- [ ] **Bật push**: làm theo [HUONG-DAN-PUSH.md](HUONG-DAN-PUSH.md) (tài khoản Expo, Firebase, development build)
- [ ] **Đưa Edge Function đặt lại mật khẩu lên cloud**: `npm run functions:deploy`
      (hiện cloud trả 404 → nút "Đặt lại mật khẩu" trong admin chưa chạy với bản cloud)
- [ ] Xác nhận đã thêm **Redirect URLs** trong Supabase (Authentication → URL Configuration):
      Site URL `thonthongnhat://`; Redirect URLs: `exp://**`, `thonthongnhat://**`, `http://localhost:5173/**`
- [ ] Đăng ký bằng username trên app từng bị lỗi phía app (chưa rõ lỗi gì) — cần chụp thông báo lỗi để sửa
- [ ] Tạo commit git đầu tiên + đẩy lên GitHub (private) — **cần làm trước khi đổi máy** (xem mục 4)

### Giai đoạn 1 — tính năng lõi còn thiếu
- [x] **Thông báo đẩy (push)** — code xong: app (`lib/push.ts`, `components/push-bridge.tsx`: đăng ký mã, kênh "Khẩn cấp"
      trên Android, bấm thông báo mở đúng màn hình, huỷ mã khi đăng xuất) + admin + Edge Function `notify`.
      **Chờ** cấu hình tài khoản Expo/Firebase + development build (xem HUONG-DAN-PUSH.md). Trong Expo Go push tự bỏ qua.
- [ ] Push cho **thông báo hẹn giờ** khi tới giờ (cần pg_cron gọi `notify`)
- [ ] **Chạy thử toàn bộ tab Quản lý trên máy** (30 màn hình mới, chưa được thử với dữ liệu thật) và xem 6 tab trên màn hình hẹp; xem lại tab Thông báo, chi tiết, SOS, Phản ánh (gửi / chi tiết), Tin tức, Tin nhắn (đặc biệt: bàn phím khi chat trên Android) trên máy ảo hoặc điện thoại thật — đã kiểm thử logic, chưa chụp màn hình
- [ ] (Nhỏ) Đổi/bỏ ảnh bìa tin tức chưa xoá ảnh cũ trong kho `news` — dọn định kỳ nếu kho đầy

### Giai đoạn 2
- [ ] (Nhỏ) Thu hồi tin nhắn ảnh chưa xoá file ảnh trong kho `chat`

### Giai đoạn 3 — tiện ích
- [x] Đã xong toàn bộ tiện ích dự kiến (biểu quyết, lịch, đặt nhà văn hoá, quỹ thôn). Ý tưởng thêm nếu cần: chợ quê / rao vặt, tìm đồ thất lạc, việc hiếu hỉ.

### Phát hành
- [x] Icon app (mái đình làng, nền xanh lá) + màn hình khởi động + favicon admin — sinh từ `assets/brand/mark.svg` bằng `npm run icons`
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
| Sinh lại kiểu TypeScript sau khi sửa CSDL | `npm run db:types` (lấy từ **cloud** — đẩy migration lên trước) |
| Supabase local (**tuỳ chọn**, cần Docker — đã gỡ khỏi máy ngày 11/11/2026) | `npx supabase start` (tải lại ~6 GB lần đầu) → `npm run db:seed` (tài khoản thử `bithu` / `123456`) |
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
    calendar.tsx          Lịch thôn + lịch đặt của tôi
    booking/new.tsx       Đặt nhà văn hoá / sân
    funds/index.tsx       Danh sách quỹ
    funds/[id].tsx        Thu chi + hộ đóng góp
    (tabs)/manage.tsx     Tab Quản lý (chỉ cán bộ)
    manage/               Màn hình khu cán bộ: sos, approvals, reports, report/[id], announce, bookings, fund
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
  lib/manage.ts           Cấp bậc người dùng (useRank), số việc chờ cho tab Quản lý
  components/forbidden.tsx  Màn hình "Không có quyền"
  lib/funds.ts            Quỹ: định dạng tiền VNĐ, tải số dư / thu chi / đóng góp
  lib/calendar.ts         Lịch: gộp sự kiện + lịch đặt, khung giờ bận
  lib/push.ts             Đăng ký push, huỷ khi đăng xuất, notifyEvent() báo máy chủ gửi push
  components/push-bridge.tsx  Bấm thông báo → mở đúng màn hình
  lib/supabase.ts         Kết nối Supabase

apps/admin/src/
  pages/                  Các trang quản trị
  components/             Layout, nhập Excel, kiểm tra quyền
  lib/                    Supabase, đăng nhập, truy vấn dùng chung

packages/shared/src/      Kiểu dữ liệu CSDL + nhãn tiếng Việt (dùng chung app & admin)

supabase/
  migrations/             0001 bảng · 0002 hàm/RPC/trigger · 0003 RLS/storage/realtime · 0004 hộp thư chat · 0005 biểu quyết · 0006 push · 0007 lịch + đặt chỗ · 0008 quỹ thôn
  functions/              Edge Functions (admin-reset-password, notify)
  tests/                  Kiểm thử end-to-end
  scripts/seed-dev.mjs    Dữ liệu mẫu cho local
  bootstrap_bi_thu.sql    Cấp quyền Bí thư đầu tiên
```

---

## 6. Lưu ý kỹ thuật đã gặp

- **Supabase trên Docker đã gỡ** (11/11/2026) để tiết kiệm ~6 GB. App và admin không cần nó (chạy với cloud).
  Chỉ cần dựng lại (`npx supabase start`) khi muốn **chạy kiểm thử** hoặc **thử migration mới trước khi đẩy lên cloud** —
  nên làm vậy với mọi thay đổi CSDL, vì kiểm thử ở local đã bắt được nhiều lỗi trước khi lên production.
- Đổi icon: sửa `assets/brand/mark.svg` rồi chạy `npm run icons` (sinh lại mọi kích thước cho Android, iOS, web, admin).

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

# Hướng dẫn bật Thông báo đẩy (Push)

Code đã làm xong (app + máy chủ + kiểm thử). Còn lại là **các bước cần tài khoản của bạn**.
Làm theo thứ tự, mỗi bước khoảng 5–15 phút.

> **Vì sao Expo Go không nhận được push?** Từ Expo SDK 53, Expo Go trên Android không hỗ trợ push.
> Cần một bản app riêng gọi là **development build** (giống Expo Go nhưng là app của mình).
> Bản này vẫn tự cập nhật khi sửa code như Expo Go.

---

## Bước 1 — Đưa phần máy chủ lên Supabase cloud

```bash
npx supabase db push --remote     # migration 0005 (biểu quyết) + 0006 (push) + 0007 (lịch, đặt chỗ)
npm run functions:deploy          # Edge Functions: notify + admin-reset-password
```

## Bước 2 — Tài khoản Expo + mã dự án (projectId)

1. Đăng ký miễn phí tại **expo.dev**.
2. Chạy:
   ```bash
   npx eas-cli login
   cd apps/mobile
   npx eas-cli init          # tạo dự án trên Expo, tự ghi projectId vào app.json
   npx eas-cli build:configure   # tạo file eas.json
   ```

## Bước 3 — Firebase (bắt buộc cho Android)

Android gửi push qua Firebase Cloud Messaging (FCM).

1. Vào **console.firebase.google.com** → *Add project* → đặt tên (vd. `thon-thong-nhat`), có thể tắt Google Analytics.
2. Trong dự án: *Add app* → **Android** → Package name: `vn.thonthongnhat.app` → *Register app*.
3. Tải file **`google-services.json`** → đặt vào thư mục `apps/mobile/`.
4. Mở `apps/mobile/app.json`, trong mục `"android"` thêm dòng:
   ```json
   "googleServicesFile": "./google-services.json",
   ```
5. Tạo khoá cho Expo gửi push qua FCM:
   - Firebase → ⚙️ *Project settings* → tab **Service accounts** → **Generate new private key** → tải file JSON.
   - **File này là bí mật** — không gửi cho ai, không đưa lên GitHub.
   - Chạy `npx eas-cli credentials` → Android → chọn profile → *Google Service Account* →
     *Manage your Google Service Account Key for Push Notifications (FCM V1)* → *Upload* file JSON vừa tải.

## Bước 4 — Tạo development build và cài lên điện thoại

```bash
cd apps/mobile
npx expo install expo-dev-client
npx eas-cli build --profile development --platform android
```

- Build chạy trên máy chủ Expo (~10–20 phút, miễn phí có giới hạn lượt/tháng).
- Xong sẽ có **link tải file .apk** → mở trên điện thoại Android → cài đặt.
- Từ giờ chạy `npm run mobile` → mở app "Thôn Thống Nhất" vừa cài (không dùng Expo Go nữa).
  Nếu Expo hỏi, bấm `s` để chuyển giữa *development build* và *Expo Go*.

> Máy ảo Android cũng nhận được push nếu image có **Google Play** (Medium_Phone_API_37 của bạn là loại này).

## Bước 5 — Thử

1. Mở app trên điện thoại → đăng nhập → bấm **Cho phép** khi app xin quyền thông báo.
2. Trên trang admin, gửi một thông báo tới khu của tài khoản đó.
3. Điện thoại phải nhận được thông báo trong vài giây. Bấm vào → mở đúng thông báo trong app.

Nếu không nhận được: Supabase Dashboard → **Edge Functions → notify → Logs** để xem lỗi,
và kiểm tra bảng `push_tokens` đã có mã của máy chưa.

---

## Push được gửi khi nào

| Sự kiện | Ai nhận |
|---|---|
| Cán bộ gửi thông báo (không hẹn giờ) | Đúng đối tượng của thông báo — thông báo **Khẩn** kêu to, rung mạnh |
| Người dân bấm SOS | Bí thư, Trưởng thôn, Phó thôn (kênh khẩn) |
| Cán bộ tiếp nhận / xử lý xong SOS | Người đã bấm SOS |
| Người dân gửi phản ánh | Bí thư, Trưởng thôn |
| Bí thư cập nhật phản ánh | Người gửi phản ánh (kèm ghi chú) |
| Tin nhắn mới trong nhóm | Các thành viên khác của nhóm |
| Cán bộ tạo khảo sát | Đúng đối tượng của khảo sát |
| Cán bộ thêm sự kiện (nếu chọn gửi) | Người của khu đó, hoặc cả thôn |
| Người dân gửi yêu cầu đặt nhà văn hoá | Cán bộ thôn |
| Cán bộ duyệt / từ chối yêu cầu đặt | Người đặt (kèm ghi chú) |

**Chưa có:** thông báo **hẹn giờ** chưa tự gửi push khi tới giờ (người dân vẫn thấy trong app).
Cần thêm lịch chạy định kỳ (pg_cron) — để làm sau.

## iOS

Cần tài khoản **Apple Developer** (99 USD/năm), sau đó `npx eas-cli build --platform ios` — EAS tự lo chứng chỉ push.

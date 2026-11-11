# CLAUDE.md

App nội bộ cho Thôn Thống Nhất (Xã Sóc Sơn). Người dùng là người Việt — **trả lời và viết giao diện bằng tiếng Việt**.

**Đọc `docs/TIEN-DO.md` trước khi làm**: phạm vi đã chốt, việc đã xong / chưa xong, cách chạy dự án.
Làm xong một hạng mục thì cập nhật lại file đó.

## Cấu trúc
npm workspaces: `apps/mobile` (Expo SDK 58, Expo Router, `src/app`), `apps/admin` (Vite + React + Ant Design 6),
`packages/shared` (types CSDL + nhãn tiếng Việt), `supabase/` (migrations, functions, tests).

## Quy ước
- Thao tác nhạy cảm (phân quyền, duyệt, gửi thông báo…) đi qua **RPC `SECURITY DEFINER`** với `search_path = ''`;
  bảng chỉ mở ghi trực tiếp khi đơn giản. Mọi bảng đều bật RLS.
- Sửa CSDL = **thêm migration mới** (không sửa migration đã đẩy lên cloud). Supabase local (Docker) đã gỡ khỏi máy:
  muốn thử migration thì `npx supabase start` → `npm run db:reset` → các `npm run db:test*` → `npm run db:types:local`;
  sau đó (hỏi người dùng) `npx supabase db push --remote`. `npm run db:types` lấy kiểu từ cloud.
- Lệnh Supabase CLI tác động cloud cần `--remote`; **hỏi người dùng trước** khi ghi lên cloud (production).
- Mobile: dùng component trong `src/components/ui.tsx` và token trong `src/constants/theme.ts`;
  font Be Vietnam Pro qua `fontFamily: Font.*` (không dùng `fontWeight`); chữ to, nút ≥ 56px.
  Cài thư viện bằng `npx expo install`. Đọc `apps/mobile/AGENTS.md`.
- Trước khi báo xong: mobile `npx tsc --noEmit && npx eslint src`; admin `npx tsc -b && npx oxlint src`.

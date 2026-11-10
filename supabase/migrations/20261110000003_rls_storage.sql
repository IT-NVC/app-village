-- =====================================================================
-- 0003: Chính sách bảo mật theo dòng (RLS), kho lưu trữ, realtime
-- Nguyên tắc: thao tác nhạy cảm (phân quyền, duyệt, gửi thông báo...) đi qua
-- RPC ở 0002; bảng chỉ mở quyền ghi trực tiếp khi thật sự đơn giản.
-- =====================================================================

alter table public.app_settings         enable row level security;
alter table public.areas                enable row level security;
alter table public.households           enable row level security;
alter table public.residents            enable row level security;
alter table public.profiles             enable row level security;
alter table public.organizations        enable row level security;
alter table public.org_members          enable row level security;
alter table public.news                 enable row level security;
alter table public.announcements        enable row level security;
alter table public.announcement_targets enable row level security;
alter table public.announcement_reads   enable row level security;
alter table public.reports              enable row level security;
alter table public.report_updates       enable row level security;
alter table public.sos_events           enable row level security;
alter table public.contacts             enable row level security;
alter table public.chat_groups          enable row level security;
alter table public.chat_group_members   enable row level security;
alter table public.messages             enable row level security;
alter table public.push_tokens          enable row level security;
alter table public.audit_logs           enable row level security;

-- ---------- Cài đặt ----------
create policy "settings: ai đăng nhập cũng xem" on public.app_settings
  for select to authenticated using (true);
create policy "settings: Bí thư/Trưởng thôn sửa" on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Khu vực (người chưa kích hoạt cũng cần xem để chọn khu khi đăng ký) ----------
create policy "areas: xem" on public.areas
  for select to authenticated using (true);
create policy "areas: cán bộ thêm" on public.areas
  for insert to authenticated with check (public.is_leader());
create policy "areas: cán bộ sửa" on public.areas
  for update to authenticated using (public.is_leader()) with check (public.is_leader());
create policy "areas: cán bộ xoá" on public.areas
  for delete to authenticated using (public.is_leader());

-- ---------- Hộ gia đình ----------
create policy "households: cán bộ hoặc hộ của mình" on public.households
  for select to authenticated using (
    public.is_leader()
    or id = (select household_id from public.residents where id = public.my_resident_id())
  );
create policy "households: cán bộ ghi" on public.households
  for all to authenticated using (public.is_leader()) with check (public.is_leader());

-- ---------- Nhân khẩu ----------
create policy "residents: cán bộ hoặc chính mình" on public.residents
  for select to authenticated using (public.is_leader() or id = public.my_resident_id());
create policy "residents: cán bộ ghi" on public.residents
  for all to authenticated using (public.is_leader()) with check (public.is_leader());

-- ---------- Tài khoản (ghi qua RPC) ----------
create policy "profiles: chính mình hoặc cán bộ" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_leader());

-- ---------- Ban ngành ----------
create policy "orgs: người dùng active xem" on public.organizations
  for select to authenticated using (public.is_active());
create policy "orgs: cán bộ thêm" on public.organizations
  for insert to authenticated with check (public.is_leader());
create policy "orgs: cán bộ sửa" on public.organizations
  for update to authenticated using (public.is_leader()) with check (public.is_leader());
create policy "orgs: cán bộ xoá" on public.organizations
  for delete to authenticated using (public.is_leader());

create policy "org_members: người dùng active xem" on public.org_members
  for select to authenticated using (public.is_active());

-- ---------- Tin tức ----------
create policy "news: xem tin đã đăng" on public.news
  for select to authenticated using ((is_published and public.is_active()) or public.is_leader());
create policy "news: cán bộ ghi" on public.news
  for all to authenticated using (public.is_leader()) with check (public.is_leader());

-- ---------- Thông báo (tạo qua RPC send_announcement) ----------
create policy "announcements: người nhận xem" on public.announcements
  for select to authenticated using (public.can_view_announcement(id));
create policy "announcements: cán bộ xoá" on public.announcements
  for delete to authenticated using (public.is_leader() or sender_id = auth.uid());

create policy "announcement_targets: xem theo thông báo" on public.announcement_targets
  for select to authenticated using (public.can_view_announcement(announcement_id));

create policy "announcement_reads: xem" on public.announcement_reads
  for select to authenticated using (user_id = auth.uid() or public.is_leader());
create policy "announcement_reads: đánh dấu đã đọc" on public.announcement_reads
  for insert to authenticated with check (user_id = auth.uid() and public.can_view_announcement(announcement_id));

-- ---------- Phản ánh ----------
create policy "reports: người gửi hoặc Bí thư/Trưởng thôn xem" on public.reports
  for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy "reports: người dân gửi" on public.reports
  for insert to authenticated with check (
    reporter_id = auth.uid() and public.is_active()
    and status = 'moi' and rating is null and rating_comment is null
  );

create policy "report_updates: xem theo phản ánh" on public.report_updates
  for select to authenticated using (
    public.is_admin()
    or exists (select 1 from public.reports r where r.id = report_id and r.reporter_id = auth.uid())
  );

-- ---------- SOS ----------
create policy "sos: chính mình hoặc cán bộ xem" on public.sos_events
  for select to authenticated using (user_id = auth.uid() or public.is_leader());
create policy "sos: người dân gửi" on public.sos_events
  for insert to authenticated with check (user_id = auth.uid() and public.is_active());

-- ---------- Danh bạ ----------
create policy "contacts: xem" on public.contacts
  for select to authenticated using (public.is_active());
create policy "contacts: cán bộ ghi" on public.contacts
  for all to authenticated using (public.is_leader()) with check (public.is_leader());

-- ---------- Chat ----------
create policy "chat_groups: thành viên xem" on public.chat_groups
  for select to authenticated using (public.is_group_member(id) or public.is_admin());
create policy "chat_groups: quản trị nhóm đổi tên/ảnh" on public.chat_groups
  for update to authenticated using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy "chat_groups: cán bộ xoá" on public.chat_groups
  for delete to authenticated using (public.is_leader());

create policy "chat_members: thành viên xem" on public.chat_group_members
  for select to authenticated using (public.is_group_member(group_id) or public.is_admin());

create policy "messages: thành viên xem" on public.messages
  for select to authenticated using (public.is_group_member(group_id) or public.is_admin());
create policy "messages: thành viên gửi" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and public.is_group_member(group_id)
    and not exists (select 1 from public.chat_group_members m
                    where m.group_id = messages.group_id and m.user_id = auth.uid() and m.is_muted)
    and deleted_at is null and is_pinned = false
  );

-- ---------- Push token ----------
create policy "push_tokens: của mình" on public.push_tokens
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Nhật ký ----------
create policy "audit: Bí thư/Trưởng thôn xem" on public.audit_logs
  for select to authenticated using (public.is_admin());

-- Không cho khách (anon) đụng vào bất kỳ bảng nào
revoke all on all tables in schema public from anon;

-- =====================================================================
-- Kho lưu trữ (Storage)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',       'avatars',       true,  2097152,  array['image/jpeg','image/png','image/webp']),
  ('news',          'news',          true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('report-images', 'report-images', false, 5242880,  array['image/jpeg','image/png','image/webp']),
  ('chat',          'chat',          false, 5242880,  array['image/jpeg','image/png','image/webp']),
  ('attachments',   'attachments',   false, 10485760, null);

-- avatars/{user_id}/...
create policy "avatars: tự tải ảnh của mình" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: tự sửa/xoá ảnh của mình" on storage.objects
  for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: tự xoá ảnh của mình" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- news/...: cán bộ tải ảnh bìa
create policy "news: cán bộ tải ảnh" on storage.objects
  for insert to authenticated with check (bucket_id = 'news' and public.is_leader());
create policy "news: cán bộ xoá ảnh" on storage.objects
  for delete to authenticated using (bucket_id = 'news' and public.is_leader());

-- report-images/{user_id}/...
create policy "report-images: người dân tải" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'report-images' and public.is_active() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "report-images: người gửi hoặc Bí thư/Trưởng thôn xem" on storage.objects
  for select to authenticated using (
    bucket_id = 'report-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- chat/{group_id}/...
create policy "chat: thành viên tải ảnh" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'chat' and public.is_group_member(((storage.foldername(name))[1])::uuid));
create policy "chat: thành viên xem ảnh" on storage.objects
  for select to authenticated using (
    bucket_id = 'chat' and (public.is_group_member(((storage.foldername(name))[1])::uuid) or public.is_admin()));

-- attachments/...: file đính kèm thông báo
create policy "attachments: người gửi thông báo tải lên" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'attachments' and (public.is_leader() or exists (
      select 1 from public.org_members where user_id = auth.uid() and role = 'truong_ban')));
create policy "attachments: người dùng active xem" on storage.objects
  for select to authenticated using (bucket_id = 'attachments' and public.is_active());

-- =====================================================================
-- Realtime: chat, thông báo, phản ánh, SOS
-- =====================================================================
alter publication supabase_realtime add table
  public.messages, public.chat_group_members, public.announcements, public.reports, public.sos_events;

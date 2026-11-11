-- =====================================================================
-- 0009: Bổ sung các thao tác Sửa / Xoá còn thiếu cho khu quản lý
--  - Thông báo: cho sửa tiêu đề / nội dung / mức độ / giờ hiện (người gửi hoặc cán bộ thôn)
--  - Phản ánh, SOS: Bí thư / Trưởng thôn được xoá (spam, báo nhầm); xoá cả ảnh phản ánh
--  - Biểu quyết: sửa câu hỏi / mô tả / hạn / mở lại; thêm, đổi tên, xoá phương án (chưa có người chọn)
--  - Hộ gia đình: ghi nhật ký thay đổi
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Thông báo: sửa
-- ---------------------------------------------------------------------
create policy "announcements: người gửi / cán bộ sửa" on public.announcements
  for update to authenticated
  using (public.is_active() and (public.is_leader() or sender_id = auth.uid()))
  with check (public.is_active() and (public.is_leader() or sender_id = auth.uid()));

-- Không cho đổi người gửi / đối tượng nhận / thời điểm đã gửi push; chỉ cán bộ thôn được đặt mức "khẩn"
create function public.announcements_before_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.sender_id := old.sender_id;
  new.target_all := old.target_all;
  new.created_at := old.created_at;
  new.pushed_at := old.pushed_at;
  if coalesce(trim(new.title), '') = '' or coalesce(trim(new.content), '') = '' then
    raise exception 'Vui lòng nhập tiêu đề và nội dung';
  end if;
  if new.priority = 'khan' and old.priority <> 'khan' and not public.is_leader() then
    raise exception 'Chỉ cán bộ thôn được đặt thông báo khẩn';
  end if;
  new.title := trim(new.title);
  return new;
end $$;
create trigger trg_announcements_before_update before update on public.announcements
  for each row execute function public.announcements_before_update();

-- Nhật ký: ghi cả thao tác sửa
drop trigger if exists audit_announcements on public.announcements;
create trigger audit_announcements after insert or update or delete on public.announcements
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- 2. Phản ánh, SOS: Bí thư / Trưởng thôn xoá
-- ---------------------------------------------------------------------
create policy "reports: Bí thư/Trưởng thôn xoá" on public.reports
  for delete to authenticated using (public.is_admin());
create policy "sos: Bí thư/Trưởng thôn xoá" on public.sos_events
  for delete to authenticated using (public.is_admin());
create policy "report-images: Bí thư/Trưởng thôn xoá ảnh" on storage.objects
  for delete to authenticated using (bucket_id = 'report-images' and public.is_admin());

create trigger audit_reports_delete after delete on public.reports
  for each row execute function public.audit_trigger();
create trigger audit_sos_delete after delete on public.sos_events
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- 3. Hộ gia đình: nhật ký
-- ---------------------------------------------------------------------
create trigger audit_households after insert or update or delete on public.households
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- 4. Biểu quyết: sửa (mọi thao tác ghi đều qua RPC, kiểm quyền cán bộ thôn)
-- ---------------------------------------------------------------------
create function public.update_poll(
  p_poll_id     uuid,
  p_title       text,
  p_description text default null,
  p_closes_at   timestamptz default null,   -- null = giữ nguyên hạn
  p_no_deadline boolean default false,      -- true = bỏ hạn chót
  p_reopen      boolean default false       -- true = mở lại khảo sát đã đóng
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.polls;
  v_closes timestamptz;
begin
  if not public.is_leader() then raise exception 'Chỉ cán bộ thôn được sửa khảo sát'; end if;
  select * into v from public.polls where id = p_poll_id for update;
  if v.id is null then raise exception 'Không tìm thấy khảo sát'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Vui lòng nhập câu hỏi'; end if;
  if p_closes_at is not null and p_closes_at <= now() then raise exception 'Hạn chót phải ở tương lai'; end if;

  v_closes := case when p_no_deadline then null when p_closes_at is not null then p_closes_at else v.closes_at end;
  if p_reopen and v_closes is not null and v_closes <= now() then
    raise exception 'Muốn mở lại khảo sát, hãy đặt hạn chót mới ở tương lai hoặc bỏ hạn chót';
  end if;

  update public.polls
     set title = trim(p_title),
         description = nullif(trim(coalesce(p_description, '')), ''),
         closes_at = v_closes,
         closed_at = case when p_reopen then null else v.closed_at end
   where id = p_poll_id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'update', 'polls', p_poll_id::text,
          jsonb_build_object('old', jsonb_build_object('title', v.title, 'closes_at', v.closes_at, 'closed_at', v.closed_at),
                             'new', jsonb_build_object('title', trim(p_title), 'closes_at', v_closes, 'reopen', p_reopen)));
end $$;

create function public.add_poll_option(p_poll_id uuid, p_label text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_leader() then raise exception 'Chỉ cán bộ thôn được sửa khảo sát'; end if;
  if not exists (select 1 from public.polls where id = p_poll_id) then raise exception 'Không tìm thấy khảo sát'; end if;
  if coalesce(trim(p_label), '') = '' then raise exception 'Vui lòng nhập nội dung phương án'; end if;
  if (select count(*) from public.poll_options where poll_id = p_poll_id) >= 10 then raise exception 'Tối đa 10 phương án'; end if;
  insert into public.poll_options (poll_id, label, sort_order)
  values (p_poll_id, trim(p_label), coalesce((select max(sort_order) from public.poll_options where poll_id = p_poll_id), 0) + 1)
  returning id into v_id;
  return v_id;
end $$;

create function public.rename_poll_option(p_option_id uuid, p_label text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_leader() then raise exception 'Chỉ cán bộ thôn được sửa khảo sát'; end if;
  if coalesce(trim(p_label), '') = '' then raise exception 'Vui lòng nhập nội dung phương án'; end if;
  update public.poll_options set label = trim(p_label) where id = p_option_id;
  if not found then raise exception 'Không tìm thấy phương án'; end if;
end $$;

create function public.delete_poll_option(p_option_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_poll uuid;
begin
  if not public.is_leader() then raise exception 'Chỉ cán bộ thôn được sửa khảo sát'; end if;
  select poll_id into v_poll from public.poll_options where id = p_option_id;
  if v_poll is null then raise exception 'Không tìm thấy phương án'; end if;
  if exists (select 1 from public.poll_votes where option_id = p_option_id) then
    raise exception 'Phương án này đã có người chọn nên không xoá được';
  end if;
  if (select count(*) from public.poll_options where poll_id = v_poll) <= 2 then
    raise exception 'Khảo sát cần ít nhất 2 phương án';
  end if;
  delete from public.poll_options where id = p_option_id;
end $$;

revoke execute on function public.update_poll(uuid, text, text, timestamptz, boolean, boolean),
  public.add_poll_option(uuid, text), public.rename_poll_option(uuid, text), public.delete_poll_option(uuid)
  from public, anon;
grant execute on function public.update_poll(uuid, text, text, timestamptz, boolean, boolean),
  public.add_poll_option(uuid, text), public.rename_poll_option(uuid, text), public.delete_poll_option(uuid)
  to authenticated, service_role;
revoke execute on function public.announcements_before_update() from public, anon, authenticated;

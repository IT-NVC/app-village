-- =====================================================================
-- 0002: Hàm hỗ trợ phân quyền, trigger, và các RPC nghiệp vụ
-- Quy ước: mọi hàm SECURITY DEFINER đều đặt search_path = '' và
-- tham chiếu đầy đủ schema để tránh bị chiếm quyền qua search_path.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Hàm hỗ trợ phân quyền
-- ---------------------------------------------------------------------

-- Cấp bậc: Bí thư (3) > Trưởng thôn (2) > Phó thôn (1) > còn lại (0)
create function public.role_rank(r public.leadership_role)
returns int language sql immutable set search_path = '' as $$
  select case r when 'bi_thu' then 3 when 'truong_thon' then 2 when 'pho_thon' then 1 else 0 end;
$$;

create function public.is_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;

-- Cấp bậc của người đang đăng nhập (0 nếu không phải cán bộ hoặc không active)
create function public.my_rank()
returns int language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.role_rank(leadership_role) from public.profiles
    where id = auth.uid() and status = 'active'
  ), 0);
$$;

-- Bí thư / Trưởng thôn / Phó thôn
create function public.is_leader()
returns boolean language sql stable set search_path = '' as $$
  select public.my_rank() >= 1;
$$;

-- Bí thư / Trưởng thôn (toàn quyền)
create function public.is_admin()
returns boolean language sql stable set search_path = '' as $$
  select public.my_rank() >= 2;
$$;

create function public.my_area_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select r.area_id from public.profiles p
  join public.residents r on r.id = p.resident_id
  where p.id = auth.uid();
$$;

create function public.my_resident_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select resident_id from public.profiles where id = auth.uid();
$$;

-- Trưởng ban của ban ngành p_org (hoặc là cán bộ thôn)
create function public.is_org_leader(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_leader() or (public.is_active() and exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid() and role = 'truong_ban'
  ));
$$;

create function public.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active() and exists (
    select 1 from public.chat_group_members where group_id = p_group and user_id = auth.uid()
  );
$$;

create function public.is_group_admin(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or (public.is_active() and exists (
    select 1 from public.chat_group_members
    where group_id = p_group and user_id = auth.uid() and role = 'admin'
  ));
$$;

-- Danh sách người nhận của một thông báo (tài khoản active)
create function public.announcement_recipients(p_announcement uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select p.id
  from public.profiles p
  left join public.residents r on r.id = p.resident_id
  join public.announcements a on a.id = p_announcement
  where p.status = 'active'
    and (
      a.target_all
      or exists (select 1 from public.announcement_targets t
                 where t.announcement_id = a.id and t.area_id is not null and t.area_id = r.area_id)
      or exists (select 1 from public.announcement_targets t
                 join public.org_members m on m.org_id = t.org_id
                 where t.announcement_id = a.id and m.user_id = p.id)
    );
$$;

-- Người đang đăng nhập có xem được thông báo này không
create function public.can_view_announcement(p_announcement uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_leader()
    or exists (select 1 from public.announcements where id = p_announcement and sender_id = auth.uid())
    or (
      exists (select 1 from public.announcements where id = p_announcement and scheduled_at <= now())
      and exists (select 1 from public.announcement_recipients(p_announcement) u where u = auth.uid())
    );
$$;

-- ---------------------------------------------------------------------
-- 2. Trigger chung
-- ---------------------------------------------------------------------

create function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_profiles_updated_at  before update on public.profiles  for each row execute function public.set_updated_at();
create trigger trg_residents_updated_at before update on public.residents for each row execute function public.set_updated_at();
create trigger trg_news_updated_at      before update on public.news      for each row execute function public.set_updated_at();
create trigger trg_reports_updated_at   before update on public.reports   for each row execute function public.set_updated_at();

-- Nhật ký thao tác
create function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, data)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(v_row->>'id', v_row->>'key', v_row->>'org_id' || ':' || (v_row->>'user_id')),
    case when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)) else v_row end
  );
  return null;
end $$;

create trigger audit_profiles after update of status, leadership_role on public.profiles
  for each row when (old.status is distinct from new.status or old.leadership_role is distinct from new.leadership_role)
  execute function public.audit_trigger();
create trigger audit_org_members   after insert or update or delete on public.org_members   for each row execute function public.audit_trigger();
create trigger audit_areas         after insert or update or delete on public.areas         for each row execute function public.audit_trigger();
create trigger audit_organizations after insert or update or delete on public.organizations for each row execute function public.audit_trigger();
create trigger audit_app_settings  after update on public.app_settings                     for each row execute function public.audit_trigger();
create trigger audit_residents     after insert or delete on public.residents               for each row execute function public.audit_trigger();
create trigger audit_announcements after insert or delete on public.announcements           for each row execute function public.audit_trigger();

-- Ghi nhận người cập nhật cài đặt
create function public.app_settings_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger trg_app_settings_stamp before update on public.app_settings
  for each row execute function public.app_settings_stamp();

-- ---------------------------------------------------------------------
-- 3. Tài khoản: tạo profile, mã kích hoạt, đăng ký, duyệt
-- ---------------------------------------------------------------------

-- Tự tạo profile khi có tài khoản mới (Google hoặc username/password)
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    nullif(lower(trim(new.raw_user_meta_data->>'username')), ''),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sinh mã kích hoạt 8 ký tự, bỏ các ký tự dễ nhầm (0/O, 1/I/L)
create function public.gen_activation_code()
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
begin
  loop
    bytes := extensions.gen_random_bytes(8);
    code := '';
    for i in 0..7 loop
      code := code || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.residents where activation_code = code);
  end loop;
  return code;
end $$;

-- Nhân khẩu do cán bộ nhập sẽ tự có mã kích hoạt (hạn 180 ngày)
create function public.residents_set_code()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.source = 'import' and new.activation_code is null then
    new.activation_code := public.gen_activation_code();
    new.activation_expires_at := now() + interval '180 days';
  end if;
  return new;
end $$;
create trigger trg_residents_set_code before insert on public.residents
  for each row execute function public.residents_set_code();

-- Cán bộ cấp lại mã kích hoạt
create function public.regenerate_activation_code(p_resident_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if not public.is_leader() then raise exception 'Không có quyền'; end if;
  if exists (select 1 from public.profiles where resident_id = p_resident_id) then
    raise exception 'Nhân khẩu này đã có tài khoản';
  end if;
  v_code := public.gen_activation_code();
  update public.residents
     set activation_code = v_code, activation_expires_at = now() + interval '180 days'
   where id = p_resident_id;
  if not found then raise exception 'Không tìm thấy nhân khẩu'; end if;
  return v_code;
end $$;

-- Người dân nhập mã kích hoạt để gắn tài khoản với hồ sơ có sẵn.
-- Trả về json thay vì raise để số lần thử sai vẫn được lưu lại.
create function public.activate_account(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles;
  v_resident_id uuid;
begin
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if v_profile.id is null then
    return jsonb_build_object('ok', false, 'error', 'Chưa đăng nhập');
  end if;
  if v_profile.resident_id is not null and v_profile.status in ('active', 'pending') then
    return jsonb_build_object('ok', false, 'error', 'Tài khoản đã được gắn với hồ sơ');
  end if;
  if v_profile.status = 'locked' then
    return jsonb_build_object('ok', false, 'error', 'Tài khoản đã bị khoá');
  end if;
  if v_profile.activation_attempts >= 10 then
    return jsonb_build_object('ok', false, 'error', 'Nhập sai quá nhiều lần. Vui lòng liên hệ cán bộ thôn.');
  end if;

  select r.id into v_resident_id
  from public.residents r
  where r.activation_code = upper(trim(p_code))
    and (r.activation_expires_at is null or r.activation_expires_at > now())
    and not exists (select 1 from public.profiles p where p.resident_id = r.id)
  for update;

  if v_resident_id is null then
    update public.profiles set activation_attempts = activation_attempts + 1 where id = v_profile.id;
    return jsonb_build_object('ok', false, 'error', 'Mã kích hoạt không đúng hoặc đã hết hạn');
  end if;

  update public.residents set activation_code = null, activation_expires_at = null where id = v_resident_id;
  update public.profiles
     set resident_id = v_resident_id, status = 'active', activation_attempts = 0,
         approved_at = now(), reject_reason = null
   where id = v_profile.id;

  return jsonb_build_object('ok', true, 'status', 'active');
end $$;

-- Người dân tự khai báo hồ sơ (khi không có mã kích hoạt)
create function public.register_resident(
  p_full_name      text,
  p_area_id        uuid,
  p_birth_date     date default null,
  p_gender         public.gender default null,
  p_phone          text default null,
  p_household_code text default null,
  p_note           text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles;
  v_household uuid;
  v_resident uuid;
  v_require boolean;
  v_status public.account_status;
begin
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if v_profile.id is null then raise exception 'Chưa đăng nhập'; end if;
  if v_profile.status not in ('unverified', 'rejected') then
    raise exception 'Tài khoản đã khai báo hồ sơ';
  end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'Vui lòng nhập họ tên'; end if;
  if not exists (select 1 from public.areas where id = p_area_id) then raise exception 'Khu vực không hợp lệ'; end if;

  if p_household_code is not null and trim(p_household_code) <> '' then
    select id into v_household from public.households where code = trim(p_household_code);
  end if;

  -- Nếu trước đó bị từ chối thì cập nhật lại hồ sơ cũ
  if v_profile.resident_id is not null then
    v_resident := v_profile.resident_id;
    update public.residents
       set full_name = trim(p_full_name), area_id = p_area_id, birth_date = p_birth_date,
           gender = p_gender, phone = p_phone, household_id = v_household, note = p_note
     where id = v_resident;
  else
    insert into public.residents (full_name, birth_date, gender, phone, household_id, area_id, note, source, created_by)
    values (trim(p_full_name), p_birth_date, p_gender, p_phone, v_household, p_area_id, p_note, 'self', auth.uid())
    returning id into v_resident;
  end if;

  select coalesce((value)::boolean, true) into v_require from public.app_settings where key = 'require_approval';
  v_status := case when coalesce(v_require, true) then 'pending'::public.account_status
                   else 'active'::public.account_status end;

  update public.profiles
     set resident_id = v_resident, status = v_status, reject_reason = null,
         approved_at = case when v_status = 'active' then now() end
   where id = v_profile.id;

  return jsonb_build_object('ok', true, 'status', v_status);
end $$;

-- Cán bộ duyệt / từ chối tài khoản chờ duyệt
create function public.review_account(p_user_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_leader() then raise exception 'Không có quyền'; end if;
  update public.profiles
     set status = case when p_approve then 'active'::public.account_status else 'rejected'::public.account_status end,
         reject_reason = case when p_approve then null else p_reason end,
         approved_by = auth.uid(), approved_at = now()
   where id = p_user_id and status = 'pending';
  if not found then raise exception 'Tài khoản không ở trạng thái chờ duyệt'; end if;
end $$;

-- Khoá / mở khoá tài khoản (chỉ với người cấp thấp hơn mình)
create function public.set_account_locked(p_user_id uuid, p_locked boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_target public.profiles;
begin
  if not public.is_leader() then raise exception 'Không có quyền'; end if;
  if p_user_id = auth.uid() then raise exception 'Không thể tự khoá tài khoản của mình'; end if;
  select * into v_target from public.profiles where id = p_user_id for update;
  if v_target.id is null then raise exception 'Không tìm thấy tài khoản'; end if;
  if public.role_rank(v_target.leadership_role) >= public.my_rank() then
    raise exception 'Không thể thao tác với người có chức vụ ngang hoặc cao hơn';
  end if;
  update public.profiles
     set status = case when p_locked then 'locked'::public.account_status
                       when resident_id is null then 'unverified'::public.account_status
                       else 'active'::public.account_status end
   where id = p_user_id;
end $$;

-- Gán / gỡ chức vụ cán bộ thôn (Bí thư, Trưởng thôn, Phó thôn)
--  - Chỉ Bí thư / Trưởng thôn được dùng
--  - Trưởng thôn chỉ gán được Phó thôn, chỉ thao tác với người cấp thấp hơn
--  - Bí thư thao tác được với tất cả (kể cả chuyển giao chức Bí thư)
create function public.set_leadership_role(p_user_id uuid, p_role public.leadership_role)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_my_rank int := public.my_rank();
  v_target public.profiles;
begin
  if v_my_rank < 2 then raise exception 'Chỉ Bí thư hoặc Trưởng thôn được phân quyền cán bộ'; end if;
  if p_user_id = auth.uid() then raise exception 'Không thể tự thay đổi chức vụ của mình'; end if;
  select * into v_target from public.profiles where id = p_user_id for update;
  if v_target.id is null or v_target.status <> 'active' then
    raise exception 'Tài khoản không tồn tại hoặc chưa hoạt động';
  end if;
  if v_my_rank < 3 then
    if public.role_rank(v_target.leadership_role) >= v_my_rank then
      raise exception 'Không thể thao tác với người có chức vụ ngang hoặc cao hơn';
    end if;
    if public.role_rank(p_role) >= v_my_rank then
      raise exception 'Không thể gán chức vụ ngang hoặc cao hơn mình';
    end if;
  end if;
  update public.profiles set leadership_role = p_role where id = p_user_id;
end $$;

-- ---------------------------------------------------------------------
-- 4. Ban ngành đoàn thể
-- ---------------------------------------------------------------------

-- Thêm thành viên / đổi vai trò trong ban ngành
--  - Cán bộ thôn: toàn quyền
--  - Trưởng ban: chỉ thêm/đổi thành viên thường, không đụng tới trưởng ban khác
create function public.set_org_member(p_org_id uuid, p_user_id uuid, p_role public.org_role default 'thanh_vien')
returns void language plpgsql security definer set search_path = '' as $$
declare v_current public.org_role;
begin
  if not public.is_org_leader(p_org_id) then raise exception 'Không có quyền'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id and status = 'active') then
    raise exception 'Tài khoản không tồn tại hoặc chưa hoạt động';
  end if;
  select role into v_current from public.org_members where org_id = p_org_id and user_id = p_user_id;
  if not public.is_leader() then
    if p_role = 'truong_ban' or v_current = 'truong_ban' then
      raise exception 'Chỉ cán bộ thôn được phân công trưởng ban';
    end if;
  end if;
  insert into public.org_members (org_id, user_id, role, added_by)
  values (p_org_id, p_user_id, p_role, auth.uid())
  on conflict (org_id, user_id) do update set role = excluded.role;
end $$;

create function public.remove_org_member(p_org_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_current public.org_role;
begin
  if not public.is_org_leader(p_org_id) then raise exception 'Không có quyền'; end if;
  select role into v_current from public.org_members where org_id = p_org_id and user_id = p_user_id;
  if v_current is null then return; end if;
  if not public.is_leader() and v_current = 'truong_ban' then
    raise exception 'Chỉ cán bộ thôn được gỡ trưởng ban';
  end if;
  delete from public.org_members where org_id = p_org_id and user_id = p_user_id;
end $$;

-- ---------------------------------------------------------------------
-- 5. Thông báo
-- ---------------------------------------------------------------------

--  - Cán bộ thôn: gửi toàn thôn, theo khu, theo ban ngành; được gửi mức "khẩn"
--  - Trưởng ban: chỉ gửi tới ban ngành mình phụ trách, không gửi mức "khẩn"
create function public.send_announcement(
  p_title        text,
  p_content      text,
  p_priority     public.priority_level default 'thuong',
  p_target_all   boolean default false,
  p_area_ids     uuid[] default '{}',
  p_org_ids      uuid[] default '{}',
  p_scheduled_at timestamptz default null,
  p_attachments  jsonb default '[]'::jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_area_ids uuid[] := coalesce(p_area_ids, '{}');
  v_org_ids uuid[] := coalesce(p_org_ids, '{}');
  v_org uuid;
begin
  if not public.is_active() then raise exception 'Không có quyền'; end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_content), '') = '' then
    raise exception 'Vui lòng nhập tiêu đề và nội dung';
  end if;
  if not p_target_all and cardinality(v_area_ids) = 0 and cardinality(v_org_ids) = 0 then
    raise exception 'Vui lòng chọn đối tượng nhận';
  end if;

  if not public.is_leader() then
    if p_target_all or cardinality(v_area_ids) > 0 then
      raise exception 'Chỉ cán bộ thôn được gửi thông báo toàn thôn hoặc theo khu';
    end if;
    if p_priority = 'khan' then
      raise exception 'Chỉ cán bộ thôn được gửi thông báo khẩn';
    end if;
    foreach v_org in array v_org_ids loop
      if not public.is_org_leader(v_org) then
        raise exception 'Bạn không phụ trách ban ngành đã chọn';
      end if;
    end loop;
  end if;

  insert into public.announcements (title, content, priority, attachments, target_all, scheduled_at, sender_id)
  values (trim(p_title), p_content, p_priority, coalesce(p_attachments, '[]'::jsonb), p_target_all,
          coalesce(p_scheduled_at, now()), auth.uid())
  returning id into v_id;

  if not p_target_all then
    insert into public.announcement_targets (announcement_id, area_id)
      select v_id, unnest(v_area_ids);
    insert into public.announcement_targets (announcement_id, org_id)
      select v_id, unnest(v_org_ids);
  end if;

  return v_id;
end $$;

-- Thống kê đã đọc / chưa đọc (cho người gửi và cán bộ)
create function public.announcement_read_stats(p_announcement uuid)
returns table (total int, read_count int) language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_leader() or exists (
    select 1 from public.announcements where id = p_announcement and sender_id = auth.uid())) then
    raise exception 'Không có quyền';
  end if;
  return query
    select count(*)::int,
           count(rd.user_id)::int
    from public.announcement_recipients(p_announcement) u
    left join public.announcement_reads rd on rd.announcement_id = p_announcement and rd.user_id = u;
end $$;

-- Danh sách chưa đọc (để cán bộ gọi điện nhắc)
create function public.announcement_unread_list(p_announcement uuid)
returns table (user_id uuid, full_name text, phone text, area_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_leader() or exists (
    select 1 from public.announcements where id = p_announcement and sender_id = auth.uid())) then
    raise exception 'Không có quyền';
  end if;
  return query
    select u, r.full_name, r.phone, a.name
    from public.announcement_recipients(p_announcement) u
    join public.profiles p on p.id = u
    left join public.residents r on r.id = p.resident_id
    left join public.areas a on a.id = r.area_id
    where not exists (select 1 from public.announcement_reads rd
                      where rd.announcement_id = p_announcement and rd.user_id = u)
    order by a.name, r.full_name;
end $$;

-- ---------------------------------------------------------------------
-- 6. Phản ánh sự cố (gửi thẳng tới Bí thư; Trưởng thôn có toàn quyền nên cũng xử lý được)
-- ---------------------------------------------------------------------

create function public.update_report_status(p_report_id uuid, p_status public.report_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Chỉ Bí thư / Trưởng thôn được xử lý phản ánh'; end if;
  update public.reports set status = p_status where id = p_report_id;
  if not found then raise exception 'Không tìm thấy phản ánh'; end if;
  insert into public.report_updates (report_id, actor_id, status, note)
  values (p_report_id, auth.uid(), p_status, p_note);
end $$;

create function public.rate_report(p_report_id uuid, p_rating smallint, p_comment text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.reports set rating = p_rating, rating_comment = p_comment
   where id = p_report_id and reporter_id = auth.uid() and status = 'hoan_thanh';
  if not found then raise exception 'Chỉ đánh giá được phản ánh của bạn đã hoàn thành'; end if;
end $$;

-- Ghi lịch sử khi người dân tạo phản ánh
create function public.reports_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.report_updates (report_id, actor_id, status, note)
  values (new.id, new.reporter_id, 'moi', 'Người dân gửi phản ánh');
  return null;
end $$;
create trigger trg_reports_after_insert after insert on public.reports
  for each row execute function public.reports_after_insert();

-- ---------------------------------------------------------------------
-- 7. Khẩn cấp (SOS)
-- ---------------------------------------------------------------------

-- Chống gửi liên tục: tối đa 1 tín hiệu / 60 giây / người
create function public.sos_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.sos_events
             where user_id = new.user_id and created_at > now() - interval '60 seconds') then
    raise exception 'Bạn vừa gửi tín hiệu khẩn cấp. Cán bộ đã nhận được, vui lòng chờ hoặc gọi trực tiếp.';
  end if;
  new.status := 'dang_cho';
  new.handled_by := null;
  new.handled_at := null;
  return new;
end $$;
create trigger trg_sos_before_insert before insert on public.sos_events
  for each row execute function public.sos_before_insert();

create function public.handle_sos(p_sos_id uuid, p_status public.sos_status)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_leader() then raise exception 'Không có quyền'; end if;
  update public.sos_events set status = p_status, handled_by = auth.uid(), handled_at = now()
   where id = p_sos_id;
  if not found then raise exception 'Không tìm thấy tín hiệu'; end if;
end $$;

-- ---------------------------------------------------------------------
-- 8. Chat nhóm (tự đồng bộ thành viên)
-- ---------------------------------------------------------------------

-- Đồng bộ nhóm chat khu vực cho 1 người theo khu họ đang ở
create function public.sync_user_area_groups(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_area uuid; v_active boolean;
begin
  select r.area_id, p.status = 'active' into v_area, v_active
  from public.profiles p left join public.residents r on r.id = p.resident_id
  where p.id = p_user_id;

  -- Rời các nhóm khu không còn thuộc về (giữ lại nếu là quản trị nhóm)
  delete from public.chat_group_members m
  using public.chat_groups g
  where m.group_id = g.id and g.type = 'area' and m.user_id = p_user_id
    and m.role = 'member'
    and (not coalesce(v_active, false) or g.area_id is distinct from v_area);

  if coalesce(v_active, false) and v_area is not null then
    insert into public.chat_group_members (group_id, user_id, role)
    select g.id, p_user_id, 'member' from public.chat_groups g where g.area_id = v_area
    on conflict do nothing;
  end if;
end $$;

create function public.profiles_sync_groups()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.sync_user_area_groups(new.id);
  return null;
end $$;
create trigger trg_profiles_sync_groups after update of status, resident_id on public.profiles
  for each row execute function public.profiles_sync_groups();

create function public.residents_sync_groups()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  select id into v_user from public.profiles where resident_id = new.id;
  if v_user is not null then perform public.sync_user_area_groups(v_user); end if;
  return null;
end $$;
create trigger trg_residents_sync_groups after update of area_id on public.residents
  for each row execute function public.residents_sync_groups();

-- Đồng bộ nhóm chat ban ngành khi thành viên ban ngành thay đổi
create function public.org_members_sync_groups()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    delete from public.chat_group_members m using public.chat_groups g
    where m.group_id = g.id and g.org_id = old.org_id and m.user_id = old.user_id
      and m.user_id is distinct from g.created_by;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.chat_group_members (group_id, user_id, role)
    select g.id, new.user_id,
           case when new.role = 'truong_ban' then 'admin'::public.chat_member_role else 'member'::public.chat_member_role end
    from public.chat_groups g where g.org_id = new.org_id
    on conflict (group_id, user_id) do update set role = excluded.role;
  end if;
  return null;
end $$;
create trigger trg_org_members_sync_groups after insert or update or delete on public.org_members
  for each row execute function public.org_members_sync_groups();

-- Tạo nhóm chat
--  - Nhóm khu (area): cán bộ thôn tạo, tự thêm toàn bộ người dân của khu
--  - Nhóm ban ngành (org): cán bộ thôn / trưởng ban tạo, tự thêm thành viên ban ngành
--  - Nhóm tuỳ chọn (custom): cán bộ thôn tạo, chọn thành viên thủ công
create function public.create_chat_group(
  p_name       text,
  p_type       public.chat_group_type,
  p_area_id    uuid default null,
  p_org_id     uuid default null,
  p_member_ids uuid[] default '{}'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_type = 'org' then
    if not public.is_org_leader(p_org_id) then raise exception 'Không có quyền'; end if;
  elsif not public.is_leader() then
    raise exception 'Chỉ cán bộ thôn được tạo nhóm này';
  end if;

  insert into public.chat_groups (name, type, area_id, org_id, created_by)
  values (trim(p_name), p_type,
          case when p_type = 'area' then p_area_id end,
          case when p_type = 'org' then p_org_id end,
          auth.uid())
  returning id into v_id;

  -- Người tạo là quản trị nhóm
  insert into public.chat_group_members (group_id, user_id, role) values (v_id, auth.uid(), 'admin');

  if p_type = 'area' then
    insert into public.chat_group_members (group_id, user_id, role)
    select v_id, p.id, 'member'
    from public.profiles p join public.residents r on r.id = p.resident_id
    where p.status = 'active' and r.area_id = p_area_id
    on conflict do nothing;
  elsif p_type = 'org' then
    insert into public.chat_group_members (group_id, user_id, role)
    select v_id, m.user_id, case when m.role = 'truong_ban' then 'admin'::public.chat_member_role else 'member'::public.chat_member_role end
    from public.org_members m where m.org_id = p_org_id
    on conflict (group_id, user_id) do update set role = excluded.role;
  else
    insert into public.chat_group_members (group_id, user_id, role)
    select v_id, p.id, 'member' from public.profiles p
    where p.id = any(coalesce(p_member_ids, '{}')) and p.status = 'active'
    on conflict do nothing;
  end if;

  return v_id;
end $$;

-- Thêm / bớt thành viên thủ công (quản trị nhóm)
create function public.add_group_members(p_group_id uuid, p_user_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_group_admin(p_group_id) then raise exception 'Không có quyền'; end if;
  insert into public.chat_group_members (group_id, user_id, role)
  select p_group_id, p.id, 'member' from public.profiles p
  where p.id = any(p_user_ids) and p.status = 'active'
  on conflict do nothing;
end $$;

create function public.remove_group_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user_id <> auth.uid() and not public.is_group_admin(p_group_id) then
    raise exception 'Không có quyền';
  end if;
  delete from public.chat_group_members where group_id = p_group_id and user_id = p_user_id;
end $$;

-- Quản trị nhóm: đổi vai trò, cấm gửi tin
create function public.update_group_member(p_group_id uuid, p_user_id uuid,
                                           p_role public.chat_member_role default null,
                                           p_is_muted boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_group_admin(p_group_id) then raise exception 'Không có quyền'; end if;
  update public.chat_group_members
     set role = coalesce(p_role, role), is_muted = coalesce(p_is_muted, is_muted)
   where group_id = p_group_id and user_id = p_user_id;
end $$;

-- Thu hồi tin nhắn (người gửi hoặc quản trị nhóm)
create function public.delete_message(p_message_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_msg public.messages;
begin
  select * into v_msg from public.messages where id = p_message_id;
  if v_msg.id is null then raise exception 'Không tìm thấy tin nhắn'; end if;
  if v_msg.sender_id is distinct from auth.uid() and not public.is_group_admin(v_msg.group_id) then
    raise exception 'Không có quyền';
  end if;
  update public.messages set deleted_at = now(), content = null, image_path = null, is_pinned = false
   where id = p_message_id;
end $$;

create function public.pin_message(p_message_id uuid, p_pinned boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_group uuid;
begin
  select group_id into v_group from public.messages where id = p_message_id;
  if v_group is null or not public.is_group_admin(v_group) then raise exception 'Không có quyền'; end if;
  update public.messages set is_pinned = p_pinned where id = p_message_id;
end $$;

create function public.mark_group_read(p_group_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.chat_group_members set last_read_at = now()
  where group_id = p_group_id and user_id = auth.uid();
$$;

create function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.chat_groups set last_message_at = new.created_at where id = new.group_id;
  return null;
end $$;
create trigger trg_messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

-- ---------------------------------------------------------------------
-- 9. Hồ sơ cá nhân
-- ---------------------------------------------------------------------

create function public.update_my_profile(p_avatar_url text default null, p_phone text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_avatar_url is not null then
    update public.profiles set avatar_url = p_avatar_url where id = auth.uid();
  end if;
  if p_phone is not null then
    update public.residents set phone = p_phone where id = public.my_resident_id();
  end if;
end $$;

-- Thông tin tài khoản của chính mình (dùng sau khi đăng nhập)
create function public.get_me()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'status', p.status,
    'reject_reason', p.reject_reason,
    'leadership_role', p.leadership_role,
    'avatar_url', p.avatar_url,
    'full_name', r.full_name,
    'phone', r.phone,
    'area_id', r.area_id,
    'area_name', a.name,
    'orgs', coalesce((
      select jsonb_agg(jsonb_build_object('org_id', o.id, 'name', o.name, 'role', m.role))
      from public.org_members m join public.organizations o on o.id = m.org_id
      where m.user_id = p.id), '[]'::jsonb)
  )
  from public.profiles p
  left join public.residents r on r.id = p.resident_id
  left join public.areas a on a.id = r.area_id
  where p.id = auth.uid();
$$;

-- Danh bạ thành viên (tên hiển thị trong chat, chọn người khi phân quyền)
-- Chỉ người dùng active mới xem được; không lộ ngày sinh / số điện thoại người dân.
create view public.member_directory as
  select p.id, r.full_name, p.avatar_url, p.leadership_role, r.area_id, a.name as area_name
  from public.profiles p
  join public.residents r on r.id = p.resident_id
  left join public.areas a on a.id = r.area_id
  where p.status = 'active' and public.is_active();

-- ---------------------------------------------------------------------
-- 10. Quyền thực thi hàm: chỉ người đã đăng nhập
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
revoke all on public.member_directory from anon;

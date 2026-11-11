-- =====================================================================
-- 0007: Lịch thôn + Đặt lịch nhà văn hoá / sân thể thao
-- =====================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------- Lịch sự kiện ----------
create type public.event_category as enum ('hop', 'van_hoa', 've_sinh', 'y_te', 'the_thao', 'khac');

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  category    public.event_category not null default 'khac',
  location    text,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  area_id     uuid references public.areas(id) on delete set null,   -- null = toàn thôn
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index on public.events (starts_at);

alter table public.events enable row level security;
-- Lịch thôn là thông tin chung: mọi người dân đang hoạt động đều xem được
create policy "events: người dùng active xem" on public.events
  for select to authenticated using (public.is_active());
create policy "events: cán bộ thêm" on public.events
  for insert to authenticated with check (public.is_leader());
create policy "events: cán bộ sửa" on public.events
  for update to authenticated using (public.is_leader()) with check (public.is_leader());
create policy "events: cán bộ xoá" on public.events
  for delete to authenticated using (public.is_leader());

-- ---------- Địa điểm cho đặt lịch ----------
create table public.venues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
insert into public.venues (name, description, sort_order) values
  ('Nhà văn hoá thôn', 'Hội trường chính, sức chứa khoảng 150 người', 1),
  ('Sân thể thao', 'Sân bóng chuyền, cầu lông ngoài trời', 2);

alter table public.venues enable row level security;
create policy "venues: xem" on public.venues
  for select to authenticated using (public.is_active());
create policy "venues: cán bộ ghi" on public.venues
  for all to authenticated using (public.is_leader()) with check (public.is_leader());

-- ---------- Yêu cầu đặt lịch ----------
create type public.booking_status as enum ('cho_duyet', 'da_duyet', 'tu_choi', 'da_huy');

create table public.venue_bookings (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  purpose      text not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       public.booking_status not null default 'cho_duyet',
  review_note  text,
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Hai lịch ĐÃ DUYỆT của cùng một địa điểm không được trùng giờ
  constraint venue_bookings_no_overlap exclude using gist (
    venue_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'da_duyet')
);
create index on public.venue_bookings (venue_id, starts_at);
create index on public.venue_bookings (requester_id);

alter table public.venue_bookings enable row level security;
-- Ai cũng thấy lịch ĐÃ DUYỆT (để biết giờ nào còn trống); lịch của mình thì thấy mọi trạng thái; cán bộ thấy hết
create policy "bookings: xem" on public.venue_bookings
  for select to authenticated using (
    public.is_leader()
    or requester_id = auth.uid()
    or (status = 'da_duyet' and public.is_active())
  );

-- Người dân gửi yêu cầu đặt
create function public.request_booking(p_venue_id uuid, p_purpose text, p_starts_at timestamptz, p_ends_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_active() then raise exception 'Không có quyền'; end if;
  if coalesce(trim(p_purpose), '') = '' then raise exception 'Vui lòng ghi mục đích sử dụng'; end if;
  if p_ends_at <= p_starts_at then raise exception 'Giờ kết thúc phải sau giờ bắt đầu'; end if;
  if p_starts_at < now() then raise exception 'Không đặt được thời gian đã qua'; end if;
  if p_ends_at - p_starts_at > interval '3 days' then raise exception 'Mỗi lần đặt tối đa 3 ngày'; end if;
  if not exists (select 1 from public.venues where id = p_venue_id and is_active) then raise exception 'Địa điểm không hợp lệ'; end if;
  if exists (select 1 from public.venue_bookings
             where venue_id = p_venue_id and status = 'da_duyet'
               and tstzrange(starts_at, ends_at) && tstzrange(p_starts_at, p_ends_at)) then
    raise exception 'Khung giờ này đã có người đặt. Vui lòng chọn giờ khác.';
  end if;
  if (select count(*) from public.venue_bookings where requester_id = auth.uid() and status = 'cho_duyet') >= 5 then
    raise exception 'Bạn đang có 5 yêu cầu chờ duyệt. Vui lòng chờ cán bộ xử lý.';
  end if;
  insert into public.venue_bookings (venue_id, requester_id, purpose, starts_at, ends_at)
  values (p_venue_id, auth.uid(), trim(p_purpose), p_starts_at, p_ends_at)
  returning id into v_id;
  return v_id;
end $$;

-- Cán bộ duyệt / từ chối
create function public.review_booking(p_booking_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_leader() then raise exception 'Chỉ cán bộ thôn được duyệt'; end if;
  begin
    update public.venue_bookings
       set status = case when p_approve then 'da_duyet'::public.booking_status else 'tu_choi'::public.booking_status end,
           review_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_booking_id and status = 'cho_duyet';
  exception when exclusion_violation then
    raise exception 'Khung giờ này đã có lịch được duyệt khác. Vui lòng từ chối hoặc liên hệ người đặt để đổi giờ.';
  end;
  if not found then raise exception 'Yêu cầu không còn ở trạng thái chờ duyệt'; end if;
end $$;

-- Người đặt huỷ (lịch chưa diễn ra), hoặc cán bộ huỷ
create function public.cancel_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.venue_bookings set status = 'da_huy'
   where id = p_booking_id
     and status in ('cho_duyet', 'da_duyet')
     and ends_at > now()
     and (requester_id = auth.uid() or public.is_leader());
  if not found then raise exception 'Không huỷ được lịch này'; end if;
end $$;

create trigger audit_events after insert or update or delete on public.events
  for each row execute function public.audit_trigger();
create trigger audit_venue_bookings after update of status on public.venue_bookings
  for each row execute function public.audit_trigger();

revoke all on public.events, public.venues, public.venue_bookings from anon;
revoke execute on function public.request_booking(uuid, text, timestamptz, timestamptz),
  public.review_booking(uuid, boolean, text), public.cancel_booking(uuid) from public, anon;
grant execute on function public.request_booking(uuid, text, timestamptz, timestamptz),
  public.review_booking(uuid, boolean, text), public.cancel_booking(uuid) to authenticated, service_role;

alter publication supabase_realtime add table public.venue_bookings;

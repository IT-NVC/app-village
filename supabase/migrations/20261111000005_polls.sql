-- =====================================================================
-- 0005: Khảo sát / Biểu quyết
--  - Gửi tới toàn thôn / khu / ban ngành (giống thông báo)
--  - Chọn 1 hoặc nhiều phương án; ẩn danh hoặc công khai người bỏ phiếu
--  - Mỗi người một phiếu, hoặc MỖI HỘ một phiếu
--  - Được đổi phiếu cho tới khi khảo sát đóng
-- =====================================================================

create type public.vote_scope as enum ('person', 'household');

create table public.polls (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  allow_multiple boolean not null default false,
  is_anonymous   boolean not null default false,
  vote_scope     public.vote_scope not null default 'person',
  target_all     boolean not null default true,
  closes_at      timestamptz,                 -- null = không hẹn giờ đóng
  closed_at      timestamptz,                 -- đóng sớm bằng tay
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on public.polls (created_at desc);

create table public.poll_targets (
  id      uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  area_id uuid references public.areas(id) on delete cascade,
  org_id  uuid references public.organizations(id) on delete cascade,
  check ((area_id is null) <> (org_id is null))
);
create index on public.poll_targets (poll_id);

create table public.poll_options (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.polls(id) on delete cascade,
  label      text not null,
  sort_order int not null default 0
);
create index on public.poll_options (poll_id);

create table public.poll_votes (
  poll_id      uuid not null references public.polls(id) on delete cascade,
  option_id    uuid not null references public.poll_options(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (poll_id, option_id, user_id)
);
create index on public.poll_votes (poll_id, user_id);
create index on public.poll_votes (poll_id, household_id);

-- ---------------------------------------------------------------------
-- Hàm hỗ trợ
-- ---------------------------------------------------------------------

create function public.poll_is_open(p public.polls)
returns boolean language sql stable set search_path = '' as $$
  select p.closed_at is null and (p.closes_at is null or p.closes_at > now());
$$;

-- Người dùng có thuộc đối tượng của khảo sát không
create function public.is_poll_recipient(p_poll uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.polls pl
    join public.profiles pr on pr.id = p_user and pr.status = 'active'
    left join public.residents r on r.id = pr.resident_id
    where pl.id = p_poll
      and (
        pl.target_all
        or exists (select 1 from public.poll_targets t where t.poll_id = pl.id and t.area_id = r.area_id)
        or exists (select 1 from public.poll_targets t join public.org_members m on m.org_id = t.org_id
                   where t.poll_id = pl.id and m.user_id = p_user)
      )
  );
$$;

create function public.can_view_poll(p_poll uuid)
returns boolean language sql stable set search_path = '' as $$
  select public.is_leader() or public.is_poll_recipient(p_poll, auth.uid());
$$;

-- ---------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------

-- Cán bộ thôn tạo khảo sát
create function public.create_poll(
  p_title          text,
  p_options        text[],
  p_description    text default null,
  p_allow_multiple boolean default false,
  p_is_anonymous   boolean default false,
  p_vote_scope     public.vote_scope default 'person',
  p_closes_at      timestamptz default null,
  p_target_all     boolean default true,
  p_area_ids       uuid[] default '{}',
  p_org_ids        uuid[] default '{}'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_opts text[];
begin
  if not public.is_leader() then raise exception 'Chỉ cán bộ thôn được tạo khảo sát'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Vui lòng nhập câu hỏi'; end if;
  select array_agg(trim(o)) into v_opts from unnest(p_options) o where coalesce(trim(o), '') <> '';
  if coalesce(cardinality(v_opts), 0) < 2 then raise exception 'Cần ít nhất 2 phương án'; end if;
  if not p_target_all and cardinality(coalesce(p_area_ids, '{}')) = 0 and cardinality(coalesce(p_org_ids, '{}')) = 0 then
    raise exception 'Vui lòng chọn đối tượng tham gia';
  end if;
  if p_closes_at is not null and p_closes_at <= now() then raise exception 'Thời hạn phải ở tương lai'; end if;

  insert into public.polls (title, description, allow_multiple, is_anonymous, vote_scope, target_all, closes_at, created_by)
  values (trim(p_title), nullif(trim(p_description), ''), p_allow_multiple, p_is_anonymous, p_vote_scope,
          p_target_all, p_closes_at, auth.uid())
  returning id into v_id;

  insert into public.poll_options (poll_id, label, sort_order)
  select v_id, o, ord from unnest(v_opts) with ordinality as t(o, ord);

  if not p_target_all then
    insert into public.poll_targets (poll_id, area_id) select v_id, unnest(coalesce(p_area_ids, '{}'));
    insert into public.poll_targets (poll_id, org_id) select v_id, unnest(coalesce(p_org_ids, '{}'));
  end if;
  return v_id;
end $$;

-- Bỏ phiếu (gọi lại để đổi phiếu). Mảng rỗng = rút phiếu.
create function public.cast_vote(p_poll_id uuid, p_option_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_poll public.polls;
  v_household uuid;
  v_n int := coalesce(cardinality(p_option_ids), 0);
begin
  select * into v_poll from public.polls where id = p_poll_id;
  if v_poll.id is null then raise exception 'Không tìm thấy khảo sát'; end if;
  if not public.is_poll_recipient(p_poll_id, auth.uid()) then raise exception 'Bạn không thuộc đối tượng của khảo sát này'; end if;
  if not public.poll_is_open(v_poll) then raise exception 'Khảo sát đã đóng'; end if;
  if v_n > 1 and not v_poll.allow_multiple then raise exception 'Khảo sát này chỉ được chọn một phương án'; end if;
  if exists (select 1 from unnest(p_option_ids) o
             where not exists (select 1 from public.poll_options po where po.id = o and po.poll_id = p_poll_id)) then
    raise exception 'Phương án không hợp lệ';
  end if;

  select r.household_id into v_household
  from public.profiles pr join public.residents r on r.id = pr.resident_id
  where pr.id = auth.uid();

  if v_poll.vote_scope = 'household' then
    if v_household is null then
      raise exception 'Khảo sát tính theo hộ, nhưng tài khoản của bạn chưa gắn với hộ gia đình. Vui lòng liên hệ cán bộ thôn.';
    end if;
    if exists (select 1 from public.poll_votes v
               where v.poll_id = p_poll_id and v.household_id = v_household and v.user_id <> auth.uid()) then
      raise exception 'Hộ của bạn đã có người bỏ phiếu cho khảo sát này';
    end if;
  end if;

  delete from public.poll_votes where poll_id = p_poll_id and user_id = auth.uid();
  insert into public.poll_votes (poll_id, option_id, user_id, household_id)
  select p_poll_id, o, auth.uid(), v_household from unnest(p_option_ids) o;
end $$;

-- Kết quả: số phiếu từng phương án + số người/hộ đã tham gia (công khai cho mọi người trong đối tượng)
create function public.poll_results(p_poll_id uuid)
returns table (option_id uuid, label text, sort_order int, votes int, voters int, my_vote boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_scope public.vote_scope;
begin
  if not public.can_view_poll(p_poll_id) then raise exception 'Không có quyền'; end if;
  select vote_scope into v_scope from public.polls where id = p_poll_id;
  return query
    select o.id, o.label, o.sort_order,
           (select count(*)::int from public.poll_votes v where v.option_id = o.id),
           (select case when v_scope = 'household'
                        then count(distinct v.household_id)::int
                        else count(distinct v.user_id)::int end
              from public.poll_votes v where v.poll_id = p_poll_id),
           exists (select 1 from public.poll_votes v where v.option_id = o.id and v.user_id = auth.uid())
    from public.poll_options o
    where o.poll_id = p_poll_id
    order by o.sort_order;
end $$;

-- Danh sách người đã bỏ phiếu (chỉ cán bộ, chỉ với khảo sát công khai)
create function public.poll_voters(p_poll_id uuid)
returns table (user_id uuid, full_name text, area_name text, option_label text, voted_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_leader() then raise exception 'Không có quyền'; end if;
  if (select is_anonymous from public.polls where id = p_poll_id) then
    raise exception 'Khảo sát ẩn danh — không xem được ai chọn gì';
  end if;
  return query
    select v.user_id, r.full_name, a.name, o.label, v.created_at
    from public.poll_votes v
    join public.poll_options o on o.id = v.option_id
    join public.profiles p on p.id = v.user_id
    left join public.residents r on r.id = p.resident_id
    left join public.areas a on a.id = r.area_id
    where v.poll_id = p_poll_id
    order by a.name, r.full_name;
end $$;

-- Số người thuộc đối tượng (để tính tỉ lệ tham gia)
create function public.poll_eligible_count(p_poll_id uuid)
returns int language sql stable security definer set search_path = '' as $$
  select case when (select vote_scope from public.polls where id = p_poll_id) = 'household'
    then (select count(distinct r.household_id)::int from public.profiles p join public.residents r on r.id = p.resident_id
          where p.status = 'active' and r.household_id is not null and public.is_poll_recipient(p_poll_id, p.id))
    else (select count(*)::int from public.profiles p where p.status = 'active' and public.is_poll_recipient(p_poll_id, p.id))
  end
  where public.can_view_poll(p_poll_id);
$$;

create function public.close_poll(p_poll_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_leader() then raise exception 'Không có quyền'; end if;
  update public.polls set closed_at = now() where id = p_poll_id and closed_at is null;
end $$;

-- ---------------------------------------------------------------------
-- RLS: đọc theo đối tượng; mọi thao tác ghi đi qua RPC
-- ---------------------------------------------------------------------
alter table public.polls        enable row level security;
alter table public.poll_targets enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes   enable row level security;

create policy "polls: đối tượng xem" on public.polls
  for select to authenticated using (public.can_view_poll(id));
create policy "polls: cán bộ xoá" on public.polls
  for delete to authenticated using (public.is_leader());
create policy "poll_targets: xem theo khảo sát" on public.poll_targets
  for select to authenticated using (public.can_view_poll(poll_id));
create policy "poll_options: xem theo khảo sát" on public.poll_options
  for select to authenticated using (public.can_view_poll(poll_id));
-- Phiếu bầu: chỉ xem phiếu của chính mình (kết quả tổng hợp qua poll_results)
create policy "poll_votes: phiếu của mình" on public.poll_votes
  for select to authenticated using (user_id = auth.uid());

create trigger audit_polls after insert or delete on public.polls
  for each row execute function public.audit_trigger();

revoke all on public.polls, public.poll_targets, public.poll_options, public.poll_votes from anon;
revoke execute on function public.poll_is_open(public.polls), public.is_poll_recipient(uuid, uuid), public.can_view_poll(uuid),
  public.create_poll(text, text[], text, boolean, boolean, public.vote_scope, timestamptz, boolean, uuid[], uuid[]),
  public.cast_vote(uuid, uuid[]), public.poll_results(uuid), public.poll_voters(uuid),
  public.poll_eligible_count(uuid), public.close_poll(uuid)
  from public, anon;
grant execute on function public.poll_is_open(public.polls), public.is_poll_recipient(uuid, uuid), public.can_view_poll(uuid),
  public.create_poll(text, text[], text, boolean, boolean, public.vote_scope, timestamptz, boolean, uuid[], uuid[]),
  public.cast_vote(uuid, uuid[]), public.poll_results(uuid), public.poll_voters(uuid),
  public.poll_eligible_count(uuid), public.close_poll(uuid)
  to authenticated, service_role;

alter publication supabase_realtime add table public.polls;

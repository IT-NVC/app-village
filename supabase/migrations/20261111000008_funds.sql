-- =====================================================================
-- 0008: Quỹ thôn — công khai thu chi
--  - Cán bộ ghi thu / chi (kèm ảnh chứng từ)
--  - MỌI người dân đang hoạt động xem được số dư, từng giao dịch, hộ đã đóng góp
--  - Mọi thêm / sửa / xoá giao dịch đều ghi nhật ký
-- =====================================================================

create type public.fund_tx_kind as enum ('thu', 'chi');

create table public.funds (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  target_amount bigint check (target_amount is null or target_amount > 0),  -- mục tiêu vận động (VNĐ)
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table public.fund_transactions (
  id           uuid primary key default gen_random_uuid(),
  fund_id      uuid not null references public.funds(id) on delete cascade,
  kind         public.fund_tx_kind not null,
  amount       bigint not null check (amount > 0),        -- VNĐ
  occurred_on  date not null default current_date,
  description  text not null,
  household_id uuid references public.households(id) on delete set null,  -- hộ đóng góp (khoản thu)
  payer_name   text,                                       -- người nộp / người nhận không thuộc hộ nào
  receipt_path text,                                       -- ảnh chứng từ trong kho fund-receipts
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (kind = 'thu' or household_id is null)
);
create index on public.fund_transactions (fund_id, occurred_on desc);
create index on public.fund_transactions (fund_id, household_id);

create trigger trg_fund_tx_updated_at before update on public.fund_transactions
  for each row execute function public.set_updated_at();
create trigger audit_funds after insert or update or delete on public.funds
  for each row execute function public.audit_trigger();
create trigger audit_fund_transactions after insert or update or delete on public.fund_transactions
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- RLS: xem công khai cho người dân; chỉ cán bộ thôn ghi
-- ---------------------------------------------------------------------
alter table public.funds enable row level security;
alter table public.fund_transactions enable row level security;

create policy "funds: người dân xem" on public.funds
  for select to authenticated using (public.is_active());
create policy "funds: cán bộ ghi" on public.funds
  for all to authenticated using (public.is_leader()) with check (public.is_leader());
create policy "fund_tx: người dân xem" on public.fund_transactions
  for select to authenticated using (public.is_active());
-- Thêm: phải ghi đúng người thêm. Sửa / xoá: cán bộ nào cũng làm được (để sửa nhập sai) — nhật ký lưu lại toàn bộ.
create policy "fund_tx: cán bộ thêm" on public.fund_transactions
  for insert to authenticated with check (public.is_leader() and created_by = auth.uid());
create policy "fund_tx: cán bộ sửa" on public.fund_transactions
  for update to authenticated using (public.is_leader()) with check (public.is_leader());
create policy "fund_tx: cán bộ xoá" on public.fund_transactions
  for delete to authenticated using (public.is_leader());

-- ---------------------------------------------------------------------
-- Tổng hợp
-- ---------------------------------------------------------------------

-- Số dư từng quỹ
create function public.fund_summaries()
returns table (
  id uuid, name text, description text, target_amount bigint, is_active boolean, created_at timestamptz,
  total_thu bigint, total_chi bigint, balance bigint, households int, last_tx_on date
)
language sql stable security definer set search_path = '' as $$
  select f.id, f.name, f.description, f.target_amount, f.is_active, f.created_at,
         coalesce(sum(t.amount) filter (where t.kind = 'thu'), 0)::bigint,
         coalesce(sum(t.amount) filter (where t.kind = 'chi'), 0)::bigint,
         (coalesce(sum(t.amount) filter (where t.kind = 'thu'), 0) - coalesce(sum(t.amount) filter (where t.kind = 'chi'), 0))::bigint,
         count(distinct t.household_id)::int,
         max(t.occurred_on)
  from public.funds f
  left join public.fund_transactions t on t.fund_id = f.id
  where public.is_active()
  group by f.id
  order by f.is_active desc, f.created_at desc;
$$;

-- Đóng góp theo hộ (công khai: tên chủ hộ + khu + tổng tiền)
create function public.fund_household_contributions(p_fund_id uuid)
returns table (household_id uuid, code text, head_name text, area_name text, total bigint, times int, is_mine boolean)
language sql stable security definer set search_path = '' as $$
  select h.id, h.code, h.head_name, a.name, sum(t.amount)::bigint, count(*)::int,
         -- coalesce: người chưa gắn hộ thì so sánh với NULL ra NULL -> đổi thành false
         coalesce(h.id = (select r.household_id from public.profiles p join public.residents r on r.id = p.resident_id
                          where p.id = auth.uid()), false)
  from public.fund_transactions t
  join public.households h on h.id = t.household_id
  left join public.areas a on a.id = h.area_id
  where t.fund_id = p_fund_id and t.kind = 'thu' and public.is_active()
  group by h.id, a.name
  order by a.name nulls last, h.head_name;
$$;

-- Hộ CHƯA đóng góp (chỉ cán bộ — để đi vận động, không công khai)
create function public.fund_missing_households(p_fund_id uuid, p_area_id uuid default null)
returns table (household_id uuid, code text, head_name text, area_name text, phone text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_leader() then raise exception 'Không có quyền'; end if;
  return query
    select h.id, h.code, h.head_name, a.name,
           (select r.phone from public.residents r where r.household_id = h.id and r.phone is not null limit 1)
    from public.households h
    left join public.areas a on a.id = h.area_id
    where (p_area_id is null or h.area_id = p_area_id)
      and not exists (select 1 from public.fund_transactions t
                      where t.fund_id = p_fund_id and t.kind = 'thu' and t.household_id = h.id)
    order by a.name nulls last, h.head_name;
end $$;

-- Danh sách hộ để chọn khi ghi khoản thu (cán bộ)
create function public.household_options()
returns table (id uuid, code text, head_name text, area_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_leader() then raise exception 'Không có quyền'; end if;
  return query
    select h.id, h.code, h.head_name, a.name
    from public.households h left join public.areas a on a.id = h.area_id
    order by a.name nulls last, h.head_name;
end $$;

-- Người dân xem được tên chủ hộ / khu của các khoản thu (bảng households vốn chỉ cán bộ đọc được)
create function public.fund_transactions_view(p_fund_id uuid)
returns table (
  id uuid, kind public.fund_tx_kind, amount bigint, occurred_on date, description text,
  household_id uuid, household_label text, payer_name text, receipt_path text, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.kind, t.amount, t.occurred_on, t.description, t.household_id,
         case when h.id is null then null
              else concat_ws(' · ', 'Hộ ' || h.head_name, a.name) end,
         t.payer_name, t.receipt_path, t.created_at
  from public.fund_transactions t
  left join public.households h on h.id = t.household_id
  left join public.areas a on a.id = h.area_id
  where t.fund_id = p_fund_id and public.is_active()
  order by t.occurred_on desc, t.created_at desc;
$$;

-- ---------------------------------------------------------------------
-- Kho ảnh chứng từ (riêng tư, người dân đang hoạt động xem được)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fund-receipts', 'fund-receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "fund-receipts: cán bộ tải lên" on storage.objects
  for insert to authenticated with check (bucket_id = 'fund-receipts' and public.is_leader());
create policy "fund-receipts: cán bộ xoá" on storage.objects
  for delete to authenticated using (bucket_id = 'fund-receipts' and public.is_leader());
create policy "fund-receipts: người dân xem" on storage.objects
  for select to authenticated using (bucket_id = 'fund-receipts' and public.is_active());

revoke all on public.funds, public.fund_transactions from anon;
revoke execute on function public.fund_summaries(), public.fund_household_contributions(uuid),
  public.fund_missing_households(uuid, uuid), public.household_options(), public.fund_transactions_view(uuid)
  from public, anon;
grant execute on function public.fund_summaries(), public.fund_household_contributions(uuid),
  public.fund_missing_households(uuid, uuid), public.household_options(), public.fund_transactions_view(uuid)
  to authenticated, service_role;

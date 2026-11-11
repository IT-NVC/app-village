-- =====================================================================
-- 0006: Thông báo đẩy (push)
--  - Đăng ký / huỷ mã thiết bị (một máy có thể đổi người đăng nhập)
--  - Nhật ký đã gửi: mỗi sự kiện chỉ gửi push một lần
-- Việc gửi do Edge Function `notify` thực hiện (dùng service role).
-- =====================================================================

-- Đăng ký mã push của thiết bị cho người đang đăng nhập
create function public.register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[.+\]$' then raise exception 'Mã thiết bị không hợp lệ'; end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

-- Đăng xuất: thiết bị này thôi nhận push của tài khoản
create function public.unregister_push_token(p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

-- Nhật ký push đã gửi (chống gửi trùng). Chỉ Edge Function (service role) đọc/ghi.
create table public.push_log (
  kind       text not null,
  ref_id     uuid not null,
  recipients int not null default 0,
  sent_at    timestamptz not null default now(),
  primary key (kind, ref_id)
);
alter table public.push_log enable row level security;
revoke all on public.push_log from anon, authenticated;

revoke execute on function public.register_push_token(text, text), public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text), public.unregister_push_token(text) to authenticated, service_role;

-- Người nhận của một khảo sát (một lần gọi, dùng cho push)
create function public.poll_recipients(p_poll uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select p.id
  from public.polls pl
  join public.profiles p on p.status = 'active'
  left join public.residents r on r.id = p.resident_id
  where pl.id = p_poll
    and (
      pl.target_all
      or exists (select 1 from public.poll_targets t where t.poll_id = pl.id and t.area_id = r.area_id)
      or exists (select 1 from public.poll_targets t join public.org_members m on m.org_id = t.org_id
                 where t.poll_id = pl.id and m.user_id = p.id)
    );
$$;
revoke execute on function public.poll_recipients(uuid) from public, anon, authenticated;
grant execute on function public.poll_recipients(uuid) to service_role;

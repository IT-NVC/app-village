-- =====================================================================
-- 0004: Hộp thư chat — danh sách nhóm của tôi kèm tin nhắn cuối + số chưa đọc
-- (một lần gọi thay vì nhiều truy vấn cho từng nhóm)
-- =====================================================================

create function public.my_chat_groups()
returns table (
  id               uuid,
  name             text,
  type             public.chat_group_type,
  avatar_url       text,
  my_role          public.chat_member_role,
  is_muted         boolean,
  member_count     int,
  last_message_at  timestamptz,
  last_content     text,
  last_has_image   boolean,
  last_deleted     boolean,
  last_sender_id   uuid,
  last_sender_name text,
  unread           int
)
language sql stable security definer set search_path = '' as $$
  select
    g.id, g.name, g.type, g.avatar_url, m.role, m.is_muted,
    (select count(*)::int from public.chat_group_members x where x.group_id = g.id),
    lm.created_at,
    lm.content,
    lm.image_path is not null,
    lm.deleted_at is not null,
    lm.sender_id,
    r.full_name,
    (select count(*)::int from public.messages mm
      where mm.group_id = g.id
        and mm.created_at > coalesce(m.last_read_at, '-infinity'::timestamptz)
        and mm.sender_id is distinct from auth.uid()
        and mm.deleted_at is null)
  from public.chat_group_members m
  join public.chat_groups g on g.id = m.group_id
  left join lateral (
    select mm.created_at, mm.content, mm.image_path, mm.deleted_at, mm.sender_id
    from public.messages mm
    where mm.group_id = g.id
    order by mm.created_at desc
    limit 1
  ) lm on true
  left join public.profiles p on p.id = lm.sender_id
  left join public.residents r on r.id = p.resident_id
  where m.user_id = auth.uid() and public.is_active()
  order by coalesce(lm.created_at, g.created_at) desc;
$$;

revoke execute on function public.my_chat_groups() from public, anon;
grant execute on function public.my_chat_groups() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Sửa lỗi: thu hồi tin nhắn (delete_message) xoá nội dung + ảnh nhưng ràng buộc cũ
-- bắt buộc phải có nội dung hoặc ảnh -> thu hồi luôn thất bại.
-- Tin đã thu hồi (deleted_at có giá trị) được phép không có nội dung.
-- ---------------------------------------------------------------------
alter table public.messages drop constraint messages_check;
alter table public.messages add constraint messages_has_body
  check (deleted_at is not null or content is not null or image_path is not null);

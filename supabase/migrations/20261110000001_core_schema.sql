-- =====================================================================
-- Thôn Thống Nhất - Xã Sóc Sơn
-- 0001: Kiểu dữ liệu & bảng lõi
-- =====================================================================

-- ---------- Kiểu dữ liệu (enum) ----------
create type public.leadership_role as enum ('bi_thu', 'truong_thon', 'pho_thon');
create type public.org_role        as enum ('truong_ban', 'thanh_vien');

-- unverified: mới tạo tài khoản, chưa kích hoạt / chưa khai báo hồ sơ
-- pending   : đã khai báo, đang chờ cán bộ duyệt
-- active    : đang hoạt động
-- rejected  : bị từ chối
-- locked    : bị khoá
create type public.account_status  as enum ('unverified', 'pending', 'active', 'rejected', 'locked');

create type public.gender          as enum ('nam', 'nu', 'khac');
create type public.priority_level  as enum ('khan', 'quan_trong', 'thuong');
create type public.report_category as enum ('dien', 'duong', 'nuoc', 've_sinh', 'an_ninh', 'khac');
create type public.report_status   as enum ('moi', 'dang_xu_ly', 'hoan_thanh', 'tu_choi');
create type public.sos_status      as enum ('dang_cho', 'da_tiep_nhan', 'da_xu_ly');
create type public.chat_group_type as enum ('area', 'org', 'custom');
create type public.chat_member_role as enum ('admin', 'member');

-- ---------- Cài đặt hệ thống ----------
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

insert into public.app_settings (key, value) values
  ('require_approval', 'true'::jsonb),          -- Bật/tắt chế độ chờ duyệt khi tự đăng ký
  ('village_name', '"Thôn Thống Nhất"'::jsonb),
  ('commune_name', '"Xã Sóc Sơn"'::jsonb);

-- ---------- Khu vực ----------
create table public.areas (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,             -- Khu A, Khu B...
  description text,
  sort_order  int not null default 0,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------- Hộ gia đình ----------
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  code        text unique,                      -- Mã hộ (tuỳ chọn)
  head_name   text not null,                    -- Tên chủ hộ
  address     text,
  area_id     uuid references public.areas(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on public.households (area_id);

-- ---------- Nhân khẩu (hồ sơ người dân) ----------
-- Cán bộ nhập sẵn, hoặc được tạo khi người dân tự đăng ký.
create table public.residents (
  id                    uuid primary key default gen_random_uuid(),
  full_name             text not null,
  birth_date            date,
  gender                public.gender,
  phone                 text,
  household_id          uuid references public.households(id) on delete set null,
  area_id               uuid references public.areas(id) on delete set null,
  note                  text,
  source                text not null default 'import' check (source in ('import', 'self')),
  activation_code       text unique,           -- Mã kích hoạt in cho người dân
  activation_expires_at timestamptz,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index on public.residents (area_id);
create index on public.residents (household_id);
create index on public.residents (phone);

-- ---------- Tài khoản (gắn 1-1 với auth.users) ----------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  username            text unique,
  resident_id         uuid unique references public.residents(id) on delete set null,
  status              public.account_status not null default 'unverified',
  leadership_role     public.leadership_role,
  avatar_url          text,
  activation_attempts int not null default 0,
  reject_reason       text,
  approved_by         uuid references auth.users(id) on delete set null,
  approved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on public.profiles (status);

-- ---------- Ban ngành đoàn thể ----------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                    -- Tổ đoàn A, Chi hội phụ nữ tổ A...
  area_id     uuid references public.areas(id) on delete cascade,  -- null = cấp toàn thôn
  description text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (name, area_id)
);
create index on public.organizations (area_id);

create table public.org_members (
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        public.org_role not null default 'thanh_vien',
  added_by    uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on public.org_members (user_id);

-- ---------- Tin tức ----------
create table public.news (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  summary      text,
  content      text not null,
  cover_url    text,
  is_published boolean not null default false,
  is_pinned    boolean not null default false,
  published_at timestamptz,
  author_id    uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.news (is_published, published_at desc);

-- ---------- Thông báo ----------
create table public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  content      text not null,
  priority     public.priority_level not null default 'thuong',
  attachments  jsonb not null default '[]'::jsonb,  -- [{url, name, type}]
  target_all   boolean not null default false,     -- Gửi toàn thôn
  scheduled_at timestamptz not null default now(), -- Hẹn giờ hiển thị
  pushed_at    timestamptz,                        -- Thời điểm đã gửi push
  sender_id    uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on public.announcements (scheduled_at desc);

-- Đối tượng nhận: theo khu hoặc theo ban ngành
create table public.announcement_targets (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  area_id         uuid references public.areas(id) on delete cascade,
  org_id          uuid references public.organizations(id) on delete cascade,
  check ((area_id is null) <> (org_id is null))
);
create index on public.announcement_targets (announcement_id);

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

-- ---------- Phản ánh sự cố ----------
create table public.reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid not null references public.profiles(id) on delete cascade,
  category       public.report_category not null,
  title          text not null,
  description    text,
  images         text[] not null default '{}',     -- đường dẫn trong bucket report-images
  latitude       double precision,
  longitude      double precision,
  address_text   text,
  status         public.report_status not null default 'moi',
  rating         smallint check (rating between 1 and 5),
  rating_comment text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on public.reports (status, created_at desc);
create index on public.reports (reporter_id);

-- Lịch sử xử lý
create table public.report_updates (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.reports(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null,
  status     public.report_status not null,
  note       text,
  created_at timestamptz not null default now()
);
create index on public.report_updates (report_id);

-- ---------- Khẩn cấp (SOS) ----------
create table public.sos_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  latitude    double precision,
  longitude   double precision,
  message     text,
  status      public.sos_status not null default 'dang_cho',
  handled_by  uuid references public.profiles(id) on delete set null,
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.sos_events (status, created_at desc);

-- ---------- Danh bạ ----------
create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  title       text,                              -- Chức danh: Bí thư, Trạm y tế xã...
  phone       text not null,
  category    text not null default 'can_bo',    -- can_bo | khan_cap | y_te | dich_vu
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.contacts (name, title, phone, category, sort_order) values
  ('Công an', 'Báo tin an ninh, trật tự', '113', 'khan_cap', 1),
  ('Cứu hoả', 'Phòng cháy chữa cháy, cứu nạn', '114', 'khan_cap', 2),
  ('Cấp cứu', 'Cấp cứu y tế', '115', 'khan_cap', 3);

-- ---------- Chat nhóm ----------
create table public.chat_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        public.chat_group_type not null default 'custom',
  area_id     uuid unique references public.areas(id) on delete cascade,         -- nhóm của khu
  org_id      uuid unique references public.organizations(id) on delete cascade, -- nhóm của ban ngành
  avatar_url  text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  last_message_at timestamptz,
  check (
    (type = 'area'   and area_id is not null and org_id is null) or
    (type = 'org'    and org_id  is not null and area_id is null) or
    (type = 'custom' and area_id is null and org_id is null)
  )
);

create table public.chat_group_members (
  group_id     uuid not null references public.chat_groups(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         public.chat_member_role not null default 'member',
  is_muted     boolean not null default false,   -- bị cấm gửi tin
  last_read_at timestamptz,
  joined_at    timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index on public.chat_group_members (user_id);

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.chat_groups(id) on delete cascade,
  sender_id   uuid references public.profiles(id) on delete set null,
  content     text,
  image_path  text,
  is_pinned   boolean not null default false,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  check (content is not null or image_path is not null)
);
create index on public.messages (group_id, created_at desc);

-- ---------- Push token ----------
create table public.push_tokens (
  token       text primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  platform    text check (platform in ('ios', 'android', 'web')),
  updated_at  timestamptz not null default now()
);
create index on public.push_tokens (user_id);

-- ---------- Nhật ký thao tác ----------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  entity      text not null,
  entity_id   text,
  data        jsonb,
  created_at  timestamptz not null default now()
);
create index on public.audit_logs (created_at desc);
create index on public.audit_logs (entity, entity_id);

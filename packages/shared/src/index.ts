import type { Database } from './database.types';

export type { Database };
type Enums = Database['public']['Enums'];

export type LeadershipRole = Enums['leadership_role'];
export type OrgRole = Enums['org_role'];
export type AccountStatus = Enums['account_status'];
export type PriorityLevel = Enums['priority_level'];
export type ReportCategory = Enums['report_category'];
export type ReportStatus = Enums['report_status'];
export type SosStatus = Enums['sos_status'];

/** Tên miền nội bộ dùng để quy đổi username -> email cho Supabase Auth */
export const USERNAME_EMAIL_DOMAIN = 'thongnhat.local';
export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;

export const LEADERSHIP_ROLE_LABEL: Record<LeadershipRole, string> = {
  bi_thu: 'Bí thư',
  truong_thon: 'Trưởng thôn',
  pho_thon: 'Phó thôn',
};

export const ORG_ROLE_LABEL: Record<OrgRole, string> = {
  truong_ban: 'Trưởng ban',
  thanh_vien: 'Thành viên',
};

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  unverified: 'Chưa kích hoạt',
  pending: 'Chờ duyệt',
  active: 'Đang hoạt động',
  rejected: 'Bị từ chối',
  locked: 'Đã khoá',
};

export const PRIORITY_LABEL: Record<PriorityLevel, string> = {
  khan: 'Khẩn',
  quan_trong: 'Quan trọng',
  thuong: 'Thông thường',
};

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  dien: 'Điện, đèn đường',
  duong: 'Đường sá',
  nuoc: 'Nước, thoát nước',
  ve_sinh: 'Vệ sinh môi trường',
  an_ninh: 'An ninh trật tự',
  khac: 'Khác',
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  moi: 'Mới gửi',
  dang_xu_ly: 'Đang xử lý',
  hoan_thanh: 'Hoàn thành',
  tu_choi: 'Từ chối',
};

export const SOS_STATUS_LABEL: Record<SosStatus, string> = {
  dang_cho: 'Đang chờ',
  da_tiep_nhan: 'Đã tiếp nhận',
  da_xu_ly: 'Đã xử lý',
};

export const GENDER_LABEL: Record<Enums['gender'], string> = {
  nam: 'Nam',
  nu: 'Nữ',
  khac: 'Khác',
};

/** Cấp bậc: Bí thư 3 > Trưởng thôn 2 > Phó thôn 1 > còn lại 0 (khớp với public.role_rank) */
export const rankOf = (role: LeadershipRole | null | undefined) =>
  role === 'bi_thu' ? 3 : role === 'truong_thon' ? 2 : role === 'pho_thon' ? 1 : 0;

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

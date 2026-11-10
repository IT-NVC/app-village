import dayjs from 'dayjs';

export const fmtDate = (d?: string | null) => (d ? dayjs(d).format('DD/MM/YYYY') : '');
export const fmtDateTime = (d?: string | null) => (d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '');

/** Bỏ dấu tiếng Việt + chữ thường để tìm kiếm / so trùng tên */
export function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** "05/09/1960" | "1960-09-05" -> "1960-09-05"; null nếu sai */
export function parseDate(input: string): string | null {
  const s = input.trim();
  let d: dayjs.Dayjs;
  const vn = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (vn) d = dayjs(`${vn[3]}-${vn[2].padStart(2, '0')}-${vn[1].padStart(2, '0')}`);
  else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) d = dayjs(s);
  else return null;
  if (!d.isValid() || d.isAfter(dayjs()) || d.year() < 1900) return null;
  const iso = d.format('YYYY-MM-DD');
  // dayjs tự "tràn" ngày (31/02 -> 03/03): kiểm tra lại
  if (vn && d.date() !== Number(vn[1])) return null;
  return iso;
}

export function parseGender(input: string): 'nam' | 'nu' | 'khac' | null {
  const n = normalize(input);
  if (!n) return null;
  if (n === 'nam' || n === 'm') return 'nam';
  if (n === 'nu' || n === 'f') return 'nu';
  return 'khac';
}

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

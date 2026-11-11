const pad = (n: number) => String(n).padStart(2, '0');

/** 10/11/2026 14:05 */
export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Vừa xong", "5 phút trước", "3 giờ trước", "Hôm qua 14:05", "10/11/2026" */
export function timeAgo(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return `${Math.floor(diff / 3600)} giờ trước`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Hôm qua ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} ngày trước`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

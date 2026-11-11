import { AlertOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { App, Button } from 'antd';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { supabase } from '@/lib/supabase';

/** Tiếng chuông báo động ngắn bằng Web Audio (không cần file âm thanh) */
function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.25);
    });
  } catch {
    /* Trình duyệt chặn âm thanh khi chưa có tương tác — bỏ qua */
  }
}

/** Nghe sự kiện realtime ở mọi trang quản trị:
 *  - SOS mới: kêu chuông + cảnh báo đỏ không tự tắt
 *  - Phản ánh mới: thông báo nhẹ */
export function SosAlerter() {
  const { notification } = App.useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    // Các tín hiệu đã báo (để realtime và lần kiểm tra định kỳ không báo trùng)
    const seen = new Set<string>();
    let primed = false;

    const alertSos = (ev: { id: string; message: string | null }) => {
      if (seen.has(ev.id)) return;
      seen.add(ev.id);
      beep();
        const key = `sos-${ev.id}`;
        notification.error({
          key,
          title: 'CÓ TÍN HIỆU KHẨN CẤP MỚI',
          description: ev.message ? `Sự việc: ${ev.message}` : 'Người dân vừa bấm nút khẩn cấp.',
          icon: <AlertOutlined style={{ color: '#D32F2F' }} />,
          duration: 0,
          placement: 'topRight',
          actions: (
            <Button
              type="primary"
              danger
              onClick={() => {
                notification.destroy(key);
                navigate('/sos');
              }}>
              Xem ngay
            </Button>
          ),
        });
        // Cập nhật tiêu đề tab trình duyệt để dễ thấy khi đang ở tab khác
        document.title = '🚨 SOS — Quản trị Thôn Thống Nhất';
        setTimeout(() => (document.title = 'Quản trị - Thôn Thống Nhất'), 60_000);
        qc.invalidateQueries({ queryKey: ['sos'] });
        qc.invalidateQueries({ queryKey: ['sos-pending'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
    };

    // Dự phòng khi Realtime lỡ sự kiện: mỗi 20 giây hỏi lại các tín hiệu đang chờ trong 30 phút gần nhất.
    // Lần đầu chỉ ghi nhận (không kêu) để mở trang không bị báo lại tín hiệu cũ.
    const poll = async () => {
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('sos_events')
        .select('id, message')
        .eq('status', 'dang_cho')
        .gte('created_at', since);
      for (const ev of data ?? []) {
        if (primed) alertSos(ev);
        else seen.add(ev.id);
      }
      primed = true;
    };
    poll();
    const timer = setInterval(poll, 20_000);

    const channel = supabase
      .channel('admin-sos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sos_events' }, (payload) => {
        alertSos(payload.new as { id: string; message: string | null });
      })
      // Phản ánh mới (Realtime chỉ gửi tới Bí thư / Trưởng thôn nhờ RLS)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (payload) => {
        const r = payload.new as { id: string; title: string };
        notification.info({
          key: `report-${r.id}`,
          title: 'Có phản ánh mới',
          description: r.title,
          placement: 'topRight',
          duration: 10,
          actions: (
            <Button type="primary" onClick={() => { notification.destroy(`report-${r.id}`); navigate('/phan-anh'); }}>
              Xem
            </Button>
          ),
        });
        qc.invalidateQueries({ queryKey: ['reports'] });
        qc.invalidateQueries({ queryKey: ['reports-new'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sos_events' }, () => {
        qc.invalidateQueries({ queryKey: ['sos'] });
        qc.invalidateQueries({ queryKey: ['sos-pending'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [notification, qc, navigate]);

  return null;
}

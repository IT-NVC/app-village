import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Empty, Flex, Spin, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router';

import { fmtDate } from '@/lib/format';
import { one, rows, supabase } from '@/lib/supabase';

/** Trang in phiếu mã kích hoạt (2 phiếu / hàng, khổ A4) để phát cho người dân */
export default function PrintCodesPage() {
  const navigate = useNavigate();
  const ids: string[] = (useLocation().state as { ids?: string[] } | null)?.ids ?? [];

  const { data = [], isLoading } = useQuery({
    queryKey: ['print-codes', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const out = [];
      for (let i = 0; i < ids.length; i += 200) {
        out.push(
          ...rows(
            await supabase
              .from('residents')
              .select('id, full_name, birth_date, activation_code, activation_expires_at, areas(name)')
              .in('id', ids.slice(i, i + 200))
              .not('activation_code', 'is', null),
          ),
        );
      }
      return out.sort(
        (a, b) =>
          (one(a.areas)?.name ?? '').localeCompare(one(b.areas)?.name ?? '', 'vi') ||
          a.full_name.localeCompare(b.full_name, 'vi'),
      );
    },
  });

  return (
    <div>
      <Flex className="no-print" gap={12} align="center" style={{ padding: 16, background: '#fff', borderBottom: '1px solid #eee' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/nhan-khau')}>
          Quay lại
        </Button>
        <Button type="primary" icon={<PrinterOutlined />} disabled={!data.length} onClick={() => window.print()}>
          In {data.length} phiếu
        </Button>
        <Typography.Text type="secondary">Mẹo: chọn khổ A4, tắt "Đầu trang và chân trang" trong hộp thoại in.</Typography.Text>
      </Flex>

      {isLoading ? (
        <Flex justify="center" style={{ padding: 48 }}>
          <Spin />
        </Flex>
      ) : data.length === 0 ? (
        <Empty style={{ padding: 48 }} description="Không có mã kích hoạt nào để in" />
      ) : (
        <div className="print-sheet">
          {data.map((r) => (
            <div className="code-card" key={r.id}>
              <h4>Thôn Thống Nhất · Xã Sóc Sơn</h4>
              <div className="name">{r.full_name}</div>
              <div className="meta">
                {one(r.areas)?.name}
                {r.birth_date ? ` · Sinh ${fmtDate(r.birth_date)}` : ''}
              </div>
              <div className="code">{r.activation_code}</div>
              <div className="meta">Hạn dùng mã: {fmtDate(r.activation_expires_at)}</div>
              <ol>
                <li>Tải ứng dụng "Thôn Thống Nhất" trên điện thoại.</li>
                <li>Bấm "Đăng ký" (hoặc đăng nhập bằng Google).</li>
                <li>Nhập mã kích hoạt ở trên. Mỗi mã chỉ dùng cho 1 người.</li>
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { GENDER_LABEL } from '@thon/shared';
import { Alert, App, Button, Checkbox, Input, Modal, Space, Table, Tabs, Tag, Typography, Upload } from 'antd';
import Papa from 'papaparse';
import { useMemo, useState } from 'react';

import { useAreas } from '@/lib/data';
import { errMsg, fmtDate, normalize, parseDate, parseGender } from '@/lib/format';
import { ensureHouseholds } from '@/lib/households';
import { fetchAll, must, supabase } from '@/lib/supabase';

// Thứ tự cột trong file mẫu / khi dán từ Excel
const COLUMNS = ['Họ và tên', 'Ngày sinh', 'Giới tính', 'Số điện thoại', 'Khu', 'Mã hộ', 'Chủ hộ', 'Ghi chú'];

type ParsedRow = {
  line: number;
  full_name: string;
  birth_date: string | null;
  gender: 'nam' | 'nu' | 'khac' | null;
  phone: string | null;
  area_id: string | null;
  area_name: string;
  household_code: string | null;
  head_name: string | null;
  note: string | null;
  errors: string[];
  duplicate: boolean;
};

function downloadTemplate() {
  const sample = [
    COLUMNS,
    ['Nguyễn Văn An', '05/09/1960', 'Nam', '0912345678', 'Khu A', 'HA001', 'Nguyễn Văn An', ''],
    ['Trần Thị Bình', '12/03/1965', 'Nữ', '', 'Khu A', 'HA001', 'Nguyễn Văn An', 'Vợ chủ hộ'],
  ];
  // BOM để Excel mở đúng tiếng Việt
  const csv = '﻿' + Papa.unparse(sample);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'mau-nhap-nhan-khau.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ImportResidentsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { data: areas = [] } = useAreas();
  const [raw, setRaw] = useState<string[][]>([]);
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pasteText, setPasteText] = useState('');

  async function loadText(text: string) {
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true, delimiter: text.includes('\t') ? '\t' : '' });
    let rows = parsed.data.map((r) => r.map((c) => (c ?? '').trim()));
    // Bỏ dòng tiêu đề nếu có
    if (rows[0] && normalize(rows[0][0] ?? '').includes('ho va ten')) rows = rows.slice(1);
    setRaw(rows);
    // Lấy nhân khẩu hiện có để đánh dấu trùng (cùng tên + ngày sinh)
    const existing = await fetchAll((from, to) =>
      supabase.from('residents').select('full_name, birth_date').range(from, to),
    );
    setExistingKeys(new Set(existing.map((e) => `${normalize(e.full_name)}|${e.birth_date ?? ''}`)));
  }

  const rows: ParsedRow[] = useMemo(() => {
    const areaByName = new Map(areas.map((a) => [normalize(a.name), a.id]));
    return raw.map((c, i) => {
      const errors: string[] = [];
      const full_name = (c[0] ?? '').replace(/\s+/g, ' ');
      if (!full_name) errors.push('Thiếu họ tên');
      const birth_date = c[1] ? parseDate(c[1]) : null;
      if (c[1] && !birth_date) errors.push(`Ngày sinh sai: "${c[1]}"`);
      const phone = (c[3] ?? '').replace(/[\s.]/g, '') || null;
      if (phone && !/^0\d{9,10}$/.test(phone)) errors.push(`SĐT sai: "${c[3]}"`);
      const area_name = c[4] ?? '';
      const area_id = area_name ? areaByName.get(normalize(area_name)) ?? null : null;
      if (!area_name) errors.push('Thiếu khu');
      else if (!area_id) errors.push(`Không có khu "${area_name}"`);
      return {
        line: i + 1,
        full_name,
        birth_date,
        gender: parseGender(c[2] ?? ''),
        phone,
        area_id,
        area_name,
        household_code: c[5]?.toUpperCase() || null,
        head_name: c[6] || null,
        note: c[7] || null,
        errors,
        duplicate: existingKeys.has(`${normalize(full_name)}|${birth_date ?? ''}`),
      };
    });
  }, [raw, areas, existingKeys]);

  const valid = rows.filter((r) => r.errors.length === 0 && !(skipDuplicates && r.duplicate));
  const errorCount = rows.filter((r) => r.errors.length > 0).length;
  const dupCount = rows.filter((r) => r.duplicate).length;

  function reset() {
    setRaw([]);
    setPasteText('');
  }

  async function doImport() {
    setBusy(true);
    try {
      const hhMap = await ensureHouseholds(
        valid
          .filter((r) => r.household_code)
          .map((r) => ({ code: r.household_code!, head_name: r.head_name ?? r.full_name, area_id: r.area_id })),
      );
      const payload = valid.map((r) => ({
        full_name: r.full_name,
        birth_date: r.birth_date,
        gender: r.gender,
        phone: r.phone,
        area_id: r.area_id,
        household_id: r.household_code ? hhMap.get(r.household_code) ?? null : null,
        note: r.note,
        source: 'import',
      }));
      for (let i = 0; i < payload.length; i += 500) {
        must(await supabase.from('residents').insert(payload.slice(i, i + 500)));
      }
      message.success(`Đã nhập ${payload.length} nhân khẩu. Mỗi người đã có mã kích hoạt.`);
      qc.invalidateQueries({ queryKey: ['residents'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      reset();
      onClose();
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Nhập danh sách nhân khẩu"
      open={open}
      width={1100}
      onCancel={() => { reset(); onClose(); }}
      footer={
        raw.length > 0 && (
          <Space>
            <Button onClick={reset}>Chọn lại</Button>
            <Button type="primary" disabled={valid.length === 0} loading={busy} onClick={doImport}>
              Nhập {valid.length} người
            </Button>
          </Space>
        )
      }>
      {raw.length === 0 ? (
        <>
          <Typography.Paragraph>
            Các cột theo thứ tự: <b>{COLUMNS.join(' · ')}</b>. Bắt buộc: Họ và tên, Khu (phải trùng tên khu đã tạo).
            Ngày sinh dạng <code>05/09/1960</code>. Người cùng <b>Mã hộ</b> sẽ được gộp vào một hộ.
          </Typography.Paragraph>
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate} style={{ marginBottom: 16 }}>
            Tải file mẫu
          </Button>
          <Tabs
            items={[
              {
                key: 'paste',
                label: 'Dán từ Excel',
                children: (
                  <>
                    <Typography.Paragraph type="secondary">
                      Trong Excel, bôi đen các ô (có thể gồm cả dòng tiêu đề) → Ctrl+C → dán vào ô dưới đây.
                    </Typography.Paragraph>
                    <Input.TextArea rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
                    <Button type="primary" style={{ marginTop: 12 }} disabled={!pasteText.trim()} onClick={() => loadText(pasteText)}>
                      Kiểm tra dữ liệu
                    </Button>
                  </>
                ),
              },
              {
                key: 'file',
                label: 'Tải file CSV',
                children: (
                  <Upload.Dragger
                    accept=".csv,.txt"
                    showUploadList={false}
                    beforeUpload={async (file) => {
                      await loadText(await file.text());
                      return false;
                    }}>
                    <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                    <p>Kéo thả hoặc bấm để chọn file .csv</p>
                    <Typography.Text type="secondary">Excel: Tệp → Lưu thành → CSV UTF-8</Typography.Text>
                  </Upload.Dragger>
                ),
              },
            ]}
          />
        </>
      ) : (
        <>
          <Space wrap style={{ marginBottom: 12 }}>
            <Tag color="blue">Tổng {rows.length} dòng</Tag>
            <Tag color="green">Hợp lệ {valid.length}</Tag>
            {errorCount > 0 && <Tag color="red">Lỗi {errorCount}</Tag>}
            {dupCount > 0 && (
              <Checkbox checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)}>
                Bỏ qua {dupCount} người đã có trong hệ thống (trùng tên + ngày sinh)
              </Checkbox>
            )}
          </Space>
          {errorCount > 0 && (
            <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Các dòng lỗi sẽ không được nhập. Sửa trong Excel rồi dán lại nếu cần." />
          )}
          <Table<ParsedRow>
            size="small"
            rowKey="line"
            dataSource={rows}
            pagination={{ pageSize: 50 }}
            scroll={{ x: 1000, y: 420 }}
            columns={[
              { title: '#', dataIndex: 'line', width: 50 },
              { title: 'Họ tên', dataIndex: 'full_name' },
              { title: 'Ngày sinh', render: (_, r) => fmtDate(r.birth_date) },
              { title: 'Giới tính', render: (_, r) => (r.gender ? GENDER_LABEL[r.gender] : '') },
              { title: 'SĐT', dataIndex: 'phone' },
              { title: 'Khu', dataIndex: 'area_name' },
              { title: 'Mã hộ', dataIndex: 'household_code' },
              {
                title: 'Kiểm tra',
                render: (_, r) =>
                  r.errors.length ? (
                    <Typography.Text type="danger">{r.errors.join('; ')}</Typography.Text>
                  ) : r.duplicate ? (
                    <Tag color="orange">Đã có</Tag>
                  ) : (
                    <Tag color="green">OK</Tag>
                  ),
              },
            ]}
          />
        </>
      )}
    </Modal>
  );
}

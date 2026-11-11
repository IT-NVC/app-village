import type { Database } from '@thon/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Button, Card, Choice, Field, Notice, PageHeader, ScrollPage, Txt } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Gender = Database['public']['Enums']['gender'];
type Area = { id: string; name: string };

async function fetchAreas(): Promise<{ list: Area[]; failed: boolean }> {
  const { data, error } = await supabase.from('areas').select('id, name').order('sort_order').order('name');
  return { list: data ?? [], failed: !!error };
}

/** "05/09/1960" -> "1960-09-05"; trả null nếu sai định dạng */
function parseVnDate(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCDate() !== d || date.getUTCMonth() !== mo - 1 || y < 1900 || date > new Date()) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function DeclareScreen() {
  const { refreshMe } = useAuth();
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birth, setBirth] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [householdCode, setHouseholdCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAreas().then(({ list, failed }) => {
      if (failed) setError('Không tải được danh sách khu. Vui lòng thử lại.');
      setAreas(list);
    });
  }, []);

  async function reloadAreas() {
    setAreas(null);
    const { list, failed } = await fetchAreas();
    setError(failed ? 'Không tải được danh sách khu. Vui lòng thử lại.' : null);
    setAreas(list);
  }

  async function onSubmit() {
    if (fullName.trim().split(/\s+/).length < 2) return setError('Vui lòng nhập đầy đủ họ và tên.');
    if (!areaId) return setError('Vui lòng chọn khu bạn đang sinh sống.');
    const birthIso = birth.trim() ? parseVnDate(birth) : null;
    if (birth.trim() && !birthIso) return setError('Ngày sinh chưa đúng. Ví dụ: 05/09/1960');
    if (phone.trim() && !/^0\d{9}$/.test(phone.replace(/\s/g, '')))
      return setError('Số điện thoại gồm 10 số, bắt đầu bằng 0.');

    setError(null);
    setBusy(true);
    const { error: rpcErr } = await supabase.rpc('register_resident', {
      p_full_name: fullName.trim(),
      p_area_id: areaId,
      p_birth_date: birthIso ?? undefined,
      p_gender: gender ?? undefined,
      p_phone: phone.replace(/\s/g, '') || undefined,
      p_household_code: householdCode.trim() || undefined,
    });
    if (rpcErr) {
      setBusy(false);
      return setError(rpcErr.message);
    }
    await refreshMe(); // -> màn chờ duyệt hoặc vào thẳng app
  }

  return (
    <ScrollPage
      header={<PageHeader title="Khai báo thông tin" subtitle="Chỉ cán bộ thôn xem được" onBack={() => router.back()} />}>
      <Card style={{ padding: Spacing.lg, gap: Spacing.md }}>
        <Txt variant="subtitle">Thông tin bắt buộc</Txt>
        <Field
          label="Họ và tên"
          icon="person-outline"
          placeholder="VD: Nguyễn Văn An"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />
        {areas === null ? (
          <ActivityIndicator color={Colors.primary} />
        ) : areas.length === 0 ? (
          <>
            <Notice tone="warning" text="Thôn chưa tạo khu vực nào. Vui lòng liên hệ cán bộ thôn, hoặc bấm Tải lại sau khi cán bộ đã tạo." />
            <Button title="Tải lại danh sách khu" icon="refresh" variant="secondary" onPress={reloadAreas} />
          </>
        ) : (
          <Choice
            label="Khu đang sinh sống"
            options={areas.map((a) => ({ value: a.id, label: a.name }))}
            value={areaId}
            onChange={setAreaId}
          />
        )}
      </Card>

      <Card style={{ padding: Spacing.lg, gap: Spacing.md }}>
        <Txt variant="subtitle">Thông tin thêm</Txt>
        <Txt variant="small" color={Colors.textSecondary} style={{ marginTop: -8 }}>
          Không bắt buộc, nhưng giúp cán bộ duyệt nhanh hơn.
        </Txt>
        <Field
          label="Số điện thoại"
          icon="call-outline"
          placeholder="VD: 0912345678"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={11}
        />
        <Field
          label="Ngày sinh"
          icon="calendar-outline"
          placeholder="ngày/tháng/năm"
          hint="Ví dụ: 05/09/1960"
          value={birth}
          onChangeText={setBirth}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <Choice
          label="Giới tính"
          options={[
            { value: 'nam', label: 'Nam' },
            { value: 'nu', label: 'Nữ' },
            { value: 'khac', label: 'Khác' },
          ]}
          value={gender}
          onChange={setGender}
        />
        <Field
          label="Mã hộ gia đình (nếu có)"
          icon="home-outline"
          value={householdCode}
          onChangeText={setHouseholdCode}
          autoCapitalize="characters"
        />
      </Card>

      <Notice text={error} />
      <Button title="Gửi thông tin" icon="send" onPress={onSubmit} loading={busy} />
    </ScrollPage>
  );
}

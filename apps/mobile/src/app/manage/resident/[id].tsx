import { ACCOUNT_STATUS_LABEL, GENDER_LABEL, type AccountStatus } from '@thon/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';

import { Async, FormSheet, ManageShell, useLoad } from '@/components/manage-kit';
import { Button, Card, Choice, Field, Notice, ScrollPage, Txt } from '@/components/ui';
import { Colors, Font, Radius, Shadow, Spacing } from '@/constants/theme';
import { confirmAction, showInfo } from '@/lib/dialog';
import { fetchAreas, ensureHousehold, errText, friendlyError, manageAccount, parseVnDate, toVnDate } from '@/lib/manage-data';
import { one } from '@/lib/manage';
import { supabase } from '@/lib/supabase';

type Gender = 'nam' | 'nu' | 'khac';
type Loaded = {
  areas: { id: string; name: string }[];
  resident: {
    id: string;
    full_name: string;
    phone: string | null;
    birth_date: string | null;
    gender: Gender | null;
    note: string | null;
    area_id: string | null;
    household_code: string | null;
    activation_code: string | null;
    activation_expires_at: string | null;
    account: { id: string; status: AccountStatus; username: string | null } | null;
  } | null;
};

async function loadResident(id: string): Promise<Loaded> {
  const areas = await fetchAreas();
  if (id === 'new') return { areas, resident: null };
  const { data, error } = await supabase
    .from('residents')
    .select('id, full_name, phone, birth_date, gender, note, area_id, activation_code, activation_expires_at, households(code), profiles(id, status, username)')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return {
    areas,
    resident: {
      id: data.id,
      full_name: data.full_name,
      phone: data.phone,
      birth_date: data.birth_date,
      gender: data.gender,
      note: data.note,
      area_id: data.area_id,
      household_code: one(data.households)?.code ?? null,
      activation_code: data.activation_code,
      activation_expires_at: data.activation_expires_at,
      account: one(data.profiles),
    },
  };
}

export default function ResidentEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const state = useLoad(() => loadResident(id), id);

  return (
    <ManageShell title={isNew ? 'Thêm nhân khẩu' : 'Nhân khẩu'}>
      <Async state={state}>{(d) => <Form key={d.resident?.id ?? 'new'} data={d} onChanged={state.reload} />}</Async>
    </ManageShell>
  );
}

function Form({ data, onChanged }: { data: Loaded; onChanged: () => Promise<void> }) {
  const r = data.resident;
  const [fullName, setFullName] = useState(r?.full_name ?? '');
  const [areaId, setAreaId] = useState<string | null>(r?.area_id ?? null);
  const [birth, setBirth] = useState(toVnDate(r?.birth_date));
  const [gender, setGender] = useState<Gender | null>(r?.gender ?? null);
  const [phone, setPhone] = useState(r?.phone ?? '');
  const [household, setHousehold] = useState(r?.household_code ?? '');
  const [note, setNote] = useState(r?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function save() {
    if (fullName.trim().split(/\s+/).length < 2) return setError('Vui lòng nhập đầy đủ họ và tên.');
    if (!areaId) return setError('Vui lòng chọn khu.');
    const birthIso = birth.trim() ? parseVnDate(birth) : null;
    if (birth.trim() && !birthIso) return setError('Ngày sinh chưa đúng. Ví dụ: 05/09/1960');
    const ph = phone.replace(/\s/g, '');
    if (ph && !/^0\d{9,10}$/.test(ph)) return setError('Số điện thoại gồm 10–11 số, bắt đầu bằng 0.');
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const name = fullName.trim().replace(/\s+/g, ' ');
      const household_id = await ensureHousehold(household, name, areaId);
      const payload = { full_name: name, area_id: areaId, birth_date: birthIso, gender, phone: ph || null, household_id, note: note.trim() || null };
      if (!r) {
        const { data: created, error: err } = await supabase.from('residents').insert({ ...payload, source: 'import' }).select('id').single();
        if (err) throw new Error(err.message);
        // Mở lại ngay hồ sơ vừa tạo để thấy mã kích hoạt
        router.replace({ pathname: '/manage/resident/[id]', params: { id: created.id } });
        return;
      }
      const { error: err } = await supabase.from('residents').update(payload).eq('id', r.id);
      if (err) throw new Error(err.message);
      setSaved(true);
      await onChanged();
    } catch (e) {
      setError(friendlyError(errText(e)));
    }
    setBusy(false);
  }

  async function regen() {
    if (!r) return;
    const { error: err } = await supabase.rpc('regenerate_activation_code', { p_resident_id: r.id });
    if (err) return showInfo('Không cấp lại được', err.message);
    await onChanged();
  }

  async function shareCode() {
    if (!r?.activation_code) return;
    await Share.share({
      message: `Mã kích hoạt ứng dụng Thôn Thống Nhất của ${r.full_name}: ${r.activation_code}\n\nCách dùng: cài ứng dụng, bấm Đăng ký, rồi nhập mã này.`,
    });
  }

  async function createAccount() {
    if (!r) return;
    setCreating(true);
    setCreateError(null);
    const err = await manageAccount({ action: 'create', resident_id: r.id, username: username.trim().toLowerCase(), password });
    setCreating(false);
    if (err) return setCreateError(err);
    setCreateOpen(false);
    setUsername('');
    setPassword('');
    showInfo('Đã tạo tài khoản', `Tên đăng nhập: ${username.trim().toLowerCase()}
Hãy trao mật khẩu cho người dân và dặn đổi sau khi đăng nhập.`);
    await onChanged();
  }

  function remove() {
    if (!r) return;
    confirmAction(`Xoá ${r.full_name}?`, 'Chỉ xoá được nhân khẩu chưa có tài khoản.', 'Xoá', async () => {
      const { error: err } = await supabase.from('residents').delete().eq('id', r.id);
      if (err) return showInfo('Không xoá được', friendlyError(err.message));
      router.back();
    }, true);
  }

  return (
    <ScrollPage header={null}>
      {r && !r.account && r.activation_code && (
        <Card style={{ padding: Spacing.lg, gap: Spacing.sm, backgroundColor: Colors.primarySoft, alignItems: 'center' }}>
          <Txt variant="caption" color={Colors.primaryDark}>
            Mã kích hoạt — đưa cho người dân
          </Txt>
          <Txt variant="hero" color={Colors.primaryDark} style={{ letterSpacing: 6, fontFamily: Font.extrabold }} selectable>
            {r.activation_code}
          </Txt>
          {r.activation_expires_at ? (
            <Txt variant="caption" color={Colors.textSecondary}>
              Hạn dùng: {toVnDate(r.activation_expires_at.slice(0, 10))}
            </Txt>
          ) : null}
          <View style={{ flexDirection: 'row', gap: Spacing.sm, alignSelf: 'stretch' }}>
            <Button title="Chia sẻ mã" icon="share-social" onPress={shareCode} style={{ flex: 1 }} />
            <Button title="Cấp lại mã" icon="refresh" variant="secondary" onPress={regen} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      {r && !r.account && (
        <Card style={{ padding: Spacing.lg, gap: Spacing.sm }}>
          <Txt variant="subtitle">Lập tài khoản hộ</Txt>
          <Txt variant="small" color={Colors.textSecondary}>
            Dành cho người chưa dùng được điện thoại: cán bộ tạo tên đăng nhập và mật khẩu rồi trao cho người dân. Tài khoản được kích hoạt ngay.
          </Txt>
          <Button
            title="Tạo tài khoản cho người này"
            icon="person-add"
            variant="secondary"
            onPress={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
          />
        </Card>
      )}

      {r?.account && (
        <Card style={{ padding: Spacing.lg, gap: Spacing.sm }}>
          <Txt variant="subtitle">Tài khoản</Txt>
          <Txt variant="body">
            {ACCOUNT_STATUS_LABEL[r.account.status]}
            {r.account.username ? ` · @${r.account.username}` : ' · đăng nhập Google'}
          </Txt>
          <Button title="Quản lý tài khoản này" variant="secondary" icon="person-circle" onPress={() => router.push({ pathname: '/manage/account/[id]', params: { id: r.account!.id } })} />
        </Card>
      )}

      <Card style={{ padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm }}>
        <Field label="Họ và tên" icon="person-outline" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        <Choice label="Khu" options={data.areas.map((a) => ({ value: a.id, label: a.name }))} value={areaId} onChange={setAreaId} />
        <Field label="Số điện thoại" icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={11} />
        <Field label="Ngày sinh" icon="calendar-outline" placeholder="ngày/tháng/năm" hint="Ví dụ: 05/09/1960" value={birth} onChangeText={setBirth} keyboardType="numbers-and-punctuation" maxLength={10} />
        <Choice<Gender>
          label="Giới tính"
          options={(Object.keys(GENDER_LABEL) as Gender[]).map((g) => ({ value: g, label: GENDER_LABEL[g] }))}
          value={gender}
          onChange={setGender}
        />
        <Field label="Mã hộ gia đình" icon="home-outline" hint="Người cùng mã hộ thuộc cùng một hộ. Mã mới sẽ tạo hộ mới." value={household} onChangeText={setHousehold} autoCapitalize="characters" />
        <Field label="Ghi chú" value={note} onChangeText={setNote} multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 14 }} />
      </Card>

      <FormSheet visible={createOpen} title="Tạo tài khoản" onClose={() => setCreateOpen(false)} onSave={createAccount} saving={creating} saveText="Tạo tài khoản">
        <Txt variant="small" color={Colors.textSecondary}>
          Tài khoản cho {r?.full_name}. Tên đăng nhập viết thường không dấu, ví dụ: nguyenvana
        </Txt>
        <Field label="Tên đăng nhập" value={username} onChangeText={(t) => setUsername(t.toLowerCase())} autoCapitalize="none" autoCorrect={false} />
        <Field label="Mật khẩu" hint="Ít nhất 6 ký tự" value={password} onChangeText={setPassword} secure />
        <Notice text={createError} />
      </FormSheet>

      {saved && <Notice tone="success" text="Đã lưu." />}
      <Notice text={error} />
      <Button title={r ? 'Lưu thay đổi' : 'Thêm nhân khẩu'} icon="checkmark" onPress={save} loading={busy} />
      {r && !r.account && <Button title="Xoá nhân khẩu" variant="dangerOutline" icon="trash" onPress={remove} />}
      <View style={{ height: Spacing.md, borderRadius: Radius.md }} />
    </ScrollPage>
  );
}

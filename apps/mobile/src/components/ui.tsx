import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Font, FontSize, Gradients, Radius, Shadow, Spacing, TouchHeight } from '@/constants/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------------------
// Chữ
// ---------------------------------------------------------------------------

type TxtVariant = 'hero' | 'title' | 'subtitle' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'label';

const txtStyles: Record<TxtVariant, TextStyle> = {
  hero: { fontFamily: Font.extrabold, fontSize: FontSize.hero, lineHeight: 36 },
  title: { fontFamily: Font.bold, fontSize: FontSize.title, lineHeight: 32 },
  subtitle: { fontFamily: Font.semibold, fontSize: FontSize.large, lineHeight: 27 },
  body: { fontFamily: Font.regular, fontSize: FontSize.body, lineHeight: 26 },
  bodyStrong: { fontFamily: Font.semibold, fontSize: FontSize.body, lineHeight: 26 },
  small: { fontFamily: Font.regular, fontSize: FontSize.small, lineHeight: 22 },
  caption: { fontFamily: Font.medium, fontSize: FontSize.caption, lineHeight: 20 },
  label: { fontFamily: Font.semibold, fontSize: FontSize.body, lineHeight: 24 },
};

export function Txt({
  variant = 'body',
  color = Colors.text,
  center,
  style,
  ...rest
}: TextProps & { variant?: TxtVariant; color?: string; center?: boolean }) {
  return (
    <Text style={[txtStyles[variant], { color }, center && { textAlign: 'center' }, style]} {...rest} />
  );
}

// Tương thích với các màn hình cũ
export const Title = (p: TextProps) => <Txt variant="title" {...p} />;
export const Body = ({ muted, ...p }: TextProps & { muted?: boolean }) => (
  <Txt variant="body" color={muted ? Colors.textSecondary : Colors.text} {...p} />
);

// ---------------------------------------------------------------------------
// Khung màn hình
// ---------------------------------------------------------------------------

/** Màn hình có vùng an toàn + cuộn + tránh bàn phím */
export function Screen({
  children,
  scroll = true,
  style,
  edges = ['top', 'left', 'right'],
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const body = <View style={[styles.screenBody, style]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Trang cuộn: header phía trên + nội dung (có thể đè lên header một đoạn `overlap`) */
export function ScrollPage({
  header,
  children,
  overlap = 0,
  refreshControl,
  contentStyle,
}: {
  header: ReactNode;
  children: ReactNode;
  overlap?: number;
  refreshControl?: ComponentProps<typeof ScrollView>['refreshControl'];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: Spacing.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}>
        {header}
        <View style={[{ paddingHorizontal: Spacing.lg, gap: Spacing.md, marginTop: overlap ? -overlap : Spacing.lg }, contentStyle]}>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Header nền gradient xanh, bo cong phía dưới */
export function GradientHeader({
  children,
  colors = Gradients.primary,
  style,
  extraBottom = 0,
}: {
  children: ReactNode;
  colors?: readonly [string, string];
  style?: StyleProp<ViewStyle>;
  /** Chừa thêm khoảng trống dưới để thẻ phía dưới "đè" lên header */
  extraBottom?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + Spacing.md, paddingBottom: Spacing.lg + extraBottom }, style]}>
      {/* Hoạ tiết vòng tròn trang trí */}
      <View pointerEvents="none" style={[styles.bubble, { width: 220, height: 220, top: -70, right: -60 }]} />
      <View pointerEvents="none" style={[styles.bubble, { width: 140, height: 140, bottom: -50, left: -40 }]} />
      {children}
    </LinearGradient>
  );
}

/** Tiêu đề trang đơn giản (cho các tab) */
export function PageHeader({
  title,
  subtitle,
  right,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <GradientHeader>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
        {onBack ? <IconButton icon="arrow-back" label="Quay lại" onPress={onBack} size={44} /> : null}
        <View style={{ flex: 1 }}>
          <Txt variant="title" color={Colors.white}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="small" color="rgba(255,255,255,0.88)">
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {right}
      </View>
    </GradientHeader>
  );
}

// ---------------------------------------------------------------------------
// Nút
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dangerOutline' | 'ghost' | 'light';

const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border: string; shadow?: boolean }> = {
  primary: { bg: Colors.primary, fg: Colors.white, border: Colors.primary, shadow: true },
  secondary: { bg: Colors.card, fg: Colors.primaryText, border: Colors.primaryBorder },
  danger: { bg: Colors.danger, fg: Colors.white, border: Colors.danger, shadow: true },
  dangerOutline: { bg: Colors.card, fg: Colors.danger, border: '#F3C2C2' },
  ghost: { bg: 'transparent', fg: Colors.primaryText, border: 'transparent' },
  light: { bg: 'rgba(255,255,255,0.18)', fg: Colors.white, border: 'rgba(255,255,255,0.35)' },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName | ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const v = buttonVariants[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        v.shadow && !isDisabled && Shadow.sm,
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        isDisabled && { opacity: 0.55 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.buttonInner}>
          {typeof icon === 'string' ? <Ionicons name={icon as IconName} size={22} color={v.fg} /> : icon}
          <Text style={[styles.buttonText, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Nút tròn chỉ có icon */
export function IconButton({
  icon,
  onPress,
  color = Colors.white,
  bg = 'rgba(255,255,255,0.2)',
  size = 48,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  color?: string;
  bg?: string;
  size?: number;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        pressed && { opacity: 0.75 },
      ]}>
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Ô nhập
// ---------------------------------------------------------------------------

export function Field({
  label,
  hint,
  secure,
  icon,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { label: string; hint?: string; secure?: boolean; icon?: IconName }) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="label">{label}</Txt>
      <View style={[styles.inputWrap, focused && styles.inputFocused]}>
        {icon ? <Ionicons name={icon} size={22} color={focused ? Colors.primaryText : Colors.textMuted} /> : null}
        <TextInput
          placeholderTextColor={Colors.textMuted}
          style={[styles.input, style]}
          secureTextEntry={secure && hidden}
          accessibilityLabel={label}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} accessibilityRole="button" accessibilityLabel={hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'} hitSlop={10}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={24} color={Colors.textSecondary} />
          </Pressable>
        )}
      </View>
      {hint ? (
        <Txt variant="small" color={Colors.textSecondary}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Thông báo, thẻ, lựa chọn
// ---------------------------------------------------------------------------

export function Notice({ text, tone = 'danger' }: { text?: string | null; tone?: 'danger' | 'success' | 'warning' | 'info' }) {
  if (!text) return null;
  const map = {
    danger: [Colors.dangerSoft, Colors.danger, 'alert-circle'],
    success: [Colors.successSoft, Colors.success, 'checkmark-circle'],
    warning: [Colors.warningSoft, Colors.warning, 'warning'],
    info: [Colors.infoSoft, Colors.info, 'information-circle'],
  } as const;
  const [bg, fg, icon] = map[tone];
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityLiveRegion="polite">
      <Ionicons name={icon} size={22} color={fg} style={{ marginTop: 2 }} />
      <Txt variant="body" color={fg} style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm }}>
      <Txt variant="subtitle">{title}</Txt>
      {action}
    </View>
  );
}

/** Icon trong vòng tròn màu nhạt */
export function IconCircle({ icon, color, bg, size = 48 }: { icon: IconName; color: string; bg: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

/** Dòng danh sách: icon + tiêu đề + mô tả + phần bên phải */
export function ListRow({
  icon,
  iconColor = Colors.primaryText,
  iconBg = Colors.primarySoft,
  title,
  subtitle,
  right,
  onPress,
  divider = true,
}: {
  icon?: IconName;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  onPress?: () => void;
  divider?: boolean;
}) {
  const content = (
    <View style={[styles.row, divider && styles.rowDivider]}>
      {icon ? <IconCircle icon={icon} color={iconColor} bg={iconBg} size={44} /> : null}
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong">{title}</Txt>
        {subtitle ? (
          <Txt variant="small" color={Colors.textSecondary}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {content}
    </Pressable>
  );
}

/** Nhóm lựa chọn dạng nút lớn (thay cho dropdown, dễ bấm hơn) */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="label">{label}</Txt>
      <View style={styles.choiceWrap}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.choice, selected && styles.choiceSelected]}>
              {selected && <Ionicons name="checkmark" size={18} color={Colors.white} />}
              <Text style={[styles.choiceText, selected && { color: Colors.white }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Chữ viết tắt từ họ tên: "Nguyễn Văn An" -> "VA" */
export function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const pick = parts.length >= 2 ? [parts[parts.length - 2], parts[parts.length - 1]] : [parts[0]];
  return pick.map((p) => p[0]!.toUpperCase()).join('');
}

export function Avatar({ name, size = 52, light }: { name?: string | null; size?: number; light?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: light ? 'rgba(255,255,255,0.25)' : Colors.primarySoft,
        borderWidth: light ? 2 : 0,
        borderColor: 'rgba(255,255,255,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontFamily: Font.bold, fontSize: size * 0.36, color: light ? Colors.white : Colors.primaryText }}>
        {initials(name)}
      </Text>
    </View>
  );
}

/** Nhãn nhỏ dạng viên thuốc */
export function Chip({ text, icon, light }: { text: string; icon?: IconName; light?: boolean }) {
  const fg = light ? Colors.white : Colors.primaryText;
  return (
    <View style={[styles.chip, { backgroundColor: light ? 'rgba(255,255,255,0.2)' : Colors.primarySoft }]}>
      {icon ? <Ionicons name={icon} size={15} color={fg} /> : null}
      <Text style={{ fontFamily: Font.semibold, fontSize: FontSize.caption, color: fg }}>{text}</Text>
    </View>
  );
}

/** Trạng thái trống */
export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={48} color={Colors.primary} />
      </View>
      <Txt variant="subtitle" center>
        {title}
      </Txt>
      {message ? (
        <Txt variant="body" color={Colors.textSecondary} center>
          {message}
        </Txt>
      ) : null}
      {action}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  screenBody: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  header: {
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    overflow: 'hidden',
  },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)' },
  button: {
    minHeight: TouchHeight,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  buttonText: { fontFamily: Font.bold, fontSize: FontSize.large },
  inputWrap: {
    minHeight: TouchHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
  },
  inputFocused: { borderColor: Colors.primary, backgroundColor: '#FBFEFC' },
  input: {
    flex: 1,
    minHeight: TouchHeight - 4,
    fontFamily: Font.medium,
    fontSize: FontSize.large,
    color: Colors.text,
    paddingVertical: 0,
  },
  notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: Radius.md },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  choice: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.card,
  },
  choiceSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  choiceText: { fontFamily: Font.semibold, fontSize: FontSize.body, color: Colors.primaryText },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full, alignSelf: 'flex-start' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  emptyIcon: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
});

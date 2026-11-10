import { ComingSoon } from '@/components/coming-soon';

export default function Screen() {
  return (
    <ComingSoon
      title="Thông báo"
      subtitle="Tin tức và thông báo từ thôn"
      icon="notifications-outline"
      message="Thông báo của thôn sẽ hiện ở đây, kèm nhắc nhở khi có tin mới."
    />
  );
}

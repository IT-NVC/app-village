import { GoogleOutlined, HomeFilled, LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Divider, Flex, Form, Input, Typography } from 'antd';
import { useState } from 'react';

import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFinish(v: { username: string; password: string }) {
    setBusy(true);
    setError(null);
    const err = await signIn(v.username, v.password);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <Flex align="center" justify="center" style={{ minHeight: '100%', padding: 16 }}>
      <Card style={{ width: 400, maxWidth: '100%' }}>
        <Flex vertical align="center" gap={4} style={{ marginBottom: 24 }}>
          <HomeFilled style={{ fontSize: 40, color: '#3BA56A' }} />
          <Typography.Title level={3} style={{ margin: 0 }}>
            Thôn Thống Nhất
          </Typography.Title>
          <Typography.Text type="secondary">Trang quản trị · Xã Sóc Sơn</Typography.Text>
        </Flex>
        <Button
          block
          size="large"
          icon={<GoogleOutlined />}
          onClick={async () => {
            const err = await signInWithGoogle();
            if (err) setError(err);
          }}>
          Đăng nhập bằng Google
        </Button>
        <Divider plain>hoặc</Divider>
        <Form layout="vertical" size="large" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
            <Input prefix={<UserOutlined />} autoComplete="username" autoFocus />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          {error && <Alert type="error" title={error} style={{ marginBottom: 16 }} showIcon />}
          <Button type="primary" htmlType="submit" block loading={busy}>
            Đăng nhập
          </Button>
        </Form>
      </Card>
    </Flex>
  );
}

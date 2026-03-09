import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import SomiLogo from '../components/SomiLogo';

const { Title } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
}

interface MfaFormValues {
  code: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, completeMfa } = useAuth();
  const [loading, setLoading] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  async function handleLogin(values: LoginFormValues) {
    setLoading(true);
    try {
      const result = await login(values.email, values.password);
      if ('mfaRequired' in result && result.mfaRequired) {
        setChallengeId(result.challengeId);
      } else {
        navigate('/patients', { replace: true });
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Login failed. Please try again.';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(values: MfaFormValues) {
    if (!challengeId) return;
    setLoading(true);
    try {
      await completeMfa(challengeId, values.code);
      navigate('/patients', { replace: true });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Invalid code. Please try again.';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--somi-mint-bg)',
        gap: 16,
      }}
    >
      <SomiLogo size={72} showText />
      <p className="somi-section-label" style={{ textAlign: 'center', margin: 0 }}>
        Speech - Ortho-Airway - Myofunctional - Integration
      </p>

      <Card style={{ width: 380, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginTop: 8 }}>
        <Title level={4} style={{ textAlign: 'center', marginBottom: 24 }}>
          Sign In
        </Title>

        {!challengeId ? (
          <Form layout="vertical" onFinish={handleLogin} requiredMark={false}>
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Please enter a valid email' },
              ]}
            >
              <Input placeholder="you@example.com" autoComplete="email" />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input.Password placeholder="Password" autoComplete="current-password" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                Sign In
              </Button>
            </Form.Item>
          </Form>
        ) : (
          <Form layout="vertical" onFinish={handleMfa} requiredMark={false}>
            <Title level={5} style={{ marginBottom: 16 }}>
              Two-Factor Authentication
            </Title>
            <Form.Item
              label="Authentication Code"
              name="code"
              rules={[
                { required: true, message: 'Please enter your authentication code' },
                { len: 6, message: 'Code must be 6 digits' },
              ]}
            >
              <Input
                placeholder="000000"
                maxLength={6}
                autoComplete="one-time-code"
                inputMode="numeric"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                Verify
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  );
}

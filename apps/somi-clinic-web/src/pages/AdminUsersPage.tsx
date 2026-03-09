import { useState, useEffect } from 'react';
import {
  Button,
  Input,
  Select,
  Form,
  Tag,
  Space,
  message,
  Popconfirm,
} from 'antd';
import { UserAddOutlined, DeleteOutlined, LockOutlined, CheckOutlined } from '@ant-design/icons';
import {
  listUsers,
  inviteUser,
  disableUser,
  enableUser,
  resetMfa,
} from '../api/admin';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import StatusTag from '../components/StatusTag';

interface InviteFormValues {
  email: string;
  role: 'therapist' | 'admin';
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm<InviteFormValues>();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await listUsers({ limit: 100 });
      setUsers(response.items);
    } catch (error) {
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchUsers();
  }, [user]);

  const handleInviteUser = async (values: InviteFormValues) => {
    try {
      await inviteUser({
        email: values.email,
        role: values.role,
      });
      message.success('User invited successfully');
      form.resetFields();
      setIsModalVisible(false);
      fetchUsers();
    } catch (error) {
      message.error('Failed to invite user');
    }
  };

  const handleDisableUser = async (userId: string) => {
    try {
      await disableUser(userId);
      message.success('User disabled successfully');
      fetchUsers();
    } catch (error) {
      message.error('Failed to disable user');
    }
  };

  const handleEnableUser = async (userId: string) => {
    try {
      await enableUser(userId);
      message.success('User enabled successfully');
      fetchUsers();
    } catch (error) {
      message.error('Failed to enable user');
    }
  };

  const handleResetMfa = async (userId: string) => {
    try {
      await resetMfa(userId);
      message.success('MFA reset successfully');
      fetchUsers();
    } catch (error) {
      message.error('Failed to reset MFA');
    }
  };

  const columns = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const colors: Record<string, string> = {
          admin: 'blue',
          therapist: 'green',
          client: 'default',
        };
        return <Tag color={colors[role] || 'default'}>{role}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusTag status={status} />,
    },
    {
      title: 'MFA',
      dataIndex: 'mfaEnabled',
      key: 'mfaEnabled',
      render: (mfaEnabled: boolean) => (
        <Tag color={mfaEnabled ? 'green' : 'default'}>
          {mfaEnabled ? 'enabled' : 'disabled'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: User) => (
        <Space>
          {record.status === 'disabled' ? (
            <Popconfirm
              title="Enable User"
              description={`Are you sure you want to enable ${record.email}?`}
              onConfirm={() => handleEnableUser(record.userId)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                size="small"
                icon={<CheckOutlined />}
              >
                Enable
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="Disable User"
              description={`Are you sure you want to disable ${record.email}?`}
              onConfirm={() => handleDisableUser(record.userId)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
              >
                Disable
              </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title="Reset MFA"
            description={`Are you sure you want to reset MFA for ${record.email}?`}
            onConfirm={() => handleResetMfa(record.userId)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              size="small"
              icon={<LockOutlined />}
            >
              Reset MFA
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="User Management"
        actions={
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => setIsModalVisible(true)}
          >
            Invite User
          </Button>
        }
      />

      <DataTable
        columns={columns}
        dataSource={users}
        rowKey="userId"
        loading={loading}
        pagination={false}
      />

      <FormModal
        title="Invite User"
        open={isModalVisible}
        onOk={form.submit}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        okText="OK"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleInviteUser}
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input placeholder="user@example.com" />
          </Form.Item>
          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Role is required' }]}
          >
            <Select
              options={[
                { label: 'Therapist', value: 'therapist' },
                { label: 'Admin', value: 'admin' },
              ]}
            />
          </Form.Item>
        </Form>
      </FormModal>
    </>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Form,
  Space,
  Segmented,
  Modal,
  message,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { listPatients, createPatient, reactivatePatient } from '../api/patients';
import { useAuth } from '../contexts/AuthContext';
import type { Patient, CreatePatientParams } from '../types';
import PageHeader from '../components/PageHeader';
import StatusTag from '../components/StatusTag';
import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';

export default function PatientListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive'>('active');

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<CreatePatientParams>();

  const fetchPatients = useCallback(async (searchValue: string, status: string) => {
    setLoading(true);
    try {
      const result = await listPatients({ search: searchValue || undefined, status, limit: 100 });
      setPatients(result.items);
    } catch {
      message.error('Failed to load patients.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch when user is authenticated
  useEffect(() => {
    if (!user) return;
    fetchPatients('', statusFilter);
  }, [user, fetchPatients]);

  // Debounced re-fetch when search or status filter changes
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      fetchPatients(search, statusFilter);
    }, 400);
    return () => clearTimeout(timer);
  }, [user, search, statusFilter, fetchPatients]);

  const handleCreate = async (values: CreatePatientParams) => {
    setSubmitting(true);
    try {
      await createPatient(values as any);
      message.success('Patient created successfully.');
      setModalOpen(false);
      form.resetFields();
      fetchPatients(search, statusFilter);
    } catch (error: any) {
      if (error?.details?.code === 'INACTIVE_PATIENT_EXISTS') {
        const existingPatientId = error.details.existingPatientId;
        Modal.confirm({
          title: 'Inactive Patient Found',
          content: 'A patient with that email already exists but is inactive. Would you like to reactivate them?',
          okText: 'Reactivate',
          cancelText: 'Cancel',
          onOk: async () => {
            try {
              await reactivatePatient(existingPatientId);
              message.success('Patient reactivated successfully.');
              setModalOpen(false);
              form.resetFields();
              setStatusFilter('active');
              fetchPatients(search, 'active');
            } catch {
              message.error('Failed to reactivate patient.');
            }
          },
        });
      } else {
        message.error(error?.message || 'Failed to create patient.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const columns: TableColumnsType<Patient> = [
    {
      title: 'Display Name',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: Patient['status']) => <StatusTag status={status} />,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      responsive: ['md'],
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: Patient) => (
        <Button
          type="link"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/patients/${record.patientId}`);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Patients"
        actions={
          <Space wrap>
            <Input.Search
              placeholder="Search patients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={(val) => {
                setSearch(val);
              }}
              allowClear
              style={{ width: '100%', maxWidth: 320, minWidth: 180 }}
            />
            <Button type="primary" onClick={() => setModalOpen(true)}>
              New Patient
            </Button>
          </Space>
        }
      />

      <Segmented
        value={statusFilter}
        onChange={(val) => setStatusFilter(val as 'active' | 'inactive')}
        options={[
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ]}
        style={{ marginBottom: 16 }}
      />

      <DataTable<Patient>
        rowKey="patientId"
        columns={columns}
        dataSource={patients}
        loading={loading}
        onRow={(record) => ({
          onClick: () => navigate(`/patients/${record.patientId}`),
          style: { cursor: 'pointer' },
        })}
      />

      <FormModal
        title="New Patient"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Create"
        confirmLoading={submitting}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="displayName"
            label="Display Name"
            rules={[{ required: true, message: 'Please enter a display name.' }]}
          >
            <Input placeholder="e.g. Jane Smith" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter an email address.' },
              { type: 'email', message: 'Please enter a valid email address.' },
            ]}
          >
            <Input placeholder="e.g. jane@example.com" />
          </Form.Item>
        </Form>
      </FormModal>
    </>
  );
}

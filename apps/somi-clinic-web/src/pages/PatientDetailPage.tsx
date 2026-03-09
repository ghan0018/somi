import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Form,
  Space,
  Spin,
  message,
  Descriptions,
  Tabs,
  Select,
} from 'antd';
import { getPatient, updatePatient } from '../api/patients';
import { useAuth } from '../contexts/AuthContext';
import type { Patient, UpdatePatientParams } from '../types';
import PageHeader from '../components/PageHeader';
import StatusTag from '../components/StatusTag';
import FormModal from '../components/FormModal';

export default function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<UpdatePatientParams>();

  const fetchPatient = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(false);
    try {
      const data = await getPatient(patientId);
      setPatient(data);
    } catch {
      setError(true);
      message.error('Failed to load patient.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (!user) return;
    fetchPatient();
  }, [user, fetchPatient]);

  const handleEditOpen = () => {
    if (!patient) return;
    form.setFieldsValue({
      displayName: patient.displayName,
      status: patient.status,
    });
    setEditModalOpen(true);
  };

  const handleEditSave = async (values: UpdatePatientParams) => {
    if (!patientId) return;
    setSaving(true);
    try {
      const updated = await updatePatient(patientId, values);
      setPatient(updated);
      message.success('Patient updated successfully.');
      setEditModalOpen(false);
    } catch {
      message.error('Failed to update patient.');
    } finally {
      setSaving(false);
    }
  };

  const generalTab = patient ? (
    <Descriptions
      bordered
      column={1}
      style={{ marginBottom: 16 }}
    >
      <Descriptions.Item label="Display Name">{patient.displayName}</Descriptions.Item>
      <Descriptions.Item label="Status">
        <StatusTag status={patient.status} />
      </Descriptions.Item>
      <Descriptions.Item label="Patient ID">{patient.patientId}</Descriptions.Item>
      <Descriptions.Item label="Created">
        {new Date(patient.createdAt).toLocaleDateString()}
      </Descriptions.Item>
      <Descriptions.Item label="Updated">
        {new Date(patient.updatedAt).toLocaleDateString()}
      </Descriptions.Item>
    </Descriptions>
  ) : null;

  const tabItems = [
    { key: 'general', label: 'General', children: generalTab },
    { key: 'plan', label: 'Plan', children: <p>Treatment plan coming soon.</p> },
    { key: 'progress', label: 'Progress', children: <p>Progress tracking coming soon.</p> },
    { key: 'messages', label: 'Messages', children: <p>Messages coming soon.</p> },
    { key: 'notes', label: 'Notes', children: <p>Notes coming soon.</p> },
  ];

  if (loading) {
    return (
      <Space style={{ padding: 48, width: '100%', justifyContent: 'center' }}>
        <Spin size="large" />
      </Space>
    );
  }

  if (error || !patient) {
    return (
      <>
        <Button onClick={() => navigate('/patients')} style={{ marginBottom: 16 }}>
          Back to Patients
        </Button>
        <p>Could not load patient data.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={patient.displayName}
        breadcrumbs={[
          { label: 'Patients', href: '/patients' },
          { label: patient.displayName },
        ]}
        actions={
          <Space wrap>
            <Button onClick={() => navigate('/patients')}>Back to Patients</Button>
            <Button type="primary" onClick={handleEditOpen}>
              Edit
            </Button>
          </Space>
        }
      />

      <Tabs defaultActiveKey="general" items={tabItems} />

      <FormModal
        title="Edit Patient"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => form.submit()}
        okText="Save"
        confirmLoading={saving}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEditSave}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="displayName"
            label="Display Name"
            rules={[{ required: true, message: 'Please enter a display name.' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select>
              <Select.Option value="active">Active</Select.Option>
              <Select.Option value="inactive">Inactive</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </FormModal>
    </>
  );
}

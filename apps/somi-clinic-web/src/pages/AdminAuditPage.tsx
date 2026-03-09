import { useState, useEffect } from 'react';
import {
  Input,
  Button,
  Select,
  Space,
  message,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { queryAudit } from '../api/admin';
import { useAuth } from '../contexts/AuthContext';
import { AuditEvent } from '../types';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';

// ---------------------------------------------------------------------------
// Action type options for the dropdown filter (matches AuditAction in backend)
// ---------------------------------------------------------------------------
const ACTION_TYPE_OPTIONS = [
  // Auth
  { label: 'auth.login', value: 'auth.login' },
  { label: 'auth.logout', value: 'auth.logout' },
  { label: 'auth.mfa_verify', value: 'auth.mfa_verify' },
  { label: 'auth.refresh', value: 'auth.refresh' },
  // Patient
  { label: 'patient.read', value: 'patient.read' },
  { label: 'patient.create', value: 'patient.create' },
  { label: 'patient.update', value: 'patient.update' },
  // Plan
  { label: 'plan.read', value: 'plan.read' },
  { label: 'plan.create', value: 'plan.create' },
  { label: 'plan.update', value: 'plan.update' },
  { label: 'plan.publish', value: 'plan.publish' },
  { label: 'plan.archive', value: 'plan.archive' },
  // Exercise
  { label: 'exercise.read', value: 'exercise.read' },
  { label: 'exercise.create', value: 'exercise.create' },
  { label: 'exercise.update', value: 'exercise.update' },
  { label: 'exercise.archive', value: 'exercise.archive' },
  // Completion
  { label: 'completion.read', value: 'completion.read' },
  { label: 'completion.create', value: 'completion.create' },
  // Adherence
  { label: 'adherence.read', value: 'adherence.read' },
  // Timeline
  { label: 'timeline.read', value: 'timeline.read' },
  // Message
  { label: 'message.read', value: 'message.read' },
  { label: 'message.create', value: 'message.create' },
  // Upload
  { label: 'upload.create', value: 'upload.create' },
  { label: 'upload.complete', value: 'upload.complete' },
  // Media
  { label: 'media.access', value: 'media.access' },
  // Feedback
  { label: 'feedback.read', value: 'feedback.read' },
  { label: 'feedback.create', value: 'feedback.create' },
  // Notes
  { label: 'note.read', value: 'note.read' },
  { label: 'note.create', value: 'note.create' },
  // Admin
  { label: 'admin.user_create', value: 'admin.user_create' },
  { label: 'admin.user_disable', value: 'admin.user_disable' },
  { label: 'admin.user_enable', value: 'admin.user_enable' },
  { label: 'admin.mfa_reset', value: 'admin.mfa_reset' },
  { label: 'admin.audit_read', value: 'admin.audit_read' },
];

export default function AdminAuditPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionTypeFilter, setActionTypeFilter] = useState<string | undefined>(undefined);
  const [patientIdFilter, setPatientIdFilter] = useState('');
  const [actorEmailFilter, setActorEmailFilter] = useState('');

  const fetchAuditEvents = async (actionType?: string, patientId?: string, actorEmail?: string) => {
    setLoading(true);
    try {
      const response = await queryAudit({
        actionType: actionType || undefined,
        patientId: patientId || undefined,
        actorEmail: actorEmail || undefined,
        limit: 100,
      });
      setEvents(response.items);
    } catch (error) {
      message.error('Failed to load audit events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchAuditEvents();
  }, [user]);

  const handleSearch = () => {
    fetchAuditEvents(actionTypeFilter, patientIdFilter, actorEmailFilter);
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (timestamp: string) => formatTimestamp(timestamp),
    },
    {
      title: 'Actor',
      key: 'actor',
      width: 200,
      render: (_: unknown, record: AuditEvent) =>
        record.actorEmail || record.actorUserId,
    },
    {
      title: 'Role',
      dataIndex: 'actorRole',
      key: 'actorRole',
      width: 100,
    },
    {
      title: 'Action',
      dataIndex: 'actionType',
      key: 'actionType',
      width: 150,
    },
    {
      title: 'Resource',
      key: 'resource',
      width: 200,
      render: (_: unknown, record: AuditEvent) =>
        `${record.resourceType} ${record.resourceId}`,
    },
    {
      title: 'Patient ID',
      dataIndex: 'patientId',
      key: 'patientId',
      width: 150,
      render: (patientId?: string) => patientId || '-',
    },
  ];

  return (
    <>
      <PageHeader title="Audit Log" />

      <Space wrap className="somi-filter-row" style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Select
          allowClear
          showSearch
          placeholder="Filter by action type"
          value={actionTypeFilter}
          onChange={(value) => setActionTypeFilter(value)}
          options={ACTION_TYPE_OPTIONS}
          style={{ width: '100%', maxWidth: 220, minWidth: 180 }}
        />
        <Input
          placeholder="Filter by actor email"
          value={actorEmailFilter}
          onChange={(e) => setActorEmailFilter(e.target.value)}
          style={{ width: '100%', maxWidth: 200, minWidth: 140 }}
        />
        <Input
          placeholder="Filter by patient ID"
          value={patientIdFilter}
          onChange={(e) => setPatientIdFilter(e.target.value)}
          style={{ width: '100%', maxWidth: 200, minWidth: 140 }}
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={handleSearch}
        >
          Search
        </Button>
      </Space>

      <DataTable
        columns={columns}
        dataSource={events}
        rowKey="auditId"
        loading={loading}
        pageSize={20}
        pagination={{
          total: events.length,
        }}
        scroll={{ x: 1200 }}
      />
    </>
  );
}

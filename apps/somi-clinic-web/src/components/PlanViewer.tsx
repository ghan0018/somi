import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Space,
  Collapse,
  Table,
  Tag,
  Typography,
  Alert,
  Modal,
  Switch,
  Tooltip,
  message,
} from 'antd';
import {
  EditOutlined,
  CheckCircleOutlined,
  StopOutlined,
  PlusOutlined,
  StepForwardOutlined,
} from '@ant-design/icons';
import {
  publishPlan,
  archivePlan,
  advanceSession,
  revertToDraft,
  updatePlanSettings,
} from '../api/plans';
import type { TreatmentPlan, Session, Assignment } from '../types';
import StatusTag from './StatusTag';
import useIsMobile from '../hooks/useIsMobile';

interface PlanViewerProps {
  plan: TreatmentPlan;
  patientId: string;
  onRefresh: () => void;
}

/**
 * Read-only display for an existing treatment plan.
 *
 * Shows plan status, action buttons (edit/publish/archive), and a collapsible
 * list of sessions with their assignment tables.
 */
export default function PlanViewer({
  plan,
  patientId,
  onRefresh,
}: PlanViewerProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [actionLoading, setActionLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handlePublish = () => {
    Modal.confirm({
      title: 'Publish Plan',
      content:
        'Publishing will make this plan visible to the patient. Are you sure?',
      okText: 'Yes, Publish',
      cancelText: 'Cancel',
      onOk: async () => {
        setActionLoading(true);
        try {
          await publishPlan(patientId, plan.planId);
          message.success('Plan published successfully.');
          onRefresh();
        } catch {
          message.error('Failed to publish plan.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleArchive = () => {
    Modal.confirm({
      title: 'Archive Plan',
      content:
        'Are you sure you want to archive this plan? The patient will no longer see it.',
      okText: 'Yes, Archive',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        setActionLoading(true);
        try {
          await archivePlan(patientId, plan.planId);
          message.success('Plan archived.');
          onRefresh();
        } catch {
          message.error('Failed to archive plan.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleRemindersToggle = async (checked: boolean) => {
    try {
      await updatePlanSettings(patientId, plan.planId, {
        remindersEnabled: checked,
      });
      message.success(checked ? 'Reminders enabled.' : 'Reminders disabled.');
      onRefresh();
    } catch {
      message.error('Failed to update reminders setting.');
    }
  };

  const handleAdvanceSession = () => {
    Modal.confirm({
      title: 'Advance to Next Session',
      content:
        'This will move the patient to the next session in their treatment plan. Are you sure?',
      okText: 'Yes, Advance',
      cancelText: 'Cancel',
      onOk: async () => {
        setActionLoading(true);
        try {
          await advanceSession(patientId, plan.planId);
          message.success('Advanced to next session.');
          onRefresh();
        } catch {
          message.error('Failed to advance session.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleRevertToDraft = () => {
    Modal.confirm({
      title: 'Edit Published Plan',
      content:
        'This will unpublish the plan and revert it to draft status. The patient will no longer see it until you re-publish.',
      okText: 'Yes, Revert to Draft',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        setActionLoading(true);
        try {
          await revertToDraft(patientId, plan.planId);
          message.success('Plan reverted to draft.');
          onRefresh();
        } catch {
          message.error('Failed to revert plan.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // ---------------------------------------------------------------------------
  // Assignment table columns
  // ---------------------------------------------------------------------------

  const assignmentColumns = [
    {
      title: 'Exercise',
      key: 'exercise',
      render: (_: unknown, record: Assignment) =>
        record.exercise?.title ?? record.exerciseId,
    },
    {
      title: 'Reps',
      key: 'reps',
      width: 70,
      render: (_: unknown, record: Assignment) => {
        const params = record.effectiveParams ?? record.paramsOverride ?? {};
        return params.reps ?? '—';
      },
    },
    {
      title: 'Sets',
      key: 'sets',
      width: 70,
      render: (_: unknown, record: Assignment) => {
        const params = record.effectiveParams ?? record.paramsOverride ?? {};
        return params.sets ?? '—';
      },
    },
    {
      title: 'Seconds',
      key: 'seconds',
      width: 80,
      render: (_: unknown, record: Assignment) => {
        const params = record.effectiveParams ?? record.paramsOverride ?? {};
        return params.seconds ?? '—';
      },
    },
  ];

  // ---------------------------------------------------------------------------
  // Session panels
  // ---------------------------------------------------------------------------

  const sessionPanels = plan.sessions.map((session: Session) => {
    const isActive =
      plan.status === 'published' &&
      session.index === (plan.activeSessionIndex ?? 0);
    const isLastSession = session.index === plan.sessions.length - 1;

    return {
      key: session.sessionKey,
      label: (
        <Space>
          <Typography.Text strong>
            {session.title || `Session ${session.index + 1}`}
          </Typography.Text>
          {isActive && <Tag color="#6DB6B0">Current</Tag>}
          <Typography.Text type="secondary">
            {session.assignments.length} exercise
            {session.assignments.length !== 1 ? 's' : ''} ·{' '}
            {session.timesPerDay}×/day
          </Typography.Text>
        </Space>
      ),
      style: isActive
        ? { borderLeft: '3px solid #6DB6B0' }
        : undefined,
      children: (
        <div>
          {session.sessionNotes && (
            <Alert
              type="info"
              showIcon
              title="Session Notes"
              description={session.sessionNotes}
              style={{ marginBottom: 16 }}
            />
          )}
          <Table
            rowKey="assignmentKey"
            columns={assignmentColumns}
            dataSource={session.assignments}
            pagination={false}
            size="small"
            scroll={{ x: isMobile ? 'max-content' : undefined }}
          />
          {isActive && !isLastSession && (
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Button
                icon={<StepForwardOutlined />}
                onClick={handleAdvanceSession}
                loading={actionLoading}
                size="small"
              >
                Advance to Next Session
              </Button>
            </div>
          )}
        </div>
      ),
    };
  });

  // ---------------------------------------------------------------------------
  // Action buttons
  // ---------------------------------------------------------------------------

  const actions = (
    <Space wrap>
      {plan.status === 'draft' && (
        <>
          <Button
            icon={<EditOutlined />}
            onClick={() =>
              navigate(`/patients/${patientId}/plan/${plan.planId}/edit`)
            }
            disabled={actionLoading}
          >
            Edit Draft
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handlePublish}
            loading={actionLoading}
          >
            Publish
          </Button>
        </>
      )}
      {plan.status === 'published' && (
        <Button
          icon={<EditOutlined />}
          onClick={handleRevertToDraft}
          disabled={actionLoading}
        >
          Edit Plan
        </Button>
      )}
      {(plan.status === 'draft' || plan.status === 'published') && (
        <Button
          danger
          icon={<StopOutlined />}
          onClick={handleArchive}
          loading={actionLoading}
        >
          Archive
        </Button>
      )}
      {plan.status === 'archived' && (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate(`/patients/${patientId}/plan/new`)}
        >
          Create New Plan
        </Button>
      )}
    </Space>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      {/* Header row: status + actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Space>
          <StatusTag status={plan.status} />
          {plan.status === 'published' && (
            <Tooltip title="When enabled, the patient will receive push notifications reminding them to complete their daily exercises.">
              <Space>
                <Typography.Text type="secondary">Reminders:</Typography.Text>
                <Switch
                  checked={plan.remindersEnabled}
                  onChange={handleRemindersToggle}
                  size="small"
                />
              </Space>
            </Tooltip>
          )}
        </Space>
        {actions}
      </div>

      {/* Session accordion */}
      <Collapse
        items={sessionPanels}
        defaultActiveKey={plan.sessions.map(
          (s: Session) => s.sessionKey,
        )}
      />
    </div>
  );
}

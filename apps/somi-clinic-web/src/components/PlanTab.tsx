import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Spin, Space, message } from 'antd';
import { FileAddOutlined } from '@ant-design/icons';
import { getTherapistPlan } from '../api/plans';
import type { TreatmentPlan } from '../types';
import EmptyState from './EmptyState';
import PlanViewer from './PlanViewer';

interface PlanTabProps {
  patientId: string;
}

/**
 * Content for the "Plan" tab on the PatientDetailPage.
 *
 * Fetches the current treatment plan for the given patient and renders
 * either:
 * - An empty state with a "Create Plan" CTA (no plan exists)
 * - A PlanViewer showing the plan details with action buttons
 */
export default function PlanTab({ patientId }: PlanTabProps) {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<TreatmentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getTherapistPlan(patientId);
      setPlan(data);
    } catch {
      setError(true);
      message.error('Failed to load treatment plan.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  if (loading) {
    return (
      <Space
        style={{ padding: 48, width: '100%', justifyContent: 'center' }}
      >
        <Spin size="large" />
      </Space>
    );
  }

  if (error) {
    return <p>Could not load treatment plan.</p>;
  }

  if (!plan) {
    return (
      <EmptyState
        icon={<FileAddOutlined />}
        title="No Treatment Plan"
        description="Create a treatment plan to assign exercises to this patient."
        action={
          <Button
            type="primary"
            onClick={() => navigate(`/patients/${patientId}/plan/new`)}
          >
            Create Plan
          </Button>
        }
      />
    );
  }

  return <PlanViewer plan={plan} patientId={patientId} onRefresh={fetchPlan} />;
}

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
  Spin,
  Modal,
  message,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { getTherapistPlan, createPlan, replacePlan } from '../api/plans';
import { getAccessUrl } from '../api/uploads';
import type { TreatmentPlan, Exercise, SessionInput } from '../types';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import ExercisePickerModal from '../components/ExercisePickerModal';
import useIsMobile from '../hooks/useIsMobile';

// ---------------------------------------------------------------------------
// Local types for the builder form state
// ---------------------------------------------------------------------------

interface BuilderAssignment {
  key: string;
  exerciseId: string;
  exerciseTitle: string;
  mediaId?: string;
  reps?: number;
  sets?: number;
  seconds?: number;
}

interface BuilderSession {
  key: string;
  title: string;
  timesPerDay: 1 | 2 | 3;
  sessionNotes: string;
  assignments: BuilderAssignment[];
}

// Simple incrementing key for React list rendering
let keyCounter = 0;
function nextKey(): string {
  return `k_${++keyCounter}`;
}

function emptySession(index: number): BuilderSession {
  return {
    key: nextKey(),
    title: `Session ${index + 1}`,
    timesPerDay: 1,
    sessionNotes: '',
    assignments: [],
  };
}

// ---------------------------------------------------------------------------
// PlanBuilderPage
// ---------------------------------------------------------------------------

export default function PlanBuilderPage() {
  const { patientId, planId } = useParams<{
    patientId: string;
    planId?: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isEdit = Boolean(planId);

  const [sessions, setSessions] = useState<BuilderSession[]>([
    emptySession(0),
  ]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Exercise picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSessionKey, setPickerSessionKey] = useState<string | null>(null);

  // Video preview state
  const [videoPreview, setVideoPreview] = useState<{
    title: string;
    mediaId: string;
  } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Load existing plan (edit mode)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isEdit || !patientId || !user) return;

    setLoading(true);
    getTherapistPlan(patientId)
      .then((plan: TreatmentPlan | null) => {
        if (!plan || plan.planId !== planId) {
          message.error('Plan not found.');
          navigate(`/patients/${patientId}`);
          return;
        }
        if (plan.status !== 'draft') {
          message.error('Only draft plans can be edited.');
          navigate(`/patients/${patientId}`);
          return;
        }

        // Populate builder state from the enriched plan
        const builderSessions: BuilderSession[] = plan.sessions.map((s) => ({
          key: nextKey(),
          title: s.title || `Session ${s.index + 1}`,
          timesPerDay: s.timesPerDay,
          sessionNotes: s.sessionNotes || '',
          assignments: s.assignments.map((a) => ({
            key: nextKey(),
            exerciseId: a.exerciseId,
            exerciseTitle: a.exercise?.title ?? a.exerciseId,
            mediaId: a.exercise?.mediaId,
            reps: a.effectiveParams?.reps ?? a.paramsOverride?.reps,
            sets: a.effectiveParams?.sets ?? a.paramsOverride?.sets,
            seconds: a.effectiveParams?.seconds ?? a.paramsOverride?.seconds,
          })),
        }));
        setSessions(builderSessions);
      })
      .catch(() => {
        message.error('Failed to load plan.');
        navigate(`/patients/${patientId}`);
      })
      .finally(() => setLoading(false));
  }, [isEdit, patientId, planId, user, navigate]);

  const markDirty = useCallback(() => setDirty(true), []);

  // -------------------------------------------------------------------------
  // Session CRUD
  // -------------------------------------------------------------------------

  const addSession = () => {
    setSessions((prev) => [...prev, emptySession(prev.length)]);
    markDirty();
  };

  const removeSession = (sessionKey: string) => {
    setSessions((prev) => prev.filter((s) => s.key !== sessionKey));
    markDirty();
  };

  const moveSession = (sessionKey: string, direction: 'up' | 'down') => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.key === sessionKey);
      if (idx < 0) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
    markDirty();
  };

  const updateSession = (
    sessionKey: string,
    updates: Partial<BuilderSession>,
  ) => {
    setSessions((prev) =>
      prev.map((s) => (s.key === sessionKey ? { ...s, ...updates } : s)),
    );
    markDirty();
  };

  // -------------------------------------------------------------------------
  // Assignment CRUD
  // -------------------------------------------------------------------------

  const openExercisePicker = (sessionKey: string) => {
    setPickerSessionKey(sessionKey);
    setPickerOpen(true);
  };

  const handleExerciseSelected = (exercise: Exercise) => {
    if (!pickerSessionKey) return;

    const newAssignment: BuilderAssignment = {
      key: nextKey(),
      exerciseId: exercise.exerciseId,
      exerciseTitle: exercise.title,
      mediaId: exercise.mediaId,
      reps: exercise.defaultParams?.reps,
      sets: exercise.defaultParams?.sets,
      seconds: exercise.defaultParams?.seconds,
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.key === pickerSessionKey
          ? { ...s, assignments: [...s.assignments, newAssignment] }
          : s,
      ),
    );
    setPickerOpen(false);
    setPickerSessionKey(null);
    markDirty();
  };

  const removeAssignment = (sessionKey: string, assignmentKey: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.key === sessionKey
          ? {
              ...s,
              assignments: s.assignments.filter(
                (a) => a.key !== assignmentKey,
              ),
            }
          : s,
      ),
    );
    markDirty();
  };

  const updateAssignment = (
    sessionKey: string,
    assignmentKey: string,
    updates: Partial<BuilderAssignment>,
  ) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.key === sessionKey
          ? {
              ...s,
              assignments: s.assignments.map((a) =>
                a.key === assignmentKey ? { ...a, ...updates } : a,
              ),
            }
          : s,
      ),
    );
    markDirty();
  };

  // -------------------------------------------------------------------------
  // Video preview
  // -------------------------------------------------------------------------

  const openVideoPreview = async (title: string, mediaId: string) => {
    setVideoPreview({ title, mediaId });
    setVideoUrl(null);
    setVideoLoading(true);
    try {
      const res = await getAccessUrl(mediaId);
      setVideoUrl(res.accessUrl);
    } catch {
      message.error('Failed to load video.');
      setVideoPreview(null);
    } finally {
      setVideoLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------

  const handleSave = async () => {
    if (!patientId) return;

    // Validation
    if (sessions.length === 0) {
      message.warning('Please add at least one session.');
      return;
    }
    for (const s of sessions) {
      if (s.assignments.length === 0) {
        message.warning(
          `"${s.title || 'Untitled session'}" has no exercises. Please add at least one.`,
        );
        return;
      }
    }

    // Build API payload
    const payload: SessionInput[] = sessions.map((s) => ({
      title: s.title || undefined,
      sessionNotes: s.sessionNotes || undefined,
      timesPerDay: s.timesPerDay,
      assignments: s.assignments.map((a) => {
        const paramsOverride: Record<string, number> = {};
        if (a.reps != null) paramsOverride.reps = a.reps;
        if (a.sets != null) paramsOverride.sets = a.sets;
        if (a.seconds != null) paramsOverride.seconds = a.seconds;
        return {
          exerciseId: a.exerciseId,
          paramsOverride:
            Object.keys(paramsOverride).length > 0 ? paramsOverride : undefined,
        };
      }),
    }));

    setSaving(true);
    try {
      if (isEdit && planId) {
        await replacePlan(patientId, planId, payload);
        message.success('Plan updated.');
      } else {
        await createPlan(patientId, payload);
        message.success('Plan created.');
      }
      navigate(`/patients/${patientId}`, { state: { activeTab: 'plan' } });
    } catch {
      message.error('Failed to save plan.');
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Cancel (with dirty check)
  // -------------------------------------------------------------------------

  const handleCancel = () => {
    if (dirty) {
      Modal.confirm({
        title: 'Discard Changes?',
        content: 'You have unsaved changes. Are you sure you want to leave?',
        okText: 'Discard',
        okButtonProps: { danger: true },
        cancelText: 'Keep Editing',
        onOk: () => navigate(`/patients/${patientId}`),
      });
    } else {
      navigate(`/patients/${patientId}`);
    }
  };

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <Space
        style={{ padding: 48, width: '100%', justifyContent: 'center' }}
      >
        <Spin size="large" />
      </Space>
    );
  }

  // Exclude exercises already in the *current* session (not all sessions),
  // so therapists can reuse the same exercise across different weeks.
  const currentSessionExerciseIds =
    sessions
      .find((s) => s.key === pickerSessionKey)
      ?.assignments.map((a) => a.exerciseId) ?? [];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <PageHeader
        title={isEdit ? 'Edit Treatment Plan' : 'Create Treatment Plan'}
        breadcrumbs={[
          { label: 'Patients', href: '/patients' },
          { label: 'Patient', href: `/patients/${patientId}` },
          { label: isEdit ? 'Edit Plan' : 'New Plan' },
        ]}
        actions={
          <Space>
            <Button onClick={handleCancel}>Cancel</Button>
            <Button type="primary" onClick={handleSave} loading={saving}>
              {isEdit ? 'Save Changes' : 'Save Draft'}
            </Button>
          </Space>
        }
      />

      <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
        {sessions.map((session, sIdx) => (
          <Card
            key={session.key}
            title={
              <Input
                value={session.title}
                onChange={(e) =>
                  updateSession(session.key, { title: e.target.value })
                }
                placeholder="Session title (e.g. Session 1)"
                style={{ width: isMobile ? '100%' : 240 }}
                variant="borderless"
              />
            }
            extra={
              <Space>
                <Button
                  type="text"
                  icon={<ArrowUpOutlined />}
                  disabled={sIdx === 0}
                  onClick={() => moveSession(session.key, 'up')}
                  size="small"
                  aria-label="Move session up"
                />
                <Button
                  type="text"
                  icon={<ArrowDownOutlined />}
                  disabled={sIdx === sessions.length - 1}
                  onClick={() => moveSession(session.key, 'down')}
                  size="small"
                  aria-label="Move session down"
                />
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeSession(session.key)}
                  disabled={sessions.length <= 1}
                  size="small"
                  aria-label="Remove session"
                />
              </Space>
            }
          >
            {/* Session settings row */}
            <Space
              orientation={isMobile ? 'vertical' : 'horizontal'}
              style={{ marginBottom: 16, width: '100%' }}
              size="middle"
            >
              <div>
                <Typography.Text
                  type="secondary"
                  style={{ display: 'block', marginBottom: 4 }}
                >
                  Times per Day
                </Typography.Text>
                <Select
                  value={session.timesPerDay}
                  onChange={(val) =>
                    updateSession(session.key, { timesPerDay: val })
                  }
                  options={[
                    { label: '1×/day', value: 1 },
                    { label: '2×/day', value: 2 },
                    { label: '3×/day', value: 3 },
                  ]}
                  style={{ width: 120 }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <Typography.Text
                  type="secondary"
                  style={{ display: 'block', marginBottom: 4 }}
                >
                  Session Notes
                </Typography.Text>
                <Input.TextArea
                  value={session.sessionNotes}
                  onChange={(e) =>
                    updateSession(session.key, {
                      sessionNotes: e.target.value,
                    })
                  }
                  placeholder="Notes for this session (visible to patient)..."
                  autoSize={{ minRows: 1, maxRows: 3 }}
                />
              </div>
            </Space>

            {/* Assignments list */}
            {session.assignments.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {session.assignments.map((assignment) => (
                  <div
                    key={assignment.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 0',
                      borderBottom: '1px solid #f0f0f0',
                      flexWrap: isMobile ? 'wrap' : 'nowrap',
                    }}
                  >
                    <Typography.Text
                      strong
                      style={{
                        minWidth: isMobile ? '100%' : 180,
                        flex: isMobile ? undefined : 1,
                      }}
                    >
                      {assignment.exerciseTitle}
                      {assignment.mediaId && (
                        <PlayCircleOutlined
                          style={{
                            marginLeft: 8,
                            color: '#6DB6B0',
                            cursor: 'pointer',
                          }}
                          onClick={() =>
                            openVideoPreview(
                              assignment.exerciseTitle,
                              assignment.mediaId!,
                            )
                          }
                          aria-label={`Preview video for ${assignment.exerciseTitle}`}
                        />
                      )}
                    </Typography.Text>
                    <Space size="small" style={{ flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'center' }}>
                        <Typography.Text
                          type="secondary"
                          style={{ display: 'block', fontSize: 12, marginBottom: 2 }}
                        >
                          Reps
                        </Typography.Text>
                        <InputNumber
                          value={assignment.reps}
                          onChange={(val) =>
                            updateAssignment(session.key, assignment.key, {
                              reps: val ?? undefined,
                            })
                          }
                          min={0}
                          style={{ width: 80 }}
                          size="small"
                        />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <Typography.Text
                          type="secondary"
                          style={{ display: 'block', fontSize: 12, marginBottom: 2 }}
                        >
                          Sets
                        </Typography.Text>
                        <InputNumber
                          value={assignment.sets}
                          onChange={(val) =>
                            updateAssignment(session.key, assignment.key, {
                              sets: val ?? undefined,
                            })
                          }
                          min={0}
                          style={{ width: 80 }}
                          size="small"
                        />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <Typography.Text
                          type="secondary"
                          style={{ display: 'block', fontSize: 12, marginBottom: 2 }}
                        >
                          Sec
                        </Typography.Text>
                        <InputNumber
                          value={assignment.seconds}
                          onChange={(val) =>
                            updateAssignment(session.key, assignment.key, {
                              seconds: val ?? undefined,
                            })
                          }
                          min={0}
                          style={{ width: 80 }}
                          size="small"
                        />
                      </div>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() =>
                          removeAssignment(session.key, assignment.key)
                        }
                        size="small"
                        aria-label={`Remove ${assignment.exerciseTitle}`}
                      />
                    </Space>
                  </div>
                ))}
              </div>
            )}

            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => openExercisePicker(session.key)}
              block
            >
              Add Exercise
            </Button>
          </Card>
        ))}

        {/* Add session button */}
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addSession}
          block
          style={{ height: 48 }}
        >
          Add Session
        </Button>
      </Space>

      {/* Exercise picker modal */}
      <ExercisePickerModal
        open={pickerOpen}
        onSelect={handleExerciseSelected}
        onCancel={() => {
          setPickerOpen(false);
          setPickerSessionKey(null);
        }}
        excludeIds={currentSessionExerciseIds}
      />

      {/* Video preview modal */}
      <Modal
        title={videoPreview?.title ?? 'Video Preview'}
        open={!!videoPreview}
        onCancel={() => {
          setVideoPreview(null);
          setVideoUrl(null);
        }}
        footer={null}
        width={640}
        destroyOnHidden
      >
        {videoLoading ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: 48,
            }}
          >
            <Spin />
          </div>
        ) : videoUrl ? (
          <video
            src={videoUrl}
            controls
            autoPlay
            style={{
              width: '100%',
              maxHeight: 360,
              borderRadius: 4,
              backgroundColor: '#000',
              display: 'block',
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

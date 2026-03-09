import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Input,
  Select,
  Space,
  Spin,
  Form,
  InputNumber,
  Card,
  message,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getExercise, createExercise, updateExercise } from '../api/exercises';
import { listTaxonomy } from '../api/admin';
import { useAuth } from '../contexts/AuthContext';
import type { TaxonomyTag } from '../types';
import { sortTagsByCategory } from '../utils/taxonomySort';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import VideoUpload from '../components/VideoUpload';

interface ExerciseFormValues {
  title: string;
  description: string;
  tags: string[];
  mediaId?: string;
  reps?: number;
  sets?: number;
  seconds?: number;
}

export default function ExerciseFormPage() {
  const navigate = useNavigate();
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const isEditMode = Boolean(exerciseId);

  const { user } = useAuth();

  // Therapists have read-only access — redirect away from create/edit
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate(exerciseId ? `/exercises/${exerciseId}` : '/exercises', { replace: true });
    }
  }, [user, exerciseId, navigate]);

  const [form] = Form.useForm<ExerciseFormValues>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [taxonomyTags, setTaxonomyTags] = useState<TaxonomyTag[]>([]);

  // Load taxonomy tags when user is authenticated
  useEffect(() => {
    if (!user) return;
    listTaxonomy()
      .then((tags) => setTaxonomyTags(tags as TaxonomyTag[]))
      .catch(() => message.error('Failed to load taxonomy tags.'));
  }, [user]);

  // Fetch existing exercise data in edit mode
  useEffect(() => {
    if (!user || !exerciseId) return;

    setLoading(true);
    getExercise(exerciseId)
      .then((exercise) => {
        form.setFieldsValue({
          title: exercise.title ?? '',
          description: exercise.description ?? '',
          tags: (exercise.tags ?? []).map((t: any) => typeof t === 'string' ? t : t.tagId),
          mediaId: exercise.mediaId,
          reps: exercise.defaultParams?.reps,
          sets: exercise.defaultParams?.sets,
          seconds: exercise.defaultParams?.seconds,
        });
      })
      .catch(() => message.error('Failed to load exercise.'))
      .finally(() => setLoading(false));
  }, [user, exerciseId, form]);

  const handleSave = async (values: ExerciseFormValues) => {
    const { title, description, tags, mediaId, reps, sets, seconds } = values;

    // Validate at least one default parameter
    if (!reps && !sets && !seconds) {
      message.error('At least one default parameter (reps, sets, or seconds) is required.');
      return;
    }

    const defaultParams: { reps?: number; sets?: number; seconds?: number } = {};
    if (reps !== undefined && reps !== null) defaultParams.reps = reps;
    if (sets !== undefined && sets !== null) defaultParams.sets = sets;
    if (seconds !== undefined && seconds !== null) defaultParams.seconds = seconds;

    const payload = {
      title,
      description,
      tagIds: tags ?? [],
      defaultParams,
      mediaId,
    };

    setSubmitting(true);
    try {
      if (isEditMode && exerciseId) {
        await updateExercise(exerciseId, payload);
        message.success('Exercise updated successfully.');
        navigate(`/exercises/${exerciseId}`);
      } else {
        const result = await createExercise(payload);
        message.success('Exercise created successfully.');
        navigate(`/exercises/${result.exerciseId}`);
      }
    } catch {
      message.error(isEditMode ? 'Failed to update exercise.' : 'Failed to create exercise.');
    } finally {
      setSubmitting(false);
    }
  };

  // Build grouped tag options for Select (age tags sorted numerically)
  const tagOptionsByCategory = sortTagsByCategory(taxonomyTags);

  const tagSelectOptions = Object.entries(tagOptionsByCategory).map(([category, tags]) => ({
    label: category.charAt(0).toUpperCase() + category.slice(1),
    options: tags.map((t) => ({ label: t.label, value: t.tagId })),
  }));

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={isEditMode ? 'Edit Exercise' : 'New Exercise'}
        breadcrumbs={[
          { label: 'Exercise Library', href: '/exercises' },
          { label: isEditMode ? 'Edit Exercise' : 'New Exercise' },
        ]}
      />

      <SectionCard>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{ tags: [] }}
        >
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter a title.' }]}
          >
            <Input placeholder="e.g. Shoulder External Rotation" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter a description.' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Describe the exercise, including any technique cues or safety notes..."
            />
          </Form.Item>

          <Form.Item
            name="mediaId"
            label="Exercise Video"
            rules={[{ required: true, message: 'Please upload an exercise video.' }]}
          >
            <VideoUpload />
          </Form.Item>

          <Form.Item name="tags" label="Tags">
            <Select
              mode="multiple"
              placeholder="Select tags"
              options={tagSelectOptions}
              allowClear
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Card
            type="inner"
            title="Default Parameters"
            style={{ marginBottom: 24 }}
          >
            <Space size={24} wrap>
              <Form.Item name="reps" label="Reps" style={{ marginBottom: 0 }}>
                <InputNumber min={1} max={999} placeholder="e.g. 10" style={{ width: 120 }} />
              </Form.Item>
              <Form.Item name="sets" label="Sets" style={{ marginBottom: 0 }}>
                <InputNumber min={1} max={99} placeholder="e.g. 3" style={{ width: 120 }} />
              </Form.Item>
              <Form.Item name="seconds" label="Seconds" style={{ marginBottom: 0 }}>
                <InputNumber min={1} max={3600} placeholder="e.g. 30" style={{ width: 120 }} />
              </Form.Item>
            </Space>
          </Card>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
              >
                Save
              </Button>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() =>
                  isEditMode && exerciseId
                    ? navigate(`/exercises/${exerciseId}`)
                    : navigate('/exercises')
                }
                disabled={submitting}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </SectionCard>
    </>
  );
}

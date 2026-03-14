import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Descriptions,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { EditOutlined, DeleteOutlined, UndoOutlined } from '@ant-design/icons';
import { getExercise, archiveExercise, restoreExercise } from '../api/exercises';
import { getAccessUrl } from '../api/uploads';
import { listTaxonomy } from '../api/admin';
import { useAuth } from '../contexts/AuthContext';
import type { Exercise, TaxonomyTag } from '../types';
import { sortTagsByCategory } from '../utils/taxonomySort';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatusTag from '../components/StatusTag';

export default function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [taxonomyTags, setTaxonomyTags] = useState<TaxonomyTag[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchExercise = useCallback(async () => {
    if (!exerciseId) return;
    setLoading(true);
    try {
      const data = await getExercise(exerciseId);
      setExercise(data);

      // Fetch signed video URL if mediaId exists
      if (data.mediaId) {
        try {
          const accessRes = await getAccessUrl(data.mediaId);
          setVideoUrl(accessRes.accessUrl);
        } catch {
          // Video URL unavailable — will show placeholder
        }
      }
    } catch {
      message.error('Failed to load exercise.');
    } finally {
      setLoading(false);
    }
  }, [exerciseId]);

  useEffect(() => {
    if (!user) return;
    fetchExercise();
  }, [user, fetchExercise]);

  // Load taxonomy tags for category labels
  useEffect(() => {
    if (!user) return;
    listTaxonomy()
      .then((tags) => setTaxonomyTags(tags as TaxonomyTag[]))
      .catch(() => {});
  }, [user]);

  const handleArchive = async () => {
    if (!exerciseId) return;
    setActionLoading(true);
    try {
      await archiveExercise(exerciseId);
      message.success('Exercise archived.');
      fetchExercise();
    } catch {
      message.error('Failed to archive exercise.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!exerciseId) return;
    setActionLoading(true);
    try {
      await restoreExercise(exerciseId);
      message.success('Exercise restored.');
      fetchExercise();
    } catch {
      message.error('Failed to restore exercise.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Typography.Text type="secondary">
          Exercise not found or failed to load.
        </Typography.Text>
        <div style={{ marginTop: 16 }}>
          <Button onClick={() => navigate('/exercises')}>Back to Exercise Library</Button>
        </div>
      </div>
    );
  }

  const isArchived = Boolean(exercise.archivedAt);
  const isAdmin = user?.role === 'admin';

  // Group tags by category for display
  const groupedTags = sortTagsByCategory(taxonomyTags);

  // Find category label for each exercise tag
  const getCategoryForTag = (tagId: string): string | undefined => {
    for (const [category, tags] of Object.entries(groupedTags)) {
      if (tags.some((t) => t.tagId === tagId)) return category;
    }
    return undefined;
  };

  // Build default params display
  const paramParts: string[] = [];
  if (exercise.defaultParams?.reps) paramParts.push(`${exercise.defaultParams.reps} reps`);
  if (exercise.defaultParams?.sets) paramParts.push(`${exercise.defaultParams.sets} sets`);
  if (exercise.defaultParams?.seconds) paramParts.push(`${exercise.defaultParams.seconds} seconds`);

  return (
    <>
      <PageHeader
        title={exercise.title}
        breadcrumbs={[
          { label: 'Exercise Library', href: '/exercises' },
          { label: exercise.title },
        ]}
        actions={
          isAdmin ? (
            <Space>
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => navigate(`/exercises/${exerciseId}/edit`)}
              >
                Edit
              </Button>
              {isArchived ? (
                <Button
                  icon={<UndoOutlined />}
                  onClick={handleRestore}
                  loading={actionLoading}
                >
                  Restore
                </Button>
              ) : (
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    Modal.confirm({
                      title: 'Archive Exercise',
                      content: `Are you sure you want to archive "${exercise.title}"?`,
                      okText: 'Yes',
                      cancelText: 'No',
                      okButtonProps: { danger: true },
                      onOk: handleArchive,
                    });
                  }}
                  loading={actionLoading}
                >
                  Archive
                </Button>
              )}
            </Space>
          ) : undefined
        }
      />

      {/* Video Section */}
      <SectionCard title="Video">
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            style={{
              width: '100%',
              maxWidth: 640,
              maxHeight: 360,
              borderRadius: 4,
              backgroundColor: '#000',
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
              backgroundColor: '#fafafa',
              borderRadius: 4,
              border: '1px dashed #d9d9d9',
              color: '#999',
            }}
          >
            No video uploaded
          </div>
        )}
      </SectionCard>

      {/* Details Section */}
      <div style={{ marginTop: 16 }}>
      <SectionCard title="Details">
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Description">
            {exercise.description || '—'}
          </Descriptions.Item>

          <Descriptions.Item label="Tags">
            {exercise.tags?.length ? (
              <Space size={4} wrap>
                {exercise.tags.map((tag) => {
                  const category = getCategoryForTag(
                    typeof tag === 'string' ? tag : tag.tagId,
                  );
                  return (
                    <Tag
                      key={typeof tag === 'string' ? tag : tag.tagId}
                      color="blue"
                    >
                      {category && (
                        <span style={{ opacity: 0.6, marginRight: 4 }}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}:
                        </span>
                      )}
                      {typeof tag === 'string' ? tag : tag.label}
                    </Tag>
                  );
                })}
              </Space>
            ) : (
              '—'
            )}
          </Descriptions.Item>

          <Descriptions.Item label="Default Parameters">
            {paramParts.length > 0 ? paramParts.join(', ') : '—'}
          </Descriptions.Item>

          <Descriptions.Item label="Status">
            <StatusTag status={isArchived ? 'archived' : 'active'} />
          </Descriptions.Item>

          <Descriptions.Item label="Created">
            {exercise.createdAt
              ? new Date(exercise.createdAt).toLocaleDateString()
              : '—'}
          </Descriptions.Item>

          {exercise.versions && (
            <Descriptions.Item label="Versions">
              {exercise.versions.length}
            </Descriptions.Item>
          )}
        </Descriptions>
      </SectionCard>
      </div>
    </>
  );
}

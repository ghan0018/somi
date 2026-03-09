import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Select,
  Space,
  Tag,
  Dropdown,
  Modal,
  message,
} from 'antd';
import type { TableColumnsType, MenuProps } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UndoOutlined, MoreOutlined } from '@ant-design/icons';
import {
  listExercises,
  archiveExercise,
  restoreExercise,
} from '../api/exercises';
import { listTaxonomy } from '../api/admin';
import { useAuth } from '../contexts/AuthContext';
import type { TaxonomyTag } from '../types';
import type { Exercise } from '../types';
import { sortTagsByCategory } from '../utils/taxonomySort';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';

// ---------------------------------------------------------------------------
// Tag category colors (on-brand tinted backgrounds with darker text)
// ---------------------------------------------------------------------------

const TAG_CATEGORY_STYLES: Record<string, React.CSSProperties> = {
  function: { backgroundColor: '#EAF5F4', color: '#2C7A7B', borderColor: '#B8DCD9' },
  structure: { backgroundColor: '#E8EEF1', color: '#1B3A4B', borderColor: '#C2D1D9' },
  age: { backgroundColor: '#F5EFE0', color: '#9E7C2E', borderColor: '#E0D1AD' },
};

const CATEGORY_ORDER: Record<string, number> = { function: 0, structure: 1, age: 2 };

export default function ExerciseListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [taxonomyTags, setTaxonomyTags] = useState<TaxonomyTag[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const isAdmin = user?.role === 'admin';

  const fetchExercises = useCallback(async (searchValue: string, tags: string[]) => {
    setLoading(true);
    try {
      const result = await listExercises({
        q: searchValue || undefined,
        tagIds: tags.length ? tags : undefined,
        limit: 100,
      });
      setExercises(result.items);
    } catch {
      message.error('Failed to load exercises.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load taxonomy tags when user is authenticated
  useEffect(() => {
    if (!user) return;
    listTaxonomy()
      .then((tags) => setTaxonomyTags(tags as TaxonomyTag[]))
      .catch(() => message.error('Failed to load taxonomy tags.'));
  }, [user]);

  // Initial fetch when user is authenticated
  useEffect(() => {
    if (!user) return;
    fetchExercises('', []);
  }, [user, fetchExercises]);

  // Debounced re-fetch when search or tag filter changes
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      fetchExercises(search, selectedTags);
    }, 400);
    return () => clearTimeout(timer);
  }, [user, search, selectedTags, fetchExercises]);

  const handleArchive = async (exerciseId: string) => {
    setActionLoading(exerciseId);
    try {
      await archiveExercise(exerciseId);
      message.success('Exercise archived.');
      fetchExercises(search, selectedTags);
    } catch {
      message.error('Failed to archive exercise.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (exerciseId: string) => {
    setActionLoading(exerciseId);
    try {
      await restoreExercise(exerciseId);
      message.success('Exercise restored.');
      fetchExercises(search, selectedTags);
    } catch {
      message.error('Failed to restore exercise.');
    } finally {
      setActionLoading(null);
    }
  };

  // Build grouped tag options for Select (age tags sorted numerically)
  const tagOptionsByCategory = sortTagsByCategory(taxonomyTags);

  const tagSelectOptions = Object.entries(tagOptionsByCategory).map(([category, tags]) => ({
    label: category.charAt(0).toUpperCase() + category.slice(1),
    options: tags.map((t) => ({ label: t.label, value: t.tagId })),
  }));

  // Build a lookup of tagId → category for sorting & coloring
  const tagCategoryMap = new Map(taxonomyTags.map((t) => [t.tagId, t.category]));

  const columns: TableColumnsType<Exercise> = [
    {
      title: 'Title',
      key: 'title',
      width: 200,
      render: (_: unknown, record: Exercise) => record.title || '—',
    },
    {
      title: 'Tags',
      key: 'tags',
      responsive: ['lg'],
      render: (_: unknown, record: Exercise) => {
        const tags = record.tags ?? [];
        if (!tags.length) return '—';

        // Sort: function → structure → age
        const sorted = [...tags].sort((a, b) => {
          const catA = tagCategoryMap.get(typeof a === 'string' ? a : a.tagId) ?? 'age';
          const catB = tagCategoryMap.get(typeof b === 'string' ? b : b.tagId) ?? 'age';
          return (CATEGORY_ORDER[catA] ?? 9) - (CATEGORY_ORDER[catB] ?? 9);
        });

        return (
          <Space size={[4, 4]} wrap style={{ maxWidth: 420 }}>
            {sorted.map((tag) => {
              const tagId = typeof tag === 'string' ? tag : tag.tagId;
              const label = typeof tag === 'string'
                ? (taxonomyTags.find((t) => t.tagId === tag)?.label ?? tag)
                : tag.label;
              const category = tagCategoryMap.get(tagId) ?? 'function';
              const style = TAG_CATEGORY_STYLES[category] ?? TAG_CATEGORY_STYLES.function;

              return (
                <Tag key={tagId} bordered style={style}>
                  {label}
                </Tag>
              );
            })}
          </Space>
        );
      },
    },
    // Actions column — admin only (therapists have read-only access)
    ...(isAdmin
      ? [
          {
            title: 'Actions',
            key: 'actions',
            width: 80,
            render: (_: unknown, record: Exercise) => {
              const isArchived = Boolean(record.archivedAt);
              const items: MenuProps['items'] = [
                {
                  key: 'edit',
                  label: 'Edit',
                  icon: <EditOutlined />,
                  onClick: ({ domEvent }) => {
                    domEvent.stopPropagation();
                    navigate(`/exercises/${record.exerciseId}/edit`);
                  },
                },
                isArchived
                  ? {
                      key: 'restore',
                      label: 'Restore',
                      icon: <UndoOutlined />,
                      onClick: ({ domEvent }) => {
                        domEvent.stopPropagation();
                        handleRestore(record.exerciseId);
                      },
                    }
                  : {
                      key: 'archive',
                      label: 'Archive',
                      icon: <DeleteOutlined />,
                      danger: true,
                      onClick: ({ domEvent }) => {
                        domEvent.stopPropagation();
                        Modal.confirm({
                          title: 'Archive Exercise',
                          content: `Are you sure you want to archive "${record.title}"?`,
                          okText: 'Yes',
                          cancelText: 'No',
                          okButtonProps: { danger: true },
                          onOk: () => handleArchive(record.exerciseId),
                        });
                      },
                    },
              ];

              return (
                <Dropdown menu={{ items }} trigger={['click']} disabled={actionLoading === record.exerciseId}>
                  <Button
                    type="text"
                    icon={<MoreOutlined />}
                    loading={actionLoading === record.exerciseId}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Dropdown>
              );
            },
          } as TableColumnsType<Exercise>[number],
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Exercise Library"
        actions={
          <Space wrap>
            <Input.Search
              placeholder="Search exercises..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={(val) => setSearch(val)}
              allowClear
              style={{ width: '100%', maxWidth: 280, minWidth: 160 }}
            />
            <Select
              mode="multiple"
              placeholder="Filter by tags"
              value={selectedTags}
              onChange={setSelectedTags}
              options={tagSelectOptions}
              allowClear
              style={{ width: '100%', maxWidth: 280, minWidth: 160 }}
              maxTagCount="responsive"
            />
            {isAdmin && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/exercises/new')}
              >
                New Exercise
              </Button>
            )}
          </Space>
        }
      />

      <DataTable<Exercise>
        rowKey="exerciseId"
        columns={columns}
        dataSource={exercises}
        loading={loading}
        onRow={(record) => ({
          onClick: () => navigate(`/exercises/${record.exerciseId}`),
          style: { cursor: 'pointer' },
        })}
      />
    </>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Modal, Input, Table, Space, Tag, Select, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { listExercises } from '../api/exercises';
import { listTaxonomy } from '../api/admin';
import { sortTagsByCategory } from '../utils/taxonomySort';
import type { Exercise, TaxonomyTag } from '../types';

interface ExercisePickerModalProps {
  open: boolean;
  onSelect: (exercise: Exercise) => void;
  onCancel: () => void;
  /** Exercise IDs already added — shown greyed-out or excluded */
  excludeIds?: string[];
}

/**
 * Modal for browsing and selecting an exercise from the library.
 *
 * Provides a search bar, tag filter, and paginated table. Clicking a row
 * triggers `onSelect` with the full Exercise object.
 */
export default function ExercisePickerModal({
  open,
  onSelect,
  onCancel,
  excludeIds = [],
}: ExercisePickerModalProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [taxonomyTags, setTaxonomyTags] = useState<TaxonomyTag[]>([]);

  const fetchExercises = useCallback(async (q: string, tags: string[]) => {
    setLoading(true);
    try {
      const result = await listExercises({
        q: q || undefined,
        tagIds: tags.length ? tags : undefined,
        limit: 100,
      });
      // Only show non-archived exercises
      setExercises(result.items.filter((e) => !e.archivedAt));
    } catch {
      message.error('Failed to load exercises.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch taxonomy when modal opens
  useEffect(() => {
    if (!open) return;
    listTaxonomy()
      .then((tags) => setTaxonomyTags(tags as TaxonomyTag[]))
      .catch(() => {});
  }, [open]);

  // Reset and fetch when modal opens
  useEffect(() => {
    if (!open) return;
    setSearch('');
    setSelectedTags([]);
    fetchExercises('', []);
  }, [open, fetchExercises]);

  // Debounced search + tag filter
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => fetchExercises(search, selectedTags), 400);
    return () => clearTimeout(timer);
  }, [open, search, selectedTags, fetchExercises]);

  const excludeSet = new Set(excludeIds);

  // Build grouped tag options (function, structure, age)
  const tagOptionsByCategory = sortTagsByCategory(taxonomyTags);
  const tagSelectOptions = Object.entries(tagOptionsByCategory).map(
    ([category, tags]) => ({
      label: category.charAt(0).toUpperCase() + category.slice(1),
      options: tags.map((t) => ({ label: t.label, value: t.tagId })),
    }),
  );

  const columns: TableColumnsType<Exercise> = [
    {
      title: 'Exercise',
      key: 'title',
      render: (_: unknown, record: Exercise) => record.title,
    },
    {
      title: 'Tags',
      key: 'tags',
      responsive: ['md'],
      render: (_: unknown, record: Exercise) => {
        const tags = record.tags ?? [];
        if (!tags.length) return '—';
        return (
          <Space size={[4, 4]} wrap>
            {tags.map((tag) => (
              <Tag key={tag.tagId}>{tag.label}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Defaults',
      key: 'defaults',
      width: 150,
      render: (_: unknown, record: Exercise) => {
        const p = record.defaultParams ?? {};
        const parts: string[] = [];
        if (p.reps) parts.push(`${p.reps} reps`);
        if (p.sets) parts.push(`${p.sets} sets`);
        if (p.seconds) parts.push(`${p.seconds}s`);
        return parts.join(', ') || '—';
      },
    },
  ];

  const filteredExercises = exercises.filter(
    (e) => !excludeSet.has(e.exerciseId),
  );

  return (
    <Modal
      title="Select Exercise"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={720}
      destroyOnHidden
    >
      <Input.Search
        placeholder="Search exercises..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ marginBottom: 12 }}
      />
      <Select
        mode="multiple"
        placeholder="Filter by tags"
        value={selectedTags}
        onChange={setSelectedTags}
        options={tagSelectOptions}
        allowClear
        style={{ width: '100%', marginBottom: 16 }}
        maxTagCount="responsive"
      />
      <Table<Exercise>
        rowKey="exerciseId"
        columns={columns}
        dataSource={filteredExercises}
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        size="small"
        onRow={(record) => ({
          onClick: () => onSelect(record),
          style: { cursor: 'pointer' },
        })}
      />
    </Modal>
  );
}

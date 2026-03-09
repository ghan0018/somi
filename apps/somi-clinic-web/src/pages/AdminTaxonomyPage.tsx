import { useState, useEffect } from 'react';
import {
  Button,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Tooltip,
  message,
  Popconfirm,
  Divider,
  Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  listTaxonomy,
  createTag,
  deleteTag,
} from '../api/admin';
import { useAuth } from '../contexts/AuthContext';
import { TaxonomyTag } from '../types';
import { sortTagsByCategory } from '../utils/taxonomySort';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import FormModal from '../components/FormModal';

interface AddTagFormValues {
  category: 'function' | 'structure' | 'age';
  label: string;
}

export default function AdminTaxonomyPage() {
  const { user } = useAuth();
  const [tags, setTags] = useState<TaxonomyTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm<AddTagFormValues>();

  const fetchTags = async () => {
    setLoading(true);
    try {
      const result = await listTaxonomy();
      setTags(result);
    } catch (error) {
      message.error('Failed to load taxonomy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchTags();
  }, [user]);

  const handleAddTag = async (values: AddTagFormValues) => {
    try {
      await createTag({
        category: values.category,
        label: values.label,
      });
      message.success('Tag added successfully');
      form.resetFields();
      setIsModalVisible(false);
      fetchTags();
    } catch (error) {
      message.error((error as any).message || 'Failed to add tag');
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await deleteTag(tagId);
      message.success('Tag deleted successfully');
      fetchTags();
    } catch (error) {
      message.error((error as any).message || 'Failed to delete tag');
    }
  };

  const groupedTags = sortTagsByCategory(tags) as Record<
    'function' | 'structure' | 'age',
    TaxonomyTag[]
  >;

  const categories: Array<'function' | 'structure' | 'age'> = [
    'function',
    'structure',
    'age',
  ];

  const categoryLabels: Record<string, string> = {
    function: 'Function',
    structure: 'Structure',
    age: 'Age',
  };

  return (
    <>
      <PageHeader
        title="Exercise Labels"
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalVisible(true)}
          >
            Add Tag
          </Button>
        }
      />

      <SectionCard>
        <div>
          {categories.map((category, index) => (
            <div key={category}>
              <Typography.Title level={4}>{categoryLabels[category]}</Typography.Title>
              <Space wrap style={{ marginBottom: 24 }}>
                {(groupedTags[category] || []).map((tag) =>
                  tag.inUse ? (
                    <Tooltip key={tag.tagId} title="Used by exercises">
                      <Tag>{tag.label}</Tag>
                    </Tooltip>
                  ) : (
                    <Popconfirm
                      key={tag.tagId}
                      title="Delete Tag"
                      description={`Are you sure you want to delete "${tag.label}"?`}
                      onConfirm={() => handleDeleteTag(tag.tagId)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Tag
                        closable
                        onClick={(e) => e.preventDefault()}
                        style={{ cursor: 'pointer' }}
                      >
                        {tag.label}
                      </Tag>
                    </Popconfirm>
                  )
                )}
              </Space>
              {index < categories.length - 1 && <Divider />}
            </div>
          ))}
        </div>
      </SectionCard>

      <FormModal
        title="Add Tag"
        open={isModalVisible}
        onOk={form.submit}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        okText="OK"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddTag}
        >
          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: 'Category is required' }]}
          >
            <Select
              options={[
                { label: 'Function', value: 'function' },
                { label: 'Structure', value: 'structure' },
                { label: 'Age', value: 'age' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="label"
            label="Label"
            rules={[{ required: true, message: 'Label is required' }]}
          >
            <Input placeholder="Tag label" />
          </Form.Item>
        </Form>
      </FormModal>
    </>
  );
}

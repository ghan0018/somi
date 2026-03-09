import { InboxOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

export default function InboxPage() {
  return (
    <>
      <PageHeader title="Inbox" />
      <EmptyState
        icon={<InboxOutlined />}
        title="No messages yet"
        description="Messages from patients will appear here."
      />
    </>
  );
}

import { Table } from 'antd';
import type { TableProps } from 'antd';

interface DataTableProps<T extends object> extends TableProps<T> {
  /**
   * Number of rows per page. Defaults to 20.
   */
  pageSize?: number;
}

/**
 * Thin wrapper around antd Table that applies consistent SOMI defaults:
 * - 20 rows per page (overridable via `pageSize`)
 * - Hides the page-size changer to keep the UI clean
 * - Enables horizontal scroll so columns never overflow the viewport
 *
 * All standard TableProps are forwarded unchanged.
 */
export default function DataTable<T extends object>({
  pageSize = 20,
  pagination,
  scroll,
  ...rest
}: DataTableProps<T>) {
  const mergedPagination =
    pagination === false
      ? false
      : {
          pageSize,
          showSizeChanger: false,
          // Allow callers to further override pagination options
          ...(typeof pagination === 'object' ? pagination : {}),
        };

  // Default to horizontal auto-scroll so tables don't blow out the layout.
  // Callers can override via the `scroll` prop.
  const mergedScroll = { x: 'max-content' as const, ...scroll };

  return <Table<T> pagination={mergedPagination} scroll={mergedScroll} {...rest} />;
}

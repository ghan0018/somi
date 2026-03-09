import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TableColumnsType } from 'antd';
import React from 'react';
import DataTable from '../DataTable';

interface Row {
  id: number;
  name: string;
}

const columns: TableColumnsType<Row> = [
  { title: 'ID', dataIndex: 'id', key: 'id' },
  { title: 'Name', dataIndex: 'name', key: 'name' },
];

const data: Row[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

describe('DataTable', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <DataTable<Row> rowKey="id" columns={columns} dataSource={[]} />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders row data', () => {
    render(<DataTable<Row> rowKey="id" columns={columns} dataSource={data} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<DataTable<Row> rowKey="id" columns={columns} dataSource={[]} />);
    // With scroll.x enabled, Ant Design renders both <th> and a hidden measure <div>
    // for each column header, so we use getAllByText.
    expect(screen.getAllByText('ID').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Name').length).toBeGreaterThan(0);
  });
});

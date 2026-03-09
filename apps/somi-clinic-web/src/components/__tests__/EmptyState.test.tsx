import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders without crashing', () => {
    const { container } = render(<EmptyState title="No results" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders the title', () => {
    render(<EmptyState title="No exercises found" />);
    expect(screen.getByText('No exercises found')).toBeInTheDocument();
  });

  it('renders description and action when provided', () => {
    render(
      <EmptyState
        title="Nothing here"
        description="Add your first item to get started."
        action={<button>Add Item</button>}
      />
    );
    expect(screen.getByText('Add your first item to get started.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
  });
});

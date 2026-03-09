import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import FormModal from '../FormModal';

describe('FormModal', () => {
  it('renders without crashing when open', () => {
    const { container } = render(
      <FormModal
        title="Test Modal"
        open
        onCancel={vi.fn()}
        onOk={vi.fn()}
      >
        <p>Modal content</p>
      </FormModal>
    );
    expect(container).toBeInTheDocument();
  });

  it('shows the title and children when open', () => {
    render(
      <FormModal
        title="Edit Patient"
        open
        onCancel={vi.fn()}
        onOk={vi.fn()}
      >
        <p>Patient form</p>
      </FormModal>
    );
    expect(screen.getByText('Edit Patient')).toBeInTheDocument();
    expect(screen.getByText('Patient form')).toBeInTheDocument();
  });

  it('uses custom okText when provided', () => {
    render(
      <FormModal
        title="Confirm"
        open
        onCancel={vi.fn()}
        onOk={vi.fn()}
        okText="Create"
      >
        <p>Form</p>
      </FormModal>
    );
    expect(screen.getByText('Create')).toBeInTheDocument();
  });
});

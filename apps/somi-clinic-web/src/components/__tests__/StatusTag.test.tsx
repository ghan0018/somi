import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import StatusTag from '../StatusTag';

describe('StatusTag', () => {
  it('renders without crashing', () => {
    const { container } = render(<StatusTag status="active" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('displays capitalised status text', () => {
    render(<StatusTag status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders "Draft" for draft status', () => {
    render(<StatusTag status="draft" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders "Archived" for archived status', () => {
    render(<StatusTag status="archived" />);
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });
});

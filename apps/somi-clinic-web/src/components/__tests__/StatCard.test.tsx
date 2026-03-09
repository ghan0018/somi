import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import StatCard from '../StatCard';

describe('StatCard', () => {
  it('renders without crashing', () => {
    const { container } = render(<StatCard label="Patients" value={42} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders the label and value', () => {
    render(<StatCard label="Active Sessions" value={7} />);
    expect(screen.getByText('Active Sessions')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders the icon when provided', () => {
    render(
      <StatCard label="Total" value={100} icon={<span data-testid="icon">*</span>} />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SectionCard from '../SectionCard';

describe('SectionCard', () => {
  it('renders without crashing', () => {
    const { container } = render(<SectionCard>Content</SectionCard>);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders the title and sectionLabel when provided', () => {
    render(
      <SectionCard title="Patient Info" sectionLabel="Overview">
        <p>Details here</p>
      </SectionCard>
    );
    expect(screen.getByText('Patient Info')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<SectionCard><span>Child content</span></SectionCard>);
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });
});

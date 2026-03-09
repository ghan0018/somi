import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import PageHeader from '../PageHeader';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('PageHeader', () => {
  it('renders the title', () => {
    renderWithRouter(<PageHeader title="Patients" />);
    expect(screen.getByText('Patients')).toBeInTheDocument();
  });

  it('renders breadcrumbs when provided', () => {
    renderWithRouter(
      <PageHeader
        title="Patient Detail"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Patients', href: '/patients' },
          { label: 'Current Patient' },
        ]}
      />
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Patients')).toBeInTheDocument();
    expect(screen.getByText('Current Patient')).toBeInTheDocument();
  });

  it('renders actions slot when provided', () => {
    renderWithRouter(
      <PageHeader title="Exercises" actions={<button>New Exercise</button>} />
    );
    expect(screen.getByRole('button', { name: 'New Exercise' })).toBeInTheDocument();
  });
});
